/**
 * Security utilities and helpers for the application
 */

import { Auth } from "convex/server";
import { Id } from "../_generated/dataModel";

/**
 * Get authenticated user ID with proper error handling
 */
export const requireAuth = async (ctx: { auth: Auth }): Promise<string> => {
  const identity = await ctx.auth.getUserIdentity();
  const userId = identity?.subject;
  
  if (!userId) {
    throw new Error("Authentication required");
  }
  
  return userId;
};

/**
 * Verify that a user owns a specific note
 */
export const verifyNoteOwnership = async (
  ctx: { db: any; auth: Auth },
  noteId: Id<"notes">
): Promise<boolean> => {
  const userId = await requireAuth(ctx);
  const note = await ctx.db.get(noteId);
  
  if (!note) {
    throw new Error("Note not found");
  }
  
  if (note.userId !== userId) {
    throw new Error("Unauthorized: You don't have permission to access this note");
  }
  
  return true;
};

/**
 * Input validation helpers
 */
export const validateNoteInput = (title: string, content: string) => {
  const errors: string[] = [];
  
  // Title validation
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) {
    errors.push("Title cannot be empty");
  }
  if (trimmedTitle.length > 200) {
    errors.push("Title must be less than 200 characters");
  }
  
  // Content validation
  if (content.length > 50000) {
    errors.push("Content must be less than 50KB");
  }
  
  // Check for potential XSS attempts (basic check)
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onload, etc.
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(title) || pattern.test(content)) {
      errors.push("Content contains potentially unsafe HTML/JavaScript");
    }
  }
  
  if (errors.length > 0) {
    throw new Error(errors.join(". "));
  }
  
  return { title: trimmedTitle, content };
};

/**
 * Rate limiting helper (basic implementation)
 * For production, consider using a proper rate limiting service
 */
export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (
  userId: string,
  options: RateLimitOptions = { maxRequests: 10, windowMs: 60000 }
): boolean => {
  const now = Date.now();
  const userLimit = requestCounts.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Start new window
    requestCounts.set(userId, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return true;
  }
  
  if (userLimit.count >= options.maxRequests) {
    const waitTime = Math.ceil((userLimit.resetTime - now) / 1000);
    throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);
  }
  
  userLimit.count++;
  return true;
};

/**
 * Sanitize user input for logging (remove PII)
 */
export const sanitizeForLogging = (data: any): any => {
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'email', 'phone'];
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  
  for (const key in sanitized) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }
  
  return sanitized;
};