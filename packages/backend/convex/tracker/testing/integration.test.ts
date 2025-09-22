import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";
import {
  mockUser,
  mockUser2,
  createMockTracker,
  createMockRowData,
  generateValidCSV,
  createMockPaginationOpts,
} from "./testHelpers";

describe("Integration Tests", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  describe("Full User Workflow", () => {
    it("should handle complete tracker lifecycle", async () => {
      // Step 1: Create tracker from template
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker({ name: "Integration Test Tracker" })
      );
      expect(trackerId).toBeDefined();

      // Step 2: Import CSV data
      const csvContent = generateValidCSV();
      const importResult = await t.withIdentity(mockUser).mutation(
        api.trackers.importCSV,
        {
          trackerId,
          csvContent,
          mode: "append",
        }
      );
      expect(importResult.imported).toBe(3);

      // Step 3: Update a row
      await t.withIdentity(mockUser).mutation(
        api.trackers.updateRow,
        {
          trackerId,
          rowId: "TEST-001",
          updates: {
            quantity: 500,
            status: "shipped",
          },
        }
      );

      // Step 4: Add new row manually
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: createMockRowData("TEST-004"),
        }
      );

      // Step 5: Bulk update
      const bulkResult = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows: [
            { ...createMockRowData("TEST-001"), status: "delivered" },
            { ...createMockRowData("TEST-005") },
          ],
          mode: "update",
        }
      );
      expect(bulkResult.updated).toBe(1);
      expect(bulkResult.imported).toBe(1);

      // Step 6: Query with pagination
      const queryResult = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        {
          trackerId,
          paginationOpts: createMockPaginationOpts(3),
        }
      );
      expect(queryResult.page).toHaveLength(3);
      expect(queryResult.isDone).toBe(false); // More items exist

      // Step 7: Delete a row
      await t.withIdentity(mockUser).mutation(
        api.trackers.deleteRow,
        {
          trackerId,
          rowId: "TEST-005",
        }
      );

      // Step 8: Verify final state
      const finalData = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      expect(finalData.page).toHaveLength(4);
      expect(finalData.page.find(d => d.rowId === "TEST-001")?.data.status).toBe("delivered");
    });

    it("should maintain data consistency across operations", async () => {
      // Create tracker
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add initial data
      const initialRows = [
        createMockRowData("CONS-001"),
        createMockRowData("CONS-002"),
        createMockRowData("CONS-003"),
      ];

      for (const row of initialRows) {
        await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          { trackerId, data: row }
        );
      }

      // Perform concurrent-like updates (simulated)
      const updates = [
        { rowId: "CONS-001", updates: { quantity: 111 } },
        { rowId: "CONS-002", updates: { quantity: 222 } },
        { rowId: "CONS-003", updates: { quantity: 333 } },
      ];

      // Update all rows
      for (const update of updates) {
        await t.withIdentity(mockUser).mutation(
          api.trackers.updateRow,
          { trackerId, ...update }
        );
      }

      // Verify all updates persisted correctly
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );

      expect(data.page.find(d => d.rowId === "CONS-001")?.data.quantity).toBe(111);
      expect(data.page.find(d => d.rowId === "CONS-002")?.data.quantity).toBe(222);
      expect(data.page.find(d => d.rowId === "CONS-003")?.data.quantity).toBe(333);
    });
  });

  describe("Multi-User Scenarios", () => {
    it("should isolate data between users", async () => {
      // User 1 creates tracker
      const { trackerId: tracker1 } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker({ name: "User 1 Tracker" })
      );

      // User 2 creates tracker
      const { trackerId: tracker2 } = await t.withIdentity(mockUser2).mutation(
        api.trackers.createTracker,
        createMockTracker({ name: "User 2 Tracker" })
      );

      // User 1 adds data
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId: tracker1,
          data: createMockRowData("USER1-001"),
        }
      );

      // User 2 adds data
      await t.withIdentity(mockUser2).mutation(
        api.trackers.addRow,
        {
          trackerId: tracker2,
          data: createMockRowData("USER2-001"),
        }
      );

      // User 1 can't access User 2's tracker
      const user1Trackers = await t.withIdentity(mockUser).query(
        api.trackers.listTrackers,
        {}
      );
      expect(user1Trackers).toHaveLength(1);
      expect(user1Trackers[0].name).toBe("User 1 Tracker");

      // User 2 can't access User 1's tracker
      const user2Trackers = await t.withIdentity(mockUser2).query(
        api.trackers.listTrackers,
        {}
      );
      expect(user2Trackers).toHaveLength(1);
      expect(user2Trackers[0].name).toBe("User 2 Tracker");

      // User 2 can't modify User 1's data
      try {
        await t.withIdentity(mockUser2).mutation(
          api.trackers.updateRow,
          {
            trackerId: tracker1,
            rowId: "USER1-001",
            updates: { product: "Hacked!" },
          }
        );
        expect.fail("Should have thrown authorization error");
      } catch (error: any) {
        expect(error.message).toContain("Not authorized");
      }
    });

    it("should handle sharing scenarios properly", async () => {
      // Create tracker with user1
      const { trackerId, slug } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker({ name: "Shared Tracker" })
      );

      // Add data
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: createMockRowData("SHARE-001"),
        }
      );

      // User2 can read by slug (public read)
      const tracker = await t.withIdentity(mockUser2).query(
        api.trackers.getTracker,
        { slug }
      );
      expect(tracker).toBeDefined();
      expect(tracker?.name).toBe("Shared Tracker");

      // But User2 still can't modify
      let errorThrown = false;
      try {
        await t.withIdentity(mockUser2).mutation(
          api.trackers.addRow,
          {
            trackerId,
            data: createMockRowData("SHARE-002"),
          }
        );
      } catch (error: any) {
        errorThrown = true;
        expect(error.message).toContain("Not authorized");
      }
      expect(errorThrown).toBe(true);
    });
  });

  describe("Error Recovery", () => {
    it("should handle partial import failures gracefully", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Mix of valid and invalid rows
      const rows = [
        createMockRowData("VALID-001"),
        { sku: "INVALID-001" }, // Missing required 'product'
        createMockRowData("VALID-002"),
        { ...createMockRowData("INVALID-002"), quantity: "not-a-number" },
        createMockRowData("VALID-003"),
      ];

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows,
          mode: "append",
        }
      );

      // Should import valid rows despite failures
      expect(result.imported).toBe(3);
      expect(result.failed).toHaveLength(2);

      // Verify only valid rows were imported
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      expect(data.page).toHaveLength(3);
      expect(data.page.every(d => d.rowId.startsWith("VALID"))).toBe(true);
    });

    it("should handle update conflicts properly", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add initial row
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: createMockRowData("CONFLICT-001"),
        }
      );

      // Try to update non-existent row
      try {
        await t.withIdentity(mockUser).mutation(
          api.trackers.updateRow,
          {
            trackerId,
            rowId: "NON-EXISTENT",
            updates: { product: "Updated" },
          }
        );
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).toContain("Row not found");
      }

      // Original row should be unchanged
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      expect(data.page[0].data.product).toBe("Test Product");
    });

    it("should maintain consistency during bulk replace", async () => {
      const { trackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        createMockTracker()
      );

      // Add initial data
      const initialRows = Array.from({ length: 5 }, (_, i) => 
        createMockRowData(`OLD-${String(i + 1).padStart(3, '0')}`)
      );

      for (const row of initialRows) {
        await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          { trackerId, data: row }
        );
      }

      // Replace with mix of valid and invalid
      const replacementRows = [
        createMockRowData("NEW-001"),
        { sku: "INVALID" }, // Will fail
        createMockRowData("NEW-002"),
      ];

      // In replace mode, validation happens row by row, not atomically
      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows: replacementRows,
          mode: "replace",
        }
      );
      
      // Replace mode will delete old data and import valid rows, skipping invalid ones
      expect(result.imported).toBe(2); // Only valid rows
      expect(result.failed).toHaveLength(1); // One invalid row

      // Replace mode deleted old data and added new valid rows
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      expect(data.page).toHaveLength(2); // Only the 2 valid new rows
      expect(data.page.every(d => d.rowId.startsWith("NEW"))).toBe(true);
    });
  });

  describe("Template System Integration", () => {
    it("should create functional trackers from all templates", async () => {
      const templates = await t.query(api.trackers.getTemplates, {});
      
      for (const template of templates) {
        // Create tracker from template
        const { trackerId } = await t.withIdentity(mockUser).mutation(
          api.trackers.createTracker,
          {
            name: `${template.name} Test`,
            description: template.description,
            columns: template.columns,
            primaryKeyColumn: template.primaryKeyColumn,
          }
        );

        // Should be able to add data matching the template
        const testData: Record<string, any> = {};
        
        // Fill required fields based on template columns
        for (const col of template.columns) {
          if (col.required || col.key === template.primaryKeyColumn) {
            switch (col.type) {
              case "text":
                testData[col.key] = `TEST-${col.key}`;
                break;
              case "number":
                testData[col.key] = 100;
                break;
              case "date":
                testData[col.key] = "2024-12-31";
                break;
              case "boolean":
                testData[col.key] = false;
                break;
              case "select":
                testData[col.key] = col.options?.[0] || "";
                break;
            }
          }
        }

        // Add row should succeed
        const result = await t.withIdentity(mockUser).mutation(
          api.trackers.addRow,
          {
            trackerId,
            data: testData,
          }
        );
        
        expect(result.rowId).toBeDefined();
        expect(result.data).toMatchObject(testData);
      }
    });
  });
});