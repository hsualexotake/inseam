import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { 
  setupNodeEnvironment, 
  setupTestEnvironment
} from "./testUtils.test";

describe("Nylas Node Actions", () => {
  let t: ReturnType<typeof convexTest>;
  let cleanupEnv: () => void;

  beforeAll(() => {
    cleanupEnv = setupTestEnvironment();
  });

  afterAll(() => {
    cleanupEnv();
  });

  beforeEach(() => {
    t = convexTest(schema, modules);
    setupNodeEnvironment();
    vi.clearAllMocks();
  });

  describe("generateOAuthState", () => {
    it("should generate a secure random state", async () => {
      const state1 = await t.action(internal.nylas.nodeActions.generateOAuthState, {});
      const state2 = await t.action(internal.nylas.nodeActions.generateOAuthState, {});

      // States should be different
      expect(state1).not.toBe(state2);

      // Should be base64url encoded
      expect(state1).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(state2).toMatch(/^[A-Za-z0-9_-]+$/);

      // Should have reasonable length (32 bytes = ~43 chars in base64url)
      expect(state1.length).toBeGreaterThanOrEqual(40);
      expect(state1.length).toBeLessThanOrEqual(50);
    });

    it("should generate cryptographically secure states", async () => {
      const states = new Set();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const state = await t.action(internal.nylas.nodeActions.generateOAuthState, {});
        states.add(state);
      }

      // All states should be unique
      expect(states.size).toBe(iterations);
    });
  });

  // TODO: Enable these tests when we have:
  // 1. Ability to mock fetch in Convex Node.js runtime
  // 2. OR move to integration tests with Nylas sandbox
  // Currently skipped because: Node.js actions run in isolated Convex runtime where we can't intercept fetch
  // Future: Consider using dependency injection for the HTTP client
  describe.skip("exchangeCodeForToken", () => {
    it("should exchange authorization code for grant ID", async () => {
      const mockResponse = {
        grant_id: "grant_123456",
        email: "test@example.com",
        provider: "google",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await t.action(internal.nylas.nodeActions.exchangeCodeForToken, {
        code: "auth_code_123",
        redirectUri: "http://localhost:3000/callback",
      });

      expect(result).toEqual({
        grantId: "grant_123456",
        email: "test@example.com",
        provider: "google",
      });

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.test.nylas.com/connect/token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: expect.stringMatching(/^Basic /),
          }),
          body: expect.stringContaining("code=auth_code_123"),
        })
      );
    });

    it("should handle API errors gracefully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Invalid authorization code",
      });

      await expect(
        t.action(internal.nylas.nodeActions.exchangeCodeForToken, {
          code: "invalid_code",
          redirectUri: "http://localhost:3000/callback",
        })
      ).rejects.toThrowError("Failed to exchange code");
    });

    it("should handle network errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await expect(
        t.action(internal.nylas.nodeActions.exchangeCodeForToken, {
          code: "code_123",
          redirectUri: "http://localhost:3000/callback",
        })
      ).rejects.toThrowError("Network error");
    });
  });

  // TODO: Enable these tests when we have:
  // 1. Test harness that can intercept HTTP calls in Node.js actions
  // 2. OR Nylas API mock server
  // Currently skipped because: Direct HTTP calls in Node.js runtime can't be intercepted
  // Future: Implement contract testing against OpenAPI spec when available
  describe.skip("nylasApiCall", () => {
    it("should make authenticated API calls", async () => {
      const mockResponse = {
        data: [{ id: "msg_1", subject: "Test Email" }],
        next_cursor: "cursor_123",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await t.action(internal.nylas.nodeActions.nylasApiCall, {
        endpoint: "/v3/grants/grant_123/messages",
        method: "GET",
      });

      expect(result).toEqual(mockResponse);

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.test.nylas.com/v3/grants/grant_123/messages",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test_api_key",
            Accept: "application/json",
          }),
        })
      );
    });

    it("should handle POST requests with body", async () => {
      const requestBody = { subject: "New Email", to: ["test@example.com"] };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "msg_created" }),
      });

      await t.action(internal.nylas.nodeActions.nylasApiCall, {
        endpoint: "/v3/grants/grant_123/messages/send",
        method: "POST",
        body: requestBody,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(requestBody),
        })
      );
    });

    it("should handle query parameters", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await t.action(internal.nylas.nodeActions.nylasApiCall, {
        endpoint: "/v3/grants/grant_123/messages?limit=10&offset=20",
        method: "GET",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.test.nylas.com/v3/grants/grant_123/messages?limit=10&offset=20",
        expect.any(Object)
      );
    });

    it("should handle 401 errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(
        t.action(internal.nylas.nodeActions.nylasApiCall, {
          endpoint: "/v3/grants/grant_123/messages",
          method: "GET",
          })
      ).rejects.toThrowError(/Authentication required/);
    });

    it("should handle 429 rate limit errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      });

      await expect(
        t.action(internal.nylas.nodeActions.nylasApiCall, {
          endpoint: "/v3/grants/grant_123/messages",
          method: "GET",
          })
      ).rejects.toThrowError(/Rate limit exceeded/);
    });

    it("should handle missing API key", async () => {
      vi.stubEnv("NYLAS_API_KEY", "");

      await expect(
        t.action(internal.nylas.nodeActions.nylasApiCall, {
          endpoint: "/v3/grants/grant_123/messages",
          method: "GET",
          })
      ).rejects.toThrowError("NYLAS_API_KEY not configured");
    });
  });

  // TODO: Enable these tests when we have:
  // 1. Nylas API test environment with stable test data
  // 2. OR ability to stub HTTP responses in Convex runtime
  // Currently skipped because: Requires real grant ID from Nylas API
  // Future: Use fixtures with known test grant IDs in sandbox environment
  describe.skip("fetchGrantInfo", () => {
    it("should fetch grant information", async () => {
      const mockGrant = {
        id: "grant_123",
        email: "user@example.com",
        provider: "google",
        grant_status: "valid",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGrant,
      });

      const result = await t.action(internal.nylas.nodeActions.fetchGrantInfo, {
        grantId: "grant_123",
      });

      expect(result).toEqual({
        email: "user@example.com",
        provider: "google",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.test.nylas.com/v3/grants/grant_123",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test_api_key",
          }),
        })
      );
    });

    it("should handle invalid grant ID", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Grant not found",
      });

      await expect(
        t.action(internal.nylas.nodeActions.fetchGrantInfo, {
          grantId: "invalid_grant",
        })
      ).rejects.toThrowError("Failed to fetch grant info");
    });
  });

  // revokeGrant function doesn't exist - these tests are commented out
  // describe.skip("revokeGrant", () => {
  //   it("should revoke a grant successfully", async () => {
  //     (global.fetch as any).mockResolvedValueOnce({
  //       ok: true,
  //       json: async () => ({ success: true }),
  //     });

  //     const result = await t.action(internal.nylas.nodeActions.revokeGrant, {
  //       grantId: "grant_to_revoke",
  //     });

  //     expect(result).toEqual({ success: true });

  //     expect(global.fetch).toHaveBeenCalledWith(
  //       "https://api.test.nylas.com/v3/grants/grant_to_revoke",
  //       expect.objectContaining({
  //         method: "DELETE",
  //         headers: expect.objectContaining({
  //           Authorization: "Bearer test_api_key",
  //         }),
  //       })
  //     );
  //   });

  //   it("should handle revocation errors", async () => {
  //     (global.fetch as any).mockResolvedValueOnce({
  //       ok: false,
  //       status: 404,
  //       text: async () => "Grant not found",
  //     });

  //     // Should not throw even if grant doesn't exist (idempotent)
  //     const result = await t.action(internal.nylas.nodeActions.revokeGrant, {
  //       grantId: "nonexistent_grant",
  //     });

  //     expect(result).toEqual({ success: true });
  //   });
  // });
});