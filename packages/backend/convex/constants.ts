/**
 * Application constants
 * Centralized configuration following best practices
 */

// Query limits (following Convex best practices)
export const QUERY_LIMITS = {
  DEFAULT: 20,
  MAX: 100,
  UPDATES: 50,
  SKU_HISTORY: 20,
} as const;

// Confidence thresholds for SKU updates
export const CONFIDENCE_THRESHOLDS = {
  AUTO_APPLY: 0.5,    // Minimum confidence to auto-apply changes
  HIGH: 0.8,          // High confidence indicator
  MEDIUM: 0.5,        // Medium confidence indicator
} as const;

// Update type emojis for titles
export const UPDATE_TYPE_EMOJIS = {
  shipment: "📦",
  delivery: "✅",
  delay: "⚠️",
  approval: "✔️",
  action: "⚡",
  general: "📌",
  in_transit: "🚚",
} as const;

// Default values
export const DEFAULTS = {
  SKU_STATUS: "pending",
  UPDATE_URGENCY: "medium",
  UPDATE_TYPE: "general",
} as const;

// Nylas API configuration
export const NYLAS_CONFIG = {
  // Rate limits based on Nylas documentation
  RATE_LIMITS: {
    EMAILS_PER_MINUTE: 10,
    AUTH_PER_10_MINUTES: 5,
    SUMMARIES_PER_HOUR: 20,
    DEFAULT_PER_MINUTE: 30,
  },
  // Retry configuration
  RETRY: {
    MAX_RETRIES: 3,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 32000,
    BACKOFF_FACTOR: 2,
  },
  // Field selection for optimization (Nylas best practice)
  DEFAULT_EMAIL_FIELDS: [
    "id",
    "from",
    "to",
    "subject",
    "body",
    "snippet",
    "date",
    "unread",
    "has_attachments",
  ],
} as const;

// Error messages
export const ERROR_MESSAGES = {
  UNAUTHENTICATED: "Unauthenticated call to protected function",
  NOT_FOUND: "Resource not found",
  RATE_LIMITED: "Rate limit exceeded. Please try again later.",
  INVALID_INPUT: "Invalid input provided",
  SKU_NOT_FOUND: "SKU not found",
  UPDATE_NOT_FOUND: "Update not found",
  ALREADY_PROCESSED: "Already processed",
} as const;

// Time windows
export const TIME_WINDOWS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// Field mappings for SKU updates
export const SKU_FIELD_MAPPINGS = {
  "Delivery Date": "deliveryDate",
  "Expected Delivery": "deliveryDate",
  "Tracking #": "trackingNumber",
  "Tracking Number": "trackingNumber",
  "Status": "status",
  "Quantity": "quantity",
  "Supplier": "supplier",
  "Notes": "notes",
  "Category": "category",
} as const;