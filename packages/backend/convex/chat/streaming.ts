import { action, mutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { saveMessage } from "@convex-dev/agent";
import { components, internal } from "../_generated/api";
import { requireAuth } from "../lib/security";
import { AgentFactory, AGENT_TYPES } from "../agents";
import type { AgentType } from "../agents";

// Initiate streaming with saved message (recommended)
export const initiateStreamingMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    agentType: v.optional(v.union(
      v.literal("summary"),
      v.literal("notes"),
      v.literal("research"),
      v.literal("analysis"),
      v.literal("creative")
    )),
  },
  handler: async (ctx, { threadId, prompt, agentType = "summary" }) => {
    const userId = await requireAuth(ctx);

    // Save the user message
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      userId,
      prompt,
    });

    // Schedule async streaming
    await ctx.scheduler.runAfter(0, internal.chat.streaming.streamResponse, {
      threadId,
      promptMessageId: messageId,
      agentType,
      userId,
    });

    return { messageId, threadId };
  },
});

// Internal streaming action
export const streamResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    agentType: v.union(
      v.literal("summary"),
      v.literal("notes"),
      v.literal("research"),
      v.literal("analysis"),
      v.literal("creative")
    ),
    userId: v.string(),
  },
  handler: async (ctx, { threadId, promptMessageId, agentType, userId }) => {
    // Create the appropriate agent
    const agent = await AgentFactory.create(agentType as AgentType);
    
    // Stream the response with delta saving
    const result = await agent.streamText(
      ctx,
      { threadId, userId },
      { promptMessageId },
      {
        saveStreamDeltas: {
          chunking: "word",      // Stream word by word
          throttleMs: 100,       // Update every 100ms
        },
      }
    );
    
    // Consume the stream to ensure it completes
    await result.consumeStream();
    
    return { success: true };
  },
});

// Direct streaming action (for immediate streaming)
export const streamTextDirect = action({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    agentType: v.optional(v.union(
      v.literal("summary"),
      v.literal("notes"),
      v.literal("research"),
      v.literal("analysis"),
      v.literal("creative")
    )),
  },
  handler: async (ctx, { threadId, prompt, agentType = "summary" }) => {
    // Get user ID from auth
    const auth = await ctx.auth.getUserIdentity();
    const userId = auth?.subject;
    
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Create the appropriate agent
    const agent = await AgentFactory.create(agentType as AgentType);
    
    // Stream text with delta saving
    const result = await agent.streamText(
      ctx,
      { threadId, userId },
      { prompt },
      {
        saveStreamDeltas: {
          chunking: "line",      // Stream line by line for this variant
          throttleMs: 50,        // Faster updates
        },
      }
    );
    
    // Consume and return the stream
    await result.consumeStream();
    
    return { 
      success: true,
      threadId,
    };
  },
});

// Stream note summary with real-time updates
export const streamNoteSummary = action({
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

    // Format the prompt
    const prompt = `Please summarize the following note:

Title: ${noteTitle}

Content:
${noteContent}

Provide a concise summary focusing on key points and actionable items.`;

    // Stream using the summary agent from factory
    const summaryAgent = await AgentFactory.create(AGENT_TYPES.SUMMARY);
    const result = await summaryAgent.streamText(
      ctx,
      { threadId, userId },
      { prompt },
      {
        saveStreamDeltas: {
          chunking: "word",      // Stream word by word
          throttleMs: 200,       // Slower updates for readability
        },
      }
    );
    
    // Consume the stream
    await result.consumeStream();
    
    return {
      success: true,
      threadId,
    };
  },
});