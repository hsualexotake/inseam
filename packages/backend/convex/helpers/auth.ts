import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

/**
 * Authentication helpers following Convex best practices
 * Centralized auth logic to avoid repetition
 */

/**
 * Require authentication for protected functions
 * Throws error if user is not authenticated
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Please sign in to continue");
  }
  return identity.subject;
}

/**
 * Optional authentication for public functions
 * Returns null if user is not authenticated
 */
export async function optionalAuth(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject || null;
}

/**
 * Get current user ID or return empty array/null for queries
 * Useful for queries that should return empty data instead of error
 */
export async function getAuthOrDefault<T>(
  ctx: QueryCtx,
  defaultValue: T
): Promise<{ userId: string | null; shouldReturn: boolean; defaultValue: T }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return {
      userId: null,
      shouldReturn: true,
      defaultValue,
    };
  }
  return {
    userId: identity.subject,
    shouldReturn: false,
    defaultValue,
  };
}