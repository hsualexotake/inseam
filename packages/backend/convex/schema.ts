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
  
  // Dynamic tracker system - create custom spreadsheets without code
  trackers: defineTable({
    // Core fields
    name: v.string(),                    // Display name
    slug: v.string(),                    // Unique identifier (URL-safe)
    description: v.optional(v.string()),
    
    // Column definitions stored as JSON
    columns: v.array(v.object({
      id: v.string(),                    // Unique column identifier
      name: v.string(),                  // Display name
      key: v.string(),                   // Data field key
      type: v.union(                     // Column data type
        v.literal("text"),
        v.literal("number"),
        v.literal("date"),
        v.literal("select"),
        v.literal("boolean")
      ),
      required: v.boolean(),
      options: v.optional(v.array(v.string())), // For select type
      order: v.number(),                 // Display order
      width: v.optional(v.number()),    // Column width in pixels
      
      // AI configuration (for future use)
      aiEnabled: v.optional(v.boolean()),
      aiAliases: v.optional(v.array(v.string())),
    })),
    
    // Settings
    primaryKeyColumn: v.string(),       // Which column is unique identifier
    
    // Metadata
    userId: v.string(),                 // Owner
    createdAt: v.number(),
    updatedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  // Tracker data table - stores all data for all trackers
  trackerData: defineTable({
    trackerId: v.id("trackers"),
    rowId: v.string(),                  // Unique row identifier
    
    // Flexible JSON storage for row data
    data: v.record(v.string(), v.union(
      v.string(),
      v.number(),
      v.boolean(),
      v.null()
    )),                                 // JSON object with column values
    
    // Metadata
    createdAt: v.number(),
    createdBy: v.string(),              // User ID who created
    updatedAt: v.number(),
    updatedBy: v.string(),              // User ID who last updated
  })
    .index("by_tracker", ["trackerId"])
    .index("by_tracker_row", ["trackerId", "rowId"]),
  
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
  
  // New centralized updates table for tracker integration
  centralizedUpdates: defineTable({
    userId: v.string(),
    source: v.string(), // "email", "manual", etc.
    sourceId: v.optional(v.string()), // email ID, message ID, etc.
    
    // Tracker integration
    trackerMatches: v.array(v.object({
      trackerId: v.id("trackers"),
      trackerName: v.string(),
      confidence: v.number(),
    })),
    
    // Standard update fields
    type: v.string(), // "shipment", "delivery", "delay", "approval", "update", "general"
    category: v.string(), // "fashion_ops", "logistics", "general"
    title: v.string(),
    summary: v.string(),
    urgency: v.optional(v.string()), // "high", "medium", "low"
    
    // Source metadata
    fromName: v.optional(v.string()), // sender name
    fromId: v.optional(v.string()), // email address, phone number, etc.
    sourceSubject: v.optional(v.string()), // email subject or message preview
    sourceQuote: v.optional(v.string()), // exact text that generated this update
    sourceDate: v.optional(v.number()), // original message timestamp
    
    // Tracker proposals embedded
    trackerProposals: v.optional(v.array(v.object({
      trackerId: v.id("trackers"),
      trackerName: v.string(),
      rowId: v.string(), // Primary key value for the row
      isNewRow: v.boolean(), // Whether this is a new row or update
      columnUpdates: v.array(v.object({
        columnKey: v.string(),
        columnName: v.string(),
        columnType: v.string(),
        currentValue: v.optional(v.union(v.string(), v.number(), v.boolean(), v.null())),
        proposedValue: v.union(v.string(), v.number(), v.boolean(), v.null()),
        confidence: v.number(),
      })),
    }))),
    
    // Processing status
    processed: v.boolean(), // Whether proposals have been applied
    processedAt: v.optional(v.number()),
    approved: v.optional(v.boolean()),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.string()),
    rejected: v.optional(v.boolean()),
    rejectedAt: v.optional(v.number()),
    
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  }).index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_processed", ["processed"])
    .index("by_user_archived", ["userId", "archivedAt"]),

  // Tracker row aliases for identifying rows by alternative names
  trackerRowAliases: defineTable({
    trackerId: v.id("trackers"),
    rowId: v.string(),        // The actual PK value (e.g., "12")
    alias: v.string(),        // The alias (e.g., "green dress")
    userId: v.string(),       // Who created it
    createdAt: v.number(),
  })
    .index("by_tracker_alias", ["trackerId", "alias"])  // Primary lookup
    .index("by_tracker_row", ["trackerId", "rowId"]),   // Get aliases for a row
});
