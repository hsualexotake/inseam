import type { AgentModule } from "../core/types";
import { config } from "./config";

// Export the agent module
const researchAgent: AgentModule = {
  config,
  // Research agent can use note tools for knowledge management
  // Additional research-specific tools can be added here later
  tools: {},
};

export default researchAgent;