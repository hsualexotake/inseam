import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";
import { 
  setupNodeEnvironment, 
  setupTestEnvironment
} from "./testUtils";

/**
 * Integration Tests for Nylas Email Integration
 * 
 * TODO: Enable these tests when we have:
 * 1. Nylas sandbox account with test credentials
 * 2. CI/CD environment variables for NYLAS_CLIENT_ID, NYLAS_API_KEY
 * 3. Test email accounts that can receive OAuth authorizations
 * 
 * Currently skipped because:
 * - Requires real Nylas API interaction
 * - Needs actual OAuth flow with browser redirects
 * - Requires persistent test data (grants, emails)
 * 
 * Future testing strategy:
 * 1. Set up Nylas sandbox account
 * 2. Create test email accounts (Gmail, Outlook)
 * 3. Use Playwright/Puppeteer for OAuth flow automation
 * 4. Run as separate test suite: `yarn test:integration`
 * 5. Only run in CI with proper credentials
 * 
 * These tests would validate:
 * - Complete OAuth flow from start to finish
 * - Email fetching with real data
 * - Error handling with actual API responses
 * - Rate limiting against real API limits
 * - Grant lifecycle (create, update, revoke)
 */
describe.skip("Nylas Integration Tests", () => {
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Complete OAuth Flow", () => {
    it("should complete full OAuth flow from initiation to grant storage", async () => {
      // Step 1: Initiate OAuth
      const authResult = await t.withIdentity({ subject: "user_123" }).action(
        api.nylas.actions.initiateNylasAuth,
        {
          redirectUri: "http://localhost:3000/callback",
          provider: "google",
        }
      );

      expect(authResult.authUrl).toBeDefined();
      
      // Extract state from URL
      const url = new URL(authResult.authUrl);
      const state = url.searchParams.get("state");
      expect(state).toBeDefined();

      // Verify state was stored
      const storedStates = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });
      expect(storedStates.length).toBe(1);
      expect(storedStates[0].state).toBe(state);

      // Step 2: Mock successful token exchange
      (global.fetch as any)
        .mockResolvedValueOnce({
          // Token exchange response
          ok: true,
          json: async () => ({
            grant_id: "grant_123456",
          }),
        })
        .mockResolvedValueOnce({
          // Grant info response
          ok: true,
          json: async () => ({
            id: "grant_123456",
            email: "user@example.com",
            provider: "google",
            grant_status: "valid",
          }),
        });

      // Step 3: Handle callback
      const callbackResult = await t.action(api.nylas.actions.handleNylasCallback, {
        code: "auth_code_123",
        state: state!,
      });

      expect(callbackResult).toMatchObject({
        success: true,
        email: "user@example.com",
        provider: "google",
      });

      // Step 4: Verify grant was stored
      const grants = await t.run(async (ctx) => {
        return await ctx.db.query("nylasGrants").collect();
      });

      expect(grants.length).toBe(1);
      expect(grants[0]).toMatchObject({
        userId: "user_123",
        grantId: "grant_123456",
        email: "user@example.com",
        provider: "google",
      });

      // Step 5: Verify state was cleaned up
      const remainingStates = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });
      expect(remainingStates.length).toBe(0);
    });

    it("should handle OAuth flow errors gracefully", async () => {
      // Initiate OAuth
      const authResult = await t.withIdentity({ subject: "user_123" }).action(
        api.nylas.actions.initiateNylasAuth,
        {
          redirectUri: "http://localhost:3000/callback",
        }
      );

      const url = new URL(authResult.authUrl);
      const state = url.searchParams.get("state");

      // Mock failed token exchange
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Invalid authorization code",
      });

      // Handle callback with error
      await expect(
        t.action(api.nylas.actions.handleNylasCallback, {
          code: "invalid_code",
          state: state!,
        })
      ).rejects.toThrowError();

      // Verify no grant was stored
      const grants = await t.run(async (ctx) => {
        return await ctx.db.query("nylasGrants").collect();
      });
      expect(grants.length).toBe(0);
    });
  });

  describe("Email Fetching and Summary", () => {
    beforeEach(async () => {
      // Setup user with grant
      await t.run(async (ctx) => {
        await ctx.db.insert("nylasGrants", {
          userId: "user_123",
          grantId: "grant_123",
          email: "test@example.com",
          provider: "google",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
    });

    it("should fetch and process emails", async () => {
      // Mock email fetch response
      const mockEmails = {
        data: [
          {
            id: "msg_1",
            grant_id: "grant_123",
            from: [{ email: "sender1@example.com", name: "Sender 1" }],
            to: [{ email: "test@example.com" }],
            subject: "Important Project Update",
            body: "Here's the latest update on our project...",
            date: Math.floor(Date.now() / 1000),
            snippet: "Here's the latest update...",
          },
          {
            id: "msg_2",
            grant_id: "grant_123",
            from: [{ email: "sender2@example.com", name: "Sender 2" }],
            to: [{ email: "test@example.com" }],
            subject: "Meeting Tomorrow",
            body: "Don't forget about our meeting tomorrow at 2 PM",
            date: Math.floor(Date.now() / 1000) - 3600,
            snippet: "Don't forget about our meeting...",
          },
        ],
        next_cursor: null,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEmails,
      });

      const result = await t.withIdentity({ subject: "user_123" }).action(
        api.nylas.actions.fetchRecentEmails,
        { limit: 5 }
      );

      expect(result.emails).toHaveLength(2);
      expect(result.emails[0]).toMatchObject({
        id: "msg_1",
        subject: "Important Project Update",
        from: "sender1@example.com",
      });
      expect(result.grant).toMatchObject({
        email: "test@example.com",
        provider: "google",
      });
    });

    it("should handle pagination correctly", async () => {
      // First page
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "msg_1", subject: "Email 1", from: [{ email: "test@example.com" }] },
            { id: "msg_2", subject: "Email 2", from: [{ email: "test@example.com" }] },
          ],
          next_cursor: "cursor_page2",
        }),
      });

      const page1 = await t.withIdentity({ subject: "user_123" }).action(
        api.nylas.actions.fetchRecentEmails,
        { limit: 2, offset: 0 }
      );

      expect(page1.emails).toHaveLength(2);

      // Second page
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "msg_3", subject: "Email 3", from: [{ email: "test@example.com" }] },
            { id: "msg_4", subject: "Email 4", from: [{ email: "test@example.com" }] },
          ],
          next_cursor: null,
        }),
      });

      const page2 = await t.withIdentity({ subject: "user_123" }).action(
        api.nylas.actions.fetchRecentEmails,
        { limit: 2, offset: 2 }
      );

      expect(page2.emails).toHaveLength(2);
      expect(page2.emails[0].id).toBe("msg_3");
    });
  });

  describe("Account Disconnection", () => {
    it("should properly disconnect account and revoke grant", async () => {
      // Setup grant
      await t.run(async (ctx) => {
        await ctx.db.insert("nylasGrants", {
          userId: "user_123",
          grantId: "grant_to_revoke",
          email: "test@example.com",
          provider: "google",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Mock revoke grant response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      // Disconnect account
      const result = await t.withIdentity({ subject: "user_123" }).action(
        api.nylas.actions.disconnectEmail,
        {}
      );

      expect(result).toMatchObject({
        success: true,
        message: "Email account disconnected",
      });

      // Verify grant was removed from database
      const grants = await t.run(async (ctx) => {
        return await ctx.db.query("nylasGrants").collect();
      });
      expect(grants.length).toBe(0);

      // Verify revoke was called
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.test.nylas.com/v3/grants/grant_to_revoke",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("Error Recovery and Resilience", () => {
    it("should handle network failures gracefully", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("nylasGrants", {
          userId: "user_123",
          grantId: "grant_123",
          email: "test@example.com",
          provider: "google",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Mock network failure
      (global.fetch as any).mockRejectedValueOnce(new Error("Network timeout"));

      await expect(
        t.withIdentity({ subject: "user_123" }).action(
          api.nylas.actions.fetchRecentEmails,
          {}
        )
      ).rejects.toThrowError("Network timeout");
    });

    it("should handle invalid grant gracefully", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("nylasGrants", {
          userId: "user_123",
          grantId: "invalid_grant",
          email: "test@example.com",
          provider: "google",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Mock 401 unauthorized (invalid grant)
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Grant has been revoked",
      });

      await expect(
        t.withIdentity({ subject: "user_123" }).action(
          api.nylas.actions.fetchRecentEmails,
          {}
        )
      ).rejects.toThrowError(/Authentication required/);
    });

    it("should clean up expired OAuth states automatically", async () => {
      // Create multiple expired states
      const now = Date.now();
      await t.run(async (ctx) => {
        for (let i = 0; i < 5; i++) {
          await ctx.db.insert("oauthStates", {
            state: `expired_state_${i}`,
            userId: `user_${i}`,
            redirectUri: "http://localhost:3000/callback",
            createdAt: now - 700000, // 11+ minutes ago
            expiresAt: now - 100000, // Expired
          });
        }
      });

      // Create one valid state
      await t.run(async (ctx) => {
        await ctx.db.insert("oauthStates", {
          state: "valid_state",
          userId: "user_valid",
          redirectUri: "http://localhost:3000/callback",
          createdAt: now,
          expiresAt: now + 600000,
        });
      });

      // Run cleanup
      const cleaned = await t.mutation(internal.nylas.internal.cleanupExpiredStates, {});
      expect(cleaned).toBe(5);

      // Verify only valid state remains
      const states = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });
      expect(states.length).toBe(1);
      expect(states[0].state).toBe("valid_state");
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent email fetches with rate limiting", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("nylasGrants", {
          userId: "user_123",
          grantId: "grant_123",
          email: "test@example.com",
          provider: "google",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Mock successful responses
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], next_cursor: null }),
      });

      // Make concurrent requests
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          t.withIdentity({ subject: "user_123" })
            .action(api.nylas.actions.fetchRecentEmails, {})
            .catch(err => ({ error: err.message }))
        );
      }

      const results = await Promise.all(promises);
      const errors = results.filter(r => 'error' in r);

      // Some requests should be rate limited
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.error.includes("Rate limit"))).toBe(true);
    });

    it("should handle concurrent OAuth initiations for same user", async () => {
      // Start multiple OAuth flows concurrently
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          t.withIdentity({ subject: "user_123" }).action(
            api.nylas.actions.initiateNylasAuth,
            {
              redirectUri: "http://localhost:3000/callback",
              provider: "google",
            }
          )
        );
      }

      const results = await Promise.all(promises);

      // All should succeed with different states
      const states = results.map(r => {
        const url = new URL(r.authUrl);
        return url.searchParams.get("state");
      });

      expect(new Set(states).size).toBe(3); // All states should be unique

      // Verify all states were stored
      const storedStates = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });
      expect(storedStates.length).toBe(3);
    });
  });
});