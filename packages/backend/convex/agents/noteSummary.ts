import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { getDefaultConfig } from "./config";
import { getChatModel } from "../ai/models";

// Lazy initialization for the note summary agent
let _noteSummaryAgent: Agent | null = null;

const createNoteSummaryAgent = (): Agent => {
  const chat = getChatModel();
  if (!chat) {
    throw new Error("AI model configuration required for note summary agent");
  }
  
  const defaultConfig = getDefaultConfig();
  
  return new Agent(components.agent, {
    name: "Note Summary Agent",
    languageModel: chat, // Required property for Agent
    instructions: `You are a helpful assistant that creates concise and informative summaries of notes.
      Your summaries should:
      - Capture the key points and main ideas
      - Be clear and well-structured
      - Highlight any action items or important takeaways
      - Be approximately 20-30% of the original length
      - Maintain the tone and context of the original note
      
      Provide ONLY the summary text without any JSON formatting or wrapper.`,
    ...defaultConfig,
  });
};

// Export a getter function for lazy initialization
export const getNoteSummaryAgent = (): Agent => {
  if (!_noteSummaryAgent) {
    _noteSummaryAgent = createNoteSummaryAgent();
  }
  return _noteSummaryAgent;
};

// Expose the main summary generation action as a lazy function
// This prevents import-time execution
export const generateSummary = () => {
  return getNoteSummaryAgent().asTextAction({
    stream: false,
    contextOptions: { recentMessages: 0 },
    storageOptions: { saveMessages: "none" },
  });
};