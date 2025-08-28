import { getChatModel, getEmbeddingModel } from "../ai/models";
import type { Config } from "@convex-dev/agent";

// Lazy initialization function to get default config
// This avoids import-time errors and checks configuration when actually needed
export const getDefaultConfig = (): Config => {
  const chat = getChatModel();
  
  if (!chat) {
    throw new Error("AI model configuration required. Please check your environment settings.");
  }
  
  const embeddingModel = getEmbeddingModel();
  
  return {
    // Model configuration
    languageModel: chat, // The property name is 'languageModel' in the Agent API
    ...(embeddingModel && { textEmbeddingModel: embeddingModel }),
    
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
    
    // Usage tracking handler for production monitoring
    usageHandler: async (_ctx, args) => {
      const { usage, model, provider, agentName, threadId, userId } = args;
      // Production: Consider sending to analytics service or saving to database
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
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
};

// Cached version to avoid repeated initialization
let _defaultConfig: Config | null = null;

export const getDefaultConfigCached = (): Config => {
  if (!_defaultConfig) {
    _defaultConfig = getDefaultConfig();
  }
  return _defaultConfig;
};