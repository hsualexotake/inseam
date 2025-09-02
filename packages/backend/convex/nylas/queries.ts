/**
 * Nylas integration queries
 * These run in the Convex JavaScript environment (not Node.js)
 * For actions that need Node.js features, see actions.ts
 */

import { query } from "../_generated/server";
import { getOptionalUserId } from "./auth";
import type { ConnectionStatus } from "./types";

/**
 * Get current user's email connection status
 * This is a query since it only reads data
 */
export const getConnectionStatus = query({
  args: {},
  handler: async (ctx): Promise<ConnectionStatus> => {
    const userId = await getOptionalUserId(ctx.auth);
    
    if (!userId) {
      return {
        connected: false,
        message: "Not authenticated",
      };
    }
    
    // Direct database query instead of runQuery
    const grant = await ctx.db
      .query("nylasGrants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (!grant) {
      return {
        connected: false,
        message: "No email account connected",
      };
    }
    
    // With API key approach, connections don't expire
    // Nylas handles token management internally
    return {
      connected: true,
      email: grant.email,
      provider: grant.provider,
      message: "Email account connected",
    };
  },
});