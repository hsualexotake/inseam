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
  
  // Track processed email IDs to prevent duplicates
  processedEmailIds: defineTable({
    userId: v.string(),
    emailId: v.string(), // Nylas message ID
    createdAt: v.number(),
  }).index("by_user_email", ["userId", "emailId"])
    .index("by_created", ["createdAt"]), // For cleanup queries
  
  
  // Unified updates table for all sources (email, wechat, whatsapp, etc)
  updates: defineTable({
    userId: v.string(),
    source: v.string(), // "email", "wechat", "whatsapp", "sms", "manual"
    sourceId: v.optional(v.string()), // email ID, message ID, etc.
    
    // Update details
    type: v.string(), // "shipment", "delivery", "delay", "approval", "action", "general"
    category: v.optional(v.string()), // "fashion_ops" or "general"
    title: v.string(),
    summary: v.string(),
    urgency: v.optional(v.string()), // "high", "medium", "low"
    
    // Source metadata
    fromName: v.optional(v.string()), // sender name
    fromId: v.optional(v.string()), // email address, phone number, wechat ID
    sourceSubject: v.optional(v.string()), // email subject or message preview
    sourceQuote: v.optional(v.string()), // exact text that generated this update
    sourceDate: v.optional(v.number()), // original message timestamp
    
    // SKU updates embedded (if applicable)
    skuUpdates: v.optional(v.array(v.object({
      skuCode: v.string(),
      field: v.string(),
      oldValue: v.optional(v.union(v.string(), v.null())), // Can be string, null, or undefined
      newValue: v.string(),
      confidence: v.number(),
    }))),
    
    // Action items embedded (if applicable)
    actionsNeeded: v.optional(v.array(v.object({
      action: v.string(),
      completed: v.boolean(),
      completedAt: v.optional(v.number()),
    }))),
    
    
    createdAt: v.number(),
    processed: v.boolean(), // whether SKU updates were applied to tracking
    acknowledged: v.optional(v.boolean()), // whether user has dismissed this update
    acknowledgedAt: v.optional(v.number()), // when the update was acknowledged
    archivedAt: v.optional(v.number()), // when item was archived (approved/rejected/dismissed)
    
    // SKU Update Approval fields
    skuUpdatesApproved: v.optional(v.boolean()), // whether SKU updates were approved
    skuUpdatesApprovedAt: v.optional(v.number()), // when approved
    skuUpdatesApprovedBy: v.optional(v.string()), // user ID who approved
    skuUpdatesRejected: v.optional(v.boolean()), // whether SKU updates were rejected
    skuUpdatesRejectedAt: v.optional(v.number()), // when rejected
    skuUpdatesRejectedBy: v.optional(v.string()), // user ID who rejected
  }).index("by_user", ["userId"])
    .index("by_source", ["source"])
    .index("by_created", ["createdAt"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_archived", ["userId", "archivedAt"]),
  
  // Simplified SKU tracking table - single source of truth
  skuTracking: defineTable({
    userId: v.string(),
    skuCode: v.string(),
    productName: v.string(),
    category: v.optional(v.string()),
    color: v.optional(v.string()),
    size: v.optional(v.string()),
    season: v.optional(v.string()),
    
    // Current tracking info
    trackingNumber: v.optional(v.string()),
    status: v.optional(v.string()), // "pending", "shipped", "in_transit", "delivered", "delayed"
    deliveryDate: v.optional(v.string()), // Store as string for simplicity
    quantity: v.optional(v.number()),
    supplier: v.optional(v.string()),
    notes: v.optional(v.string()),
    
    
    // Last update metadata
    lastUpdatedFrom: v.optional(v.string()), // email ID or "manual"
    lastUpdatedAt: v.number(),
    lastUpdateConfidence: v.optional(v.number()),
    
    // Update history embedded for audit trail
    updateHistory: v.optional(v.array(v.object({
      field: v.string(),
      oldValue: v.optional(v.string()),
      newValue: v.string(),
      sourceEmailId: v.optional(v.string()),
      sourceQuote: v.optional(v.string()),
      confidence: v.number(),
      timestamp: v.number(),
    }))),
    
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_sku_code", ["skuCode"])
    .index("by_user_sku", ["userId", "skuCode"])
    .index("by_user_status", ["userId", "status"]),
});
