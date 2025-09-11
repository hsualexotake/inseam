import { Id } from "../_generated/dataModel";

/**
 * Core column definition used across frontend and backend
 */
export interface ColumnDefinition {
  id: string;
  name: string;
  key: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  required: boolean;
  options?: string[];
  order: number;
  width?: number;
  aiEnabled?: boolean;
  aiAliases?: string[];
}

/**
 * Column type union for type safety
 */
export type ColumnType = ColumnDefinition["type"];

/**
 * Possible values in tracker data
 */
export type TrackerDataValue = string | number | boolean | null;

/**
 * Tracker entity with all fields
 */
export interface Tracker {
  _id: Id<"trackers">;
  name: string;
  slug: string;
  description?: string;
  columns: ColumnDefinition[];
  primaryKeyColumn: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

/**
 * Tracker data row
 */
export interface TrackerDataRow {
  _id: Id<"trackerData">;
  trackerId: Id<"trackers">;
  rowId: string;
  data: Record<string, TrackerDataValue>;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
}

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data: Record<string, any>;
}

/**
 * Bulk import results
 */
export interface BulkImportResult {
  imported: number;
  updated: number;
  failed: Array<{
    row: number;
    error: string;
  }>;
}