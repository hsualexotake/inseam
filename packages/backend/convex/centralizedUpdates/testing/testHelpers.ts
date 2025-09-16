import { Id } from "../../_generated/dataModel";
import { UserIdentity } from "convex/server";

/**
 * Realistic test data based on actual production scenarios
 */

// Mock users with different permissions and organizations
export const mockUser1: UserIdentity = {
  subject: "user_2mGDwW4oBDPF9Abc1234567",
  issuer: "https://example.clerk.dev",
  tokenIdentifier: "https://example.clerk.dev|user_2mGDwW4oBDPF9Abc1234567",
  name: "Test User 1",
  email: "user1@example.com",
};

export const mockUser2: UserIdentity = {
  subject: "user_3nHExY5pCEQG0Def8901234",
  issuer: "https://example.clerk.dev",
  tokenIdentifier: "https://example.clerk.dev|user_3nHExY5pCEQG0Def8901234",
  name: "Test User 2",
  email: "user2@example.com",
};

export const unauthorizedUser: UserIdentity = {
  subject: "user_4oIFzZ6qDFRH1Ghi5678901",
  issuer: "https://example.clerk.dev",
  tokenIdentifier: "https://example.clerk.dev|user_4oIFzZ6qDFRH1Ghi5678901",
  name: "Unauthorized User",
  email: "unauthorized@example.com",
};

// Realistic email samples from actual production patterns
export const realEmailSamples = {
  // Common scenario: Shipment delay notification
  delayNotification: {
    id: "msg_2mGDwW4oBDPF9XyZ",
    subject: "Urgent: Shipment Delay Notice - Order #PO-2024-1234",
    from: { name: "Supplier Updates", email: "updates@supplier.com" },
    date: Date.now() - 3600000, // 1 hour ago
    body: `Dear valued partner,

We regret to inform you that your shipment has been delayed.

Order Details:
- SKU 12 (Green Summer Dress) - Delivery delayed to September 15, 2024
- Original date: September 10, 2024
- Reason: Customs clearance delays at port
- New tracking: TRK-789456123

Please update your systems accordingly.

Best regards,
Supplier Team`,
    snippet: "We regret to inform you that your shipment has been delayed..."
  },

  // Complex scenario: Multiple SKU updates in one email
  multiSkuUpdate: {
    id: "msg_3nHExY5pCEQG0ABC",
    subject: "Weekly Inventory Update - Multiple Items",
    from: { name: "Warehouse Manager", email: "warehouse@logistics.com" },
    date: Date.now() - 7200000, // 2 hours ago
    body: `Weekly Update Report:

1. SKU 12 - Quantity received: 50 units (was 30)
2. SKU 45 - Price adjustment: Now $29.99 (was $39.99)
3. SKU 78 - NEW ITEM: Blue Cotton Shirt, Initial stock: 100 units
4. SKU 23 - DISCONTINUED: No longer available

Additional notes:
- All items passed quality check
- Next shipment expected Sept 20`,
    snippet: "Weekly Update Report: 1. SKU 12 - Quantity received: 50 units..."
  },

  // Edge case: Ambiguous/unclear email
  ambiguousEmail: {
    id: "msg_4oIFzZ6qDFRH1DEF",
    subject: "Update",
    from: { name: "Info", email: "info@company.com" },
    date: Date.now() - 10800000, // 3 hours ago
    body: "Please update the system with the latest information. Thanks.",
    snippet: "Please update the system with the latest information..."
  },

  // Edge case: Conflicting information in same email
  conflictingInfo: {
    id: "msg_5pJGaA7rESHI2GHI",
    subject: "Correction: Delivery Date Update",
    from: { name: "Shipping Dept", email: "shipping@supplier.com" },
    date: Date.now() - 1800000, // 30 minutes ago
    body: `Important Update:

SKU 12 delivery date is September 15.

CORRECTION: Please ignore above. The correct delivery date for SKU 12 is September 20, 2024.

Apologies for any confusion.`,
    snippet: "Important Update: SKU 12 delivery date is September 15. CORRECTION..."
  },

  // SQL injection attempt
  sqlInjectionAttempt: {
    id: "msg_6qKHbB8sFTIJ3JKL",
    subject: "'; DROP TABLE trackers; --",
    from: { name: "Malicious User", email: "hacker@evil.com" },
    date: Date.now(),
    body: "SKU '; DELETE FROM trackerData WHERE 1=1; -- has been updated",
    snippet: "SKU '; DELETE FROM..."
  },

  // Unicode and special characters
  unicodeContent: {
    id: "msg_7rLIcC9tGUJK4KLM",
    subject: "Update: México Orders 🚢📦",
    from: { name: "José García", email: "jose@supplier.mx" },
    date: Date.now() - 5400000,
    body: `Actualización de pedidos:

SKU 12 (Vestido Verde 👗) - 50% descuento aplicado
Precio: €29.99 → €14.99
Entrega: 15/09/2024
Notas: Frágil ⚠️ - Manejar con cuidado`,
    snippet: "Actualización de pedidos: SKU 12 (Vestido Verde 👗)..."
  }
};

