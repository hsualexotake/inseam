/**
 * Playground-specific agent instances
 * These are created synchronously for use with definePlaygroundAPI
 * They use the same configurations as the factory system but are pre-built
 */

import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { getChatModel } from "../ai/models";

// Import agent configurations directly (not dynamically)
import summaryAgentModule from "./summaryAgent";
import notesAgentModule from "./notesAgent";
import researchAgentModule from "./researchAgent";
import analysisAgentModule from "./analysisAgent";
import creativeAgentModule from "./creativeAgent";

// Get the language model
const languageModel = getChatModel();
if (!languageModel) {
  throw new Error("AI model configuration required. Please check your environment settings.");
}

/**
 * Create agent instances synchronously for playground
 * These use the exact same configurations as the factory system
 */

// Summary Agent - Creates concise summaries
export const summaryAgent = new Agent(components.agent, {
  name: summaryAgentModule.config.name,
  languageModel,
  instructions: summaryAgentModule.config.instructions,
  tools: summaryAgentModule.tools || {},
  ...(summaryAgentModule.config.config || {}),
});

// Notes Agent - Manages user notes with CRUD operations
export const notesAgent = new Agent(components.agent, {
  name: notesAgentModule.config.name,
  languageModel,
  instructions: notesAgentModule.config.instructions,
  tools: notesAgentModule.tools || {},
  ...(notesAgentModule.config.config || {}),
});

// Research Agent - Explores and researches topics
export const researchAgent = new Agent(components.agent, {
  name: researchAgentModule.config.name,
  languageModel,
  instructions: researchAgentModule.config.instructions,
  tools: researchAgentModule.tools || {},
  ...(researchAgentModule.config.config || {}),
});

// Analysis Agent - Analyzes data and patterns
export const analysisAgent = new Agent(components.agent, {
  name: analysisAgentModule.config.name,
  languageModel,
  instructions: analysisAgentModule.config.instructions,
  tools: analysisAgentModule.tools || {},
  ...(analysisAgentModule.config.config || {}),
});

// Creative Agent - Creative writing and ideation
export const creativeAgent = new Agent(components.agent, {
  name: creativeAgentModule.config.name,
  languageModel,
  instructions: creativeAgentModule.config.instructions,
  tools: creativeAgentModule.tools || {},
  ...(creativeAgentModule.config.config || {}),
});