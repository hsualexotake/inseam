/**
 * Shared mathematical tools that can be used across multiple agents
 * 
 * NOTE: This file is for demonstration purposes to show how shared tools work.
 * These tools were moved from demoMathAgent/tools.ts to demonstrate the shared tools pattern.
 * In a real application, only truly reusable tools should be placed here.
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";

/**
 * Shared tool to round a decimal number to specified decimal places
 * This is a general-purpose mathematical operation that could be useful across agents
 */
export const roundNumber = createTool({
  description: "Round a decimal number to specified decimal places",
  args: z.object({
    number: z.number().describe("The number to round"),
    decimals: z.number().int().min(0).max(10).describe("Number of decimal places (0-10)")
  }),
  handler: async (_ctx: ToolCtx, { number, decimals }): Promise<{
    original: number;
    rounded: number;
    decimals: number;
    operation: string;
  }> => {
    const multiplier = Math.pow(10, decimals);
    const result = Math.round(number * multiplier) / multiplier;
    
    return {
      original: number,
      rounded: result,
      decimals: decimals,
      operation: `Rounded ${number} to ${decimals} decimal places`
    };
  }
});

/**
 * Shared tool to calculate percentages
 * This is another general-purpose operation that multiple agents might need
 */
export const percentageCalculator = createTool({
  description: "Calculate percentages - use this for questions like 'What is X% of Y?', 'Calculate X% of Y', or 'What percent is X of Y?'",
  args: z.object({
    value: z.number().describe("For 'percentOf' mode: the percentage value (e.g., 15 for 15%). For 'whatPercent' mode: the value to compare"),
    total: z.number().describe("The base/total value (e.g., 200 in 'What is 15% of 200?')"),
    mode: z.enum(["percentOf", "whatPercent"]).describe("Use 'percentOf' to calculate X% of Y (e.g., 15% of 200). Use 'whatPercent' to find what % X is of Y")
  }),
  handler: async (_ctx: ToolCtx, { value, total, mode }): Promise<{
    value: number;
    total: number;
    result: number;
    explanation: string;
  }> => {
    let result: number;
    let explanation: string;
    
    if (mode === "percentOf") {
      // Calculate value% of total
      result = (value / 100) * total;
      explanation = `${value}% of ${total} is ${result}`;
    } else {
      // Calculate what percentage value is of total
      if (total === 0) {
        throw new Error("Cannot calculate percentage with total of zero");
      }
      result = (value / total) * 100;
      explanation = `${value} is ${result}% of ${total}`;
    }
    
    return {
      value,
      total,
      result,
      explanation
    };
  }
});

// Export shared math tools as a collection
export const sharedMathTools = {
  roundNumber,
  percentageCalculator,
};