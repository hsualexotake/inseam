import { getChatModel, getEmbeddingModel } from "../../ai/models";
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
      recentMessages: 20,  // Reduced from 100 to prevent token limit issues
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
      
      // Hash user ID for privacy
      const hashUserId = (id: string) => {
        // Simple hash for logging - in production use proper hashing
        return `user_${id.substring(0, 8)}***`;
      };
      
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log(`[Agent Usage] ${agentName}:`, {
          model,
          provider,
          threadId: threadId ? `thread_${threadId.substring(0, 8)}***` : 'no-thread',
          userHash: userId ? hashUserId(userId) : 'anonymous',
          tokens: usage.totalTokens,
        });
      }
    },
  };
};

