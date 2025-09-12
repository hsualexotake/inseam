/**
 * Test file for demo math and summary workflow
 * Run this from Convex Dashboard to test the workflow implementation
 */

import { action } from "../../_generated/server";
import { workflow } from "./manager";
import { internal } from "../../_generated/api";

/**
 * Test the math analysis workflow with both demoMath and summary agents
 * This demonstrates multi-agent coordination in a single workflow
 */
export const demoMathSummaryTestWorkflow = action({
  args: {},
  handler: async (ctx): Promise<any> => {
    // Start the workflow with test calculations
    const workflowId = await workflow.start(
      ctx,
      internal.agents.workflows.definitions.mathWorkflow.mathAnalysisWorkflow,
      {
        calculations: [
          { operation: "Round 3.14159 to 2 decimal places", description: "Rounding test" },
          { operation: "What is 15% of 200?", description: "Percentage calculation" },
          { operation: "Calculate 42 + 58", description: "Addition test" },
          { operation: "Compare 100 and 75", description: "Comparison test" },
          { operation: "What is the ceiling of 4.3?", description: "Ceiling function" }
        ],
        userId: "test-user"
      }
    );
    
    // Get workflow status
    const status = await workflow.status(ctx, workflowId);
    
    return {
      workflowId,
      status,
      message: "Workflow started. Check the thread to see both demoMathAgent and summaryAgent working together."
    };
  }
});