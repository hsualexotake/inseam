import { openai } from "@ai-sdk/openai";

// Model configuration - centralized for easy updates
// Using lazy initialization to avoid import-time errors
export const getChatModel = () => {
  return process.env.OPENAI_API_KEY
    ? openai.chat("gpt-4o-mini")
    : undefined;
};

export const getEmbeddingModel = () => {
  return process.env.OPENAI_API_KEY
    ? openai.embedding("text-embedding-3-small")
    : undefined;
};

// Removed deprecated exports that caused import-time execution
// Use getChatModel() and getEmbeddingModel() directly instead

// Export model names for reference
export const MODEL_CONFIG = {
  chat: "gpt-4o-mini",
  embedding: "text-embedding-3-small",
} as const;

// Helper to check if models are configured
export const areModelsConfigured = () => {
  return !!process.env.OPENAI_API_KEY;
};