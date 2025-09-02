"use node";

/**
 * Node.js specific actions for Nylas integration
 * These actions run in Node.js runtime and have access to Node APIs
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import crypto from "crypto";
import { 
  sanitizeErrorMessage
} from "./utils";
import type { NylasTokenResponse, NylasGrantInfo } from "./types";
import { 
  NYLAS_API_URI, 
  NYLAS_CLIENT_ID, 
  NYLAS_API_KEY,
  validateNylasCredentials,
  getNylasApiHeaders,
  generateRequestId
} from "./config";

/**
 * Generate secure OAuth state for CSRF protection
 * Uses Node.js crypto module for cryptographically secure randomness
 */
export const generateOAuthState = internalAction({
  args: {},
  handler: async () => {
    // Use Node.js crypto.randomBytes for secure random generation
    // 32 bytes provides 256 bits of entropy, which is highly secure
    return crypto.randomBytes(32).toString("base64url");
  },
});

/**
 * Exchange OAuth code for grant ID
 * This is still needed to complete the OAuth flow, but we only extract the grant_id
 */
export const exchangeCodeForToken = internalAction({
  args: {
    code: v.string(),
    redirectUri: v.optional(v.string()),
  },
  handler: async (ctx, { code, redirectUri }): Promise<NylasTokenResponse> => {
    validateNylasCredentials();
    const clientId = NYLAS_CLIENT_ID!;
    const clientSecret = NYLAS_API_KEY!; // API key serves as client_secret in v3
    
    const body: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    };
    
    if (redirectUri) {
      body.redirect_uri = redirectUri;
    }
    
    const tokenResponse = await fetch(`${NYLAS_API_URI}/connect/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }
    
    // We only need the grant_id from this response
    return tokenResponse.json();
  },
});

/**
 * Fetch grant information from Nylas
 */
export const fetchGrantInfo = internalAction({
  args: {
    grantId: v.string(),
  },
  handler: async (ctx, { grantId }): Promise<Pick<NylasGrantInfo, 'email' | 'provider'>> => {
    if (!NYLAS_API_KEY) {
      throw new Error("NYLAS_API_KEY not configured");
    }
    
    const response = await fetch(`${NYLAS_API_URI}/grants/${grantId}`, {
      headers: getNylasApiHeaders(),
    });
    
    if (!response.ok) {
      throw new Error("Failed to get grant information");
    }
    
    const data = await response.json();
    
    return {
      email: data.email || "",
      provider: data.provider || "unknown",
    };
  },
});

/**
 * Make an authenticated API call to Nylas
 * Uses grant-specific access token for proper authentication
 */
export const nylasApiCall = internalAction({
  args: {
    endpoint: v.string(),
    method: v.optional(v.string()),
    body: v.optional(v.any()),
  },
  handler: async (ctx, { endpoint, method = "GET", body }) => {
    if (!NYLAS_API_KEY) {
      throw new Error("NYLAS_API_KEY not configured");
    }
    
    const requestId = generateRequestId();
    const url = endpoint.startsWith("http") 
      ? endpoint 
      : `${NYLAS_API_URI}${endpoint}`;
    
    // Per Nylas v3 docs: Use API key as Bearer token for all API calls
    // Grant ID is included in the URL path (e.g., /grants/{grantId}/messages)
    const headers = {
      "Authorization": `Bearer ${NYLAS_API_KEY}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Nylas-Client-Request-Id": requestId,
      "User-Agent": "Convex-Nylas-Integration/1.0.0",
    };
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      
      // Check for rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
      }
      
      // Check for authentication errors
      if (response.status === 401) {
        throw new Error("Authentication failed. Please reconnect your email account.");
      }
      
      // Log error for debugging
      // console.error(`Nylas API error: ${response.status} - ${errorText}`);
      throw new Error(sanitizeErrorMessage(new Error(errorText)));
    }
    
    return response.json();
  },
});

/**
 * Revoke a Nylas grant
 * Per Nylas best practices, always revoke old grants when disconnecting or reconnecting
 */
export const revokeGrant = internalAction({
  args: {
    grantId: v.string(),
  },
  handler: async (ctx, { grantId }) => {
    if (!NYLAS_API_KEY) {
      throw new Error("NYLAS_API_KEY not configured");
    }
    
    try {
      // Per Nylas v3 docs: POST /v3/grants/{grant_id}/revoke
      const response = await fetch(`${NYLAS_API_URI}/grants/${grantId}/revoke`, {
        method: "POST",
        headers: getNylasApiHeaders(),
      });
      
      // Nylas returns 200 on successful revocation, 404 if grant doesn't exist
      if (response.ok || response.status === 404) {
        return { success: true, message: "Grant revoked successfully" };
      }
      
      const errorText = await response.text();
      console.error(`Failed to revoke grant ${grantId}: ${errorText}`);
      return { success: false, message: "Failed to revoke grant" };
    } catch (error) {
      console.error("Error revoking grant:", error);
      // Don't throw - allow disconnect to proceed even if revocation fails
      return { success: false, message: "Error revoking grant" };
    }
  },
});

// Note: No token storage needed with Hosted OAuth + API Key approach
// Only the grant ID is stored, and the API key is used for all requests