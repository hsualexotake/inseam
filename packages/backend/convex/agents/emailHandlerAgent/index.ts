import type { AgentModule } from "../core/types";
import { config } from "./config";
import { emailHandlerTools } from "./tools";

// Export the agent module
const emailHandlerAgent: AgentModule = {
  config,
  tools: emailHandlerTools,
};

export default emailHandlerAgent;