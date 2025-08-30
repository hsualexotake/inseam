// Main export file for the agent system
// Provides a clean API for the rest of the application

// Core exports
export { AgentFactory, createAgent, createCustomAgent } from "./core/factory";
export type { AgentType, AgentConfig, AgentModule } from "./core/types";

// Tools exports
export { noteTools } from "./notesAgent/tools";

// Constants for agent types
export const AGENT_TYPES = {
  SUMMARY: 'summary' as const,
  NOTES: 'notes' as const,
  RESEARCH: 'research' as const,
  ANALYSIS: 'analysis' as const,
  CREATIVE: 'creative' as const,
};