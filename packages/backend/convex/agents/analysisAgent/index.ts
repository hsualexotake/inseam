import type { AgentModule } from "../core/types";
import { config } from "./config";

// Export the agent module
const analysisAgent: AgentModule = {
  config,
  // Analysis agent may use note tools for storing insights
  // Additional analysis-specific tools can be added here
  tools: {},
};

export default analysisAgent;