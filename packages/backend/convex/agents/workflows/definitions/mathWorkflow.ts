/**
 * Demo Math Workflow
 * 
 * Demonstrates a multi-step workflow using multiple agents
 * This workflow:
 * 1. Performs calculations using demoMath agent
 * 2. Creates a summary using summary agent
 */

import { v } from "convex/values";
import { internal } from "../../../_generated/api";
import { workflow } from "../manager";

/**
 * Math analysis workflow definition
 * This demonstrates how to coordinate multiple agents in a workflow
 */
export const mathAnalysisWorkflow = workflow.define({
  args: {
    calculations: v.array(v.object({
      operation: v.string(),
      description: v.string(),
    })),
    userId: v.string(),
  },
  handler: async (step, { calculations, userId }): Promise<any> => {
    // Step 1: Perform calculations using demoMath agent
    // This will create a new thread and return the threadId
    const calculationResults = await step.runAction(
      internal.agents.workflows.actions.mathActions.performCalculations,
      { calculations, userId }
    );
    
    // Step 2: Create a summary using summary agent
    // Pass the threadId from step 1 to maintain conversation continuity
    const summaryResults = await step.runAction(
      internal.agents.workflows.actions.mathActions.createSummary,
      {
        calculations: calculationResults,
        userId,
        threadId: calculationResults.threadId
      }
    );
    
    // Return complete workflow results
    return {
      status: 'completed',
      threadId: calculationResults.threadId,
      steps: {
        calculations: calculationResults,
        summary: summaryResults,
      },
      totalTokensUsed: 
        (calculationResults.totalTokens || 0) +
        (summaryResults.usage?.totalTokens || 0),
    };
  },
});

/**
 * Simple math operations workflow
 * This demonstrates using just the demoMath agent for a series of calculations
 */
export const simpleMathWorkflow = workflow.define({
  args: {
    numbers: v.array(v.number()),
    userId: v.string(),
  },
  handler: async (step, { numbers, userId }): Promise<any> => {
    const calculations = [
      {
        operation: `Round ${numbers[0]} to 2 decimal places`,
        description: "Rounding operation",
      },
      {
        operation: `What is 15% of ${numbers[1]}?`,
        description: "Percentage calculation",
      },
      {
        operation: `Compare ${numbers[0]} and ${numbers[1]}`,
        description: "Number comparison",
      },
    ];
    
    // Use the math agent for all calculations
    const results = await step.runAction(
      internal.agents.workflows.actions.mathActions.performCalculations,
      { calculations, userId }
    );
    
    return {
      status: 'completed',
      threadId: results.threadId,
      calculations: results.calculations,
      totalTokens: results.totalTokens,
    };
  },
});

