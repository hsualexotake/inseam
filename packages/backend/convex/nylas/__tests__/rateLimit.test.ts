import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";

describe("Rate Limiting", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", async () => {
      const result = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "user_123",
        endpoint: "emails"
      });

      expect(result.allowed).toBe(true);
    });

    it("should create rate limit record on first request", async () => {
      const result = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "user_123",
        endpoint: "emails"
      });
      
      expect(result.allowed).toBe(true);
      
      // Increment to create the record
      await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
        userId: "user_123",
        endpoint: "emails"
      });

      const limits = await t.run(async (ctx) => {
        return await ctx.db.query("rateLimits").collect();
      });

      expect(limits.length).toBe(1);
      expect(limits[0]).toMatchObject({
        userId: "user_123",
        endpoint: "emails",
        count: 1,
      });
    });

    it("should respect rate limits", async () => {
      // Set up a rate limit that's already at max
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "user_123",
          endpoint: "nylas.fetchEmails",
          count: 10,
          windowStart: Date.now(),
        });
      });

      const result = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "user_123",
        endpoint: "nylas.fetchEmails"
      });

      expect(result.allowed).toBe(false);
    });

    it("should reset window when expired", async () => {
      // Set up an expired rate limit
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "user_123",
          endpoint: "nylas.fetchEmails",
          count: 10,
          windowStart: Date.now() - 70000, // 70 seconds ago (window is 60 seconds)
        });
      });

      const result = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "user_123",
        endpoint: "nylas.fetchEmails"
      });

      expect(result.allowed).toBe(true);
      
      // Increment to trigger window reset
      await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
        userId: "user_123",
        endpoint: "nylas.fetchEmails"
      });

      // Check that window was reset
      const limits = await t.run(async (ctx) => {
        return await ctx.db.query("rateLimits").collect();
      });

      expect(limits[0].count).toBe(1);
      expect(limits[0].windowStart).toBeGreaterThan(Date.now() - 1000);
    });

    it("should handle different endpoints independently", async () => {
      // Max out one endpoint
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "user_123",
          endpoint: "nylas.fetchEmails",
          count: 10,
          windowStart: Date.now(),
        });
      });

      // Other endpoint should still work
      const result = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "user_123",
        endpoint: "emails.summarize"
      });

      expect(result.allowed).toBe(true);
    });

    it("should handle different users independently", async () => {
      // Max out one user
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "user_123",
          endpoint: "nylas.fetchEmails",
          count: 10,
          windowStart: Date.now(),
        });
      });

      // Other user should still work
      const result = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "user_456",
        endpoint: "nylas.fetchEmails"
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe("incrementRateLimit", () => {
    it("should increment count for existing limit", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "user_123",
          endpoint: "emails.summarize",
          count: 5,
          windowStart: Date.now(),
        });
      });

      await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
        userId: "user_123",
        endpoint: "emails.summarize"
      });

      const limits = await t.run(async (ctx) => {
        return await ctx.db.query("rateLimits").collect();
      });

      expect(limits[0].count).toBe(6);
    });

    it("should create new limit if none exists", async () => {
      await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
        userId: "user_123",
        endpoint: "emails.summarize"
      });

      const limits = await t.run(async (ctx) => {
        return await ctx.db.query("rateLimits").collect();
      });

      expect(limits.length).toBe(1);
      expect(limits[0].count).toBe(1);
    });

    it("should handle concurrent increments", async () => {
      // Create initial limit
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "user_123",
          endpoint: "emails",
          count: 0,
          windowStart: Date.now(),
        });
      });

      // Simulate concurrent increments
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
            userId: "user_123",
            endpoint: "emails"
          })
        );
      }

      await Promise.all(promises);

      const limits = await t.run(async (ctx) => {
        return await ctx.db.query("rateLimits").collect();
      });

      expect(limits[0].count).toBe(5);
    });
  });

  describe("resetRateLimit", () => {
    it("should reset count to zero", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "user_123",
          endpoint: "emails.summarize",
          count: 10,
          windowStart: Date.now() - 30000,
        });
      });

      await t.mutation(internal.nylas.rateLimit.resetRateLimit, {
        userId: "user_123",
        endpoint: "emails.summarize"
      });

      const limits = await t.run(async (ctx) => {
        return await ctx.db.query("rateLimits").collect();
      });

      expect(limits[0].count).toBe(0);
      expect(limits[0].windowStart).toBeGreaterThan(Date.now() - 1000);
    });

    it("should create new limit if none exists", async () => {
      await t.mutation(internal.nylas.rateLimit.resetRateLimit, {
        userId: "user_123",
        endpoint: "emails.summarize"
      });

      const limits = await t.run(async (ctx) => {
        return await ctx.db.query("rateLimits").collect();
      });

      expect(limits.length).toBe(1);
      expect(limits[0].count).toBe(0);
    });
  });

  describe("Rate limiting integration", () => {
    it("should enforce rate limits across check and increment", async () => {
      const results = [];

      for (let i = 0; i < 12; i++) {
        const checkResult = await t.query(internal.nylas.rateLimit.checkRateLimit, {
          userId: "user_123",
          endpoint: "nylas.fetchEmails"
        });
        
        if (checkResult.allowed) {
          await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
            userId: "user_123",
            endpoint: "nylas.fetchEmails"
          });
        }
        results.push(checkResult.allowed);
      }

      // First 10 should succeed
      expect(results.slice(0, 10).every(r => r === true)).toBe(true);
      // 11th and 12th should fail
      expect(results[10]).toBe(false);
      expect(results[11]).toBe(false);
    });

    it("should allow requests after window expires", async () => {
      // Max out rate limit
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "user_123",
          endpoint: "nylas.fetchEmails",
          count: 10,
          windowStart: Date.now() - 61000, // Just past 60 second window
        });
      });

      const checkResult = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "user_123",
        endpoint: "nylas.fetchEmails"
      });
      
      if (checkResult.allowed) {
        await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
          userId: "user_123",
          endpoint: "nylas.fetchEmails"
        });
      }

      expect(checkResult.allowed).toBe(true);

      // Verify count was reset and incremented
      const limits = await t.run(async (ctx) => {
        return await ctx.db.query("rateLimits").collect();
      });

      expect(limits[0].count).toBe(1);
    });

    it("should handle burst traffic correctly", async () => {
      // Simulate burst of requests - run sequentially since convex-test is synchronous
      const results = [];
      for (let i = 0; i < 20; i++) {
        const checkResult = await t.query(internal.nylas.rateLimit.checkRateLimit, {
          userId: "user_burst",
          endpoint: "nylas.fetchEmails"
        });
        if (checkResult.allowed) {
          await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
            userId: "user_burst",
            endpoint: "nylas.fetchEmails"
          });
          results.push(true);
        } else {
          results.push(false);
        }
      }

      const successful = results.filter(r => r === true).length;

      // Should allow exactly 10 requests (the limit for nylas.fetchEmails)
      expect(successful).toBe(10);
      expect(results.slice(0, 10).every(r => r === true)).toBe(true);
      expect(results.slice(10).every(r => r === false)).toBe(true);
    });

    it("should track different limits for different configurations", async () => {
      // Different limits for different endpoints
      const emailResults = [];
      const authResults = [];

      // Try 12 email requests (nylas.fetchEmails has limit of 10)
      for (let i = 0; i < 12; i++) {
        const checkResult = await t.query(internal.nylas.rateLimit.checkRateLimit, {
          userId: "user_123",
          endpoint: "nylas.fetchEmails"
        });
        if (checkResult.allowed) {
          await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
            userId: "user_123",
            endpoint: "nylas.fetchEmails"
          });
        }
        emailResults.push(checkResult.allowed);
      }

      // Try 7 auth requests (nylas.auth has limit of 5)
      for (let i = 0; i < 7; i++) {
        const checkResult = await t.query(internal.nylas.rateLimit.checkRateLimit, {
          userId: "user_123",
          endpoint: "nylas.auth"
        });
        if (checkResult.allowed) {
          await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
            userId: "user_123",
            endpoint: "nylas.auth"
          });
        }
        authResults.push(checkResult.allowed);
      }

      // Email: first 10 succeed, last 2 fail
      expect(emailResults.slice(0, 10).every(r => r === true)).toBe(true);
      expect(emailResults.slice(10).every(r => r === false)).toBe(true);

      // Auth: first 5 succeed, last 2 fail
      expect(authResults.slice(0, 5).every(r => r === true)).toBe(true);
      expect(authResults.slice(5).every(r => r === false)).toBe(true);
    });
  });

  describe("Rate Limit Edge Cases", () => {
    it("should handle rate limit window boundaries precisely", async () => {
      const now = Date.now();
      
      // Create rate limit past the window boundary
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "boundary_user",
          endpoint: "nylas.fetchEmails",
          count: 10,
          windowStart: now - 60001, // Just past window boundary
        });
      });

      // Should allow request (window expired)
      const result = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "boundary_user",
        endpoint: "nylas.fetchEmails"
      });
      
      expect(result.allowed).toBe(true);
    });

    it("should handle rate limits for unknown endpoints with defaults", async () => {
      const result = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "user_123",
        endpoint: "unknown.endpoint.name"
      });

      expect(result.allowed).toBe(true);

      // Should use default limits (30 per minute)
      for (let i = 0; i < 30; i++) {
        await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
          userId: "user_123",
          endpoint: "unknown.endpoint.name"
        });
      }

      const limitedResult = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "user_123",
        endpoint: "unknown.endpoint.name"
      });

      expect(limitedResult.allowed).toBe(false);
    });

    it("should handle very long user IDs and endpoint names", async () => {
      const longUserId = "user_" + "x".repeat(1000);
      const longEndpoint = "endpoint." + "y".repeat(1000);

      const result = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: longUserId,
        endpoint: longEndpoint
      });

      expect(result.allowed).toBe(true);

      await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
        userId: longUserId,
        endpoint: longEndpoint
      });

      const limits = await t.run(async (ctx) => {
        return await ctx.db.query("rateLimits").collect();
      });

      const longLimit = limits.find(l => l.userId === longUserId);
      expect(longLimit).toBeDefined();
      expect(longLimit?.count).toBe(1);
    });

    it("should handle concurrent window resets correctly", async () => {
      const now = Date.now();
      
      // Create expired rate limit
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "reset_user",
          endpoint: "nylas.fetchEmails",
          count: 10,
          windowStart: now - 70000, // Expired
        });
      });

      // Multiple concurrent checks and increments
      const operations = [];
      for (let i = 0; i < 5; i++) {
        operations.push(
          (async () => {
            const check = await t.query(internal.nylas.rateLimit.checkRateLimit, {
              userId: "reset_user",
              endpoint: "nylas.fetchEmails"
            });
            if (check.allowed) {
              await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
                userId: "reset_user",
                endpoint: "nylas.fetchEmails"
              });
            }
            return check.allowed;
          })()
        );
      }

      const results = await Promise.all(operations);

      // All should succeed (window was expired)
      expect(results.every(r => r === true)).toBe(true);

      // Final count should be 5
      const finalLimit = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .filter(q => 
            q.and(
              q.eq(q.field("userId"), "reset_user"),
              q.eq(q.field("endpoint"), "nylas.fetchEmails")
            )
          )
          .first();
      });

      expect(finalLimit?.count).toBe(5);
      expect(finalLimit?.windowStart).toBeGreaterThan(now - 1000);
    });

    it("should handle negative window starts gracefully", async () => {
      // This shouldn't happen in practice, but test defensive programming
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          userId: "negative_user",
          endpoint: "test.endpoint",
          count: 5,
          windowStart: -1000, // Negative timestamp (invalid)
        });
      });

      const result = await t.query(internal.nylas.rateLimit.checkRateLimit, {
        userId: "negative_user",
        endpoint: "test.endpoint"
      });

      // Should treat as expired and allow
      expect(result.allowed).toBe(true);
    });

    it("should maintain separate limits for similar endpoint names", async () => {
      const endpoints = [
        "nylas.fetchEmails",
        "nylas.fetchEmail",
        "nylas_fetchEmails",
        "NYLAS.FETCHEMAILS"
      ];

      // Increment each endpoint separately
      for (const endpoint of endpoints) {
        for (let i = 0; i < 3; i++) {
          await t.mutation(internal.nylas.rateLimit.incrementRateLimit, {
            userId: "similar_user",
            endpoint
          });
        }
      }

      // Check all limits were tracked separately
      const limits = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .filter(q => q.eq(q.field("userId"), "similar_user"))
          .collect();
      });

      expect(limits.length).toBe(4);
      expect(limits.every(l => l.count === 3)).toBe(true);
    });

    it("should handle reset of non-existent rate limit", async () => {
      // Reset should create a new limit with count 0
      await t.mutation(internal.nylas.rateLimit.resetRateLimit, {
        userId: "new_reset_user",
        endpoint: "new.endpoint"
      });

      const limit = await t.run(async (ctx) => {
        return await ctx.db
          .query("rateLimits")
          .filter(q => 
            q.and(
              q.eq(q.field("userId"), "new_reset_user"),
              q.eq(q.field("endpoint"), "new.endpoint")
            )
          )
          .first();
      });

      expect(limit).toBeDefined();
      expect(limit?.count).toBe(0);
      expect(limit?.windowStart).toBeLessThanOrEqual(Date.now());
      expect(limit?.windowStart).toBeGreaterThan(Date.now() - 1000);
    });
  });
});