/**
 * Example usage of the AI Agent system
 * Demonstrates key patterns for using agents in your application
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { AgentFactory, AGENT_TYPES } from "./index";
import type { AgentType } from "./index";
import { createThread } from "@convex-dev/agent";
import { components } from "../_generated/api";

/**
 * Example 1: Basic agent usage with factory
 * Shows how to create and use different agent types
 */
export const basicAgentUsage = action({
  args: {
    text: v.string(),
    agentType: v.union(
      v.literal("summary"),
      v.literal("research"),
      v.literal("analysis"),
      v.literal("creative")
    ),
  },
  handler: async (ctx, { text, agentType }) => {
    // Get user ID
    const auth = await ctx.auth.getUserIdentity();
    const userId = auth?.subject || "demo-user";
    
    // Create agent using factory
    const agent = await AgentFactory.create(agentType as AgentType);
    
    // Create thread for conversation history
    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: `${agentType} Session`,
    });
    
    // Generate response
    const result = await agent.generateText(
      ctx,
      { threadId, userId },
      { prompt: text }
    );
    
    return {
      response: result.text,
      agentType,
      threadId,
    };
  },
});

/**
 * Example 3: Streaming responses
 * Shows how to stream agent responses for real-time updates
 */
export const streamingExample = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, { prompt }) => {
    // Get user ID
    const auth = await ctx.auth.getUserIdentity();
    const userId = auth?.subject || "demo-user";
    
    // Create agent
    const agent = await AgentFactory.create(AGENT_TYPES.SUMMARY);
    
    // Create thread
    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: "Streaming Example",
    });
    
    // Stream the response
    const result = await agent.streamText(
      ctx,
      { threadId, userId },
      { prompt },
      {
        saveStreamDeltas: {
          chunking: "word",      // Stream word by word
          throttleMs: 100,       // Update every 100ms
        },
      }
    );
    
    // Consume the stream
    await result.consumeStream();
    
    return {
      success: true,
      threadId,
      message: "Stream completed. Check the thread messages for the response.",
    };
  },
});

// Export all examples
export default {
  basicAgentUsage,
  streamingExample,
};