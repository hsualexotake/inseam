import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  notes: defineTable({
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    summary: v.optional(v.string()),
  }).index("by_user", ["userId"]),
  
  // Rate limiting table
  rateLimits: defineTable({
    userId: v.string(),
    endpoint: v.string(), // e.g., "ai_summary", "create_note"
    count: v.number(),
    windowStart: v.number(), // timestamp
  }).index("by_user_endpoint", ["userId", "endpoint"]),
  
  // Usage tracking for cost monitoring
  usage: defineTable({
    userId: v.string(),
    date: v.string(), // YYYY-MM-DD format
    totalTokens: v.number(),
    totalCost: v.number(),
    requestCount: v.number(),
  }).index("by_user_date", ["userId", "date"]),
});
