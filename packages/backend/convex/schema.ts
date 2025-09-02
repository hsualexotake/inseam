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
  
  // Nylas email integration (API key approach - no token storage needed)
  nylasGrants: defineTable({
    userId: v.string(),
    grantId: v.string(), // Only store grant ID per Nylas v3 best practices
    email: v.string(),
    provider: v.string(), // gmail, outlook, etc.
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_grant", ["grantId"]),
  
  // Email summaries storage
  emailSummaries: defineTable({
    userId: v.string(),
    emailIds: v.array(v.string()), // Nylas message IDs
    summary: v.string(),
    threadId: v.optional(v.string()), // AI conversation thread
    createdAt: v.number(),
    timeRange: v.object({
      start: v.string(),
      end: v.string(),
    }),
  }).index("by_user", ["userId"])
    .index("by_created", ["createdAt"]),
  
  // OAuth state storage for CSRF protection
  oauthStates: defineTable({
    state: v.string(), // Random state parameter
    userId: v.string(), // User initiating OAuth
    redirectUri: v.string(), // Validated redirect URI
    createdAt: v.number(),
    expiresAt: v.number(), // Auto-expire after 10 minutes
  }).index("by_state", ["state"])
    .index("by_expires", ["expiresAt"]),
});
