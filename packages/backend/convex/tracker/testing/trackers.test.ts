import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { modules } from "../../test.setup";
import {
  mockUser,
  mockUser2,
  createMockTracker,
  createMockRowData,
  expectAsyncError,
  createMockPaginationOpts,
} from "./testHelpers";

describe("Tracker CRUD Operations", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  describe("createTracker", () => {
    it("should create a tracker with valid data", async () => {
      const trackerData = createMockTracker();
      
      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        trackerData
      );

      expect(result.trackerId).toBeDefined();
      expect(result.slug).toBe("test-tracker");
    });

    it("should generate unique slugs for duplicate names", async () => {
      const trackerData = createMockTracker();
      
      // Create first tracker
      const result1 = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        trackerData
      );
      expect(result1.slug).toBe("test-tracker");

      // Create second tracker with same name
      const result2 = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        trackerData
      );
      expect(result2.slug).toBe("test-tracker-1");

      // Create third tracker with same name
      const result3 = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        trackerData
      );
      expect(result3.slug).toBe("test-tracker-2");
    });

    it("should handle special characters in tracker name", async () => {
      const trackerData = createMockTracker({
        name: "Test Tracker!@#$%^&*()",
      });
      
      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        trackerData
      );

      expect(result.slug).toBe("test-tracker");
    });

    it("should handle unicode in tracker name", async () => {
      const trackerData = createMockTracker({
        name: "测试 Tracker 🚀",
      });
      
      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        trackerData
      );

      expect(result.slug).toBeDefined();
      expect(result.slug).not.toContain("🚀");
    });

    it("should truncate very long names", async () => {
      const trackerData = createMockTracker({
        name: "x".repeat(100),
      });
      
      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        trackerData
      );

      expect(result.slug.length).toBeLessThanOrEqual(50);
    });

    it("should reject creation without authentication", async () => {
      const trackerData = createMockTracker();
      
      await expectAsyncError(
        () => t.mutation(api.trackers.createTracker, trackerData),
        "Not authenticated"
      );
    });

    it("should validate required fields", async () => {
      await expectAsyncError(
        () => t.withIdentity(mockUser).mutation(
          api.trackers.createTracker,
          {
            name: "",
            columns: [],
            primaryKeyColumn: "test",
          }
        ),
        "Primary key column"
      );
    });
  });

  describe("updateTracker", () => {
    it("should update tracker metadata", async () => {
      // Create tracker
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Update tracker
      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.updateTracker,
        {
          trackerId,
          updates: {
            name: "Updated Tracker",
            description: "Updated description",
          },
        }
      );

      expect(result.success).toBe(true);
    });

    it("should prevent unauthorized updates", async () => {
      // Create tracker with user1
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Try to update with user2
      await expectAsyncError(
        () => t.withIdentity(mockUser2).mutation(
          api.trackers.updateTracker,
          {
            trackerId,
            updates: { name: "Hacked!" },
          }
        ),
        "Not authorized"
      );
    });
  });

  describe("deleteTracker", () => {
    it("should delete tracker and all associated data", async () => {
      // Create tracker
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add some data
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: createMockRowData(),
        }
      );

      // Delete tracker
      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.deleteTracker,
        { trackerId }
      );

      expect(result.success).toBe(true);

      // Verify tracker is deleted
      const tracker = await t.withIdentity(mockUser).query(
        api.trackers.getTracker,
        { trackerId }
      );
      expect(tracker).toBeNull();
    });

    it("should prevent unauthorized deletion", async () => {
      // Create tracker with user1
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Try to delete with user2
      await expectAsyncError(
        () => t.withIdentity(mockUser2).mutation(
          api.trackers.deleteTracker,
          { trackerId }
        ),
        "Not authorized"
      );
    });
  });

  describe("Data Operations", () => {
    let trackerId: Id<"trackers">;

    beforeEach(async () => {
      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );
      trackerId = result.trackerId;
    });

    describe("addRow", () => {
      it("should add a valid row", async () => {
        const rowData = createMockRowData("TEST-001");
        
        const result = await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          {
            trackerId,
            data: rowData,
          }
        );

        expect(result.rowId).toBeDefined();
        expect(result.data.sku).toBe("TEST-001");
      });

      it("should reject duplicate primary keys", async () => {
        const rowData = createMockRowData("TEST-001");
        
        // Add first row
        await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          {
            trackerId,
            data: rowData,
          }
        );

        // Try to add duplicate
        await expectAsyncError(
          () => t.withIdentity(mockUser).mutation(
            api.trackers.addRow,
            {
              trackerId,
              data: rowData,
            }
          ),
          "already exists"
        );
      });

      it("should validate required fields", async () => {
        await expectAsyncError(
          () => t.withIdentity(mockUser).mutation(
            api.trackers.addRow,
            {
              trackerId,
              data: {
                // Missing required 'sku' and 'product'
                quantity: 100,
              },
            }
          ),
          "required"
        );
      });

      it("should validate data types", async () => {
        await expectAsyncError(
          () => t.withIdentity(mockUser).mutation(
            api.trackers.addRow,
            {
              trackerId,
              data: {
                sku: "TEST-001",
                product: "Test",
                quantity: "not-a-number", // Should be number
              },
            }
          ),
          "must be a number"
        );
      });

      it("should validate select options", async () => {
        await expectAsyncError(
          () => t.withIdentity(mockUser).mutation(
            api.trackers.addRow,
            {
              trackerId,
              data: {
                sku: "TEST-001",
                product: "Test",
                status: "invalid-status", // Not in options
              },
            }
          ),
          "must be one of"
        );
      });
    });

    describe("updateRow", () => {
      it("should update an existing row", async () => {
        // Add row
        await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          {
            trackerId,
            data: createMockRowData("TEST-001"),
          }
        );

        // Update row
        const result = await t.withIdentity(mockUser).mutation(
          api.trackers.updateRow,
          {
            trackerId,
            rowId: "TEST-001",
            updates: {
              product: "Updated Product",
              quantity: 200,
            },
          }
        );

        expect(result.success).toBe(true);
      });

      it("should prevent unauthorized updates", async () => {
        // Add row with user1
        await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          {
            trackerId,
            data: createMockRowData("TEST-001"),
          }
        );

        // Try to update with user2
        await expectAsyncError(
          () => t.withIdentity(mockUser2).mutation(
            api.trackers.updateRow,
            {
              trackerId,
              rowId: "TEST-001",
              updates: { product: "Hacked!" },
            }
          ),
          "Not authorized"
        );
      });
    });

    describe("deleteRow", () => {
      it("should delete a row", async () => {
        // Add row
        await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          {
            trackerId,
            data: createMockRowData("TEST-001"),
          }
        );

        // Delete row
        const result = await t.withIdentity(mockUser).mutation(
          api.trackers.deleteRow,
          {
            trackerId,
            rowId: "TEST-001",
          }
        );

        expect(result.success).toBe(true);
      });

      it("should prevent unauthorized deletion", async () => {
        // Add row with user1
        await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          {
            trackerId,
            data: createMockRowData("TEST-001"),
          }
        );

        // Try to delete with user2
        await expectAsyncError(
          () => t.withIdentity(mockUser2).mutation(
            api.trackers.deleteRow,
            {
              trackerId,
              rowId: "TEST-001",
            }
          ),
          "Not authorized"
        );
      });
    });
  });

  describe("Query Operations", () => {
    it("should list user trackers", async () => {
      // Create multiple trackers
      await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker({ name: "Tracker 1" })
      );
      await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker({ name: "Tracker 2" })
      );
      await t.withIdentity(mockUser2).mutation(
        api.trackers.createTracker,
        createMockTracker({ name: "Other User Tracker" })
      );

      // Query user1's trackers
      const trackers = await t.withIdentity(mockUser).query(
        api.trackers.listTrackers,
        {}
      );

      expect(trackers.length).toBe(2);
      expect(trackers.every(t => t.userId === mockUser.subject)).toBe(true);
    });

    it("should get tracker by slug", async () => {
      const { slug } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      const tracker = await t.withIdentity(mockUser).query(
        api.trackers.getTracker,
        { slug }
      );

      expect(tracker).toBeDefined();
      expect(tracker?.slug).toBe(slug);
    });

    it("should get tracker data with pagination", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add multiple rows
      for (let i = 1; i <= 10; i++) {
        await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          {
            trackerId,
            data: createMockRowData(`TEST-${String(i).padStart(3, '0')}`),
          }
        );
      }

      // Get paginated data
      const result = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        {
          trackerId,
          paginationOpts: createMockPaginationOpts(5),
        }
      );

      expect(result.page.length).toBe(5);
      expect(result.isDone).toBe(false);
    });

    it("should sort tracker data", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add rows with different quantities
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: { ...createMockRowData("TEST-001"), quantity: 300 },
        }
      );
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: { ...createMockRowData("TEST-002"), quantity: 100 },
        }
      );
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: { ...createMockRowData("TEST-003"), quantity: 200 },
        }
      );

      // Get sorted data
      const result = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        {
          trackerId,
          sortBy: "quantity",
          sortOrder: "asc",
          paginationOpts: createMockPaginationOpts(10),
        }
      );

      expect(result.page).toHaveLength(3);
      expect(result.page[0].data.quantity).toBe(100);
      expect(result.page[1].data.quantity).toBe(200);
      expect(result.page[2].data.quantity).toBe(300);
    });
  });

  describe("Template System", () => {
    it("should return available templates", async () => {
      const templates = await t.query(api.trackers.getTemplates, {});

      expect(templates).toBeDefined();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.key === "fashion")).toBe(true);
      expect(templates.some(t => t.key === "logistics")).toBe(true);
      expect(templates.some(t => t.key === "simple")).toBe(true);
    });

    it("should have valid columns in templates", async () => {
      const templates = await t.query(api.trackers.getTemplates, {});

      templates.forEach(template => {
        expect(template.columns.length).toBeGreaterThan(0);
        expect(template.primaryKeyColumn).toBeDefined();
        
        // Verify primary key column exists
        const primaryKeyExists = template.columns.some(
          col => col.key === template.primaryKeyColumn
        );
        expect(primaryKeyExists).toBe(true);
      });
    });
  });
});