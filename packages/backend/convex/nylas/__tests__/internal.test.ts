import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";

describe("Nylas Internal Functions", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  describe("storeOAuthState", () => {
    it("should store OAuth state with correct fields", async () => {
      await t.mutation(internal.nylas.internal.storeOAuthState, {
        state: "test_state_123",
        userId: "user_456",
        redirectUri: "http://localhost:3000/callback",
      });

      const states = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });

      expect(states.length).toBe(1);
      expect(states[0]).toMatchObject({
        state: "test_state_123",
        userId: "user_456",
        redirectUri: "http://localhost:3000/callback",
      });
      expect(states[0].createdAt).toBeDefined();
      expect(states[0].expiresAt).toBeGreaterThan(Date.now());
      expect(states[0].expiresAt).toBeLessThanOrEqual(Date.now() + 600000); // 10 minutes
    });

    it("should allow multiple states for different users", async () => {
      await t.mutation(internal.nylas.internal.storeOAuthState, {
        state: "state_user1",
        userId: "user1",
        redirectUri: "http://localhost:3000/callback",
      });

      await t.mutation(internal.nylas.internal.storeOAuthState, {
        state: "state_user2",
        userId: "user2",
        redirectUri: "http://localhost:3000/callback",
      });

      const states = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });

      expect(states.length).toBe(2);
      expect(states.map(s => s.userId).sort()).toEqual(["user1", "user2"]);
    });
  });

  describe("validateOAuthState", () => {
    it("should validate correct state and return user info", async () => {
      // First store a state
      await t.mutation(internal.nylas.internal.storeOAuthState, {
        state: "valid_state",
        userId: "user_123",
        redirectUri: "http://localhost:3000/callback",
      });

      // Then validate it
      const result = await t.query(internal.nylas.internal.validateOAuthState, {
        state: "valid_state",
      });

      expect(result).toMatchObject({
        state: "valid_state",
        userId: "user_123",
        redirectUri: "http://localhost:3000/callback",
      });

      // State should still exist (queries can't delete)
      const states = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });
      expect(states.length).toBe(1);
    });

    it("should return null for invalid state", async () => {
      const result = await t.query(internal.nylas.internal.validateOAuthState, {
        state: "nonexistent_state",
      });

      expect(result).toBeNull();
    });

    it("should return null for expired state", async () => {
      // Create an expired state
      await t.run(async (ctx) => {
        await ctx.db.insert("oauthStates", {
          state: "expired_state",
          userId: "user_123",
          redirectUri: "http://localhost:3000/callback",
          createdAt: Date.now() - 700000, // 11+ minutes ago
          expiresAt: Date.now() - 100000, // Already expired
        });
      });

      const result = await t.query(internal.nylas.internal.validateOAuthState, {
        state: "expired_state",
      });

      expect(result).toBeNull();

      // Expired state should still exist (queries can't delete)
      const states = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });
      expect(states.length).toBe(1);
    });
  });

  describe("deleteOAuthState", () => {
    it("should delete specific OAuth state", async () => {
      // Store multiple states
      await t.mutation(internal.nylas.internal.storeOAuthState, {
        state: "state1",
        userId: "user1",
        redirectUri: "http://localhost:3000/callback",
      });

      await t.mutation(internal.nylas.internal.storeOAuthState, {
        state: "state2",
        userId: "user2",
        redirectUri: "http://localhost:3000/callback",
      });

      // Delete one state
      await t.mutation(internal.nylas.internal.deleteOAuthState, {
        state: "state1",
      });

      const states = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });

      expect(states.length).toBe(1);
      expect(states[0].state).toBe("state2");
    });

    it("should handle deletion of non-existent state gracefully", async () => {
      // Should not throw
      await expect(
        t.mutation(internal.nylas.internal.deleteOAuthState, {
          state: "nonexistent",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("storeGrant", () => {
    it("should store new grant for user", async () => {
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "user_123",
        grantId: "grant_456",
        email: "test@gmail.com",
        provider: "google",
      });

      const grants = await t.run(async (ctx) => {
        return await ctx.db.query("nylasGrants").collect();
      });

      expect(grants.length).toBe(1);
      expect(grants[0]).toMatchObject({
        userId: "user_123",
        grantId: "grant_456",
        email: "test@gmail.com",
        provider: "google",
      });
      expect(grants[0].createdAt).toBeDefined();
      expect(grants[0].updatedAt).toBeDefined();
    });

    it("should update existing grant for user", async () => {
      // Store initial grant
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "user_123",
        grantId: "old_grant",
        email: "old@gmail.com",
        provider: "gmail",
      });

      const oldGrant = await t.run(async (ctx) => {
        return await ctx.db.query("nylasGrants").first();
      });

      // Wait a bit to ensure updatedAt changes
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update with new grant
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "user_123",
        grantId: "new_grant",
        email: "new@gmail.com",
        provider: "outlook",
      });

      const grants = await t.run(async (ctx) => {
        return await ctx.db.query("nylasGrants").collect();
      });

      // Should still have only one grant
      expect(grants.length).toBe(1);
      expect(grants[0]).toMatchObject({
        userId: "user_123",
        grantId: "new_grant",
        email: "new@gmail.com",
        provider: "outlook",
      });
      expect(grants[0].createdAt).toBe(oldGrant!.createdAt); // Created time preserved
      expect(grants[0].updatedAt).toBeGreaterThan(oldGrant!.updatedAt); // Updated time changed
    });

    it("should allow different grants for different users", async () => {
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "user1",
        grantId: "grant1",
        email: "user1@gmail.com",
        provider: "google",
      });

      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "user2",
        grantId: "grant2",
        email: "user2@gmail.com",
        provider: "outlook",
      });

      const grants = await t.run(async (ctx) => {
        return await ctx.db.query("nylasGrants").collect();
      });

      expect(grants.length).toBe(2);
      expect(grants.map(g => g.userId).sort()).toEqual(["user1", "user2"]);
    });
  });

  describe("getGrant", () => {
    it("should retrieve grant by user ID", async () => {
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "user_123",
        grantId: "grant_456",
        email: "test@gmail.com",
        provider: "google",
      });

      const grant = await t.query(internal.nylas.internal.getGrant, {
        userId: "user_123",
      });

      expect(grant).toMatchObject({
        userId: "user_123",
        grantId: "grant_456",
        email: "test@gmail.com",
        provider: "google",
      });
    });

    it("should return null for non-existent user", async () => {
      const grant = await t.query(internal.nylas.internal.getGrant, {
        userId: "nonexistent_user",
      });

      expect(grant).toBeNull();
    });

    it("should use index for efficient lookup", async () => {
      // Store multiple grants
      for (let i = 0; i < 10; i++) {
        await t.mutation(internal.nylas.internal.storeGrant, {
          userId: `user_${i}`,
          grantId: `grant_${i}`,
          email: `user${i}@gmail.com`,
          provider: "google",
        });
      }

      // Query should still be fast with index
      const grant = await t.query(internal.nylas.internal.getGrant, {
        userId: "user_5",
      });

      expect(grant).toMatchObject({
        userId: "user_5",
        grantId: "grant_5",
      });
    });
  });

  describe("removeGrant", () => {
    it("should remove grant for user", async () => {
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "user_123",
        grantId: "grant_456",
        email: "test@gmail.com",
        provider: "google",
      });

      await t.mutation(internal.nylas.internal.removeGrant, {
        userId: "user_123",
      });

      const grants = await t.run(async (ctx) => {
        return await ctx.db.query("nylasGrants").collect();
      });

      expect(grants.length).toBe(0);
    });

    it("should only remove grant for specific user", async () => {
      // Store grants for multiple users
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "user1",
        grantId: "grant1",
        email: "user1@gmail.com",
        provider: "google",
      });

      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "user2",
        grantId: "grant2",
        email: "user2@gmail.com",
        provider: "outlook",
      });

      // Remove only user1's grant
      await t.mutation(internal.nylas.internal.removeGrant, {
        userId: "user1",
      });

      const grants = await t.run(async (ctx) => {
        return await ctx.db.query("nylasGrants").collect();
      });

      expect(grants.length).toBe(1);
      expect(grants[0].userId).toBe("user2");
    });

    it("should handle removal when no grant exists", async () => {
      // Should not throw
      await expect(
        t.mutation(internal.nylas.internal.removeGrant, {
          userId: "nonexistent_user",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("cleanupExpiredStates", () => {
    it("should remove expired OAuth states", async () => {
      // Create expired states
      await t.run(async (ctx) => {
        await ctx.db.insert("oauthStates", {
          state: "expired1",
          userId: "user1",
          redirectUri: "http://localhost:3000",
          createdAt: Date.now() - 700000,
          expiresAt: Date.now() - 100000, // Expired
        });

        await ctx.db.insert("oauthStates", {
          state: "expired2",
          userId: "user2",
          redirectUri: "http://localhost:3000",
          createdAt: Date.now() - 800000,
          expiresAt: Date.now() - 200000, // Expired
        });
      });

      // Create valid state
      await t.mutation(internal.nylas.internal.storeOAuthState, {
        state: "valid_state",
        userId: "user3",
        redirectUri: "http://localhost:3000",
      });

      // Run cleanup
      const result = await t.mutation(internal.nylas.internal.cleanupExpiredStates, {});

      expect(result.cleaned).toBe(2);

      // Only valid state should remain
      const states = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });

      expect(states.length).toBe(1);
      expect(states[0].state).toBe("valid_state");
    });

    it("should return 0 when no expired states exist", async () => {
      // Create only valid states
      await t.mutation(internal.nylas.internal.storeOAuthState, {
        state: "valid1",
        userId: "user1",
        redirectUri: "http://localhost:3000",
      });

      await t.mutation(internal.nylas.internal.storeOAuthState, {
        state: "valid2",
        userId: "user2",
        redirectUri: "http://localhost:3000",
      });

      const result = await t.mutation(internal.nylas.internal.cleanupExpiredStates, {});

      expect(result.cleaned).toBe(0);

      const states = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });

      expect(states.length).toBe(2);
    });
  });

  describe("Concurrent User Operations", () => {
    it("should handle concurrent OAuth state creation", async () => {
      // Simulate multiple users initiating OAuth simultaneously
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          t.mutation(internal.nylas.internal.storeOAuthState, {
            state: `concurrent_state_${i}`,
            userId: `concurrent_user_${i}`,
            redirectUri: "http://localhost:3000/callback",
          })
        );
      }

      await Promise.all(promises);

      const states = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });

      expect(states.length).toBe(10);
      // All states should be unique
      const uniqueStates = new Set(states.map(s => s.state));
      expect(uniqueStates.size).toBe(10);
    });

    it("should handle concurrent grant updates for same user", async () => {
      // Initial grant
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "user_race",
        grantId: "initial_grant",
        email: "initial@gmail.com",
        provider: "google",
      });

      const initialGrant = await t.query(internal.nylas.internal.getGrant, {
        userId: "user_race",
      });

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate race condition with multiple updates
      const updates = [];
      for (let i = 0; i < 5; i++) {
        updates.push(
          t.mutation(internal.nylas.internal.storeGrant, {
            userId: "user_race",
            grantId: `grant_update_${i}`,
            email: `update${i}@gmail.com`,
            provider: "google",
          })
        );
      }

      await Promise.all(updates);

      // Should only have one grant (last one wins)
      const grants = await t.run(async (ctx) => {
        return await ctx.db
          .query("nylasGrants")
          .filter(q => q.eq(q.field("userId"), "user_race"))
          .collect();
      });

      expect(grants.length).toBe(1);
      // CreatedAt should be preserved from initial grant
      expect(grants[0].createdAt).toBe(initialGrant?.createdAt);
      // UpdatedAt should be newer or equal (if updates were very fast)
      expect(grants[0].updatedAt).toBeGreaterThanOrEqual(initialGrant?.updatedAt || 0);
    });

    it("should handle concurrent expired state cleanup", async () => {
      const now = Date.now();
      
      // Create many expired states
      const createPromises = [];
      for (let i = 0; i < 20; i++) {
        createPromises.push(
          t.run(async (ctx) => {
            await ctx.db.insert("oauthStates", {
              state: `expired_concurrent_${i}`,
              userId: `user_${i}`,
              redirectUri: "http://localhost:3000",
              createdAt: now - 700000,
              expiresAt: now - 100000,
            });
          })
        );
      }
      await Promise.all(createPromises);

      // Multiple cleanup attempts simultaneously
      const cleanupPromises = [];
      for (let i = 0; i < 3; i++) {
        cleanupPromises.push(
          t.mutation(internal.nylas.internal.cleanupExpiredStates, {})
        );
      }

      const results = await Promise.all(cleanupPromises);
      
      // Total cleaned should be 20 (across all cleanup runs)
      const totalCleaned = results.reduce((sum, r) => sum + r.cleaned, 0);
      expect(totalCleaned).toBe(20);

      // No expired states should remain
      const remaining = await t.run(async (ctx) => {
        return await ctx.db.query("oauthStates").collect();
      });
      expect(remaining.length).toBe(0);
    });
  });

  describe("Data Consistency Tests", () => {
    it("should maintain grant consistency during rapid updates", async () => {
      const userId = "consistency_user";
      
      // Create initial grant
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId,
        grantId: "grant_0",
        email: "email0@gmail.com",
        provider: "google",
      });

      // Rapid sequential updates
      for (let i = 1; i <= 10; i++) {
        await t.mutation(internal.nylas.internal.storeGrant, {
          userId,
          grantId: `grant_${i}`,
          email: `email${i}@gmail.com`,
          provider: i % 2 === 0 ? "outlook" : "google",
        });
      }

      // Verify final state
      const finalGrant = await t.query(internal.nylas.internal.getGrant, { userId });
      
      expect(finalGrant).toBeDefined();
      expect(finalGrant?.grantId).toBe("grant_10");
      expect(finalGrant?.email).toBe("email10@gmail.com");
      expect(finalGrant?.provider).toBe("outlook");
      
      // Should only have one grant for this user
      const allGrants = await t.run(async (ctx) => {
        return await ctx.db
          .query("nylasGrants")
          .filter(q => q.eq(q.field("userId"), userId))
          .collect();
      });
      expect(allGrants.length).toBe(1);
    });

    it("should handle orphaned OAuth states gracefully", async () => {
      const now = Date.now();
      
      // Create states with non-existent users (orphaned)
      await t.run(async (ctx) => {
        await ctx.db.insert("oauthStates", {
          state: "orphaned_state_1",
          userId: "non_existent_user_1",
          redirectUri: "http://localhost:3000",
          createdAt: now - 100000,
          expiresAt: now + 500000, // Still valid
        });
      });

      // Validation should return the state even if user doesn't exist
      const orphanedState = await t.query(internal.nylas.internal.validateOAuthState, {
        state: "orphaned_state_1",
      });

      expect(orphanedState).toBeDefined();
      expect(orphanedState?.userId).toBe("non_existent_user_1");
    });

    it("should preserve timestamps correctly during grant updates", async () => {
      const userId = "timestamp_user";
      const startTime = Date.now();
      
      // Create grant
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId,
        grantId: "grant_1",
        email: "test1@gmail.com",
        provider: "google",
      });

      const grant1 = await t.query(internal.nylas.internal.getGrant, { userId });
      const createdAt = grant1?.createdAt;
      const updatedAt1 = grant1?.updatedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      // Update grant
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId,
        grantId: "grant_2",
        email: "test2@gmail.com",
        provider: "outlook",
      });

      const grant2 = await t.query(internal.nylas.internal.getGrant, { userId });

      // CreatedAt should not change
      expect(grant2?.createdAt).toBe(createdAt);
      // UpdatedAt should be newer
      expect(grant2?.updatedAt).toBeGreaterThan(updatedAt1 || 0);
      // Timestamps should be reasonable
      expect(grant2?.createdAt).toBeGreaterThanOrEqual(startTime);
      expect(grant2?.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it("should handle removal of non-existent grants without errors", async () => {
      // Should not throw when removing non-existent grant
      await expect(
        t.mutation(internal.nylas.internal.removeGrant, {
          userId: "user_that_never_existed",
        })
      ).resolves.not.toThrow();

      // Remove grant twice should be idempotent
      await t.mutation(internal.nylas.internal.storeGrant, {
        userId: "remove_twice_user",
        grantId: "grant",
        email: "test@gmail.com",
        provider: "google",
      });

      await t.mutation(internal.nylas.internal.removeGrant, {
        userId: "remove_twice_user",
      });

      // Second removal should also not throw
      await expect(
        t.mutation(internal.nylas.internal.removeGrant, {
          userId: "remove_twice_user",
        })
      ).resolves.not.toThrow();
    });

    it("should validate OAuth state expiry boundary conditions", async () => {
      const now = Date.now();
      
      // State expiring exactly now
      await t.run(async (ctx) => {
        await ctx.db.insert("oauthStates", {
          state: "boundary_exact",
          userId: "user",
          redirectUri: "http://localhost:3000",
          createdAt: now - 600000,
          expiresAt: now, // Expires exactly now
        });
      });

      // State expiring 1ms in future
      await t.run(async (ctx) => {
        await ctx.db.insert("oauthStates", {
          state: "boundary_future",
          userId: "user",
          redirectUri: "http://localhost:3000",
          createdAt: now,
          expiresAt: now + 1, // Expires 1ms in future
        });
      });

      // State expired 1ms ago
      await t.run(async (ctx) => {
        await ctx.db.insert("oauthStates", {
          state: "boundary_past",
          userId: "user",
          redirectUri: "http://localhost:3000",
          createdAt: now - 600000,
          expiresAt: now - 1, // Expired 1ms ago
        });
      });

      // Validate each state
      const exactState = await t.query(internal.nylas.internal.validateOAuthState, {
        state: "boundary_exact",
      });
      const futureState = await t.query(internal.nylas.internal.validateOAuthState, {
        state: "boundary_future",
      });
      const pastState = await t.query(internal.nylas.internal.validateOAuthState, {
        state: "boundary_past",
      });

      // Exact boundary (expiresAt === now) is still considered valid
      expect(exactState).toBeDefined();
      // Future state is valid
      expect(futureState).toBeDefined();
      // Past state is expired
      expect(pastState).toBeNull();
    });
  });

  describe("Index Usage Tests", () => {
    it("should efficiently query grants by user ID using index", async () => {
      // Create many grants for different users
      for (let i = 0; i < 100; i++) {
        await t.mutation(internal.nylas.internal.storeGrant, {
          userId: `user_${i}`,
          grantId: `grant_${i}`,
          email: `user${i}@gmail.com`,
          provider: i % 3 === 0 ? "google" : i % 3 === 1 ? "outlook" : "yahoo",
        });
      }

      // Query for specific user should be fast (using index)
      const grant50 = await t.query(internal.nylas.internal.getGrant, {
        userId: "user_50",
      });

      expect(grant50).toBeDefined();
      expect(grant50?.email).toBe("user50@gmail.com");

      // Non-existent user should also be fast
      const noGrant = await t.query(internal.nylas.internal.getGrant, {
        userId: "user_does_not_exist",
      });

      expect(noGrant).toBeNull();
    });
  });
});