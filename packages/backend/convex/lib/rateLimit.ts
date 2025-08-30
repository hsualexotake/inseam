/**
 * Rate limiting utilities for API protection
 */

import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";

// Rate limit configurations
export const RATE_LIMITS = {
  ai_summary: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  create_note: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  ai_general: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

export type RateLimitEndpoint = keyof typeof RATE_LIMITS;

/**
 * Check and update rate limit for a user
 * Returns true if within limit, throws error if exceeded
 */
export const checkRateLimit = internalMutation({
  args: {
    userId: v.string(),
    endpoint: v.string(),
  },
  handler: async (ctx, { userId, endpoint }) => {
    const config = RATE_LIMITS[endpoint as RateLimitEndpoint];
    if (!config) {
      throw new Error(`Unknown rate limit endpoint: ${endpoint}`);
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get existing rate limit record
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_endpoint", (q) => 
        q.eq("userId", userId).eq("endpoint", endpoint)
      )
      .first();

    // If no record or window expired, create/reset
    if (!existing || existing.windowStart < windowStart) {
      if (existing) {
        await ctx.db.patch(existing._id, {
          count: 1,
          windowStart: now,
        });
      } else {
        await ctx.db.insert("rateLimits", {
          userId,
          endpoint,
          count: 1,
          windowStart: now,
        });
      }
      return { allowed: true, remaining: config.maxRequests - 1 };
    }

    // Check if within limit
    if (existing.count >= config.maxRequests) {
      const resetTime = existing.windowStart + config.windowMs;
      const waitSeconds = Math.ceil((resetTime - now) / 1000);
      throw new Error(
        `Rate limit exceeded for ${endpoint}. Please wait ${waitSeconds} seconds.`
      );
    }

    // Increment counter
    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
    });

    return { 
      allowed: true, 
      remaining: config.maxRequests - existing.count - 1 
    };
  },
});

/**
 * Track usage for cost monitoring
 */
export const trackUsage = internalMutation({
  args: {
    userId: v.string(),
    tokens: v.number(),
    cost: v.number(),
  },
  handler: async (ctx, { userId, tokens, cost }) => {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const existing = await ctx.db
      .query("usage")
      .withIndex("by_user_date", (q) => 
        q.eq("userId", userId).eq("date", date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalTokens: existing.totalTokens + tokens,
        totalCost: existing.totalCost + cost,
        requestCount: existing.requestCount + 1,
      });
    } else {
      await ctx.db.insert("usage", {
        userId,
        date,
        totalTokens: tokens,
        totalCost: cost,
        requestCount: 1,
      });
    }
  },
});

/**
 * Get user's usage for today
 */
export const getUserUsageToday = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) return null;

    const date = new Date().toISOString().split('T')[0];
    
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_date", (q) => 
        q.eq("userId", userId).eq("date", date)
      )
      .first();

    return usage || {
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0,
    };
  },
});