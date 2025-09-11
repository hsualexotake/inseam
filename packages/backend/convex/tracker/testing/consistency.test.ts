import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { modules } from "../../test.setup";
import {
  mockUser,
  createMockTracker,
  createMockRowData,
  generateLargeDataset,
  createMockPaginationOpts,
} from "./testHelpers";

describe("Data Consistency Tests", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  describe("Referential Integrity", () => {
    it("should maintain tracker-data relationship integrity", async () => {
      // Create tracker
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add data
      const rows = Array.from({ length: 5 }, (_, i) => 
        createMockRowData(`REF-${String(i + 1).padStart(3, '0')}`)
      );

      for (const row of rows) {
        await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          { trackerId, data: row }
        );
      }

      // Verify all data belongs to correct tracker
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      
      expect(data.page).toHaveLength(5);
      data.page.forEach(row => {
        expect(row.trackerId).toBe(trackerId);
      });

      // Delete tracker should cascade delete all data
      await t.withIdentity(mockUser).mutation(
        api.trackers.deleteTracker,
        { trackerId }
      );

      // Tracker should be gone
      const deletedTracker = await t.withIdentity(mockUser).query(
        api.trackers.getTracker,
        { trackerId }
      );
      expect(deletedTracker).toBeNull();

      // Data should also be gone (can't query directly, but creating new tracker with same data should work)
      const { trackerId: newTrackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Should be able to reuse the same primary keys
      for (const row of rows) {
        const result = await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          { trackerId: newTrackerId, data: row }
        );
        expect(result.rowId).toBeDefined();
      }
    });

    it("should maintain primary key uniqueness within tracker", async () => {
      // Create two trackers
      const { trackerId: tracker1 } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker({ name: "Tracker 1" })
      );

      const { trackerId: tracker2 } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker({ name: "Tracker 2" })
      );

      // Same primary key should work in different trackers
      const sameData = createMockRowData("SAME-001");
      
      const result1 = await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        { trackerId: tracker1, data: sameData }
      );
      expect(result1.rowId).toBe("SAME-001");

      const result2 = await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        { trackerId: tracker2, data: sameData }
      );
      expect(result2.rowId).toBe("SAME-001");

      // But duplicate in same tracker should fail
      try {
        await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          { trackerId: tracker1, data: sameData }
        );
        expect.fail("Should have thrown duplicate key error");
      } catch (error: any) {
        expect(error.message).toContain("already exists");
      }
    });
  });

  describe("Data Type Consistency", () => {
    it("should maintain data type consistency across operations", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add row with specific types
      const originalData = {
        sku: "TYPE-001",
        product: "Test Product",
        quantity: 123,
        status: "pending",
        delivery: "2024-12-31",
        urgent: true,
      };

      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        { trackerId, data: originalData }
      );

      // Update with different values but same types
      await t.withIdentity(mockUser).mutation(
        api.trackers.updateRow,
        {
          trackerId,
          rowId: "TYPE-001",
          updates: {
            quantity: 456,
            urgent: false,
          },
        }
      );

      // Retrieve and verify types are preserved
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );

      const row = data.page[0].data;
      expect(typeof row.sku).toBe("string");
      expect(typeof row.product).toBe("string");
      expect(typeof row.quantity).toBe("number");
      expect(typeof row.status).toBe("string");
      expect(typeof row.delivery).toBe("string");
      expect(typeof row.urgent).toBe("boolean");
      
      // Verify updated values
      expect(row.quantity).toBe(456);
      expect(row.urgent).toBe(false);
    });

    it("should handle null and undefined consistently", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add row with minimal required data
      const minimalData = {
        sku: "NULL-001",
        product: "Test Product",
        // All optional fields omitted
      };

      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        { trackerId, data: minimalData }
      );

      // Update with explicit null values
      await t.withIdentity(mockUser).mutation(
        api.trackers.updateRow,
        {
          trackerId,
          rowId: "NULL-001",
          updates: {
            quantity: null,
            status: null,
            delivery: null,
            urgent: null,
          },
        }
      );

      // Retrieve and verify nulls are handled correctly
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );

      const row = data.page[0].data;
      // After explicitly setting to null, values should be null
      expect(row.quantity).toBe(null);
      expect(row.status).toBe(null);
      expect(row.delivery).toBe(null);
      expect(row.urgent).toBe(null);
    });
  });

  describe("Transaction Consistency", () => {
    it("should maintain consistency during bulk operations", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add initial dataset
      const initialRows = generateLargeDataset(50);
      await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows: initialRows,
          mode: "append",
        }
      );

      // Get initial state
      const beforeUpdate = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      expect(beforeUpdate.page).toHaveLength(50);

      // Perform bulk update with mix of updates and new rows
      const mixedRows = [
        ...initialRows.slice(0, 25).map(row => ({
          ...row,
          quantity: 999,
        })),
        ...generateLargeDataset(25).map((row, i) => ({
          ...row,
          sku: `NEW-${String(i + 1).padStart(3, '0')}`,
        })),
      ];

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows: mixedRows,
          mode: "update",
        }
      );

      expect(result.updated).toBe(25);
      expect(result.imported).toBe(25);

      // Verify final state
      const afterUpdate = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      
      expect(afterUpdate.page).toHaveLength(75); // 50 original + 25 new
      
      // Check updated rows have new quantity
      const updatedRows = afterUpdate.page.filter(d => 
        d.rowId.startsWith("TEST") && parseInt(d.rowId.split("-")[1]) <= 25
      );
      updatedRows.forEach(row => {
        expect(row.data.quantity).toBe(999);
      });
    });

    it("should handle concurrent-like operations correctly", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Simulate rapid sequential operations (as close to concurrent as we can get in tests)
      const operations = Array.from({ length: 10 }, (_, i) => ({
        data: createMockRowData(`CONC-${String(i + 1).padStart(3, '0')}`),
      }));

      // Add all rows rapidly
      const addPromises = operations.map(op => 
        t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          { trackerId, ...op }
        )
      );

      const results = await Promise.all(addPromises);
      
      // All should succeed with unique IDs
      const rowIds = results.map(r => r.rowId);
      const uniqueIds = new Set(rowIds);
      expect(uniqueIds.size).toBe(10);

      // Verify all data is present
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(20) }
      );
      expect(data.page).toHaveLength(10);
    });
  });

  describe("Index Consistency", () => {
    it("should maintain index consistency for user queries", async () => {
      // Create multiple trackers for same user
      const trackerIds: Id<"trackers">[] = [];
      
      for (let i = 0; i < 5; i++) {
        const { trackerId } = await t.withIdentity(mockUser).mutation(
          api.trackers.createTracker,
          createMockTracker({ name: `Index Test ${i}` })
        );
        trackerIds.push(trackerId);
      }

      // User should see all their trackers
      const userTrackers = await t.withIdentity(mockUser).query(
        api.trackers.listTrackers,
        {}
      );
      expect(userTrackers).toHaveLength(5);
      expect(userTrackers.map(t => t._id).sort()).toEqual(trackerIds.sort());

      // Delete middle tracker
      await t.withIdentity(mockUser).mutation(
        api.trackers.deleteTracker,
        { trackerId: trackerIds[2] }
      );

      // Index should be updated
      const updatedTrackers = await t.withIdentity(mockUser).query(
        api.trackers.listTrackers,
        {}
      );
      expect(updatedTrackers).toHaveLength(4);
      expect(updatedTrackers.map(t => t._id)).not.toContain(trackerIds[2]);
    });

    it("should maintain index consistency for data queries", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add rows
      const rows = generateLargeDataset(30);
      await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows,
          mode: "append",
        }
      );

      // Query should use index efficiently
      const firstPage = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        {
          trackerId,
          paginationOpts: createMockPaginationOpts(10),
        }
      );
      
      const secondPage = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        {
          trackerId,
          paginationOpts: { numItems: 10, cursor: firstPage.continueCursor },
        }
      );

      // Pages should not overlap
      const firstIds = firstPage.page.map(d => d.rowId);
      const secondIds = secondPage.page.map(d => d.rowId);
      const intersection = firstIds.filter(id => secondIds.includes(id));
      expect(intersection).toHaveLength(0);

      // Delete some rows
      for (let i = 0; i < 5; i++) {
        await t.withIdentity(mockUser).mutation(
          api.trackers.deleteRow,
          {
            trackerId,
            rowId: `TEST-${String(i + 1).padStart(3, '0')}`,
          }
        );
      }

      // Index should reflect deletions
      const afterDeletion = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(50) }
      );
      expect(afterDeletion.page).toHaveLength(25);
      
      // Deleted rows should not appear
      const remainingIds = afterDeletion.page.map(d => d.rowId);
      for (let i = 0; i < 5; i++) {
        const deletedId = `TEST-${String(i + 1).padStart(3, '0')}`;
        expect(remainingIds).not.toContain(deletedId);
      }
    });
  });

  describe("Column Definition Consistency", () => {
    it("should maintain column definition integrity", async () => {
      const originalColumns = createMockTracker().columns;
      
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add data matching original columns
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: createMockRowData("COL-001"),
        }
      );

      // Update tracker with modified columns (add new column)
      const updatedColumns = [
        ...originalColumns,
        {
          id: "newfield",
          name: "New Field",
          key: "newfield",
          type: "text" as const,
          required: false,
          order: originalColumns.length,
        },
      ];

      await t.withIdentity(mockUser).mutation(
        api.trackers.updateTracker,
        {
          trackerId,
          updates: {
            columns: updatedColumns,
          },
        }
      );

      // Existing data should still be valid
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      expect(data.page).toHaveLength(1);

      // Should be able to add new data with new field
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: {
            ...createMockRowData("COL-002"),
            newfield: "New Value",
          },
        }
      );

      const updatedData = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      expect(updatedData.page).toHaveLength(2);
      expect(updatedData.page[1].data.newfield).toBe("New Value");
    });

    it("should validate column consistency in bulk operations", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Try to import data with extra fields not in columns
      const rowsWithExtra = [
        {
          ...createMockRowData("EXTRA-001"),
          extraField1: "Should be ignored",
          extraField2: 123,
        },
      ];

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows: rowsWithExtra,
          mode: "append",
        }
      );

      expect(result.imported).toBe(1);

      // Extra fields should not be stored
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      
      expect(data.page[0].data).not.toHaveProperty("extraField1");
      expect(data.page[0].data).not.toHaveProperty("extraField2");
      
      // Only defined columns should be present
      const definedKeys = createMockTracker().columns.map(c => c.key);
      const storedKeys = Object.keys(data.page[0].data);
      storedKeys.forEach(key => {
        expect(definedKeys).toContain(key);
      });
    });
  });
});