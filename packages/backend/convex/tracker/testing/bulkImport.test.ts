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
  generateLargeDataset,
  generateValidCSV,
  generateComplexCSV,
  generateMaliciousCSV,
  expectAsyncError,
  createMockPaginationOpts,
} from "./testHelpers";

describe("Bulk Import Operations", () => {
  let t: ReturnType<typeof convexTest>;
  let trackerId: any;

  beforeEach(async () => {
    t = convexTest(schema, modules);
    
    // Create a tracker for testing
    const result = await t.withIdentity(mockUser).mutation(
      api.trackers.createTracker,
      createMockTracker()
    );
    trackerId = result.trackerId;
  });

  describe("bulkImport - Append Mode", () => {
    it("should import multiple rows in append mode", async () => {
      const rows = [
        createMockRowData("TEST-001"),
        createMockRowData("TEST-002"),
        createMockRowData("TEST-003"),
      ];

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows,
          mode: "append",
        }
      );

      expect(result.imported).toBe(3);
      expect(result.updated).toBe(0);
      expect(result.failed).toHaveLength(0);

      // Verify data was imported
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      expect(data.page).toHaveLength(3);
    });

    it("should skip existing rows in append mode", async () => {
      // Add initial row
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: createMockRowData("TEST-001"),
        }
      );

      // Try to import with duplicate
      const rows = [
        createMockRowData("TEST-001"), // Duplicate
        createMockRowData("TEST-002"), // New
      ];

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows,
          mode: "append",
        }
      );

      expect(result.imported).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain("already exists");
    });

    it("should validate all rows before import", async () => {
      const rows = [
        createMockRowData("TEST-001"),
        { sku: "TEST-002" }, // Missing required 'product'
        createMockRowData("TEST-003"),
      ];

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows,
          mode: "append",
        }
      );

      expect(result.imported).toBe(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].row).toBe(2);
      expect(result.failed[0].error).toContain("required");
    });
  });

  describe("bulkImport - Update Mode", () => {
    beforeEach(async () => {
      // Add initial data
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: createMockRowData("TEST-001"),
        }
      );
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: createMockRowData("TEST-002"),
        }
      );
    });

    it("should update existing rows in update mode", async () => {
      const rows = [
        { ...createMockRowData("TEST-001"), product: "Updated Product 1", quantity: 999 },
        { ...createMockRowData("TEST-002"), product: "Updated Product 2", quantity: 888 },
      ];

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows,
          mode: "update",
        }
      );

      expect(result.imported).toBe(0);
      expect(result.updated).toBe(2);
      expect(result.failed).toHaveLength(0);

      // Verify data was updated
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      expect(data.page[0].data.product).toContain("Updated");
      expect(data.page[0].data.quantity).toBe(999);
    });

    it("should add new rows in update mode", async () => {
      const rows = [
        { ...createMockRowData("TEST-001"), product: "Updated" }, // Existing
        createMockRowData("TEST-003"), // New
      ];

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows,
          mode: "update",
        }
      );

      expect(result.imported).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe("bulkImport - Replace Mode", () => {
    it("should replace all data in replace mode", async () => {
      // Add initial data
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: createMockRowData("OLD-001"),
        }
      );
      await t.withIdentity(mockUser).mutation(
        api.trackers.addRow,
        {
          trackerId,
          data: createMockRowData("OLD-002"),
        }
      );

      // Replace with new data
      const rows = [
        createMockRowData("NEW-001"),
        createMockRowData("NEW-002"),
        createMockRowData("NEW-003"),
      ];

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows,
          mode: "replace",
        }
      );

      expect(result.imported).toBe(3);
      expect(result.updated).toBe(0);
      expect(result.failed).toHaveLength(0);

      // Verify old data is gone
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      expect(data.page).toHaveLength(3);
      expect(data.page.every(d => d.rowId.startsWith("NEW"))).toBe(true);
    });
  });

  describe("CSV Import", () => {
    it("should import valid CSV", async () => {
      const csvContent = generateValidCSV();

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.importCSV,
        {
          trackerId,
          csvContent,
          mode: "append",
        }
      );

      expect(result.imported).toBe(3);
      expect(result.failed).toHaveLength(0);
    });

    it("should handle CSV with quoted values", async () => {
      const csvContent = generateComplexCSV();

      // Need to adjust columns for this test
      const { trackerId: newTrackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        {
          name: "CSV Test Tracker",
          columns: [
            {
              id: "sku",
              name: "SKU Code",
              key: "sku",
              type: "text" as const,
              required: true,
              order: 0,
            },
            {
              id: "product",
              name: "Product Name",
              key: "product",
              type: "text" as const,
              required: true,
              order: 1,
            },
            {
              id: "quantity",
              name: "Quantity",
              key: "quantity",
              type: "number" as const,
              required: false,
              order: 2,
            },
            {
              id: "notes",
              name: "Notes",
              key: "notes",
              type: "text" as const,
              required: false,
              order: 3,
            },
          ],
          primaryKeyColumn: "sku",
        }
      );

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.importCSV,
        {
          trackerId: newTrackerId,
          csvContent,
          mode: "append",
        }
      );

      expect(result.imported).toBe(3);
      expect(result.failed).toHaveLength(0);

      // Verify complex values were imported correctly
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId: newTrackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      
      expect(data.page[0].data.product).toBe("Product, with comma");
      expect(data.page[0].data.notes).toBe("This is a note with, commas");
      expect(data.page[1].data.product).toBe('Product with "quotes"');
    });

    it("should sanitize malicious CSV", async () => {
      const csvContent = generateMaliciousCSV();

      // Create tracker with appropriate columns
      const { trackerId: newTrackerId } = await t.withIdentity(mockUser).mutation(
        api.trackers.createTracker,
        {
          name: "Security Test Tracker",
          columns: [
            {
              id: "sku",
              name: "SKU Code",
              key: "sku",
              type: "text" as const,
              required: true,
              order: 0,
            },
            {
              id: "product",
              name: "Product Name",
              key: "product",
              type: "text" as const,
              required: true,
              order: 1,
            },
            {
              id: "formula",
              name: "Formula",
              key: "formula",
              type: "text" as const,
              required: false,
              order: 2,
            },
          ],
          primaryKeyColumn: "sku",
        }
      );

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.importCSV,
        {
          trackerId: newTrackerId,
          csvContent,
          mode: "append",
        }
      );

      expect(result.imported).toBe(4);

      // Verify formulas were sanitized
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { trackerId: newTrackerId, paginationOpts: createMockPaginationOpts(100) }
      );
      
      // Check that dangerous characters were prefixed with '
      expect(data.page[0].data.formula).toBe("'=1+1");
      expect(data.page[1].data.formula).toBe("'+1234567890");
      expect(data.page[2].data.formula).toBe("'-SUM(A1:A10)");
      expect(data.page[3].data.formula).toBe("'@example.com");
    });
  });

  describe("Performance Tests", () => {
    it("should handle large datasets efficiently", async () => {
      const largeDataset = generateLargeDataset(100);

      const startTime = Date.now();
      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows: largeDataset,
          mode: "append",
        }
      );
      const endTime = Date.now();

      expect(result.imported).toBe(100);
      expect(result.failed).toHaveLength(0);
      
      // Should complete in reasonable time (< 5 seconds for 100 rows)
      expect(endTime - startTime).toBeLessThan(5000);

      // Verify all data was imported
      const data = await t.withIdentity(mockUser).query(
        api.trackers.getTrackerData,
        { 
          trackerId,
          paginationOpts: createMockPaginationOpts(200),
        }
      );
      expect(data.page).toHaveLength(100);
    });
  });

  describe("Authorization", () => {
    it("should prevent unauthorized bulk imports", async () => {
      const rows = [createMockRowData("TEST-001")];

      await expectAsyncError(
        () => t.withIdentity(mockUser2).mutation(
          api.trackers.bulkImport,
          {
            trackerId,
            rows,
            mode: "append",
          }
        ),
        "Not authorized"
      );
    });

    it("should prevent unauthorized CSV imports", async () => {
      const csvContent = generateValidCSV();

      await expectAsyncError(
        () => t.withIdentity(mockUser2).mutation(
          api.trackers.importCSV,
          {
            trackerId,
            csvContent,
            mode: "append",
          }
        ),
        "Not authorized"
      );
    });

    it("should require authentication for bulk operations", async () => {
      const rows = [createMockRowData("TEST-001")];

      await expectAsyncError(
        () => t.mutation(
          api.trackers.bulkImport,
          {
            trackerId,
            rows,
            mode: "append",
          }
        ),
        "Unauthenticated call to protected function"
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle mixed valid and invalid rows", async () => {
      const rows = [
        createMockRowData("TEST-001"), // Valid
        { sku: "TEST-002" }, // Missing required field
        { ...createMockRowData("TEST-003"), quantity: "not-a-number" }, // Invalid type
        createMockRowData("TEST-004"), // Valid
        { ...createMockRowData("TEST-005"), status: "invalid" }, // Invalid select option
      ];

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows,
          mode: "append",
        }
      );

      expect(result.imported).toBe(2); // TEST-001 and TEST-004
      expect(result.failed).toHaveLength(3);
      
      // Check error messages
      expect(result.failed[0].row).toBe(2);
      expect(result.failed[0].error).toContain("required");
      
      expect(result.failed[1].row).toBe(3);
      expect(result.failed[1].error).toContain("number");
      
      expect(result.failed[2].row).toBe(5);
      expect(result.failed[2].error).toContain("must be one of");
    });

    it("should handle empty imports gracefully", async () => {
      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.bulkImport,
        {
          trackerId,
          rows: [],
          mode: "append",
        }
      );

      expect(result.imported).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.failed).toHaveLength(0);
    });

    it("should handle CSV with no data rows", async () => {
      const csvContent = "SKU Code,Product Name,Quantity\n";

      const result = await t.withIdentity(mockUser).mutation(
        api.trackers.importCSV,
        {
          trackerId,
          csvContent,
          mode: "append",
        }
      );

      expect(result.imported).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.failed).toHaveLength(0);
    });
  });
});