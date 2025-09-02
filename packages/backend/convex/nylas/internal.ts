import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { isValidEmail } from "./utils";

/**
 * Internal query to get user's Nylas grant
 */
export const getGrant = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const grant = await ctx.db
      .query("nylasGrants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    return grant;
  },
});

/**
 * Internal mutation to store Nylas grant
 */
export const storeGrant = internalMutation({
  args: {
    userId: v.string(),
    grantId: v.string(),
    email: v.string(),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    // Security: Validate email format before storing
    if (!isValidEmail(args.email)) {
      throw new Error("Invalid email format provided by OAuth provider");
    }
    
    // Security: Validate other inputs
    if (!args.grantId || args.grantId.length > 255) {
      throw new Error("Invalid grant ID");
    }
    
    if (!args.provider || args.provider.length > 50) {
      throw new Error("Invalid provider");
    }
    
    // Check if user already has a grant
    const existingGrant = await ctx.db
      .query("nylasGrants")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    const now = Date.now();
    
    if (existingGrant) {
      // Update existing grant
      await ctx.db.patch(existingGrant._id, {
        grantId: args.grantId,
        email: args.email,
        provider: args.provider,
        updatedAt: now,
      });
    } else {
      // Create new grant
      await ctx.db.insert("nylasGrants", {
        userId: args.userId,
        grantId: args.grantId,
        email: args.email,
        provider: args.provider,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Internal mutation to remove Nylas grant
 */
export const removeGrant = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const grant = await ctx.db
      .query("nylasGrants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (grant) {
      await ctx.db.delete(grant._id);
    }
  },
});

/**
 * Internal mutation to store email summary
 */
export const storeEmailSummary = internalMutation({
  args: {
    userId: v.string(),
    emailIds: v.array(v.string()),
    summary: v.string(),
    threadId: v.optional(v.string()),
    timeRange: v.object({
      start: v.string(),
      end: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailSummaries", {
      userId: args.userId,
      emailIds: args.emailIds,
      summary: args.summary,
      threadId: args.threadId,
      createdAt: Date.now(),
      timeRange: args.timeRange,
    });
  },
});

/**
 * Internal query to get user's email summaries
 */
export const getEmailSummaries = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 10 }) => {
    const summaries = await ctx.db
      .query("emailSummaries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    
    return summaries;
  },
});

/**
 * Internal mutation to store OAuth state for CSRF protection
 */
export const storeOAuthState = internalMutation({
  args: {
    state: v.string(),
    userId: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    
    await ctx.db.insert("oauthStates", {
      state: args.state,
      userId: args.userId,
      redirectUri: args.redirectUri,
      createdAt: now,
      expiresAt: now + tenMinutes,
    });
  },
});

/**
 * Internal query to validate OAuth state
 */
export const validateOAuthState = internalQuery({
  args: {
    state: v.string(),
  },
  handler: async (ctx, { state }) => {
    const storedState = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .first();
    
    if (!storedState) {
      return null;
    }
    
    // Check if state has expired
    if (Date.now() > storedState.expiresAt) {
      // Note: Can't delete in a query, return null for expired state
      return null;
    }
    
    return storedState;
  },
});

/**
 * Internal mutation to delete a used OAuth state
 */
export const deleteOAuthState = internalMutation({
  args: {
    state: v.string(),
  },
  handler: async (ctx, { state }) => {
    const storedState = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .first();
    
    if (storedState) {
      await ctx.db.delete(storedState._id);
    }
  },
});

/**
 * Internal mutation to clean up expired OAuth states
 */
export const cleanupExpiredStates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const expiredStates = await ctx.db
      .query("oauthStates")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .collect();
    
    for (const state of expiredStates) {
      await ctx.db.delete(state._id);
    }
    
    return { cleaned: expiredStates.length };
  },
});