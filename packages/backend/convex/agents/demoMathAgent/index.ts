/**
 * Demo Math Agent Module
 * Exports the complete agent configuration with math tools
 */

import type { AgentModule } from "../core/types";
import { config } from "./config";
import { mathTools } from "./tools";

// Export the agent module with configuration and tools
const demoMathAgent: AgentModule = {
  config,
  tools: mathTools,
};

export default demoMathAgent;