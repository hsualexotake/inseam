/**
 * Shared TypeScript types for the application
 */

import { Id } from "./_generated/dataModel";

export interface Note {
  _id: Id<"notes">;
  userId: string;
  title: string;
  content: string;
  summary?: string;
}

export interface RateLimit {
  _id: Id<"rateLimits">;
  userId: string;
  endpoint: string;
  count: number;
  windowStart: number;
}

export interface Usage {
  _id: Id<"usage">;
  userId: string;
  date: string;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
}

// Re-export tracker types from dedicated file
export type {
  ColumnDefinition,
  ColumnType,
  TrackerDataValue,
  Tracker,
  TrackerDataRow,
  ValidationError,
  ValidationResult,
  BulkImportResult
} from "./types/tracker";

// Legacy alias for backward compatibility
export type TrackerData = import("./types/tracker").TrackerDataRow;

// Cost configuration
export const COST_PER_1K_TOKENS = {
  'gpt-4o-mini': {
    input: 0.00015,
    output: 0.0006,
  },
  'text-embedding-3-small': {
    input: 0.00002,
    output: 0,
  },
} as const;