// Create realistic tracker data
export function createMockTracker(overrides?: Partial<any>) {
  return {
    name: "Production Tracker",
    description: "Track production SKUs and inventory",
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
    ...overrides
  };
}

// Create realistic centralized update
export function createMockCentralizedUpdate(overrides?: Partial<any>) {
  return {
    source: "email",
    sourceId: "msg_2mGDwW4oBDPF9XyZ",
    type: "delay",
    category: "logistics",
    title: "Shipment Delay - SKU 12",
    summary: "Delivery delayed to September 15, 2024 due to customs",
    urgency: "high",
    fromName: "Supplier Updates",
    fromId: "updates@supplier.com",
    sourceSubject: "Urgent: Shipment Delay Notice",
    sourceQuote: "SKU 12 (Green Summer Dress) - Delivery delayed to September 15, 2024",
    sourceDate: Date.now() - 3600000,
    trackerMatches: [
      {
        trackerId: "tracker_123" as Id<"trackers">,
        trackerName: "Production Tracker",
        confidence: 0.95
      }
    ],
    trackerProposals: [
      {
        trackerId: "tracker_123" as Id<"trackers">,
        trackerName: "Production Tracker",
        rowId: "12",
        isNewRow: false,
        columnUpdates: [
          {
            columnKey: "delivery_date",
            columnName: "Delivery Date",
            columnType: "date",
            currentValue: "2024-09-10",
            proposedValue: "2024-09-15",
            confidence: 0.9
          }
        ]
      }
    ],
    processed: false,
    ...overrides
  };
}

// Create realistic alias data
export function createMockAlias(overrides?: Partial<any>) {
  return {
    trackerId: "tracker_123" as Id<"trackers">,
    rowId: "12",
    alias: "green dress",
    ...overrides
  };
}

// Helper to test authorization failures
export async function expectAuthorizationError(
  fn: () => Promise<any>,
  expectedMessage?: string
) {
  try {
    await fn();
    throw new Error("Expected authorization error but none was thrown");
  } catch (error: any) {
    if (expectedMessage) {
      expect(error.message).toContain(expectedMessage);
    } else {
      expect(error.message).toMatch(/not authorized|unauthorized|permission/i);
    }
  }
}

// Helper to test validation errors
export async function expectValidationError(
  fn: () => Promise<any>,
  expectedMessage?: string
) {
  try {
    await fn();
    throw new Error("Expected validation error but none was thrown");
  } catch (error: any) {
    if (expectedMessage) {
      expect(error.message).toContain(expectedMessage);
    } else {
      expect(error.message).toMatch(/invalid|required|must be|cannot be/i);
    }
  }
}

// Helper to create test data in database
export async function setupTestData(t: any, userId: string) {
  // Create a tracker
  const tracker = await t.run(async (ctx: any) => {
    return await ctx.db.insert("trackers", {
      userId,
      name: "Test Tracker",
      slug: "test-tracker",
      description: "Test tracker for unit tests",
      columns: createMockTracker().columns,
      primaryKeyColumn: "sku",
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  });

  // Add some test rows
  const rows = await t.run(async (ctx: any) => {
    const row1 = await ctx.db.insert("trackerData", {
      trackerId: tracker,
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

    const row2 = await ctx.db.insert("trackerData", {
      trackerId: tracker,
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

    return { row1, row2 };
  });

  return { tracker, rows };
}

// Helper to verify database state
export async function verifyDatabaseState(
  t: any,
  trackerId: Id<"trackers">,
  rowId: string,
  expectedData: Record<string, any>
) {
  const row = await t.run(async (ctx: any) => {
    return await ctx.db
      .query("trackerData")
      .withIndex("by_tracker_row", (q: any) =>
        q.eq("trackerId", trackerId).eq("rowId", rowId)
      )
      .first();
  });

  if (!row) {
    throw new Error(`Row ${rowId} not found in tracker ${trackerId}`);
  }

  // Check each expected field
  for (const [key, value] of Object.entries(expectedData)) {
    expect(row.data[key]).toBe(value);
  }
}

// Helper to simulate concurrent operations
export async function runConcurrently<T>(
  operations: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(operations.map(op => op()));
}

// Helper to measure performance
export async function measurePerformance(
  name: string,
  fn: () => Promise<any>,
  maxMs: number = 1000
) {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;

  if (duration > maxMs) {
    throw new Error(`${name} took ${duration}ms, expected less than ${maxMs}ms`);
  }

  return { result, duration };
}