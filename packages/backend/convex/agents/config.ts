import { stepCountIs } from "ai";
import { languageModel, textEmbeddingModel } from "../ai/models";
import type { Config } from "@convex-dev/agent";

// Shared defaults for all agents
// Only include models if they are configured
export const defaultConfig: Config = {
  // Model configuration - filter out undefined values
  ...(languageModel && { languageModel }),
  ...(textEmbeddingModel && { textEmbeddingModel }),
  
  // Context configuration for message history and search
  contextOptions: {
    excludeToolMessages: true,
    recentMessages: 100,
    searchOptions: {
      limit: 10,
      textSearch: false,
      vectorSearch: false,  // Disable vector search to avoid "no messages" error
      messageRange: { before: 2, after: 1 },
    },
    searchOtherThreads: false,
  },
  
  // LLM call settings
  callSettings: {
    maxRetries: 3,
    temperature: 0.3,  // Lower temperature for more consistent summaries
  },
  
  // Tool execution settings - allow multiple steps for tool calls
  stopWhen: stepCountIs(5),
  
  // Usage tracking handler for production monitoring
  usageHandler: async (ctx, args) => {
    const { usage, model, provider, agentName, threadId, userId } = args;
    // Production: Consider sending to analytics service or saving to database
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Agent Usage] ${agentName}:`, {
        model,
        provider,
        threadId,
        userId,
        tokens: usage.totalTokens,
      });
    }
  },
};