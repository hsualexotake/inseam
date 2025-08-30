import type { AgentModule } from "../core/types";
import { config } from "./config";

// Export the agent module
const summaryAgent: AgentModule = {
  config,
  tools: {}, // Summary agent doesn't need special tools
};

export default summaryAgent;