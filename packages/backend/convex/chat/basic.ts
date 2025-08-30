import { action, mutation, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { saveMessage } from "@convex-dev/agent";
import { components, internal } from "../_generated/api";
import { requireAuth } from "../lib/security";
import { AgentFactory, AGENT_TYPES } from "../agents";
import type { AgentType } from "../agents";

// Send a message and generate a response (recommended async approach)
export const sendMessage = mutation({
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
// Type annotation needed due to complex type inference
export const generateResponse: ReturnType<typeof internalAction> = internalAction({
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
    // Create the appropriate agent using the factory
    const agent = await AgentFactory.create(agentType as AgentType);
    
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

    // Use the summary agent from factory
    const summaryAgent = await AgentFactory.create(AGENT_TYPES.SUMMARY);
    const result = await summaryAgent.generateText(
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