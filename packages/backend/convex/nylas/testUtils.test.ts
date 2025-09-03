import { vi } from "vitest";

/**
 * Test utilities for Nylas integration tests
 * Provides consistent mocking and setup for all test suites
 */

/**
 * Setup Node.js environment mocks
 * Call this in beforeEach for tests that use Node.js actions
 */
export const setupNodeEnvironment = () => {
  // Mock fetch for Node.js actions
  if (typeof global.fetch === 'undefined') {
    global.fetch = vi.fn() as any;
  } else if (global.fetch && typeof (global.fetch as any).mockReset === 'function') {
    (global.fetch as any).mockReset();
  } else {
    // Replace existing fetch with mock
    global.fetch = vi.fn() as any;
  }
};

/**
 * Mock a successful Nylas API call
 */
export const mockNylasApiCall = (response: any, status = 200) => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
    headers: new Headers({
      'content-type': 'application/json',
      'x-request-id': 'test-request-123'
    })
  });
};

/**
 * Mock a failed Nylas API call
 */
export const mockNylasApiError = (error: string, status = 400) => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error }),
    text: async () => JSON.stringify({ error }),
    headers: new Headers({
      'content-type': 'application/json',
      'x-request-id': 'test-request-error'
    })
  });
};

/**
 * Mock network error
 */
export const mockNetworkError = () => {
  (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
};

/**
 * Create mock email data
 */
export const createMockEmail = (overrides = {}) => ({
  id: "email_123",
  grant_id: "grant_123",
  from: [{ email: "sender@example.com", name: "Sender" }],
  to: [{ email: "recipient@example.com", name: "Recipient" }],
  subject: "Test Email",
  body: "This is a test email body",
  snippet: "This is a test...",
  date: Math.floor(Date.now() / 1000),
  unread: true,
  folders: ["inbox"],
  ...overrides
});

/**
 * Create mock grant data
 */
export const createMockGrant = (overrides = {}) => ({
  id: "grant_123",
  provider: "google",
  email: "test@example.com",
  status: "valid",
  created_at: Math.floor(Date.now() / 1000),
  ...overrides
});

/**
 * Create mock OAuth token response
 */
export const createMockTokenResponse = (overrides = {}) => ({
  grant_id: "grant_123",
  email: "test@example.com",
  provider: "google",
  ...overrides
});

/**
 * Setup environment variables for tests
 * Returns a cleanup function to restore original values
 */
export const setupTestEnvironment = () => {
  const originalEnv = { ...process.env };
  
  // Set test environment variables
  process.env.NYLAS_CLIENT_ID = "test_client_id";
  process.env.NYLAS_API_KEY = "test_api_key";
  process.env.NYLAS_API_URI = "https://api.test.nylas.com";
  process.env.ALLOWED_REDIRECT_DOMAINS = "localhost:3000,app.example.com";
  
  // Return cleanup function
  return () => {
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  };
};

/**
 * Create authenticated context for tests
 */
export const createAuthContext = (userId = "user_123") => ({
  subject: userId,
  tokenIdentifier: `token_${userId}`,
});

/**
 * Wait for all promises to resolve
 * Useful for ensuring async operations complete
 */
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));