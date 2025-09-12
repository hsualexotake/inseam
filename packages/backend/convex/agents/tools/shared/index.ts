/**
 * Shared tools that can be used across multiple agents
 * These are generic, reusable tools that aren't specific to any agent
 */

// Export shared math tools (for demonstration purposes)
export { sharedMathTools, roundNumber, percentageCalculator } from './math';

// Aggregate all shared tools
import { sharedMathTools } from './math';

export const sharedTools = {
  ...sharedMathTools,
  // Add more shared tool collections here as needed
};