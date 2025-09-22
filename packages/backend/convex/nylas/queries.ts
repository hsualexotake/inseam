import { query } from "../_generated/server";
import { requireAuth } from "../helpers/auth";

/**
 * Public query to check if user has connected their email
 * Used by frontend components to show connection status
 */
export const getEmailConnection = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const grant = await ctx.db
      .query("nylasGrants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!grant) {
      return null;
    }

    return {
      connected: true,
      email: grant.email,
      provider: grant.provider,
    };
  },
});