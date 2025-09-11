import { describe, it, expect } from "vitest";
import {
  validateRowData,
  validateColumns,
  generateSlug,
  parseCSV,
  mapCSVToTrackerData,
} from "../../lib/trackerValidation";
import { ColumnDefinition } from "../../types/tracker";
import {
  createMockColumns,
  generateValidCSV,
  generateComplexCSV,
  generateMaliciousCSV,
  edgeCaseData,
} from "./testHelpers";

describe("Validation Functions", () => {
  describe("validateRowData", () => {
    const columns = createMockColumns();

    it("should validate valid data", () => {
      const data = {
        sku: "TEST-001",
        product: "Test Product",
        quantity: 100,
        status: "pending",
        delivery: "2024-12-31",
        urgent: true,
      };

      const result = validateRowData(columns, data);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data.sku).toBe("TEST-001");
      expect(result.data.quantity).toBe(100);
      expect(result.data.urgent).toBe(true);
    });

    it("should reject missing required fields", () => {
      const data = {
        // Missing required 'sku' and 'product'
        quantity: 100,
      };

      const result = validateRowData(columns, data);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === "sku")).toBe(true);
      expect(result.errors.some(e => e.field === "product")).toBe(true);
    });

    it("should validate number fields", () => {
      const testCases = [
        { input: "123", expected: 123, valid: true },
        { input: "123.45", expected: 123.45, valid: true },
        { input: "-123", expected: -123, valid: true },
        { input: "not-a-number", expected: null, valid: false },
        { input: "", expected: null, valid: true }, // Empty is ok for optional
      ];

      testCases.forEach(({ input, expected, valid }) => {
        const result = validateRowData(columns, {
          sku: "TEST",
          product: "Test",
          quantity: input,
        });

        if (valid) {
          expect(result.isValid).toBe(true);
          if (input !== "") {
            expect(result.data.quantity).toBe(expected);
          }
        } else {
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.field === "quantity")).toBe(true);
        }
      });
    });

    it("should validate date fields", () => {
      const testCases = [
        { input: "2024-12-31", valid: true },
        { input: "2024/12/31", valid: true },
        { input: "12/31/2024", valid: true },
        { input: "Dec 31, 2024", valid: true },
        { input: "not-a-date", valid: false },
        { input: "", valid: true }, // Empty is ok for optional
      ];

      testCases.forEach(({ input, valid }) => {
        const result = validateRowData(columns, {
          sku: "TEST",
          product: "Test",
          delivery: input,
        });

        if (valid) {
          expect(result.isValid).toBe(true);
          if (input !== "") {
            expect(result.data.delivery).toBeDefined();
            // Should be stored as ISO string
            expect(result.data.delivery).toMatch(/^\d{4}-\d{2}-\d{2}T/);
          }
        } else {
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.field === "delivery")).toBe(true);
        }
      });
    });

    it("should validate boolean fields", () => {
      const testCases = [
        { input: true, expected: true },
        { input: false, expected: false },
        { input: "true", expected: true },
        { input: "false", expected: false },
        { input: 1, expected: true },
        { input: 0, expected: false },
        { input: "1", expected: true },
        { input: "0", expected: false },
        { input: "yes", expected: true },
        { input: "no", expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = validateRowData(columns, {
          sku: "TEST",
          product: "Test",
          urgent: input,
        });

        expect(result.isValid).toBe(true);
        expect(result.data.urgent).toBe(expected);
      });
    });

    it("should validate select fields", () => {
      const validOptions = ["pending", "in_production", "shipped", "delivered"];
      
      validOptions.forEach(option => {
        const result = validateRowData(columns, {
          sku: "TEST",
          product: "Test",
          status: option,
        });
        expect(result.isValid).toBe(true);
        expect(result.data.status).toBe(option);
      });

      // Invalid option
      const result = validateRowData(columns, {
        sku: "TEST",
        product: "Test",
        status: "invalid-option",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === "status")).toBe(true);
    });

    it("should handle null and undefined values", () => {
      const result = validateRowData(columns, {
        sku: "TEST",
        product: "Test",
        quantity: null,
        status: undefined,
        delivery: null,
        urgent: undefined,
      });

      expect(result.isValid).toBe(true);
      // Optional fields can be null/undefined
    });

    it("should handle edge case values", () => {
      const result = validateRowData(columns, {
        sku: edgeCaseData.veryLongString,
        product: edgeCaseData.specialCharacters,
        quantity: edgeCaseData.largeNumber,
      });

      expect(result.isValid).toBe(true);
      expect(result.data.sku).toBe(edgeCaseData.veryLongString);
      expect(result.data.product).toBe(edgeCaseData.specialCharacters);
      expect(result.data.quantity).toBe(edgeCaseData.largeNumber);
    });
  });

  describe("validateColumns", () => {
    it("should validate valid columns", () => {
      const columns = createMockColumns();
      const result = validateColumns(columns);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect duplicate column IDs", () => {
      const columns: ColumnDefinition[] = [
        {
          id: "col1",
          name: "Column 1",
          key: "key1",
          type: "text",
          required: false,
          order: 0,
        },
        {
          id: "col1", // Duplicate ID
          name: "Column 2",
          key: "key2",
          type: "text",
          required: false,
          order: 1,
        },
      ];

      const result = validateColumns(columns);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes("Duplicate column ID"))).toBe(true);
    });

    it("should detect duplicate column keys", () => {
      const columns: ColumnDefinition[] = [
        {
          id: "col1",
          name: "Column 1",
          key: "key1",
          type: "text",
          required: false,
          order: 0,
        },
        {
          id: "col2",
          name: "Column 2",
          key: "key1", // Duplicate key
          type: "text",
          required: false,
          order: 1,
        },
      ];

      const result = validateColumns(columns);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes("Duplicate column key"))).toBe(true);
    });

    it("should validate select columns have options", () => {
      const columns: ColumnDefinition[] = [
        {
          id: "col1",
          name: "Status",
          key: "status",
          type: "select",
          required: false,
          order: 0,
          // Missing options
        },
      ];

      const result = validateColumns(columns);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes("must have options"))).toBe(true);
    });
  });

  describe("generateSlug", () => {
    it("should generate valid slugs", () => {
      const testCases = [
        { input: "Test Tracker", expected: "test-tracker" },
        { input: "Test  Tracker", expected: "test-tracker" },
        { input: "Test-Tracker", expected: "test-tracker" },
        { input: "Test_Tracker", expected: "test-tracker" },
        { input: "Test!@#$%Tracker", expected: "test-tracker" },
        { input: "  Test Tracker  ", expected: "test-tracker" },
        { input: "UPPERCASE", expected: "uppercase" },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(generateSlug(input)).toBe(expected);
      });
    });

    it("should handle unicode characters", () => {
      const slug = generateSlug("测试 Tracker 🚀");
      expect(slug).toBeDefined();
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });

    it("should truncate long names", () => {
      const longName = "x".repeat(100);
      const slug = generateSlug(longName);
      expect(slug.length).toBeLessThanOrEqual(50);
    });

    it("should handle edge cases", () => {
      expect(generateSlug("")).toBe("");
      expect(generateSlug("---")).toBe("");
      expect(generateSlug("123")).toBe("123");
      expect(generateSlug("!@#$%^&*()")).toBe("");
    });
  });

  describe("parseCSV", () => {
    it("should parse simple CSV", () => {
      const csv = generateValidCSV();
      const { headers, rows } = parseCSV(csv);

      expect(headers).toEqual([
        "SKU Code",
        "Product Name",
        "Quantity",
        "Status",
        "Delivery Date",
        "Urgent",
      ]);
      expect(rows).toHaveLength(3);
      expect(rows[0][0]).toBe("TEST-001");
      expect(rows[0][1]).toBe("Product One");
    });

    it("should handle quoted values with commas", () => {
      const csv = generateComplexCSV();
      const { headers, rows } = parseCSV(csv);

      expect(headers).toEqual(["SKU Code", "Product Name", "Quantity", "Notes"]);
      expect(rows[0][1]).toBe("Product, with comma");
      expect(rows[0][3]).toBe("This is a note with, commas");
    });

    it("should handle escaped quotes", () => {
      const csv = generateComplexCSV();
      const { rows } = parseCSV(csv);

      expect(rows[1][1]).toBe('Product with "quotes"');
      expect(rows[1][3]).toBe('Another "quoted" note');
    });

    it("should skip empty lines", () => {
      const csv = `header1,header2

row1,value1

row2,value2
`;
      const { headers, rows } = parseCSV(csv);

      expect(headers).toEqual(["header1", "header2"]);
      expect(rows).toHaveLength(2);
    });

    it("should sanitize malicious CSV", () => {
      const csv = generateMaliciousCSV();
      const { rows } = parseCSV(csv);

      // Values starting with =, +, -, @ should be sanitized
      expect(rows[0][2]).toBe("'=1+1");
      expect(rows[1][2]).toBe("'+1234567890");
      expect(rows[2][2]).toBe("'-SUM(A1:A10)");
      expect(rows[3][2]).toBe("'@example.com");
    });

    it("should handle empty CSV", () => {
      const { headers, rows } = parseCSV("");
      expect(headers).toEqual([]);
      expect(rows).toEqual([]);
    });
  });

  describe("mapCSVToTrackerData", () => {
    const columns = createMockColumns();

    it("should map CSV headers to column keys", () => {
      const headers = ["SKU Code", "Product Name", "Quantity"];
      const rows = [["TEST-001", "Product 1", "100"]];

      const result = mapCSVToTrackerData(headers, rows, columns);

      expect(result).toHaveLength(1);
      expect(result[0].sku).toBe("TEST-001");
      expect(result[0].product).toBe("Product 1");
      expect(result[0].quantity).toBe("100");
    });

    it("should match headers case-insensitively", () => {
      const headers = ["sku code", "PRODUCT NAME", "QuAnTiTy"];
      const rows = [["TEST-001", "Product 1", "100"]];

      const result = mapCSVToTrackerData(headers, rows, columns);

      expect(result[0].sku).toBe("TEST-001");
      expect(result[0].product).toBe("Product 1");
      expect(result[0].quantity).toBe("100");
    });

    it("should match by column key as well as name", () => {
      const headers = ["sku", "product", "quantity"]; // Using keys instead of names
      const rows = [["TEST-001", "Product 1", "100"]];

      const result = mapCSVToTrackerData(headers, rows, columns);

      expect(result[0].sku).toBe("TEST-001");
      expect(result[0].product).toBe("Product 1");
      expect(result[0].quantity).toBe("100");
    });

    it("should ignore unmapped columns", () => {
      const headers = ["SKU Code", "Unknown Column", "Product Name"];
      const rows = [["TEST-001", "ignored", "Product 1"]];

      const result = mapCSVToTrackerData(headers, rows, columns);

      expect(result[0].sku).toBe("TEST-001");
      expect(result[0].product).toBe("Product 1");
      expect(result[0]["Unknown Column"]).toBeUndefined();
    });

    it("should handle empty rows", () => {
      const headers = ["SKU Code", "Product Name"];
      const rows: string[][] = [];

      const result = mapCSVToTrackerData(headers, rows, columns);

      expect(result).toEqual([]);
    });
  });
});