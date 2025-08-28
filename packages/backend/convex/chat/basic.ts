import { action, mutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { saveMessage } from "@convex-dev/agent";
import { components, internal } from "../_generated/api";
import { getUserId } from "../notes";
import { noteSummaryAgent } from "../agents/noteSummary";
import { AgentFactory } from "../agents/factory";

// Send a message and generate a response (recommended async approach)
export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    agentType: v.optional(v.union(
      v.literal("summary"),
      v.literal("general"),
      v.literal("research"),
      v.literal("analysis"),
      v.literal("creative")
    )),
  },
  handler: async (ctx, { threadId, prompt, agentType = "general" }) => {
    const userId = await getUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Save the user message
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      userId,
      prompt,
      skipEmbeddings: true, // Will be generated lazily if needed
    });

    // Schedule async response generation
    await ctx.scheduler.runAfter(0, internal.chat.basic.generateResponse, {
      threadId,
      promptMessageId: messageId,
      agentType,
      userId,
    });

    return { messageId };
  },
});

// Internal action to generate response asynchronously
export const generateResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    agentType: v.union(
      v.literal("summary"),
      v.literal("general"),
      v.literal("research"),
      v.literal("analysis"),
      v.literal("creative")
    ),
    userId: v.string(),
  },
  handler: async (ctx, { threadId, promptMessageId, agentType, userId }) => {
    // Create the appropriate agent using the factory
    const agent = AgentFactory.create(agentType);
    
    // Generate the response
    const result = await agent.generateText(
      ctx,
      { threadId, userId },
      { promptMessageId }
    );
    
    return result;
  },
});

// Direct action for immediate response (simpler but no optimistic updates)
export const generateTextDirect = action({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    agentType: v.optional(v.union(
      v.literal("summary"),
      v.literal("general"),
      v.literal("research"),
      v.literal("analysis"),
      v.literal("creative")
    )),
  },
  handler: async (ctx, { threadId, prompt, agentType = "general" }) => {
    // Get user ID from auth
    const auth = await ctx.auth.getUserIdentity();
    const userId = auth?.subject;
    
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Create the appropriate agent
    const agent = AgentFactory.create(agentType);
    
    // Generate text directly
    const result = await agent.generateText(
      ctx,
      { threadId, userId },
      { prompt }
    );
    
    return result.text;
  },
});

// Generate a note summary specifically
export const generateNoteSummary = action({
  args: {
    threadId: v.string(),
    noteTitle: v.string(),
    noteContent: v.string(),
  },
  handler: async (ctx, { threadId, noteTitle, noteContent }) => {
    // Get user ID from auth
    const auth = await ctx.auth.getUserIdentity();
    const userId = auth?.subject;
    
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Format the prompt for note summarization
    const prompt = `Please summarize the following note:

Title: ${noteTitle}

Content:
${noteContent}`;

    // Use the note summary agent
    const result = await noteSummaryAgent.generateText(
      ctx,
      { threadId, userId },
      { prompt }
    );
    
    // Parse the JSON response
    try {
      const parsed = JSON.parse(result.text);
      return parsed.summary || result.text;
    } catch {
      // If parsing fails, return the raw text
      return result.text;
    }
  },
});