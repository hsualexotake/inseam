import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "../convex/_generated/api";
import { Auth } from "convex/server";

export const getUserId = async (ctx: { auth: Auth }) => {
  return (await ctx.auth.getUserIdentity())?.subject;
};

// Check if AI models are configured (replacement for openai.openaiKeySet)
export const aiModelsConfigured = query({
  args: {},
  handler: async () => {
    return !!process.env.OPENAI_API_KEY;
  },
});

// Get all notes for a specific user
export const getNotes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const notes = await ctx.db
      .query("notes")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    return notes;
  },
});

// Get note for a specific note
export const getNote = query({
  args: {
    id: v.optional(v.id("notes")),
  },
  handler: async (ctx, args) => {
    const { id } = args;
    if (!id) return null;
    const note = await ctx.db.get(id);
    return note;
  },
});

// Create a new note for a user
export const createNote = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    isSummary: v.boolean(),
  },
  handler: async (ctx, { title, content, isSummary }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("User not found");
    const noteId = await ctx.db.insert("notes", { userId, title, content });

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
      
      // Import the agent directly for internal use
      const { getNoteSummaryAgent } = await import("./agents/noteSummary");
      
      // Format the prompt
      const prompt = `Please provide a concise summary of the following note:

Title: ${title}

Content:
${content}`;
      
      // Generate the summary with proper parameters (ctx, threadOpts, generateTextArgs)
      const result = await getNoteSummaryAgent().generateText(
        ctx, 
        { userId }, // threadOpts - second parameter
        { prompt }  // generateTextArgs - third parameter
      );
      const summary = result.text;
      
      await ctx.runMutation(internal.notes.saveSummaryToNote, {
        noteId,
        summary,
      });
      
      return { success: true, summary };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error generating summary:", error);
      // Save error message as summary
      await ctx.runMutation(internal.notes.saveSummaryToNote, {
        noteId,
        summary: `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
