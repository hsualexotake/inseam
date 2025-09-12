/**
 * Math tools for the demo math agent
 * 
 * NOTE: This demonstrates a mixed approach where some tools are imported from shared
 * (roundNumber, percentageCalculator) while others remain agent-specific.
 * This is for demonstration purposes to show both patterns working together.
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import type { ToolCtx } from "@convex-dev/agent";

// Import shared math tools that are generally useful across agents
import { roundNumber, percentageCalculator } from "../tools/shared/math";

/**
 * Tool to calculate basic arithmetic expressions
 */
export const calculateExpression = createTool({
  description: "Calculate basic arithmetic operations (add, subtract, multiply, divide)",
  args: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
    operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("The operation to perform")
  }),
  handler: async (ctx: ToolCtx, { a, b, operation }): Promise<{
    a: number;
    b: number;
    operation: string;
    result: number;
    expression: string;
  }> => {
    let result: number;
    let symbol: string;
    
    switch (operation) {
      case "add":
        result = a + b;
        symbol = "+";
        break;
      case "subtract":
        result = a - b;
        symbol = "-";
        break;
      case "multiply":
        result = a * b;
        symbol = "×";
        break;
      case "divide":
        if (b === 0) {
          throw new Error("Cannot divide by zero");
        }
        result = a / b;
        symbol = "÷";
        break;
    }
    
    return {
      a,
      b,
      operation,
      result,
      expression: `${a} ${symbol} ${b} = ${result}`
    };
  }
});

/**
 * Tool to compare two numbers
 */
export const compareNumbers = createTool({
  description: "Compare two numbers and provide analysis",
  args: z.object({
    a: z.number().describe("First number to compare"),
    b: z.number().describe("Second number to compare")
  }),
  handler: async (ctx: ToolCtx, { a, b }): Promise<{
    a: number;
    b: number;
    comparison: "greater" | "less" | "equal";
    difference: number;
    ratio: number | null;
    summary: string;
  }> => {
    let comparison: "greater" | "less" | "equal";
    
    if (a > b) {
      comparison = "greater";
    } else if (a < b) {
      comparison = "less";
    } else {
      comparison = "equal";
    }
    
    const difference = Math.abs(a - b);
    const ratio = b !== 0 ? a / b : null;
    
    let summary: string;
    if (comparison === "equal") {
      summary = `${a} is equal to ${b}`;
    } else if (comparison === "greater") {
      summary = `${a} is greater than ${b} by ${difference}`;
    } else {
      summary = `${a} is less than ${b} by ${difference}`;
    }
    
    return {
      a,
      b,
      comparison,
      difference,
      ratio,
      summary
    };
  }
});

/**
 * Tool to perform floor and ceiling operations
 */
export const floorCeil = createTool({
  description: "Round a number down (floor) or up (ceiling) to the nearest integer",
  args: z.object({
    number: z.number().describe("The number to round"),
    operation: z.enum(["floor", "ceil"]).describe("Operation: 'floor' to round down, 'ceil' to round up")
  }),
  handler: async (ctx: ToolCtx, { number, operation }): Promise<{
    original: number;
    result: number;
    operation: string;
    description: string;
  }> => {
    const result = operation === "floor" ? Math.floor(number) : Math.ceil(number);
    const description = operation === "floor" 
      ? `Rounded ${number} down to ${result}`
      : `Rounded ${number} up to ${result}`;
    
    return {
      original: number,
      result,
      operation,
      description
    };
  }
});

// Export all math tools as a collection
// This includes both shared tools (imported) and agent-specific tools (defined here)
export const mathTools = {
  // Shared tools (imported from shared/math)
  roundNumber,           // Generally useful rounding
  percentageCalculator,  // Generally useful percentage calculations
  
  // Agent-specific tools (defined in this file)
  calculateExpression,   // More specific to math agent
  compareNumbers,        // More specific to math agent
  floorCeil,            // More specific to math agent
};