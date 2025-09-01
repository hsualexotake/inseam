/**
 * Helper function for executing agents with threads
 * Follows Convex best practices for code reusability
 */

import { createThread } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { AgentFactory, type AgentType } from "../index";
import type { ActionCtx } from "../../_generated/server";

export type AgentThreadOptions = {
  userId: string;
  agentType: AgentType;
  title: string;
  metadata?: Record<string, any>;
};

/**
 * Execute an agent with automatic thread creation
 * Ensures all agent interactions are tracked in threads for:
 * - Playground visibility
 * - Conversation history
 * - Debugging and monitoring
 * 
 * @param ctx - Action context
 * @param options - Thread configuration options
 * @param prompt - The prompt to send to the agent
 * @returns Result and threadId for reference
 */
export async function executeWithAgentThread(
  ctx: ActionCtx,
  options: AgentThreadOptions,
  prompt: string
): Promise<{
  result: any;
  threadId: string;
  text: string;
  usage?: { totalTokens?: number };
}> {
  // Create agent using factory
  const agent = await AgentFactory.create(options.agentType);
  
  // Create thread for visibility and history
  const threadId = await createThread(ctx, components.agent, {
    userId: options.userId,
    title: options.title
    // Note: metadata is not supported by createThread
    // Could store metadata separately if needed
  });
  
  // Execute with thread
  const result = await agent.generateText(
    ctx,
    { threadId, userId: options.userId },
    { prompt }
  );
  
  return { 
    result, 
    threadId,
    text: result.text,
    usage: result.usage
  };
}