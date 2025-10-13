"use node";

/**
 * Nylas integration actions
 * These are the main entry points for email operations
 */

import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { 
  isValidRedirectUri,
  sanitizeErrorMessage,
  cleanEmailBody,
  sanitizeSubject,
  sanitizeEmailAddress
} from "./utils";
import { withRateLimit } from "./rateLimit";
import type { 
  EmailFetchResult, 
  FormattedEmail, 
  NylasEmail, 
  NylasTokenResponse,
  NylasGrantInfo
} from "./types";
import {
  NYLAS_API_URI,
  NYLAS_CLIENT_ID,
  getAllowedRedirectDomains,
  ErrorMessages
} from "./config";
import { requireAuth } from "../helpers/auth";

/**
 * Fetch recent emails from user's inbox
 * Direct action that returns results immediately
 */
export const fetchRecentEmails = action({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 5, offset = 0 }): Promise<EmailFetchResult> => {
    const userId = await requireAuth(ctx);
    
    // Validate parameters
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const validatedOffset = Math.max(0, offset);
    
    // Apply rate limiting
    return await withRateLimit(ctx, userId, "nylas.fetchEmails", async (): Promise<EmailFetchResult> => {
      // Get user's grant
      const grant = await ctx.runQuery(internal.nylas.internal.getGrant, { userId });
      
      if (!grant) {
        throw new Error(ErrorMessages.NO_EMAIL_CONNECTED);
      }
      
      // Fetch emails using Nylas API with API key authentication
      // Nylas returns messages in reverse chronological order (newest first) by default
      const endpoint = `/grants/${grant.grantId}/messages?` +
        `limit=${validatedLimit}&` +
        `offset=${validatedOffset}`;
      
      const data = await ctx.runAction(
        internal.nylas.nodeActions.nylasApiCall,
        {
          endpoint,
        }
      );
      
      // Extract and format email data with sanitization
      const emails: FormattedEmail[] = data.data?.map((email: NylasEmail) => ({
        id: email.id,
        threadId: email.thread_id,
        subject: sanitizeSubject(email.subject || ""),
        from: email.from?.[0] ? {
          email: sanitizeEmailAddress(email.from[0].email || ""),
          name: email.from[0].name?.replace(/[<>"/\\]/g, '').substring(0, 100) || "Unknown Sender"
        } : { email: "unknown@example.com", name: "Unknown Sender" },
        to: email.to?.map(contact => ({
          email: sanitizeEmailAddress(contact.email || ""),
          name: contact.name?.replace(/[<>"/\\]/g, '').substring(0, 100) || ""
        })) || [],
        date: email.date,
        snippet: cleanEmailBody(email.snippet || ""),
        body: cleanEmailBody(email.body || email.snippet || ""),
        unread: email.unread || false,
        hasAttachments: (email.attachments?.length || 0) > 0,
      })) || [];
      
      return {
        emails,
        totalCount: emails.length,
        grant: {
          email: grant.email,
          provider: grant.provider,
        },
      };
    });
  },
});

/**
 * INTERNAL: Fetch recent emails for a specific user (no auth check)
 * Used by background jobs and internal processes
 */
export const fetchRecentEmailsInternal = internalAction({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 5, offset = 0 }): Promise<EmailFetchResult> => {
    // No requireAuth needed - userId passed directly from internal caller

    // Validate parameters
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const validatedOffset = Math.max(0, offset);

    // Apply rate limiting
    return await withRateLimit(ctx, userId, "nylas.fetchEmails", async (): Promise<EmailFetchResult> => {
      // Get user's grant
      const grant = await ctx.runQuery(internal.nylas.internal.getGrant, { userId });

      if (!grant) {
        throw new Error(ErrorMessages.NO_EMAIL_CONNECTED);
      }

      // Fetch emails using Nylas API with API key authentication
      // Nylas returns messages in reverse chronological order (newest first) by default
      const endpoint = `/grants/${grant.grantId}/messages?` +
        `limit=${validatedLimit}&` +
        `offset=${validatedOffset}`;

      const data = await ctx.runAction(
        internal.nylas.nodeActions.nylasApiCall,
        {
          endpoint,
        }
      );

      // Extract and format email data with sanitization
      const emails: FormattedEmail[] = data.data?.map((email: NylasEmail) => ({
        id: email.id,
        threadId: email.thread_id,
        subject: sanitizeSubject(email.subject || ""),
        from: email.from?.[0] ? {
          email: sanitizeEmailAddress(email.from[0].email || ""),
          name: email.from[0].name?.replace(/[<>"/\\]/g, '').substring(0, 100) || "Unknown Sender"
        } : { email: "unknown@example.com", name: "Unknown Sender" },
        to: email.to?.map(contact => ({
          email: sanitizeEmailAddress(contact.email || ""),
          name: contact.name?.replace(/[<>"/\\]/g, '').substring(0, 100) || ""
        })) || [],
        date: email.date,
        snippet: cleanEmailBody(email.snippet || ""),
        body: cleanEmailBody(email.body || email.snippet || ""),
        unread: email.unread || false,
        hasAttachments: (email.attachments?.length || 0) > 0,
      })) || [];

      return {
        emails,
        totalCount: emails.length,
        grant: {
          email: grant.email,
          provider: grant.provider,
        },
      };
    });
  },
});

/**
 * Connect a user's email account via Nylas OAuth
 * Returns the OAuth URL for the user to authenticate
 */
export const initiateNylasAuth = action({
  args: {
    redirectUri: v.string(),
    provider: v.optional(v.union(
      v.literal("google"),
      v.literal("microsoft"),
      v.literal("imap")
    )),
  },
  handler: async (ctx, { redirectUri, provider }) => {
    const userId = await requireAuth(ctx);
    
    // Validate redirect URI for security
    const allowedDomains = getAllowedRedirectDomains();

    // TODO: REMOVE DEBUG LOGS AFTER FIXING REDIRECT URI ISSUE
    console.log("DEBUG - Validating redirect URI:", redirectUri);
    console.log("DEBUG - Allowed domains:", allowedDomains);
    console.log("DEBUG - Validation result:", isValidRedirectUri(redirectUri, allowedDomains));

    if (!isValidRedirectUri(redirectUri, allowedDomains)) {
      throw new Error("Invalid redirect URI");
    }
    
    if (!NYLAS_CLIENT_ID) {
      throw new Error("Server configuration error");
    }
    
    // Generate secure state for CSRF protection using Node.js crypto
    const state = await ctx.runAction(internal.nylas.nodeActions.generateOAuthState);
    
    // Store state for validation on callback
    await ctx.runMutation(internal.nylas.internal.storeOAuthState, {
      state,
      userId,
      redirectUri,
    });
    
    // Build OAuth URL with Nylas Hosted Authentication
    // Using the simple "Hosted OAuth with API Key" approach as recommended by Nylas
    const authUrl = new URL(`${NYLAS_API_URI}/connect/auth`);
    authUrl.searchParams.append("client_id", NYLAS_CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("state", state);
    
    // Provider hint if specified
    if (provider) {
      authUrl.searchParams.append("provider", provider);
    }
    
    return {
      authUrl: authUrl.toString(),
      message: "Redirect user to this URL to connect their email",
    };
  },
});

/**
 * Handle OAuth callback from Nylas
 * Exchange authorization code for access token and store grant
 */
export const handleNylasCallback = action({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, { code, state }): Promise<{ success: boolean; email: string; provider: string }> => {
    // Validate state for CSRF protection
    const storedState: { userId: string; redirectUri: string } | null = await ctx.runQuery(
      internal.nylas.internal.validateOAuthState, 
      { state }
    );
    
    if (!storedState) {
      throw new Error(ErrorMessages.INVALID_STATE);
    }
    
    const userId = storedState.userId;
    
    try {
      // Check if user already has a grant (reconnecting)
      const existingGrant = await ctx.runQuery(internal.nylas.internal.getGrant, { userId });
      
      if (existingGrant) {
        // Revoke the old grant before creating new one (per Nylas best practices)
        await ctx.runAction(internal.nylas.nodeActions.revokeGrant, { 
          grantId: existingGrant.grantId 
        });
      }
      
      // Exchange code for access token
      const tokenData: NylasTokenResponse = await ctx.runAction(
        internal.nylas.nodeActions.exchangeCodeForToken,
        { code, redirectUri: storedState.redirectUri }
      );
      
      // Validate we got an email from the token exchange
      if (!tokenData.email) {
        throw new Error("No email address returned from OAuth provider");
      }
      
      // Get grant information for provider details (optional, with fallback)
      let provider = "unknown";
      try {
        const grantData: Pick<NylasGrantInfo, 'email' | 'provider'> = await ctx.runAction(
          internal.nylas.nodeActions.fetchGrantInfo,
          { grantId: tokenData.grant_id }
        );
        provider = grantData.provider || "unknown";
      } catch (error) {
        // Failed to fetch grant info - infer provider from email domain as fallback
        // eslint-disable-next-line no-console
        console.warn("Failed to fetch grant info, inferring provider from email:", error);
        if (tokenData.email.includes("@gmail.com") || tokenData.email.includes("@googlemail.com")) {
          provider = "google";
        } else if (tokenData.email.includes("@outlook.com") || tokenData.email.includes("@hotmail.com")) {
          provider = "microsoft";
        }
      }
      
      // Store grant in database (only grant ID needed with API key approach)
      await ctx.runMutation(internal.nylas.internal.storeGrant, {
        userId,
        grantId: tokenData.grant_id,
        email: tokenData.email,
        provider,
      });
      
      // Delete the used OAuth state for security
      await ctx.runMutation(internal.nylas.internal.deleteOAuthState, { state });
      
      // Clean up any expired states
      await ctx.runMutation(internal.nylas.internal.cleanupExpiredStates);
      
      return {
        success: true,
        email: tokenData.email,
        provider,
      };
    } catch (error) {
      // Always sanitize errors before rethrowing
      const safeError = sanitizeErrorMessage(error);
      throw new Error(safeError);
    }
  },
});

/**
 * Disconnect user's email account
 * Revokes the grant with Nylas before removing from database
 */
export const disconnectEmail = action({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    
    // Get the grant before removing it
    const grant = await ctx.runQuery(internal.nylas.internal.getGrant, { userId });
    
    if (grant) {
      // Revoke the grant with Nylas (per best practices)
      await ctx.runAction(internal.nylas.nodeActions.revokeGrant, { 
        grantId: grant.grantId 
      });
    }
    
    // Remove grant from database
    await ctx.runMutation(internal.nylas.internal.removeGrant, { userId });
    
    return {
      success: true,
      message: "Email account disconnected and access revoked",
    };
  },
});

// Note: getConnectionStatus has been moved to queries.ts
// Queries cannot be in files with "use node" directive