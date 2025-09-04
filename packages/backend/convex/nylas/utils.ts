/**
 * Pure JavaScript utilities for Nylas integration
 * These functions don't require Node.js APIs and can run in Convex's default runtime
 */


/**
 * Validate redirect URI to prevent open redirects
 */
export function isValidRedirectUri(uri: string, allowedDomains: string[]): boolean {
  try {
    const url = new URL(uri);
    
    // Check if the domain is in the allowed list
    return allowedDomains.some(domain => {
      // Support wildcards like *.example.com
      if (domain.startsWith("*.")) {
        const baseDomain = domain.slice(2);
        // Must end with baseDomain AND have something before it
        return url.hostname.endsWith("." + baseDomain);
      }
      // For localhost, check both hostname and port
      if (domain.includes("localhost")) {
        const [host, port] = domain.split(":");
        if (port) {
          return url.hostname === host && url.port === port;
        }
        return url.hostname === host;
      }
      return url.hostname === domain;
    });
  } catch {
    return false;
  }
}

/**
 * Sanitize error messages to avoid leaking sensitive information
 * This is a critical security function that prevents information disclosure
 */
export function sanitizeErrorMessage(error: unknown): string {
  // Never log raw errors as they might contain sensitive data
  // Use a secure logging mechanism if detailed logging is needed
  
  // Convert error to string safely
  const errorString = error instanceof Error ? error.message : String(error);
  
  // Security: Remove any potential sensitive information patterns
  const sensitivePatterns = [
    /api[_-]?key/gi,
    /secret/gi,
    /token/gi,
    /password/gi,
    /bearer/gi,
    /authorization/gi,
    /client[_-]?id/gi,
    /grant[_-]?id/gi,
    /\b[a-f0-9]{32,}\b/gi, // Hex strings (likely tokens)
    /\b[A-Za-z0-9+/]{20,}={0,2}\b/gi, // Base64 strings
    /localhost/gi,
    /127\.0\.0\.1/gi,
    /internal/gi,
    /\.local/gi,
    /nyl_[A-Za-z0-9]+/gi, // Nylas API key pattern
    /sk_[A-Za-z0-9]+/gi, // Secret key pattern
    /pk_[A-Za-z0-9]+/gi, // Public key pattern
    /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, // Bearer token with value
    /[A-Za-z0-9]{40,}/g, // Long alphanumeric strings (API keys)
    /https?:\/\/[^\s]*@/gi, // URLs with credentials
  ];
  
  // Check if error contains sensitive information
  const containsSensitiveInfo = sensitivePatterns.some(pattern => pattern.test(errorString));
  
  if (containsSensitiveInfo) {
    return "An error occurred while processing your request";
  }
  
  // Whitelist of safe error messages that can be shown to users
  const safeErrorMessages = [
    "No email account connected",
    "Please sign in to continue",
    "Authentication required", 
    "Rate limit exceeded",
    "Invalid redirect URI",
    "Invalid or expired state",
    "Please connect your email first",
    "Token expired and no refresh token available",
    "Too many requests",
    "Invalid email format",
    "Connection failed",
    "Request timeout",
    "Service temporarily unavailable"
  ];
  
  // Check if the error message is in our whitelist of safe messages
  const safeMessage = safeErrorMessages.find(safe => 
    errorString.toLowerCase().includes(safe.toLowerCase())
  );
  
  if (safeMessage) {
    // Return the whitelisted message, not the full error
    if (errorString.toLowerCase().includes("rate limit")) {
      return "Rate limit exceeded. Please try again later.";
    }
    if (errorString.toLowerCase().includes("no email account")) {
      return "No email account connected. Please connect your email first.";
    }
    if (errorString.toLowerCase().includes("sign in") || errorString.toLowerCase().includes("authentication")) {
      return "Please sign in to continue";
    }
    if (errorString.toLowerCase().includes("invalid redirect")) {
      return "Invalid redirect URI";
    }
    if (errorString.toLowerCase().includes("invalid") && errorString.toLowerCase().includes("state")) {
      return "Invalid or expired state parameter";
    }
    return safeMessage;
  }
  
  // Additional validation: check for any hex strings or base64 that might have been missed
  const additionalPatterns = [
    /[A-Za-z0-9]{32,}/g, // Long strings that might be keys
    /\b\d{4,}\b/g, // Long numbers that might be IDs
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, // UUIDs
    /\b[A-Za-z0-9_\-]{20,}\b/g, // Generic tokens
  ];
  
  for (const pattern of additionalPatterns) {
    if (pattern.test(errorString)) {
      return "An error occurred while processing your request";
    }
  }
  
  // If error is very long, truncate it (could contain data dumps)
  if (errorString.length > 200) {
    return "An error occurred while processing your request";
  }
  
  // Final safety check: if the error contains any JSON-like structures
  if (errorString.includes('{') && errorString.includes('}')) {
    return "An error occurred while processing your request";
  }
  
  // Generic error message for all other cases
  return "An error occurred while processing your request";
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data) {
    return "***";
  }
  
  // If string is too short to mask meaningfully, return asterisks
  if (data.length <= visibleChars * 2) {
    return "***";
  }
  
  const start = data.slice(0, visibleChars);
  const end = data.slice(-visibleChars);
  return `${start}...${end}`;
}

