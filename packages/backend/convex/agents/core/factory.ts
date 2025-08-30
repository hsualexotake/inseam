import { Agent } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { getDefaultConfig } from "./config";
import { agentRegistry } from "./registry";
import type { AgentType, AgentConfig } from "./types";

/**
 * Factory class for creating AI agents with consistent configuration
 * Uses modular agent definitions from separate directories
 */
export class AgentFactory {
  /**
   * Create a new agent of a specific type using the registry
   * @param type - The type of agent to create
   * @param customConfig - Optional custom configuration to override defaults
   * @returns A configured Agent instance
   */
  static async create(type: AgentType, customConfig: Partial<AgentConfig> = {}): Promise<Agent> {
    // Check if agent type exists in registry
    if (!(type in agentRegistry)) {
      throw new Error(`Unknown agent type: ${type}`);
    }

    // Dynamically import the agent module
    const agentModule = await agentRegistry[type]();
    const moduleConfig = agentModule.default.config;

    // Get default configuration (which includes validation)
    const defaultConfig = getDefaultConfig();

    // Merge configurations: default -> module -> custom
    const finalConfig = {
      ...defaultConfig,
      ...moduleConfig.config, // Agent-specific config overrides
      ...customConfig.config, // Custom config overrides
      name: customConfig.name || moduleConfig.name,
      languageModel: defaultConfig.languageModel!, // Non-null assertion safe here
      instructions: customConfig.instructions || moduleConfig.instructions,
      // Merge tools separately to avoid overwriting
      tools: {
        ...agentModule.default.tools,
        ...customConfig.tools,
      },
    };

    // Create and return the agent
    return new Agent(components.agent, finalConfig);
  }

  /**
   * Create a custom agent with fully specified configuration
   * @param config - Complete agent configuration
   * @returns A configured Agent instance
   */
  static async createCustom(config: AgentConfig): Promise<Agent> {
    // Get default configuration (which includes validation)
    const defaultConfig = getDefaultConfig();

    // Merge with defaults
    const finalConfig = {
      ...defaultConfig,
      ...config.config,
      name: config.name || 'custom-agent',
      languageModel: defaultConfig.languageModel!, // Non-null assertion safe here
      instructions: config.instructions,
      tools: config.tools || {},
    };

    return new Agent(components.agent, finalConfig);
  }

  /**
   * Get available agent types from the registry
   * @returns Array of available agent types
   */
  static getAvailableTypes(): AgentType[] {
    return Object.keys(agentRegistry) as AgentType[];
  }

  /**
   * Check if an agent type exists
   * @param type - The agent type to check
   * @returns Boolean indicating if the type exists
   */
  static isValidType(type: string): type is AgentType {
    return type in agentRegistry;
  }
}

// Export convenience functions for common agent creation
export const createAgent = AgentFactory.create;
export const createCustomAgent = AgentFactory.createCustom;