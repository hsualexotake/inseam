import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { defaultConfig } from "./config";

// Create the agent directly - following Convex documentation pattern
export const noteSummaryAgent = new Agent(components.agent, {
  name: "Note Summary Agent",
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

// Expose the main summary generation action
// This can be called directly from internal actions
export const generateSummary = noteSummaryAgent.asTextAction();