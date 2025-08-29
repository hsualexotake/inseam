import { Agent } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { getDefaultConfig } from "./config";
import type { Config } from "@convex-dev/agent";

// Agent type definitions
export type AgentType = 'summary' | 'general' | 'research' | 'analysis' | 'creative';

// Agent configuration interface
export interface AgentConfig extends Partial<Config> {
  name: string;
  instructions: string;
  tools?: Record<string, any>;
}

// Predefined agent configurations
const agentConfigurations: Record<AgentType, Omit<AgentConfig, keyof Config>> = {
  summary: {
    name: "Summary Agent",
    instructions: `You are a helpful assistant that creates concise and informative summaries.
      Focus on capturing key points, main ideas, and actionable items.
      Keep summaries clear, well-structured, and approximately 20-30% of the original length.`,
  },
  general: {
    name: "General Assistant",
    instructions: `You are a helpful, knowledgeable assistant that can help with a wide variety of tasks.
      Be friendly, clear, and thorough in your responses.
      When appropriate, provide step-by-step explanations or examples.`,
  },
  research: {
    name: "Research Agent",
    instructions: `You are a thorough research assistant that helps find and analyze information.
      You excel at:
      - Breaking down complex topics
      - Finding relevant information
      - Providing comprehensive analysis
      - Citing sources when available
      - Identifying knowledge gaps`,
  },
  analysis: {
    name: "Analysis Agent",
    instructions: `You are an analytical assistant specialized in data interpretation and pattern recognition.
      You excel at:
      - Analyzing trends and patterns
      - Providing data-driven insights
      - Creating structured comparisons
      - Identifying correlations
      - Making evidence-based recommendations`,
  },
  creative: {
    name: "Creative Agent",
    instructions: `You are a creative assistant that helps with ideation and content creation.
      You excel at:
      - Brainstorming ideas
      - Writing creative content
      - Suggesting innovative solutions
      - Developing concepts
      - Creating engaging narratives`,
  },
};

/**
 * Factory class for creating AI agents with consistent configuration
 */
export class AgentFactory {
  /**
   * Create a new agent of a specific type
   * @param type - The type of agent to create
   * @param customConfig - Optional custom configuration to override defaults
   * @returns A configured Agent instance
   */
  static create(type: AgentType, customConfig: Partial<AgentConfig> = {}): Agent {
    // Get the base configuration for the agent type
    const baseConfig = agentConfigurations[type];
    
    if (!baseConfig) {
      throw new Error('Unknown agent type provided');
    }

    // Get default configuration (which includes validation)
    const defaultConfig = getDefaultConfig();

    // Merge configurations: default -> type-specific -> custom
    // getDefaultConfig throws if languageModel is not available, so we know it exists
    const finalConfig = {
      ...defaultConfig,
      ...baseConfig,
      ...customConfig,
      name: type, // Add required name field
      languageModel: defaultConfig.languageModel!, // Non-null assertion safe here
      // Merge tools separately to avoid overwriting
      tools: {
        ...baseConfig.tools,
        ...customConfig?.tools,
      },
    };

    // Create and return the agent - no type casting needed
    return new Agent(components.agent, finalConfig);
  }

  /**
   * Create a custom agent with fully specified configuration
   * @param config - Complete agent configuration
   * @returns A configured Agent instance
   */
  static createCustom(config: AgentConfig): Agent {
    // Get default configuration (which includes validation)
    const defaultConfig = getDefaultConfig();

    // Merge with defaults
    const finalConfig = {
      ...defaultConfig,
      ...config,
      name: config.name || 'custom-agent', // Ensure name is provided
      languageModel: defaultConfig.languageModel!, // Non-null assertion safe here
    };

    return new Agent(components.agent, finalConfig);
  }

  /**
   * Get available agent types
   * @returns Array of available agent types
   */
  static getAvailableTypes(): AgentType[] {
    return Object.keys(agentConfigurations) as AgentType[];
  }

  /**
   * Get configuration for a specific agent type
   * @param type - The agent type
   * @returns The agent configuration
   */
  static getConfiguration(type: AgentType): Omit<AgentConfig, keyof Config> {
    const config = agentConfigurations[type];
    if (!config) {
      throw new Error(`Unknown agent type: ${type}`);
    }
    return config;
  }
}

// Export pre-configured agents for common use cases
// These create agents on demand to avoid initialization errors
export const agents = {
  summary: () => AgentFactory.create('summary'),
  general: () => AgentFactory.create('general'),
  research: () => AgentFactory.create('research'),
  analysis: () => AgentFactory.create('analysis'),
  creative: () => AgentFactory.create('creative'),
};