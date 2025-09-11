import { ColumnDefinition } from "../../types/tracker";

/**
 * Test Helpers for Tracker System Tests
 * Provides mock data factories and utilities for testing
 */

// Mock authenticated user
export const mockUser = { subject: "test-user-123" };
export const mockUser2 = { subject: "test-user-456" };

/**
 * Create default pagination options for testing
 */
export const createMockPaginationOpts = (numItems: number = 100) => ({
  numItems,
  cursor: null,
});

/**
 * Create mock tracker columns with various types
 */
export const createMockColumns = (): ColumnDefinition[] => [
  {
    id: "sku",
    name: "SKU Code",
    key: "sku",
    type: "text",
    required: true,
    order: 0,
    width: 120,
  },
  {
    id: "product",
    name: "Product Name",
    key: "product",
    type: "text",
    required: true,
    order: 1,
    width: 200,
  },
  {
    id: "quantity",
    name: "Quantity",
    key: "quantity",
    type: "number",
    required: false,
    order: 2,
    width: 100,
  },
  {
    id: "status",
    name: "Status",
    key: "status",
    type: "select",
    required: false,
    options: ["pending", "in_production", "shipped", "delivered"],
    order: 3,
    width: 140,
  },
  {
    id: "delivery",
    name: "Delivery Date",
    key: "delivery",
    type: "date",
    required: false,
    order: 4,
    width: 120,
  },
  {
    id: "urgent",
    name: "Urgent",
    key: "urgent",
    type: "boolean",
    required: false,
    order: 5,
    width: 80,
  },
];

/**
 * Create a mock tracker configuration
 */
export const createMockTracker = (overrides?: Partial<any>) => ({
  name: "Test Tracker",
  description: "Test tracker for unit tests",
  columns: createMockColumns(),
  primaryKeyColumn: "sku",
  ...overrides,
});

/**
 * Create mock row data
 */
export const createMockRowData = (sku: string = "TEST-001") => ({
  sku,
  product: "Test Product",
  quantity: 100,
  status: "pending",
  delivery: "2024-12-31",
  urgent: false,
});

/**
 * Generate CSV test data
 */
export const generateValidCSV = (): string => {
  return `SKU Code,Product Name,Quantity,Status,Delivery Date,Urgent
TEST-001,Product One,100,pending,2024-12-31,false
TEST-002,Product Two,200,shipped,2024-12-15,true
TEST-003,"Product, Three",300,delivered,2024-12-01,false`;
};

/**
 * Generate CSV with quoted values and commas
 */
export const generateComplexCSV = (): string => {
  return `SKU Code,Product Name,Quantity,Notes
TEST-001,"Product, with comma",100,"This is a note with, commas"
TEST-002,"Product with ""quotes""",200,"Another ""quoted"" note"
TEST-003,Simple Product,300,Simple note`;
};

/**
 * Generate CSV with potential injection attacks
 */
export const generateMaliciousCSV = (): string => {
  return `SKU Code,Product Name,Formula
TEST-001,Normal Product,=1+1
TEST-002,Another Product,+1234567890
TEST-003,Safe Product,-SUM(A1:A10)
TEST-004,Email Product,@example.com`;
};

/**
 * Generate large dataset for performance testing
 */
export const generateLargeDataset = (count: number = 100) => {
  const rows = [];
  for (let i = 1; i <= count; i++) {
    rows.push({
      sku: `TEST-${String(i).padStart(3, '0')}`,
      product: `Product ${i}`,
      quantity: Math.floor(Math.random() * 1000),
      status: ["pending", "in_production", "shipped", "delivered"][i % 4],
      delivery: new Date(2024, 11, (i % 28) + 1).toISOString(),
      urgent: i % 2 === 0,
    });
  }
  return rows;
};

/**
 * Wait for a specified time (useful for async testing)
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Assert that an async function throws
 */
export const expectAsyncError = async (
  fn: () => Promise<any>,
  errorMessage?: string
): Promise<void> => {
  let error: Error | null = null;
  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }
  
  if (!error) {
    throw new Error("Expected function to throw but it didn't");
  }
  
  if (errorMessage && !error.message.includes(errorMessage)) {
    throw new Error(`Expected error message to include "${errorMessage}" but got "${error.message}"`);
  }
};

/**
 * Create test data with various edge cases
 */
export const edgeCaseData = {
  emptyString: "",
  nullValue: null,
  undefinedValue: undefined,
  veryLongString: "x".repeat(1000),
  specialCharacters: "!@#$%^&*()_+-=[]{}|;':\",./<>?",
  unicode: "🚀 Unicode 测试 тест",
  sqlInjection: "'; DROP TABLE trackers; --",
  xssAttempt: "<script>alert('XSS')</script>",
  largeNumber: Number.MAX_SAFE_INTEGER,
  negativeNumber: -9999,
  floatNumber: 3.14159,
  invalidDate: "not-a-date",
  futureDate: "2099-12-31",
  pastDate: "1900-01-01",
};