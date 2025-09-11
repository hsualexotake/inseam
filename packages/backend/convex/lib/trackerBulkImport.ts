import { Doc } from "../_generated/dataModel";
import { validateRowData } from "./trackerValidation";
import { DatabaseWriter } from "../_generated/server";

export interface ImportResult {
  imported: number;
  updated: number;
  failed: { row: number; error: string }[];
}

export interface ProcessRowParams {
  rowData: Record<string, any>;
  tracker: Doc<"trackers">;
  mode: "append" | "update" | "replace";
  userId: string;
  db: DatabaseWriter;
}

/**
 * Process a single row during bulk import
 */
export async function processImportRow({
  rowData,
  tracker,
  mode,
  userId,
  db
}: ProcessRowParams): Promise<{
  imported: boolean;
  updated: boolean;
  error?: string;
}> {
  // Validate data
  const validation = validateRowData(tracker.columns, rowData);
  if (!validation.isValid) {
    return {
      imported: false,
      updated: false,
      error: validation.errors.map(e => e.message).join(", ")
    };
  }

  // Get primary key value
  const primaryKeyValue = validation.data[tracker.primaryKeyColumn];
  if (!primaryKeyValue) {
    return {
      imported: false,
      updated: false,
      error: `Primary key "${tracker.primaryKeyColumn}" is required`
    };
  }

  // Check if row exists
  const existing = await db
    .query("trackerData")
    .withIndex("by_tracker_row", q => 
      q.eq("trackerId", tracker._id)
       .eq("rowId", String(primaryKeyValue))
    )
    .first();

  if (existing) {
    if (mode === "update" || mode === "replace") {
      // Update existing row
      await db.patch(existing._id, {
        data: validation.data,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
      return { imported: false, updated: true };
    } else {
      // Skip in append mode
      return {
        imported: false,
        updated: false,
        error: `Row with ${tracker.primaryKeyColumn} "${primaryKeyValue}" already exists`
      };
    }
  } else {
    // Insert new row
    await db.insert("trackerData", {
      trackerId: tracker._id,
      rowId: String(primaryKeyValue),
      data: validation.data,
      createdAt: Date.now(),
      createdBy: userId,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return { imported: true, updated: false };
  }
}

/**
 * Validate import data before processing
 */
export function validateImportData(
  tracker: Doc<"trackers">,
  userId: string
): void {
  if (tracker.userId !== userId) {
    throw new Error("Not authorized to import to this tracker");
  }

  if (!tracker.columns || tracker.columns.length === 0) {
    throw new Error("Tracker has no columns defined");
  }

  if (!tracker.primaryKeyColumn) {
    throw new Error("Tracker has no primary key column defined");
  }
}