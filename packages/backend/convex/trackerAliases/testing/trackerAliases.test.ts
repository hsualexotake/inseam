import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";

describe("TrackerAliases - Real World Scenarios and Edge Cases", () => {
  let t: ReturnType<typeof convexTest>;

  // Test users
  const mockUser1 = {
    subject: "user_2mGDwW4oBDPF9Abc1234567",
    issuer: "https://example.clerk.dev"
  };

  const mockUser2 = {
    subject: "user_3nHExY5pCEQG0Def8901234",
    issuer: "https://example.clerk.dev"
  };

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  // Helper to create a tracker with data
  async function setupTrackerWithData(userId: string) {
    const trackerId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("trackers", {
        userId,
        name: "Test Tracker",
        slug: "test-tracker",
        description: "Test tracker",
        columns: [
          {
            id: "col_1",
            key: "sku",
            name: "SKU Code",
            type: "text",
            required: true,
            order: 0,
            width: 100
          },
          {
            id: "col_2",
            key: "description",
            name: "Description",
            type: "text",
            required: false,
            order: 1,
            width: 200
          }
        ],
        primaryKeyColumn: "sku",
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      // Add some test rows
      await ctx.db.insert("trackerData", {
        trackerId: id,
        rowId: "12",
        data: { sku: "12", description: "Green Summer Dress" },
        createdAt: Date.now(),
        createdBy: userId,
        updatedAt: Date.now(),
        updatedBy: userId
      });

      await ctx.db.insert("trackerData", {
        trackerId: id,
        rowId: "45",
        data: { sku: "45", description: "Blue Cotton Shirt" },
        createdAt: Date.now(),
        createdBy: userId,
        updatedAt: Date.now(),
        updatedBy: userId
      });

      return id;
    });

    return trackerId;
  }

  describe("Real-World Alias Resolution", () => {
    it("should resolve descriptive alias to actual SKU", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Add alias "green dress" for SKU 12
      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: "green dress"
        }
      );

      // Resolve the alias
      const resolved = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.trackerAliases.resolveAlias, {
          trackerId,
          searchTerm: "green dress"
        });
      });

      expect(resolved).toBeDefined();
      expect(resolved?.rowId).toBe("12");
    });

    it("should handle multiple aliases for the same item", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Add multiple aliases for SKU 12
      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: "green dress"
        }
      );

      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: "summer collection item"
        }
      );

      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: "vestido verde" // Spanish
        }
      );

      // All aliases should resolve to SKU 12
      const resolved1 = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.trackerAliases.resolveAlias, {
          trackerId,
          searchTerm: "green dress"
        });
      });
      expect(resolved1?.rowId).toBe("12");

      const resolved2 = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.trackerAliases.resolveAlias, {
          trackerId,
          searchTerm: "summer collection item"
        });
      });
      expect(resolved2?.rowId).toBe("12");

      const resolved3 = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.trackerAliases.resolveAlias, {
          trackerId,
          searchTerm: "vestido verde"
        });
      });
      expect(resolved3?.rowId).toBe("12");
    });

    it("should handle case-insensitive matching correctly", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Add alias with mixed case
      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: "Green Dress"
        }
      );

      // Should resolve with different cases
      const testCases = [
        "green dress",
        "GREEN DRESS",
        "Green Dress",
        "gReEn DrEsS"
      ];

      for (const searchTerm of testCases) {
        const resolved = await t.run(async (ctx) => {
          return await ctx.runQuery(internal.trackerAliases.resolveAlias, {
            trackerId,
            searchTerm
          });
        });
        expect(resolved?.rowId).toBe("12");
      }
    });
  });

  describe("Edge Cases and Validation", () => {
    it("should prevent duplicate aliases (case-insensitive)", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Add initial alias
      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: "Green Dress"
        }
      );

      // Try to add same alias with different case - should fail
      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerAliases.addRowAlias,
          {
            trackerId,
            rowId: "12",
            alias: "green dress" // lowercase
          }
        )
      ).rejects.toThrow(/already exists/i);

      // Try to add same alias for different SKU - should also fail
      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerAliases.addRowAlias,
          {
            trackerId,
            rowId: "45",
            alias: "GREEN DRESS" // uppercase
          }
        )
      ).rejects.toThrow(/already used/i);
    });

    it("should reject circular/self-referencing aliases", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Try to create alias "12" for SKU "12" (circular)
      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerAliases.addRowAlias,
          {
            trackerId,
            rowId: "12",
            alias: "12" // Same as the SKU itself
          }
        )
      ).rejects.toThrow(); // Should reject as meaningless
    });

    it("should handle SQL injection attempts safely", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Try SQL injection in alias
      const maliciousAlias = "'; DROP TABLE trackers; --";

      // Should store safely as string, not execute
      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: maliciousAlias
        }
      );

      // Verify it was stored as plain text
      const aliases = await t.withIdentity(mockUser1).query(
        api.trackerAliases.getRowAliases,
        { trackerId, rowId: "12" }
      );

      expect(aliases).toHaveLength(1);
      expect(aliases[0].alias).toBe(maliciousAlias.toLowerCase().trim());

      // Verify database is intact
      const trackerStillExists = await t.run(async (ctx) => {
        return await ctx.db.get(trackerId);
      });
      expect(trackerStillExists).toBeDefined();
    });

    it("should handle Unicode and special characters correctly", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Test various Unicode and special characters
      const specialAliases = [
        "👗 Vestido Verde México",
        "50% off-season (limited)",
        "Green/Summer Dress [2024]",
        "Grünes Kleid €29.99",
        "绿色连衣裙", // Chinese
        "فستان أخضر", // Arabic
        "Зеленое платье" // Russian
      ];

      for (const alias of specialAliases) {
        await t.withIdentity(mockUser1).mutation(
          api.trackerAliases.addRowAlias,
          {
            trackerId,
            rowId: "12",
            alias
          }
        );
      }

      // All should be stored and retrievable
      const aliases = await t.withIdentity(mockUser1).query(
        api.trackerAliases.getRowAliases,
        { trackerId, rowId: "12" }
      );

      expect(aliases).toHaveLength(specialAliases.length);

      // Each should resolve correctly
      for (const alias of specialAliases) {
        const resolved = await t.run(async (ctx) => {
          return await ctx.runQuery(internal.trackerAliases.resolveAlias, {
            trackerId,
            searchTerm: alias
          });
        });
        expect(resolved?.rowId).toBe("12");
      }
    });

    it("should enforce length limits on aliases", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Create alias at exactly 100 chars (should work)
      const exactly100 = "a".repeat(100);
      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: exactly100
        }
      );

      // Try to create alias over 100 chars (should fail)
      const over100 = "a".repeat(101);
      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerAliases.addRowAlias,
          {
            trackerId,
            rowId: "12",
            alias: over100
          }
        )
      ).rejects.toThrow(/100 characters or less/i);
    });

    it("should reject empty or whitespace-only aliases", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Test various empty/whitespace aliases
      const invalidAliases = [
        "",
        " ",
        "   ",
        "\t",
        "\n",
        " \t\n "
      ];

      for (const alias of invalidAliases) {
        await expect(
          t.withIdentity(mockUser1).mutation(
            api.trackerAliases.addRowAlias,
            {
              trackerId,
              rowId: "12",
              alias
            }
          )
        ).rejects.toThrow(/empty/i);
      }
    });
  });

  describe("Authorization and Security", () => {
    it("should prevent unauthorized users from adding aliases", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // User2 tries to add alias to User1's tracker - should fail
      await expect(
        t.withIdentity(mockUser2).mutation(
          api.trackerAliases.addRowAlias,
          {
            trackerId,
            rowId: "12",
            alias: "unauthorized alias"
          }
        )
      ).rejects.toThrow(/not authorized/i);
    });

    it("should prevent unauthorized users from removing aliases", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // User1 adds an alias
      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: "green dress"
        }
      );

      // Get the alias ID
      const aliases = await t.withIdentity(mockUser1).query(
        api.trackerAliases.getRowAliases,
        { trackerId, rowId: "12" }
      );
      const aliasId = aliases[0]._id;

      // User2 tries to remove it - should fail
      await expect(
        t.withIdentity(mockUser2).mutation(
          api.trackerAliases.removeRowAlias,
          { aliasId }
        )
      ).rejects.toThrow(/not authorized/i);
    });

    it("should not leak data to unauthorized users", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // User1 adds aliases
      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: "confidential product"
        }
      );

      // User2 tries to get all aliases - should return empty
      const aliases = await t.withIdentity(mockUser2).query(
        api.trackerAliases.getAllTrackerAliases,
        { trackerId }
      );

      expect(aliases).toEqual([]); // Should not see User1's data
    });
  });

  describe("Bulk Operations", () => {
    it("should handle bulk alias imports correctly", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      const bulkAliases = [
        { rowId: "12", alias: "green dress" },
        { rowId: "12", alias: "summer dress" },
        { rowId: "45", alias: "blue shirt" },
        { rowId: "45", alias: "cotton shirt" },
      ];

      const result = await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.bulkAddAliases,
        {
          trackerId,
          aliases: bulkAliases
        }
      );

      expect(result.success).toHaveLength(4);
      expect(result.failed).toHaveLength(0);

      // Verify all were added
      const sku12Aliases = await t.withIdentity(mockUser1).query(
        api.trackerAliases.getRowAliases,
        { trackerId, rowId: "12" }
      );
      expect(sku12Aliases).toHaveLength(2);

      const sku45Aliases = await t.withIdentity(mockUser1).query(
        api.trackerAliases.getRowAliases,
        { trackerId, rowId: "45" }
      );
      expect(sku45Aliases).toHaveLength(2);
    });

    it("should handle partial failures in bulk import", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Add one alias first
      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: "green dress"
        }
      );

      // Try bulk import with some duplicates
      const bulkAliases = [
        { rowId: "12", alias: "green dress" }, // Duplicate - should fail
        { rowId: "12", alias: "summer dress" }, // New - should succeed
        { rowId: "45", alias: "blue shirt" }, // New - should succeed
        { rowId: "45", alias: "" }, // Empty - should fail
      ];

      const result = await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.bulkAddAliases,
        {
          trackerId,
          aliases: bulkAliases
        }
      );

      expect(result.success).toHaveLength(2); // 2 should succeed
      expect(result.failed).toHaveLength(2); // 2 should fail
      expect(result.failed[0].reason).toContain("Already exists");
      expect(result.failed[1].reason).toContain("Empty alias");
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent alias additions gracefully", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Try to add the same alias concurrently
      const promises = Array(5).fill(null).map(() =>
        t.withIdentity(mockUser1).mutation(
          api.trackerAliases.addRowAlias,
          {
            trackerId,
            rowId: "12",
            alias: "concurrent alias"
          }
        ).catch(err => ({ error: err.message }))
      );

      const results = await Promise.all(promises);

      // Only one should succeed
      const successes = results.filter(r => !('error' in r));
      const failures = results.filter(r => 'error' in r);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(4);

      // All failures should be due to duplicate
      failures.forEach(f => {
        expect(f.error).toMatch(/already exists/i);
      });
    });

    it("should handle concurrent alias removals safely", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Add an alias
      await t.withIdentity(mockUser1).mutation(
        api.trackerAliases.addRowAlias,
        {
          trackerId,
          rowId: "12",
          alias: "to be removed"
        }
      );

      // Get the alias ID
      const aliases = await t.withIdentity(mockUser1).query(
        api.trackerAliases.getRowAliases,
        { trackerId, rowId: "12" }
      );
      const aliasId = aliases[0]._id;

      // Try to remove it concurrently
      const promises = Array(3).fill(null).map(() =>
        t.withIdentity(mockUser1).mutation(
          api.trackerAliases.removeRowAlias,
          { aliasId }
        ).catch(err => ({ error: err.message }))
      );

      const results = await Promise.all(promises);

      // Only one should succeed
      const successes = results.filter(r => !('error' in r));
      const failures = results.filter(r => 'error' in r);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(2);

      // Failures should be because alias no longer exists
      failures.forEach(f => {
        expect(f.error).toMatch(/not found/i);
      });
    });
  });

  describe("Performance", () => {
    it("should resolve aliases quickly with many aliases defined", async () => {
      const trackerId = await setupTrackerWithData(mockUser1.subject);

      // Add 100 aliases
      for (let i = 0; i < 100; i++) {
        await t.withIdentity(mockUser1).mutation(
          api.trackerAliases.addRowAlias,
          {
            trackerId,
            rowId: i < 50 ? "12" : "45",
            alias: `alias_${i}`
          }
        );
      }

      // Measure resolution time
      const start = Date.now();
      const resolved = await t.run(async (ctx) => {
        return await ctx.runQuery(internal.trackerAliases.resolveAlias, {
          trackerId,
          searchTerm: "alias_50"
        });
      });
      const duration = Date.now() - start;

      expect(resolved?.rowId).toBe("45");
      expect(duration).toBeLessThan(100); // Should resolve in under 100ms
    });
  });
});