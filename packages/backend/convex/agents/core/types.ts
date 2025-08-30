import type { Config } from "@convex-dev/agent";

// Agent type definitions
export type AgentType = 'summary' | 'notes' | 'research' | 'analysis' | 'creative';

// Agent configuration interface
export interface AgentConfig {
  name: string;
  instructions: string;
  tools?: Record<string, any>;
  // Allow extending with Convex Config properties
  config?: Partial<Config>;
}

// Agent module interface - what each agent module should export
export interface AgentModule {
  config: AgentConfig;
  tools?: Record<string, any>;
}

// Registry type for agent modules
export type AgentRegistry = {
  [K in AgentType]: () => Promise<{ default: AgentModule }>;
};