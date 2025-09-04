/**
 * Retry helpers with exponential backoff
 * Following Nylas best practices for handling rate limits
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Execute function with exponential backoff retry logic
 * Follows Nylas recommendation for handling 429 rate limit errors
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 32000,
    backoffFactor = 2,
    shouldRetry = isRetryableError,
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error;
      }
      
      // Check if we have more retries
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const baseDelay = initialDelay * Math.pow(backoffFactor, attempt);
      const jitteredDelay = baseDelay * (0.5 + Math.random() * 0.5); // Add jitter
      const delay = Math.min(jitteredDelay, maxDelay);
      
      // Check for retry-after header (Nylas specific)
      const retryAfter = extractRetryAfter(error);
      const actualDelay = retryAfter ? retryAfter * 1000 : delay;
      
      // Silent retry - avoid logging in production
      // In dev, you can enable this: console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${actualDelay}ms`);
      await sleep(actualDelay);
    }
  }
  
  throw lastError;
}

/**
 * Simple retry wrapper without exponential backoff
 * Useful for transient errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Check if error is retryable
 * Following Nylas guidelines for retryable errors
 */
function isRetryableError(error: any): boolean {
  // Check for rate limit errors
  if (error.message?.includes("429") || 
      error.message?.toLowerCase().includes("rate limit") ||
      error.message?.toLowerCase().includes("too many requests")) {
    return true;
  }
  
  // Check for network errors
  if (error.message?.toLowerCase().includes("network") ||
      error.message?.toLowerCase().includes("timeout") ||
      error.message?.toLowerCase().includes("econnrefused")) {
    return true;
  }
  
  // Check for temporary server errors
  if (error.status === 503 || // Service Unavailable
      error.status === 502 || // Bad Gateway
      error.status === 504) {  // Gateway Timeout
    return true;
  }
  
  return false;
}

/**
 * Extract retry-after value from error (if present)
 * Nylas may include this in rate limit responses
 */
function extractRetryAfter(error: any): number | null {
  // Check for retry-after in error message
  const match = error.message?.match(/retry.*?(\d+)\s*seconds?/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Check for retryAfter property
  if (error.retryAfter && typeof error.retryAfter === 'number') {
    return error.retryAfter;
  }
  
  return null;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}