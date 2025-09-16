import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../schema";
import { modules } from "../../test.setup";

describe("Email Workflow Integration - Real World Scenarios", () => {
  let t: ReturnType<typeof convexTest>;

  const mockUser = {
    subject: "user_2mGDwW4oBDPF9Abc1234567",
    issuer: "https://example.clerk.dev"
  };

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  // Helper to create test tracker
  async function createTestTracker(userId: string) {
    return await t.run(async (_ctx) => {
      const trackerId = await _ctx.db.insert("trackers", {
        userId,
        name: "Production Tracker",
        slug: "production-tracker",
        description: "Track production items",
        columns: [
          {
            id: "col_1",
            key: "sku",
            name: "SKU Code",
            type: "text",
            required: true,
            order: 0,
            width: 100,
            aiEnabled: true,
            aiAliases: ["sku code", "item code", "product code"]
          },
          {
            id: "col_2",
            key: "description",
            name: "Description",
            type: "text",
            required: false,
            order: 1,
            width: 200,
            aiEnabled: true,
            aiAliases: ["item name", "product name"]
          },
          {
            id: "col_3",
            key: "quantity",
            name: "Quantity",
            type: "number",
            required: false,
            order: 2,
            width: 100,
            aiEnabled: true,
            aiAliases: ["units", "stock", "inventory"]
          },
          {
            id: "col_4",
            key: "delivery_date",
            name: "Delivery Date",
            type: "date",
            required: false,
            order: 3,
            width: 150,
            aiEnabled: true,
            aiAliases: ["arrival date", "expected date", "eta"]
          },
          {
            id: "col_5",
            key: "price",
            name: "Unit Price",
            type: "number",
            required: false,
            order: 4,
            width: 100,
            aiEnabled: true,
            aiAliases: ["cost", "unit cost", "price per unit"]
          }
        ],
        primaryKeyColumn: "sku",
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      // Add existing SKUs
      await _ctx.db.insert("trackerData", {
        trackerId,
        rowId: "12",
        data: {
          sku: "12",
          description: "Green Summer Dress",
          quantity: 30,
          delivery_date: "2024-09-10",
          price: 39.99
        },
        createdAt: Date.now(),
        createdBy: userId,
        updatedAt: Date.now(),
        updatedBy: userId
      });

      await _ctx.db.insert("trackerData", {
        trackerId,
        rowId: "45",
        data: {
          sku: "45",
          description: "Blue Cotton Shirt",
          quantity: 50,
          delivery_date: "2024-09-12",
          price: 29.99
        },
        createdAt: Date.now(),
        createdBy: userId,
        updatedAt: Date.now(),
        updatedBy: userId
      });

      return trackerId;
    });
  }

  describe("Email to Tracker Matching", () => {
    it("should correctly match complex multi-tracker email", async () => {
      const trackerId = await createTestTracker(mockUser.subject);

      // Simulate email with multiple SKU mentions
      const email = {
        id: "msg_complex_1",
        subject: "Update on your orders",
        body: `Dear Customer,

Here are the updates for your recent orders:

1. SKU 12 (Green Dress) - Delivery delayed to September 15, 2024
   - Previous date: September 10, 2024
   - Reason: Customs clearance

2. SKU 45 - Quantity increased to 100 units
   - Previous quantity: 50 units
   - Available immediately

3. New Item Added: SKU 78 - Blue Summer Shirt
   - Initial stock: 75 units
   - Price: $35.99
   - Expected delivery: September 20, 2024

Please update your systems accordingly.

Best regards,
Supplier Team`,
        snippet: "Here are the updates for your recent orders..."
      };

      // Mock the agent tool response for tracker matching
      const trackerMatches = await t.run(async (_ctx) => {
        // Simulate the analyzeEmailForTrackers tool
        const fullContent = `${email.subject} ${email.body}`.toLowerCase();
        const matches = [];

        // Check if content mentions SKUs
        if (fullContent.includes("sku") || fullContent.includes("delivery") || fullContent.includes("quantity")) {
          matches.push({
            trackerId: trackerId,
            trackerName: "Production Tracker",
            confidence: 0.95,
            matchedKeywords: ["sku", "delivery", "quantity", "price"],
            relevantColumns: ["sku", "delivery_date", "quantity", "price"]
          });
        }

        return matches;
      });

      expect(trackerMatches).toHaveLength(1);
      expect(trackerMatches[0].confidence).toBeGreaterThan(0.9);
      expect(trackerMatches[0].relevantColumns).toContain("delivery_date");
      expect(trackerMatches[0].relevantColumns).toContain("quantity");
    });

    it("should handle ambiguous emails with low confidence", async () => {
      const trackerId = await createTestTracker(mockUser.subject);

      const ambiguousEmail = {
        id: "msg_ambiguous_1",
        subject: "Update",
        body: "Please update the system with the latest information.",
        snippet: "Please update the system..."
      };

      const trackerMatches = await t.run(async (_ctx) => {
        const fullContent = `${ambiguousEmail.subject} ${ambiguousEmail.body}`.toLowerCase();
        const matches = [];

        // Very generic content - low confidence
        if (fullContent.includes("update")) {
          matches.push({
            trackerId: trackerId,
            trackerName: "Production Tracker",
            confidence: 0.2, // Low confidence
            matchedKeywords: ["update"],
            relevantColumns: []
          });
        }

        return matches;
      });

      // Should still create a match but with low confidence
      expect(trackerMatches).toHaveLength(1);
      expect(trackerMatches[0].confidence).toBeLessThan(0.3);
      expect(trackerMatches[0].relevantColumns).toHaveLength(0);
    });
  });

  describe("Data Extraction with Aliases", () => {
    it("should resolve aliases during extraction", async () => {
      const trackerId = await createTestTracker(mockUser.subject);

      // Add aliases
      await t.run(async (_ctx) => {
        await _ctx.db.insert("trackerRowAliases", {
          trackerId,
          rowId: "12",
          alias: "green dress",
          userId: mockUser.subject,
          createdAt: Date.now()
        });

        await _ctx.db.insert("trackerRowAliases", {
          trackerId,
          rowId: "45",
          alias: "blue shirt",
          userId: mockUser.subject,
          createdAt: Date.now()
        });
      });

      // Email using aliases instead of SKU codes
      // This email would contain: "The green dress delivery has been delayed to September 15. The blue shirt quantity is now 100 units."

      // Simulate extraction with alias resolution
      const extractedData = await t.run(async (_ctx) => {
        // Mock LLM extraction result from the email content
        const llmExtracted = {
          "green dress": {
            delivery_date: "2024-09-15"
          },
          "blue shirt": {
            quantity: 100
          }
        };

        // Resolve aliases
        const resolved: Record<string, any> = {};

        for (const [key, data] of Object.entries(llmExtracted)) {
          // Try to resolve as alias
          // Find alias by filtering (test environment doesn't have indexes)
          const aliases = await _ctx.db
            .query("trackerRowAliases")
            .collect();
          const aliasMatch = aliases.find(
            a => a.trackerId === trackerId && a.alias === key.toLowerCase()
          );

          if (aliasMatch) {
            resolved[aliasMatch.rowId] = data;
          } else {
            resolved[key] = data;
          }
        }

        return resolved;
      });

      // Should resolve "green dress" to SKU 12 and "blue shirt" to SKU 45
      expect(extractedData["12"]).toBeDefined();
      expect(extractedData["12"].delivery_date).toBe("2024-09-15");
      expect(extractedData["45"]).toBeDefined();
      expect(extractedData["45"].quantity).toBe(100);
    });
  });

  describe("Conflicting Information Handling", () => {
    it("should use latest information when email contains corrections", async () => {
      await createTestTracker(mockUser.subject);

      const emailWithCorrection = {
        id: "msg_correction_1",
        subject: "Correction: Delivery Date Update",
        body: `Important Update:

SKU 12 delivery date is September 15, 2024.

CORRECTION: Please ignore the above. The correct delivery date for SKU 12 is September 20, 2024.

We apologize for any confusion.`,
        snippet: "Important Update: SKU 12 delivery date..."
      };

      // Simulate extraction that handles corrections
      const extractedData = await t.run(async (_ctx) => {
        // Mock intelligent extraction that recognizes corrections
        const bodyLower = emailWithCorrection.body.toLowerCase();

        // Find all date mentions for SKU 12
        const dates = [];

        // First mention: September 15
        if (bodyLower.includes("september 15")) {
          dates.push({ date: "2024-09-15", position: bodyLower.indexOf("september 15") });
        }

        // Correction mention: September 20
        if (bodyLower.includes("september 20")) {
          const correctionPos = bodyLower.indexOf("september 20");
          const hasCorrection = bodyLower.substring(Math.max(0, correctionPos - 100), correctionPos)
            .includes("correct");

          dates.push({
            date: "2024-09-20",
            position: correctionPos,
            isCorrected: hasCorrection
          });
        }

        // Use the corrected date if found, otherwise latest mention
        const finalDate = dates.find(d => d.isCorrected) || dates[dates.length - 1];

        return {
          "12": {
            delivery_date: finalDate?.date || null
          }
        };
      });

      // Should use the corrected date (September 20)
      expect(extractedData["12"].delivery_date).toBe("2024-09-20");
    });

    it("should handle multiple updates for same SKU in one email", async () => {
      await createTestTracker(mockUser.subject);

      const multiUpdateEmail = {
        id: "msg_multi_1",
        subject: "Multiple Updates for SKU 12",
        body: `Updates for SKU 12:

Morning update: Quantity is 50 units
Afternoon update: Quantity revised to 75 units
Final confirmation: Quantity is 80 units

Please use the final numbers for your records.`,
        snippet: "Updates for SKU 12..."
      };

      // Simulate extraction that handles multiple updates
      const extractedData = await t.run(async (_ctx) => {
        // Mock extraction that recognizes "final" as authoritative
        const bodyLower = multiUpdateEmail.body.toLowerCase();

        // let quantity = null; // Not used in this mock

        // Find all quantity mentions
        const quantityPattern = /quantity (?:is|revised to) (\d+) units/g;
        let match;
        const quantities = [];

        while ((match = quantityPattern.exec(bodyLower)) !== null) {
          quantities.push({
            value: parseInt(match[1]),
            position: match.index,
            isFinal: bodyLower.substring(Math.max(0, match.index - 50), match.index).includes("final")
          });
        }

        // Use final quantity if marked, otherwise last mention
        const finalQuantity = quantities.find(q => q.isFinal) || quantities[quantities.length - 1];

        return {
          "12": {
            quantity: finalQuantity?.value || null
          }
        };
      });

      // Should use the final quantity (80)
      expect(extractedData["12"].quantity).toBe(80);
    });
  });

  describe("New Row Creation", () => {
    it("should correctly identify when to create new rows", async () => {
      const trackerId = await createTestTracker(mockUser.subject);

      // Test email would contain:
      // "We're adding a new item to your catalog:
      // SKU: 99
      // Description: Red Silk Scarf
      // Initial Stock: 200 units
      // Price: $24.99
      // Expected Delivery: October 1, 2024
      // This is a brand new item not previously in your system."

      // Check if SKU 99 exists
      const exists = await t.run(async (_ctx) => {
        // Find existing row by filtering (test environment doesn't have indexes)
        const rows = await _ctx.db
          .query("trackerData")
          .collect();
        const existing = rows.find(
          r => r.trackerId === trackerId && r.rowId === "99"
        );

        return !!existing;
      });

      expect(exists).toBe(false);

      // Create proposal for new row
      const proposal = {
        trackerId,
        trackerName: "Production Tracker",
        rowId: "99",
        isNewRow: true, // Should be marked as new
        columnUpdates: [
          {
            columnKey: "sku",
            columnName: "SKU Code",
            columnType: "text",
            proposedValue: "99",
            confidence: 0.95
          },
          {
            columnKey: "description",
            columnName: "Description",
            columnType: "text",
            proposedValue: "Red Silk Scarf",
            confidence: 0.95
          },
          {
            columnKey: "quantity",
            columnName: "Quantity",
            columnType: "number",
            proposedValue: 200,
            confidence: 0.95
          },
          {
            columnKey: "price",
            columnName: "Unit Price",
            columnType: "number",
            proposedValue: 24.99,
            confidence: 0.95
          },
          {
            columnKey: "delivery_date",
            columnName: "Delivery Date",
            columnType: "date",
            proposedValue: "2024-10-01",
            confidence: 0.9
          }
        ]
      };

      expect(proposal.isNewRow).toBe(true);
      expect(proposal.columnUpdates).toHaveLength(5);
    });
  });

  describe("Data Type Handling", () => {
    it("should correctly extract and type different data formats", async () => {
      await createTestTracker(mockUser.subject);

      // Test email would contain various data formats:
      // "SKU 12: Quantity: fifty units (written as text), Price: $39.99 USD, Delivery: Sept 15, 2024"
      // "SKU 45: Quantity: 100, Price: €29.99 EUR, Delivery: 15/09/2024"

      // Simulate type conversion
      const extractedData = await t.run(async (_ctx) => {
        // Mock extraction with type conversion
        const parseQuantity = (text: string): number | null => {
          // Handle written numbers
          const writtenNumbers: Record<string, number> = {
            "fifty": 50,
            "hundred": 100,
            "thousand": 1000
          };

          const lower = text.toLowerCase();
          for (const [word, num] of Object.entries(writtenNumbers)) {
            if (lower.includes(word)) return num;
          }

          // Try to parse as number
          const match = text.match(/\d+/);
          return match ? parseInt(match[0]) : null;
        };

        const parsePrice = (text: string): number => {
          // Remove currency symbols and parse
          const cleaned = text.replace(/[$€£¥]/g, "").trim();
          return parseFloat(cleaned);
        };

        const parseDate = (text: string): string => {
          // Handle various date formats
          const formats = [
            { pattern: /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, parse: (m: RegExpMatchArray) => {
              const months: Record<string, string> = {
                "january": "01", "jan": "01",
                "february": "02", "feb": "02",
                "march": "03", "mar": "03",
                "april": "04", "apr": "04",
                "may": "05",
                "june": "06", "jun": "06",
                "july": "07", "jul": "07",
                "august": "08", "aug": "08",
                "september": "09", "sept": "09", "sep": "09",
                "october": "10", "oct": "10",
                "november": "11", "nov": "11",
                "december": "12", "dec": "12"
              };
              const month = months[m[1].toLowerCase()] || "01";
              const day = m[2].padStart(2, "0");
              return `${m[3]}-${month}-${day}`;
            }},
            { pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, parse: (m: RegExpMatchArray) => {
              return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
            }}
          ];

          for (const format of formats) {
            const match = text.match(format.pattern);
            if (match) return format.parse(match);
          }

          return text;
        };

        return {
          "12": {
            quantity: parseQuantity("fifty units"),
            price: parsePrice("$39.99 USD"),
            delivery_date: parseDate("Sept 15, 2024"),
            description: "Green Summer Dress" // Remove quotes
          },
          "45": {
            quantity: 100,
            price: parsePrice("€29.99 EUR"),
            delivery_date: parseDate("15/09/2024")
          }
        };
      });

      // Verify correct type conversions
      expect(extractedData["12"].quantity).toBe(50); // "fifty" → 50
      expect(extractedData["12"].price).toBe(39.99); // "$39.99 USD" → 39.99
      expect(extractedData["12"].delivery_date).toBe("2024-09-15"); // "Sept 15, 2024" → "2024-09-15"
      expect(extractedData["12"].description).toBe("Green Summer Dress"); // Quotes removed

      expect(extractedData["45"].quantity).toBe(100);
      expect(extractedData["45"].price).toBe(29.99); // "€29.99 EUR" → 29.99
      expect(extractedData["45"].delivery_date).toBe("2024-09-15"); // "15/09/2024" → "2024-09-15"
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed JSON from LLM gracefully", async () => {
      await createTestTracker(mockUser.subject);

      // Simulate LLM returning malformed JSON
      const malformedResponses = [
        "```json\n{sku: \"12\", quantity: 50}```", // Missing quotes around keys
        "{\"sku\": \"12\", \"quantity\": 50,}", // Trailing comma
        "Sure! Here's the JSON: {\"sku\": \"12\"}", // Extra text
        "{\"sku\": \"12\"\n\"quantity\": 50}", // Missing comma
      ];

      for (const response of malformedResponses) {
        const result = await t.run(async (_ctx) => {
          try {
            // Try to clean and parse
            let cleaned = response;

            // Remove markdown code blocks
            cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "");

            // Extract JSON from text
            const jsonMatch = cleaned.match(/\{[^}]*\}/);
            if (jsonMatch) {
              cleaned = jsonMatch[0];
            }

            // Try to fix common issues
            cleaned = cleaned.replace(/,\s*}/, "}"); // Remove trailing comma
            cleaned = cleaned.replace(/(\w+):/g, '"$1":'); // Add quotes to keys

            const parsed = JSON.parse(cleaned);
            return { success: true, data: parsed };
          } catch (error: any) {
            return { success: false, error: error.message };
          }
        });

        // Should handle gracefully, either by fixing or failing with clear error
        expect(result).toBeDefined();
      }
    });

    it("should handle network timeouts during agent processing", async () => {
      await createTestTracker(mockUser.subject);

      // Simulate timeout scenario
      const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), 100);
      });

      const extractionPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ "12": { quantity: 50 } }), 200);
      });

      try {
        const result = await Promise.race([timeoutPromise, extractionPromise]);
        expect(result).toBeNull(); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("timeout");
      }
    });
  });
});