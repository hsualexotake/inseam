import type { AgentRegistry } from "./types";

// Central registry for all agents
// Uses dynamic imports for better code splitting and lazy loading
export const agentRegistry: AgentRegistry = {
  summary: () => import('../summaryAgent'),
  research: () => import('../researchAgent'),
  analysis: () => import('../analysisAgent'),
  creative: () => import('../creativeAgent'),
  demoMath: () => import('../demoMathAgent'),
  emailHandler: () => import('../emailHandlerAgent'),
};

// Helper to get available agent types
export const getAvailableAgents = (): string[] => {
  return Object.keys(agentRegistry);
};

// Helper to check if an agent type exists
export const isValidAgentType = (type: string): boolean => {
  return type in agentRegistry;
};