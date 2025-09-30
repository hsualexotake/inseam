import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test.setup";
import {
  mockUser1,
  mockUser2,
  realEmailSamples,
  expectAuthorizationError,
  setupTestData,
  verifyDatabaseState,
  runConcurrently,
  measurePerformance
} from "./testHelpers";

describe("CentralizedUpdates - Real World Scenarios", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  describe("Email Processing Flow", () => {
    it("should handle real delay notification email correctly", async () => {
      // Setup: Create tracker with existing SKU
      const { tracker } = await setupTestData(t, mockUser1.subject);

      // Create update from real email
      const updateId = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.insert("centralizedUpdates", {
          userId: mockUser1.subject,
          source: "email",
          sourceId: realEmailSamples.delayNotification.id,
          type: "delay",
          category: "logistics",
          title: "Shipment Delay - SKU 12",
          summary: "Delivery delayed to September 15, 2024",
          urgency: "high",
          fromName: realEmailSamples.delayNotification.from.name,
          fromId: realEmailSamples.delayNotification.from.email,
          sourceSubject: realEmailSamples.delayNotification.subject,
          sourceQuote: "SKU 12 (Green Summer Dress) - Delivery delayed to September 15, 2024",
          sourceDate: realEmailSamples.delayNotification.date,
          trackerMatches: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            confidence: 0.95
          }],
          trackerProposals: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            rowId: "12",
            isNewRow: false,
            columnUpdates: [{
              columnKey: "delivery_date",
              columnName: "Delivery Date",
              columnType: "date",
              currentValue: "2024-09-10",
              proposedValue: "2024-09-15",
              confidence: 0.9
            }]
          }],
          processed: false,
          createdAt: Date.now()
        });
      });

      // Verify update was created correctly
      const update = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.get(updateId);
      });

      expect(update).toBeDefined();
      expect(update?.urgency).toBe("high");
      expect(update?.trackerProposals).toHaveLength(1);
      expect(update?.trackerProposals?.[0]?.columnUpdates[0]?.proposedValue).toBe("2024-09-15");
    });

    it("should handle multiple SKU mentions in one email", async () => {
      const { tracker } = await setupTestData(t, mockUser1.subject);

      // Create update with multiple proposals
      const updateId = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.insert("centralizedUpdates", {
          userId: mockUser1.subject,
          source: "email",
          sourceId: realEmailSamples.multiSkuUpdate.id,
          type: "update",
          category: "inventory",
          title: "Multiple SKU Updates",
          summary: "Updates for SKUs 12, 45, and new SKU 78",
          urgency: "medium",
          fromName: realEmailSamples.multiSkuUpdate.from.name,
          fromId: realEmailSamples.multiSkuUpdate.from.email,
          sourceSubject: realEmailSamples.multiSkuUpdate.subject,
          sourceDate: realEmailSamples.multiSkuUpdate.date,
          trackerMatches: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            confidence: 0.85
          }],
          trackerProposals: [
            {
              trackerId: tracker,
              trackerName: "Test Tracker",
              rowId: "12",
              isNewRow: false,
              columnUpdates: [{
                columnKey: "quantity",
                columnName: "Quantity",
                columnType: "number",
                currentValue: 30,
                proposedValue: 50,
                confidence: 0.95
              }]
            },
            {
              trackerId: tracker,
              trackerName: "Test Tracker",
              rowId: "45",
              isNewRow: false,
              columnUpdates: [{
                columnKey: "price",
                columnName: "Unit Price",
                columnType: "number",
                currentValue: 39.99,
                proposedValue: 29.99,
                confidence: 0.95
              }]
            },
            {
              trackerId: tracker,
              trackerName: "Test Tracker",
              rowId: "78",
              isNewRow: true,
              columnUpdates: [
                {
                  columnKey: "sku",
                  columnName: "SKU Code",
                  columnType: "text",
                  proposedValue: "78",
                  confidence: 0.9
                },
                {
                  columnKey: "description",
                  columnName: "Description",
                  columnType: "text",
                  proposedValue: "Blue Cotton Shirt",
                  confidence: 0.9
                },
                {
                  columnKey: "quantity",
                  columnName: "Quantity",
                  columnType: "number",
                  proposedValue: 100,
                  confidence: 0.95
                }
              ]
            }
          ],
          processed: false,
          createdAt: Date.now()
        });
      });

      const update = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.get(updateId);
      });

      // Should have 3 separate proposals
      expect(update?.trackerProposals).toHaveLength(3);

      // Check each proposal
      const sku12Proposal = update?.trackerProposals?.find((p: any) => p.rowId === "12");
      expect(sku12Proposal?.columnUpdates[0]?.proposedValue).toBe(50);

      const sku45Proposal = update?.trackerProposals?.find((p: any) => p.rowId === "45");
      expect(sku45Proposal?.columnUpdates[0]?.proposedValue).toBe(29.99);

      const sku78Proposal = update?.trackerProposals?.find((p: any) => p.rowId === "78");
      expect(sku78Proposal?.isNewRow).toBe(true);
      expect(sku78Proposal?.columnUpdates).toHaveLength(3);
    });

    it("should handle emails with no extractable data gracefully", async () => {
      await setupTestData(t, mockUser1.subject);

      // Create update from ambiguous email
      const updateId = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.insert("centralizedUpdates", {
          userId: mockUser1.subject,
          source: "email",
          sourceId: realEmailSamples.ambiguousEmail.id,
          type: "general",
          category: "general",
          title: "Update",
          summary: "General update request",
          fromName: realEmailSamples.ambiguousEmail.from.name,
          fromId: realEmailSamples.ambiguousEmail.from.email,
          sourceSubject: realEmailSamples.ambiguousEmail.subject,
          sourceDate: realEmailSamples.ambiguousEmail.date,
          trackerMatches: [], // No matches
          trackerProposals: [], // No proposals
          processed: false,
          createdAt: Date.now()
        });
      });

      const update = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.get(updateId);
      });

      // Should create update but with empty proposals
      expect(update).toBeDefined();
      expect(update?.trackerProposals).toHaveLength(0);
      expect(update?.trackerMatches).toHaveLength(0);
    });
  });

  describe("Approval and Rejection Flow", () => {
    it("should approve only selected columns from proposal", async () => {
      const { tracker } = await setupTestData(t, mockUser1.subject);

      // Create update with multiple column changes
      const updateId = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.insert("centralizedUpdates", {
          userId: mockUser1.subject,
          source: "email",
          sourceId: "test_msg_1",
          type: "update",
          category: "inventory",
          title: "Multi-field Update",
          summary: "Price and quantity update for SKU 12",
          trackerMatches: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            confidence: 0.9
          }],
          trackerProposals: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            rowId: "12",
            isNewRow: false,
            columnUpdates: [
              {
                columnKey: "price",
                columnName: "Unit Price",
                columnType: "number",
                currentValue: 39.99,
                proposedValue: 50.00, // User wants to reject this
                confidence: 0.8
              },
              {
                columnKey: "delivery_date",
                columnName: "Delivery Date",
                columnType: "date",
                currentValue: "2024-09-10",
                proposedValue: "2024-09-15", // User wants to approve this
                confidence: 0.95
              }
            ]
          }],
          processed: false,
          createdAt: Date.now()
        });
      });

      // User approves only delivery_date, rejects price
      await t.withIdentity(mockUser1).mutation(
        api.centralizedUpdates.updateProposalWithEdits,
        {
          updateId,
          editedProposals: [{
            trackerId: tracker,
            rowId: "12",
            editedColumns: [{
              columnKey: "delivery_date",
              newValue: "2024-09-15", // Use the proposed value
              targetColumnKey: "delivery_date"
            }]
          }]
        }
      );

      // Verify only approved field was updated
      await verifyDatabaseState(t, tracker, "12", {
        delivery_date: "2024-09-15",
        price: 39.99 // Should remain unchanged
      });

      // Verify update is marked as processed
      const processedUpdate = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.get(updateId);
      });
      expect(processedUpdate?.processed).toBe(true);
      expect(processedUpdate?.approved).toBe(true);
    });

    it("should prevent duplicate primary keys when approving", async () => {
      const { tracker } = await setupTestData(t, mockUser1.subject);

      // Create update that would change SKU 12 to SKU 45 (which already exists)
      const updateId = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.insert("centralizedUpdates", {
          userId: mockUser1.subject,
          source: "email",
          sourceId: "test_msg_2",
          type: "update",
          category: "general",
          title: "SKU Change",
          summary: "Changing SKU 12 to SKU 45",
          trackerMatches: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            confidence: 0.9
          }],
          trackerProposals: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            rowId: "12",
            isNewRow: false,
            columnUpdates: [{
              columnKey: "sku",
              columnName: "SKU Code",
              columnType: "text",
              currentValue: "12",
              proposedValue: "45", // This already exists!
              confidence: 0.9
            }]
          }],
          processed: false,
          createdAt: Date.now()
        });
      });

      // Attempt to approve should fail
      const result = await t.withIdentity(mockUser1).mutation(
        api.centralizedUpdates.updateProposalWithEdits,
        {
          updateId,
          editedProposals: [{
            trackerId: tracker,
            rowId: "12",
            editedColumns: [{
              columnKey: "sku",
              newValue: "45", // This already exists!
              targetColumnKey: "sku"
            }]
          }]
        }
      );

      // Check that the result contains an error about duplicate
      expect(result.success).toBe(true); // Overall operation succeeded
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(false); // But this specific proposal failed
      expect(result.results[0].error).toContain("Duplicate");

      // Verify data wasn't changed
      await verifyDatabaseState(t, tracker, "12", {
        sku: "12" // Should remain unchanged
      });
    });

    it("should handle rejection of all proposals", async () => {
      const { tracker } = await setupTestData(t, mockUser1.subject);

      const updateId = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.insert("centralizedUpdates", {
          userId: mockUser1.subject,
          source: "email",
          sourceId: "test_msg_3",
          type: "update",
          category: "general",
          title: "Suspicious Update",
          summary: "Questionable changes",
          trackerMatches: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            confidence: 0.5
          }],
          trackerProposals: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            rowId: "12",
            isNewRow: false,
            columnUpdates: [{
              columnKey: "price",
              columnName: "Unit Price",
              columnType: "number",
              currentValue: 39.99,
              proposedValue: 0.01, // Suspicious price
              confidence: 0.3
            }]
          }],
          processed: false,
          createdAt: Date.now()
        });
      });

      // Reject all proposals
      await t.withIdentity(mockUser1).mutation(
        api.centralizedUpdates.rejectProposals,
        { updateId }
      );

      // Verify update is marked as rejected
      const rejectedUpdate = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.get(updateId);
      });
      expect(rejectedUpdate?.processed).toBe(true);
      expect(rejectedUpdate?.rejected).toBe(true);
      expect(rejectedUpdate?.approved).toBeUndefined();

      // Verify data wasn't changed
      await verifyDatabaseState(t, tracker, "12", {
        price: 39.99 // Should remain unchanged
      });
    });
  });

  describe("Authorization and Security", () => {
    it("should prevent unauthorized user from accessing another user's updates", async () => {
      await setupTestData(t, mockUser1.subject);

      // User1 creates an update
      const updateId = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.insert("centralizedUpdates", {
          userId: mockUser1.subject,
          source: "email",
          sourceId: "test_msg_4",
          type: "update",
          category: "general",
          title: "Private Update",
          summary: "User1's private data",
          trackerMatches: [],
          processed: false,
          createdAt: Date.now()
        });
      });

      // User2 tries to approve it - should fail
      await expectAuthorizationError(
        () => t.withIdentity(mockUser2).mutation(
          api.centralizedUpdates.updateProposalWithEdits,
          {
            updateId,
            editedProposals: []
          }
        ),
        "Not authorized"
      );

      // User2 tries to reject it - should fail
      await expectAuthorizationError(
        () => t.withIdentity(mockUser2).mutation(
          api.centralizedUpdates.rejectProposals,
          { updateId }
        ),
        "Not authorized"
      );
    });

    it("should handle SQL injection attempts safely", async () => {
      const { tracker } = await setupTestData(t, mockUser1.subject);

      // Create update with SQL injection attempt in content
      const updateId = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.insert("centralizedUpdates", {
          userId: mockUser1.subject,
          source: "email",
          sourceId: realEmailSamples.sqlInjectionAttempt.id,
          type: "update",
          category: "general",
          title: realEmailSamples.sqlInjectionAttempt.subject, // Contains SQL injection
          summary: "Malicious update attempt",
          fromName: realEmailSamples.sqlInjectionAttempt.from.name,
          fromId: realEmailSamples.sqlInjectionAttempt.from.email,
          sourceSubject: realEmailSamples.sqlInjectionAttempt.subject,
          sourceQuote: realEmailSamples.sqlInjectionAttempt.body,
          sourceDate: realEmailSamples.sqlInjectionAttempt.date,
          trackerMatches: [],
          trackerProposals: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            rowId: "'; DELETE FROM trackerData; --",
            isNewRow: true,
            columnUpdates: [{
              columnKey: "sku",
              columnName: "SKU Code",
              columnType: "text",
              proposedValue: "'; DROP TABLE trackers; --",
              confidence: 0.1
            }]
          }],
          processed: false,
          createdAt: Date.now()
        });
      });

      // The SQL injection attempt should be stored as plain text, not executed
      const update = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.get(updateId);
      });

      expect(update?.title).toContain("DROP TABLE");
      expect(update?.trackerProposals?.[0].rowId).toContain("DELETE FROM");

      // Verify database is still intact
      const trackerStillExists = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.get(tracker);
      });
      expect(trackerStillExists).toBeDefined();
    });
  });

  describe("Pagination and Performance", () => {
    it("should handle pagination correctly at boundaries", async () => {
      // Create exactly 10 updates (typical page size)
      const updateIds = [];
      for (let i = 0; i < 10; i++) {
        const updateId = await t.withIdentity(mockUser1).run(async (ctx) => {
          return await ctx.db.insert("centralizedUpdates", {
            userId: mockUser1.subject,
            source: "email",
            sourceId: `msg_${i}`,
            type: "update",
            category: "general",
            title: `Update ${i}`,
            summary: `Summary ${i}`,
            trackerMatches: [],
            processed: false,
            createdAt: Date.now() - (i * 1000) // Stagger creation times
          });
        });
        updateIds.push(updateId);
      }

      // Get first page
      const page1 = await t.withIdentity(mockUser1).query(
        api.centralizedUpdates.getCentralizedUpdates,
        {
          viewMode: "active",
          paginationOpts: { numItems: 10, cursor: null }
        }
      );

      expect(page1.page).toHaveLength(10);
      expect(page1.isDone).toBe(false); // Might have more

      // Get second page - should be empty or have remaining items
      const page2 = await t.withIdentity(mockUser1).query(
        api.centralizedUpdates.getCentralizedUpdates,
        {
          viewMode: "active",
          paginationOpts: { numItems: 10, cursor: page1.continueCursor }
        }
      );

      // Should not error even if empty
      expect(page2.page).toBeDefined();
    });

    it("should calculate statistics efficiently with many updates", async () => {
      // Create a tracker first
      const { tracker } = await setupTestData(t, mockUser1.subject);

      // Create 50 updates with various states
      for (let i = 0; i < 50; i++) {
        await t.withIdentity(mockUser1).run(async (ctx) => {
          return await ctx.db.insert("centralizedUpdates", {
            userId: mockUser1.subject,
            source: "email",
            sourceId: `bulk_msg_${i}`,
            type: "update",
            category: "general",
            title: `Bulk Update ${i}`,
            summary: `Bulk Summary ${i}`,
            trackerMatches: [],
            trackerProposals: i % 3 === 0 ? [{
              trackerId: tracker, // Use actual tracker ID
              trackerName: "Test",
              rowId: String(i),
              isNewRow: false,
              columnUpdates: []
            }] : [],
            processed: i < 20, // First 20 are processed
            approved: i < 10, // First 10 are approved
            rejected: i >= 10 && i < 20, // Next 10 are rejected
            createdAt: Date.now() - (i * 1000)
          });
        });
      }

      // Measure performance of stats calculation
      const { result: stats } = await measurePerformance(
        "getCentralizedStats",
        () => t.withIdentity(mockUser1).query(api.centralizedUpdates.getCentralizedStats, {}),
        100 // Should complete in 100ms
      );

      expect(stats.total).toBe(50);
      expect(stats.pending).toBe(30);
      expect(stats.approved).toBe(10);
      expect(stats.rejected).toBe(10);
      expect(stats.withProposals).toBe(17); // Every 3rd update has proposals
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent approvals without data corruption", async () => {
      const { tracker } = await setupTestData(t, mockUser1.subject);

      // Create two different updates for the same SKU
      const update1Id = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.insert("centralizedUpdates", {
          userId: mockUser1.subject,
          source: "email",
          sourceId: "concurrent_1",
          type: "update",
          category: "general",
          title: "Price Update 1",
          summary: "Setting price to 50",
          trackerMatches: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            confidence: 0.9
          }],
          trackerProposals: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            rowId: "12",
            isNewRow: false,
            columnUpdates: [{
              columnKey: "price",
              columnName: "Unit Price",
              columnType: "number",
              currentValue: 39.99,
              proposedValue: 50.00,
              confidence: 0.9
            }]
          }],
          processed: false,
          createdAt: Date.now()
        });
      });

      const update2Id = await t.withIdentity(mockUser1).run(async (ctx) => {
        return await ctx.db.insert("centralizedUpdates", {
          userId: mockUser1.subject,
          source: "email",
          sourceId: "concurrent_2",
          type: "update",
          category: "general",
          title: "Price Update 2",
          summary: "Setting price to 60",
          trackerMatches: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            confidence: 0.9
          }],
          trackerProposals: [{
            trackerId: tracker,
            trackerName: "Test Tracker",
            rowId: "12",
            isNewRow: false,
            columnUpdates: [{
              columnKey: "price",
              columnName: "Unit Price",
              columnType: "number",
              currentValue: 39.99,
              proposedValue: 60.00,
              confidence: 0.9
            }]
          }],
          processed: false,
          createdAt: Date.now() + 1000
        });
      });

      // Approve both concurrently
      const results = await runConcurrently([
        () => t.withIdentity(mockUser1).mutation(
          api.centralizedUpdates.updateProposalWithEdits,
          {
            updateId: update1Id,
            editedProposals: [{
              trackerId: tracker,
              rowId: "12",
              editedColumns: [{
                columnKey: "price",
                newValue: 50.00,
                targetColumnKey: "price"
              }]
            }]
          }
        ),
        () => t.withIdentity(mockUser1).mutation(
          api.centralizedUpdates.updateProposalWithEdits,
          {
            updateId: update2Id,
            editedProposals: [{
              trackerId: tracker,
              rowId: "12",
              editedColumns: [{
                columnKey: "price",
                newValue: 60.00,
                targetColumnKey: "price"
              }]
            }]
          }
        )
      ]);

      // Both should complete without error
      expect(results).toHaveLength(2);

      // Last write wins - verify final state
      const finalRow = await t.withIdentity(mockUser1).run(async (ctx) => {
        // Find row by filtering (test environment doesn't have indexes)
        const rows = await ctx.db
          .query("trackerData")
          .collect();
        return rows.find(
          r => r.trackerId === tracker && r.rowId === "12"
        );
      });

      // Price should be either 50 or 60, not corrupted
      expect([50, 60]).toContain(finalRow?.data.price);
    });
  });
});