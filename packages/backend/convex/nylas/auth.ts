/**
 * Authentication helper for Nylas integration
 * Centralizes user authentication and authorization logic
 */

import { Auth } from "convex/server";
import { ErrorMessages } from "./config";

/**
 * Get authenticated user ID from Convex auth
 * @param auth - Convex auth context
 * @returns User ID
 * @throws Error if user is not authenticated
 */
export async function getAuthenticatedUserId(auth: Auth): Promise<string> {
  const identity = await auth.getUserIdentity();
  
  if (!identity) {
    throw new Error(ErrorMessages.NOT_AUTHENTICATED);
  }
  
  return identity.subject;
}

/**
 * Check if user is authenticated (without throwing)
 * @param auth - Convex auth context
 * @returns User ID or null if not authenticated
 */
export async function getOptionalUserId(auth: Auth): Promise<string | null> {
  const identity = await auth.getUserIdentity();
  return identity ? identity.subject : null;
}