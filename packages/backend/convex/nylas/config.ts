/**
 * Centralized configuration for Nylas integration
 * Reduces duplication and provides single source of truth
 * 
 * SECURITY NOTE: This file contains sensitive configuration and should only
 * be imported in server-side actions with "use node" directive
 */

// API Configuration
export const NYLAS_API_URI = process.env.NYLAS_API_URI || "https://api.us.nylas.com/v3";
export const NYLAS_CLIENT_ID = process.env.NYLAS_CLIENT_ID;
// SECURITY: API_KEY should never be exposed to client code
// Only access this in server-side actions with "use node" directive
const NYLAS_API_KEY_INTERNAL = process.env.NYLAS_API_KEY;

// Export a getter function instead of the raw value for additional safety
export function getNylasApiKey(): string | undefined {
  // Comprehensive check for actual browser environment
  // This distinguishes between real browsers and test environments like edge-runtime
  const isBrowser = 
    typeof window !== 'undefined' && 
    typeof window.document !== 'undefined' &&
    typeof window.navigator !== 'undefined' &&
    // Check we're not in a test environment
    !((global as any).process?.env?.NODE_ENV === 'test') &&
    // Check we're not in jsdom
    !(window.navigator?.userAgent?.includes('jsdom')) &&
    // Check for edge-runtime specific globals
    typeof (global as any).EdgeRuntime === 'undefined';
    
  if (isBrowser) {
    throw new Error('SECURITY: Attempted to access API key from client side');
  }
  
  return NYLAS_API_KEY_INTERNAL;
}

// Limits and Constraints
export const MAX_EMAIL_FETCH_LIMIT = 100;
export const DEFAULT_EMAIL_FETCH_LIMIT = 5;
export const MAX_PROMPT_LENGTH = 5000;
export const MAX_EMAIL_SUMMARY_COUNT = 50;

// OAuth Configuration
export const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const DEFAULT_REDIRECT_DOMAINS = ["localhost:3000", "localhost:3001"];

/**
 * Get allowed redirect domains from environment or defaults
 */
export function getAllowedRedirectDomains(): string[] {
  const envDomains = process.env.ALLOWED_REDIRECT_DOMAINS;
  return envDomains ? envDomains.split(",").map(d => d.trim()) : DEFAULT_REDIRECT_DOMAINS;
}

/**
 * Calculate token expiry timestamp
 * @param expiresIn - Expiry time in seconds from Nylas
 * @returns Timestamp in milliseconds
 */
export function calculateTokenExpiry(expiresIn: number | undefined): number | undefined {
  return expiresIn ? Date.now() + (expiresIn * 1000) : undefined;
}

/**
 * Validate email fetch limit
 * @param limit - Requested limit
 * @returns Valid limit within constraints
 */
export function validateEmailLimit(limit?: number): number {
  if (!limit) return DEFAULT_EMAIL_FETCH_LIMIT;
  return Math.min(Math.max(1, limit), MAX_EMAIL_FETCH_LIMIT);
}

/**
 * Validate prompt length
 * @param prompt - User prompt
 * @throws Error if prompt exceeds maximum length
 */
export function validatePromptLength(prompt: string): void {
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`);
  }
}

/**
 * Check if Nylas credentials are configured
 * @throws Error if credentials are missing
 */
export function validateNylasCredentials(): void {
  if (!NYLAS_CLIENT_ID || !getNylasApiKey()) {
    // Don't mention specific env var names in error messages
    throw new Error("Nylas credentials not configured in environment variables.");
  }
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get Nylas API headers for authenticated requests
 * Includes security headers for request tracing
 * NOTE: This should ONLY be used in server-side node actions, never exposed to client
 */
export function getNylasApiHeaders(requestId?: string): Record<string, string> {
  // Ensure this is only called from server context
  const apiKey = getNylasApiKey();
  if (!apiKey) {
    // Generic error message that doesn't reveal configuration details
    throw new Error("API configuration error - server-side access only");
  }
  
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-Nylas-Client-Request-Id": requestId || generateRequestId(),
    "User-Agent": "Convex-Nylas-Integration/1.0.0",
  };
}

/**
 * Error messages for consistency
 */
export const ErrorMessages = {
  NOT_AUTHENTICATED: "Please sign in to continue",
  NO_EMAIL_CONNECTED: "No email account connected. Please connect your email first.",
  TOKEN_EXPIRED: "Token expired and no refresh token available. Please reconnect your email.",
  INVALID_STATE: "Invalid or expired state parameter",
  RATE_LIMIT: "Too many requests. Please try again later.",
  GENERIC_ERROR: "An error occurred while processing your request",
} as const;