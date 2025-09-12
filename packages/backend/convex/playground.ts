/**
 * Playground configuration for testing and debugging AI agents
 * Provides a UI for inspecting threads, messages, and tool calls
 * 
 * Access the playground:
 * 1. Generate an API key: yarn convex run --component agent apiKeys:issue '{name:"playground"}'
 * 2. Visit hosted version: https://get-convex.github.io/agent/
 * 3. Or run locally: yarn playground:local
 */

import { definePlaygroundAPI } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { 
  summaryAgent, 
  notesAgent, 
  researchAgent, 
  analysisAgent, 
  creativeAgent,
  demoMathAgent 
} from "./agents/playgroundAgents";

/**
 * Define the Playground API
 * This exposes the necessary functions for the playground UI to interact with our agents
 * Authorization is handled by API keys generated via CLI
 * 
 * All 6 defined agents are available in the playground:
 * - Summary Agent: Creates concise summaries
 * - Notes Agent: Manages notes with CRUD operations
 * - Research Agent: Explores and researches topics
 * - Analysis Agent: Analyzes data and patterns
 * - Creative Agent: Creative writing and ideation
 * - Demo Math Agent: Mathematical operations demonstration
 */
export const {
  isApiKeyValid,
  listAgents,
  listUsers,
  listThreads,
  listMessages,
  createThread,
  generateText,
  fetchPromptContext,
} = definePlaygroundAPI(components.agent, {
  // List all available agents for the playground
  agents: [
    summaryAgent,
    notesAgent,
    researchAgent,
    analysisAgent,
    creativeAgent,
    demoMathAgent,
  ],
});