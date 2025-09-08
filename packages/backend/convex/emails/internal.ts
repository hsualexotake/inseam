import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Internal helper functions for email deduplication
 */

// Batch check multiple emails in a single query (performance optimization)
export const checkProcessedEmailsBatch = internalQuery({
  args: {
    userId: v.string(),
    emailIds: v.array(v.string()),
  },
  handler: async (ctx, { userId, emailIds }) => {
    // Get all processed emails for this user in one query
    const processed = await ctx.db
      .query("processedEmailIds")
      .withIndex("by_user_email", (q) => q.eq("userId", userId))
      .collect();
    
    // Create a Set for O(1) lookup performance
    // No time filtering - emails are processed exactly once
    const processedSet = new Set(processed.map(p => p.emailId));
    
    // Return array of booleans matching the order of input emailIds
    return emailIds.map(id => processedSet.has(id));
  },
});

// Mark multiple emails as processed in a batch
export const markEmailsProcessed = internalMutation({
  args: {
    userId: v.string(),
    emailIds: v.array(v.string()),
  },
  handler: async (ctx, { userId, emailIds }): Promise<{ processed: number }> => {
    const now = Date.now();
    
    // Use efficient batch check instead of N+1 queries
    const processedChecks = await ctx.runQuery(
      internal.emails.internal.checkProcessedEmailsBatch,
      { userId, emailIds }
    );
    
    // Filter to only unprocessed emails
    const newEmailIds = emailIds.filter(
      (_, idx) => !processedChecks[idx]
    );
    
    // Parallel inserts for better performance (Convex best practice)
    await Promise.all(
      newEmailIds.map(emailId => 
        ctx.db.insert("processedEmailIds", {
          userId,
          emailId,
          createdAt: now,
        })
      )
    );
    
    return { processed: newEmailIds.length };
  },
});

// Cleanup old processed email IDs (older than 30 days)
export const cleanupOldProcessedEmails = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const BATCH_SIZE = 100; // Process in batches to avoid memory issues
    let totalDeleted = 0;
    
    // Process in batches to avoid loading all records into memory
    while (true) {
      // Get a batch of old records
      const oldRecords = await ctx.db
        .query("processedEmailIds")
        .withIndex("by_created")
        .filter((q) => q.lt(q.field("createdAt"), thirtyDaysAgo))
        .take(BATCH_SIZE);
      
      if (oldRecords.length === 0) {
        break; // No more records to delete
      }
      
      // Delete records in this batch in parallel
      await Promise.all(
        oldRecords.map(record => ctx.db.delete(record._id))
      );
      totalDeleted += oldRecords.length;
      
      // If we got less than BATCH_SIZE, we're done
      if (oldRecords.length < BATCH_SIZE) {
        break;
      }
    }
    
    return { deleted: totalDeleted };
  },
});

// Get all processed email IDs for a user (for debugging)
export const getProcessedEmailIds = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 100 }) => {
    const records = await ctx.db
      .query("processedEmailIds")
      .withIndex("by_user_email", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    
    return records.map(r => ({
      emailId: r.emailId,
      processedAt: new Date(r.createdAt).toISOString(),
    }));
  },
});