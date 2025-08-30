import type { AgentModule } from "../core/types";
import { config } from "./config";

// Export the agent module
const creativeAgent: AgentModule = {
  config,
  // Creative agent may use various tools for content generation
  // Additional creative-specific tools can be added here
  tools: {},
};

export default creativeAgent;