import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Rate limiting utilities for API calls
 * Implements sliding window rate limiting
 */

const RATE_LIMITS = {
  // Nylas API limits (per user)
  "nylas.fetchEmails": { 
    requests: 10, 
    windowMs: 60 * 1000 // 10 requests per minute
  },
  "nylas.auth": { 
    requests: 5, 
    windowMs: 10 * 60 * 1000 // 5 auth attempts per 10 minutes
  },
  // Email summary limits
  "emails.summarize": { 
    requests: 20, 
    windowMs: 60 * 60 * 1000 // 20 summaries per hour
  },
  // Default for unspecified endpoints
  "default": { 
    requests: 30, 
    windowMs: 60 * 1000 // 30 requests per minute
  },
};

/**
 * Check if a user has exceeded rate limits
 */
export const checkRateLimit = internalQuery({
  args: {
    userId: v.string(),
    endpoint: v.string(),
  },
  handler: async (ctx, { userId, endpoint }) => {
    const limit = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
    const now = Date.now();
    const windowStart = now - limit.windowMs;
    
    // Get existing rate limit record
    const rateLimitRecord = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_endpoint", (q) => 
        q.eq("userId", userId).eq("endpoint", endpoint)
      )
      .first();
    
    if (!rateLimitRecord) {
      // No record exists, user is within limits
      return {
        allowed: true,
        remaining: limit.requests - 1,
        resetAt: now + limit.windowMs,
      };
    }
    
    // Check if window has expired
    if (rateLimitRecord.windowStart < windowStart) {
      // Window expired, reset count
      return {
        allowed: true,
        remaining: limit.requests - 1,
        resetAt: now + limit.windowMs,
      };
    }
    
    // Check if within limits
    const allowed = rateLimitRecord.count < limit.requests;
    const remaining = Math.max(0, limit.requests - rateLimitRecord.count - 1);
    const resetAt = rateLimitRecord.windowStart + limit.windowMs;
    
    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000),
    };
  },
});

/**
 * Increment rate limit counter
 */
export const incrementRateLimit = internalMutation({
  args: {
    userId: v.string(),
    endpoint: v.string(),
  },
  handler: async (ctx, { userId, endpoint }) => {
    const limit = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
    const now = Date.now();
    const windowStart = now - limit.windowMs;
    
    // Get existing rate limit record
    const rateLimitRecord = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_endpoint", (q) => 
        q.eq("userId", userId).eq("endpoint", endpoint)
      )
      .first();
    
    if (!rateLimitRecord) {
      // Create new record
      await ctx.db.insert("rateLimits", {
        userId,
        endpoint,
        count: 1,
        windowStart: now,
      });
      return;
    }
    
    // Check if window has expired
    if (rateLimitRecord.windowStart < windowStart) {
      // Reset window
      await ctx.db.patch(rateLimitRecord._id, {
        count: 1,
        windowStart: now,
      });
    } else {
      // Increment counter
      await ctx.db.patch(rateLimitRecord._id, {
        count: rateLimitRecord.count + 1,
      });
    }
  },
});

/**
 * Reset rate limit for a user/endpoint combination
 */
export const resetRateLimit = internalMutation({
  args: {
    userId: v.string(),
    endpoint: v.string(),
  },
  handler: async (ctx, { userId, endpoint }) => {
    const now = Date.now();
    
    // Get existing rate limit record
    const rateLimitRecord = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_endpoint", (q) => 
        q.eq("userId", userId).eq("endpoint", endpoint)
      )
      .first();
    
    if (rateLimitRecord) {
      // Reset existing record
      await ctx.db.patch(rateLimitRecord._id, {
        count: 0,
        windowStart: now,
      });
    } else {
      // Create new record with zero count
      await ctx.db.insert("rateLimits", {
        userId,
        endpoint,
        count: 0,
        windowStart: now,
      });
    }
  },
});

/**
 * Clean up old rate limit records
 */
export const cleanupOldRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Clean up records older than 1 hour
    const cutoff = now - (60 * 60 * 1000);
    
    const oldRecords = await ctx.db
      .query("rateLimits")
      .filter((q) => q.lt(q.field("windowStart"), cutoff))
      .collect();
    
    for (const record of oldRecords) {
      await ctx.db.delete(record._id);
    }
    
    return { cleaned: oldRecords.length };
  },
});

/**
 * Wrapper to enforce rate limits on actions
 */
export async function withRateLimit<T>(
  ctx: any,
  userId: string,
  endpoint: string,
  action: () => Promise<T>
): Promise<T> {
  // Check rate limit
  const rateLimit = await ctx.runQuery(internal.nylas.rateLimit.checkRateLimit, { userId, endpoint });
  
  if (!rateLimit.allowed) {
    throw new Error(
      `Rate limit exceeded. Please try again in ${rateLimit.retryAfter} seconds.`
    );
  }
  
  // Increment counter
  await ctx.runMutation(internal.nylas.rateLimit.incrementRateLimit, { userId, endpoint });
  
  // Execute action
  try {
    return await action();
  } catch (error) {
    // If action fails, we might want to decrement the counter
    // For now, we'll keep it incremented to prevent abuse
    throw error;
  }
}