/**
 * Validate email address format with strict security rules
 */
export function isValidEmail(email: string): boolean {
  // Security: Reject emails that are too long (prevent DoS)
  if (!email || email.length > 254) {
    return false;
  }
  
  // Security: Reject emails with dangerous characters or patterns
  const dangerousPatterns = [
    // Prevent script injection
    /<|>|"|'|&|javascript:|data:|vbscript:/i,
    // Prevent path traversal
    /\.\.|\/\//,
    // Prevent SQL injection patterns
    /union|select|insert|delete|drop|create|alter|exec/i
  ];
  
  if (dangerousPatterns.some(pattern => pattern.test(email))) {
    return false;
  }
  
  // More strict regex that requires a proper domain with TLD
  // Local part: alphanumeric, dots, hyphens, plus, underscores only
  // Domain: alphanumeric, dots, hyphens only, must have valid TLD
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // Security: Reject IP addresses, localhost, and internal domains
  const domainPart = email.split('@')[1].toLowerCase();
  const rejectedDomains = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'internal',
    'local',
    'test',
    'example.com',
    'example.org',
    'test.com'
  ];
  
  if (rejectedDomains.includes(domainPart) || 
      /^\d+\.\d+\.\d+\.\d+$/.test(domainPart) ||  // IP address
      domainPart.includes('[') ||                   // IPv6 brackets
      domainPart.endsWith('.local') ||              // .local domains
      domainPart.endsWith('.internal')) {           // .internal domains
    return false;
  }
  
  // Security: Validate local part length (before @)
  const localPart = email.split('@')[0];
  if (localPart.length > 64) {
    return false;
  }
  
  return true;
}

/**
 * Format date for display
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours < 1) {
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} minutes ago`;
  } else if (hours < 24) {
    return `${hours} hours ago`;
  } else if (hours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Clean and sanitize email body from HTML and potential security threats
 * This is a defensive function to prevent XSS and injection attacks
 */
export function cleanEmailBody(body: string): string {
  if (!body || typeof body !== 'string') {
    return '';
  }
  
  // Security: Limit maximum length to prevent DoS
  if (body.length > 50000) {
    body = body.substring(0, 50000) + '... [content truncated for security]';
  }
  
  return body
    // Remove all HTML tags and their content for security
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags entirely
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove style tags entirely
    .replace(/<[^>]*>/g, '')                          // Remove all other HTML tags
    
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    
    // Security: Remove potentially dangerous patterns
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/onload/gi, '')
    .replace(/onerror/gi, '')
    .replace(/onclick/gi, '')
    
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .trim()
    
    // Final length limit for processing
    .substring(0, 10000);
}

/**
 * Sanitize email subject line
 */
export function sanitizeSubject(subject: string): string {
  if (!subject || typeof subject !== 'string') {
    return '(No subject)';
  }
  
  return subject
    // Remove potentially dangerous characters
    .replace(/[<>"/\\&'`]/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Limit length
    .substring(0, 200)
    .trim() || '(No subject)';
}

/**
 * Sanitize email address for display
 */
export function sanitizeEmailAddress(email: string): string {
  if (!email || typeof email !== 'string') {
    return 'unknown@example.com';
  }
  
  // Basic sanitization - remove dangerous characters
  const sanitized = email
    .replace(/[<>"/\\`]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .substring(0, 254)
    .trim();
    
  // Validate format after sanitization
  return isValidEmail(sanitized) ? sanitized : 'unknown@example.com';
}