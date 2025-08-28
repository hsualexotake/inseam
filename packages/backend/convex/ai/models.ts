import { openai } from "@ai-sdk/openai";

// Model configuration - centralized for easy updates
export const languageModel = process.env.OPENAI_API_KEY 
  ? openai.chat("gpt-4o-mini")
  : undefined;

export const textEmbeddingModel = process.env.OPENAI_API_KEY
  ? openai.embedding("text-embedding-3-small")
  : undefined;

// Export model names for reference
export const MODEL_CONFIG = {
  chat: "gpt-4o-mini",
  embedding: "text-embedding-3-small",
} as const;

// Helper to check if models are configured
export const areModelsConfigured = () => {
  return !!process.env.OPENAI_API_KEY;
};