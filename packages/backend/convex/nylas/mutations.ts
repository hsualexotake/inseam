/**
 * Nylas integration mutations
 * Simple mutations for managing grants and OAuth state
 */

import { mutation } from "../_generated/server";
import { getAuthenticatedUserId } from "./auth";

/**
 * Get user's connection status
 * Returns the stored grant information
 */
export const getConnectionInfo = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx.auth);
    
    const grant = await ctx.db
      .query("nylasGrants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (!grant) {
      return null;
    }
    
    return {
      email: grant.email,
      provider: grant.provider,
      connectedAt: grant.createdAt,
    };
  },
});