/**
 * Example usage of the AI Agent system
 * This file demonstrates how to use the various agents and features
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { AgentFactory } from "./factory";
import { noteSummaryAgent } from "./noteSummary";
import { noteTools } from "../ai/tools";
import { createThread } from "@convex-dev/agent";
import { components } from "../_generated/api";

/**
 * Example 1: Using the Note Summary Agent directly
 */
export const exampleNoteSummary = action({
  args: {
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { title, content }) => {
    // Get user ID
    const auth = await ctx.auth.getUserIdentity();
    const userId = auth?.subject || "demo-user";
    
    // Create a thread for the conversation
    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: `Summary: ${title}`,
    });
    
    // Generate summary
    const prompt = `Summarize this note:\nTitle: ${title}\nContent: ${content}`;
    const result = await noteSummaryAgent.generateText(
      ctx,
      { threadId, userId },
      { prompt }
    );
    
    return {
      summary: result.text,
      threadId,
    };
  },
});

/**
 * Example 2: Using the Agent Factory to create different agents
 */
export const exampleMultipleAgents = action({
  args: {
    text: v.string(),
    analysisType: v.union(
      v.literal("summary"),
      v.literal("analysis"),
      v.literal("creative")
    ),
  },
  handler: async (ctx, { text, analysisType }) => {
    // Get user ID
    const auth = await ctx.auth.getUserIdentity();
    const userId = auth?.subject || "demo-user";
    
    // Create appropriate agent based on analysis type
    const agent = AgentFactory.create(analysisType);
    
    // Create thread
    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: `${analysisType} Analysis`,
    });
    
    // Generate response
    const result = await agent.generateText(
      ctx,
      { threadId, userId },
      { prompt: text }
    );
    
    return {
      result: result.text,
      agentType: analysisType,
      threadId,
    };
  },
});

/**
 * Example 3: Using an agent with tools
 */
export const exampleAgentWithTools = action({
  args: {
    request: v.string(),
  },
  handler: async (ctx, { request }) => {
    // Get user ID
    const auth = await ctx.auth.getUserIdentity();
    const userId = auth?.subject || "demo-user";
    
    // Create a general agent with note tools
    const agentWithTools = AgentFactory.createCustom({
      name: "Assistant with Tools",
      instructions: `You are a helpful assistant with access to note management tools.
        You can search, create, and analyze notes for the user.
        Use the appropriate tools to help with the user's request.`,
      tools: noteTools,
    });
    
    // Create thread
    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: "Tool-enabled Conversation",
    });
    
    // Process request with tools
    const result = await agentWithTools.generateText(
      ctx,
      { threadId, userId },
      { prompt: request }
    );
    
    return {
      response: result.text,
      toolsUsed: result.toolCalls?.length || 0,
      threadId,
    };
  },
});

/**
 * Example 4: Streaming response
 */
export const exampleStreaming = action({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, { prompt }) => {
    // Get user ID
    const auth = await ctx.auth.getUserIdentity();
    const userId = auth?.subject || "demo-user";
    
    // Create agent
    const agent = AgentFactory.create("general");
    
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
          chunking: "word",
          throttleMs: 100,
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

/**
 * Example 5: Chaining multiple agents
 */
export const exampleAgentChain = action({
  args: {
    content: v.string(),
  },
  handler: async (ctx, { content }) => {
    // Get user ID
    const auth = await ctx.auth.getUserIdentity();
    const userId = auth?.subject || "demo-user";
    
    // Create thread
    const threadId = await createThread(ctx, components.agent, {
      userId,
      title: "Multi-Agent Analysis",
    });
    
    // Step 1: Summarize with summary agent
    const summaryAgent = AgentFactory.create("summary");
    const summaryResult = await summaryAgent.generateText(
      ctx,
      { threadId, userId },
      { prompt: `Summarize this content: ${content}` }
    );
    
    // Step 2: Analyze the summary with analysis agent
    const analysisAgent = AgentFactory.create("analysis");
    const analysisResult = await analysisAgent.generateText(
      ctx,
      { threadId, userId },
      { prompt: `Analyze this summary and provide insights: ${summaryResult.text}` }
    );
    
    // Step 3: Create action items with general agent
    const generalAgent = AgentFactory.create("general");
    const actionResult = await generalAgent.generateText(
      ctx,
      { threadId, userId },
      { prompt: `Based on this analysis, suggest 3 action items: ${analysisResult.text}` }
    );
    
    return {
      summary: summaryResult.text,
      analysis: analysisResult.text,
      actionItems: actionResult.text,
      threadId,
    };
  },
});

// Export all examples
export default {
  exampleNoteSummary,
  exampleMultipleAgents,
  exampleAgentWithTools,
  exampleStreaming,
  exampleAgentChain,
};