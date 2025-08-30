import type { AgentModule } from "../core/types";
import { config } from "./config";
import { noteTools } from "./tools";

// Export the agent module
const notesAgent: AgentModule = {
  config,
  tools: noteTools,
};

export default notesAgent;