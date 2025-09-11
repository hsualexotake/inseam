import { Doc } from "../_generated/dataModel";
import { DatabaseWriter } from "../_generated/server";
import { processImportRow, ImportResult } from "./trackerBulkImport";
import { TRACKER_LIMITS } from "./trackerConstants";

/**
 * Process rows in batches for bulk import
 * This function handles the common batch processing logic for both
 * regular bulk import and CSV import
 */
export async function processBatchImport({
  rows,
  tracker,
  mode,
  userId,
  db,
  startIndex = 0,
}: {
  rows: Array<Record<string, any>>;
  tracker: Doc<"trackers">;
  mode: "append" | "update" | "replace";
  userId: string;
  db: DatabaseWriter;
  startIndex?: number;
}): Promise<ImportResult> {
  const results: ImportResult = {
    imported: 0,
    updated: 0,
    failed: [],
  };

  // Process rows in batches for better performance
  for (let i = 0; i < rows.length; i += TRACKER_LIMITS.IMPORT_BATCH_SIZE) {
    const batch = rows.slice(i, Math.min(i + TRACKER_LIMITS.IMPORT_BATCH_SIZE, rows.length));
    
    // Process batch sequentially to avoid database conflicts
    for (let j = 0; j < batch.length; j++) {
      const rowIndex = startIndex + i + j;
      try {
        const result = await processImportRow({
          rowData: batch[j],
          tracker,
          mode,
          userId,
          db
        });

        if (result.imported) {
          results.imported++;
        } else if (result.updated) {
          results.updated++;
        } else if (result.error) {
          results.failed.push({
            row: rowIndex + 1,
            error: result.error
          });
        }
      } catch (error) {
        results.failed.push({
          row: rowIndex + 1,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  return results;
}

/**
 * Delete all existing data for a tracker
 * Used when mode is "replace"
 */
export async function deleteAllTrackerData(
  db: DatabaseWriter,
  trackerId: Doc<"trackers">["_id"]
): Promise<void> {
  const existingData = await db
    .query("trackerData")
    .withIndex("by_tracker", q => q.eq("trackerId", trackerId))
    .collect();

  // Delete sequentially - Convex automatically batches operations in mutations
  for (const row of existingData) {
    await db.delete(row._id);
  }
}