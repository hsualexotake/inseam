/**
 * Workflow actions for mathematical operations
 * These actions use agents within workflow steps
 */

import { v } from "convex/values";
import { internalAction } from "../../../_generated/server";
import { AgentFactory } from "../../core/factory";
import { createThread } from "@convex-dev/agent";
import { components } from "../../../_generated/api";

/**
 * Perform calculations using the demoMath agent
 */
export const performCalculations = internalAction({
  args: {
    calculations: v.array(v.object({
      operation: v.string(),
      description: v.string(),
    })),
    userId: v.string(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, { calculations, userId, threadId }) => {
    // Create the demo math agent
    const agent = await AgentFactory.create('demoMath');
    
    // Use provided threadId or create a new thread
    const actualThreadId = threadId || await createThread(ctx, components.agent, {
      userId,
      title: `Math Workflow - ${new Date().toISOString()}`,
    });
    
    // Perform each calculation
    const results = [];
    for (const calc of calculations) {
      const result = await agent.generateText(
        ctx,
        { threadId: actualThreadId, userId },
        { prompt: calc.operation }
      );
      
      results.push({
        operation: calc.operation,
        description: calc.description,
        result: result.text,
        usage: result.usage,
      });
    }
    
    return {
      threadId: actualThreadId,
      calculations: results,
      totalTokens: results.reduce((acc, r) => acc + (r.usage?.totalTokens || 0), 0),
    };
  },
});

/**
 * Create a summary of the workflow using the summary agent
 */
export const createSummary = internalAction({
  args: {
    calculations: v.any(),
    userId: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, { calculations, userId, threadId }) => {
    // Create summary agent
    const agent = await AgentFactory.create('summary');
    
    // Use the provided threadId from previous step
    // This ensures continuity in the same conversation
    
    // Create summary
    const prompt = `Create a concise summary of these mathematical calculations:

Calculations performed:
${JSON.stringify(calculations, null, 2)}

Please provide:
1. A brief overview of all calculations performed
2. The key numerical results
3. A summary statement of what was accomplished`;
    
    const summary = await agent.generateText(
      ctx,
      { threadId, userId },
      { prompt }
    );
    
    return {
      threadId,
      summary: summary.text,
      usage: summary.usage,
    };
  },
});