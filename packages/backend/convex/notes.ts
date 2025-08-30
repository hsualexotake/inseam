import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "../convex/_generated/api";
import { requireAuth, validateNoteInput } from "./lib/security";
import { Auth } from "convex/server";

// Export for backward compatibility
export const getUserId = async (ctx: { auth: Auth }) => {
  return (await ctx.auth.getUserIdentity())?.subject;
};


// Check if AI models are configured - secure query for frontend
export const getAiConfigStatus = query({
  args: {},
  handler: async (ctx) => {
    // For queries, we check auth but return false if not authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    
    // Check configuration without exposing env vars
    const { areModelsConfigured } = await import("./ai/models");
    return areModelsConfigured();
  },
});

// Get all notes for a specific user
export const getNotes = query({
  args: {},
  handler: async (ctx) => {
    // For queries, we return null if not authenticated
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return null;

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return notes;
  },
});

// Get note for a specific note with authorization
export const getNote = query({
  args: {
    id: v.optional(v.id("notes")),
  },
  handler: async (ctx, args) => {
    const { id } = args;
    if (!id) return null;
    
    // Get current user
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return null;
    
    // Get note and verify ownership
    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) {
      return null; // Return null instead of throwing to avoid exposing note existence
    }
    
    return note;
  },
});

// Create a new note for a user with validation
export const createNote = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    isSummary: v.boolean(),
  },
  handler: async (ctx, { title, content, isSummary }) => {
    const userId = await requireAuth(ctx);
    
    // Use security helper for validation
    const { title: validatedTitle, content: validatedContent } = validateNoteInput(title, content);
    
    const noteId = await ctx.db.insert("notes", { 
      userId, 
      title: validatedTitle, 
      content: validatedContent 
    });

    if (isSummary) {
      // Schedule summary generation using the new agent system
      await ctx.scheduler.runAfter(0, internal.notes.generateNoteSummaryWithAgent, {
        noteId,
        title,
        content,
        userId,
      });
    }

    return noteId;
  },
});

export const deleteNote = mutation({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    // Get current user with proper auth check
    const userId = await requireAuth(ctx);
    
    // Verify note ownership before deletion
    const note = await ctx.db.get(args.noteId);
    if (!note) {
      throw new Error("Note not found");
    }
    
    if (note.userId !== userId) {
      throw new Error("Unauthorized: You can only delete your own notes");
    }
    
    await ctx.db.delete(args.noteId);
  },
});

// Internal action to generate note summary using the agent system
export const generateNoteSummaryWithAgent = internalAction({
  args: {
    noteId: v.id("notes"),
    title: v.string(),
    content: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { noteId, title, content, userId }) => {
    try {
      // Check if AI is configured
      const { areModelsConfigured } = await import("./ai/models");
      if (!areModelsConfigured()) {
        await ctx.runMutation(internal.notes.saveSummaryToNote, {
          noteId,
          summary: "AI summary unavailable - OpenAI API key not configured",
        });
        return { success: false, error: "AI not configured" };
      }
      
      // Check rate limit
      await ctx.runMutation(internal.lib.rateLimit.checkRateLimit, {
        userId,
        endpoint: "ai_summary",
      });
      
      // Use the factory to create a summary agent
      const { AgentFactory, AGENT_TYPES } = await import("./agents");
      const summaryAgent = await AgentFactory.create(AGENT_TYPES.SUMMARY);
      
      // Format the prompt
      const prompt = `Please provide a concise summary of the following note:

Title: ${title}

Content:
${content}`;
      
      // Retry logic with exponential backoff
      const MAX_RETRIES = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Generate the summary with proper parameters
          const result = await summaryAgent.generateText(
            ctx, 
            { userId },
            { prompt }
          );
          
          const summary = result.text;
          
          // Track usage for cost monitoring
          const tokens = result.usage?.totalTokens || 0;
          const cost = (tokens / 1000) * 0.0006; // GPT-4o-mini output pricing
          
          await ctx.runMutation(internal.lib.rateLimit.trackUsage, {
            userId,
            tokens,
            cost,
          });
          
          await ctx.runMutation(internal.notes.saveSummaryToNote, {
            noteId,
            summary,
          });
          
          return { success: true, summary };
        } catch (error) {
          lastError = error as Error;
          if (attempt < MAX_RETRIES - 1) {
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
      }
      
      // All retries failed
      throw lastError || new Error("Failed to generate summary after retries");
    } catch {
      // Error has been caught and will be handled by saving generic message
      // In production, this would be logged to a proper logging service
      // For now, we silently handle the error
      
      // Save generic error message (not exposing internal details)
      await ctx.runMutation(internal.notes.saveSummaryToNote, {
        noteId,
        summary: "Failed to generate summary. Please try again later.",
      });
      
      return { success: false, error: "Summary generation failed" };
    }
  },
});

// Internal mutation to save summary to note
export const saveSummaryToNote = internalMutation({
  args: {
    noteId: v.id("notes"),
    summary: v.string(),
  },
  handler: async (ctx, { noteId, summary }) => {
    await ctx.db.patch(noteId, { summary });
  },
});
