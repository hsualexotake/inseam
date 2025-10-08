import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { optionalAuth, requireAuth } from "./helpers/auth";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * Centralized Updates System with Tracker Integration
 * Parallel system to UnifiedUpdates that supports dynamic tracker proposals
 */

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validates field names to prevent injection attacks
 */
function isValidFieldName(fieldName: string): boolean {
  // Only allow alphanumeric characters, underscores, and hyphens
  return /^[a-zA-Z0-9_-]+$/.test(fieldName);
}

/**
 * Validates that an update exists, belongs to the user, and hasn't been processed
 */
async function validateUpdateAccess(
  ctx: MutationCtx,
  updateId: Id<"centralizedUpdates">,
  userId: string
): Promise<Doc<"centralizedUpdates">> {
  const update = await ctx.db.get(updateId);
  if (!update) {
    throw new Error("Update not found");
  }

  if (update.userId !== userId) {
    throw new Error("Not authorized to modify this update");
  }

  if (update.processed) {
    throw new Error("Update has already been processed");
  }

  return update;
}

/**
 * Validates that a tracker exists and belongs to the user
 */
async function validateTrackerAccess(
  ctx: MutationCtx,
  trackerId: Id<"trackers">,
  userId: string
): Promise<{ tracker: Doc<"trackers"> | null; error?: string }> {
  const tracker = await ctx.db.get(trackerId);
  if (!tracker) {
    return { tracker: null, error: "Tracker not found" };
  }

  if (tracker.userId !== userId) {
    return { tracker: null, error: "Not authorized to modify this tracker" };
  }

  return { tracker };
}

/**
 * Checks if a primary key value already exists in the tracker
 */
async function checkPrimaryKeyDuplicate(
  ctx: MutationCtx,
  trackerId: Id<"trackers">,
  primaryKeyColumn: string,
  newValue: any,
  excludeRowId: string
): Promise<{ isDuplicate: boolean; error?: string }> {
  // Validate the primary key column name to prevent injection
  if (!isValidFieldName(primaryKeyColumn)) {
    return { isDuplicate: true, error: "Invalid primary key column name" };
  }

  const duplicateExists = await ctx.db
    .query("trackerData")
    .withIndex("by_tracker", q => q.eq("trackerId", trackerId))
    .filter(q =>
      q.and(
        q.eq(q.field(`data.${primaryKeyColumn}`), newValue),
        q.neq(q.field("rowId"), excludeRowId)
      )
    )
    .first();

  if (duplicateExists) {
    return {
      isDuplicate: true,
      error: `Duplicate ${primaryKeyColumn} value: ${newValue} already exists in tracker`
    };
  }

  return { isDuplicate: false };
}

/**
 * Inserts or updates a tracker row
 */
async function upsertTrackerRow(
  ctx: MutationCtx,
  trackerId: Id<"trackers">,
  rowId: string,
  data: Record<string, any>,
  userId: string,
  isNewRow: boolean
): Promise<void> {
  if (isNewRow) {
    // Create new row
    await ctx.db.insert("trackerData", {
      trackerId,
      rowId,
      data,
      createdAt: Date.now(),
      createdBy: userId,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
  } else {
    // Check for existing row
    const existingRow = await ctx.db
      .query("trackerData")
      .withIndex("by_tracker_row", q =>
        q.eq("trackerId", trackerId)
         .eq("rowId", rowId)
      )
      .first();

    if (existingRow) {
      // Update existing row
      await ctx.db.patch(existingRow._id, {
        data: { ...existingRow.data, ...data },
        updatedAt: Date.now(),
        updatedBy: userId,
      });
    } else {
      // Row doesn't exist, create it
      await ctx.db.insert("trackerData", {
        trackerId,
        rowId,
        data,
        createdAt: Date.now(),
        createdBy: userId,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
    }
  }
}


// Get paginated centralized updates
export const getCentralizedUpdates = query({
  args: {
    paginationOpts: paginationOptsValidator,
    viewMode: v.union(v.literal("active"), v.literal("archived")),
  },
  handler: async (ctx, args) => {
    const userId = await optionalAuth(ctx);
    if (!userId) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }
    
    let query = ctx.db
      .query("centralizedUpdates")
      .withIndex("by_user_created", (q) => q.eq("userId", userId));
    
    // Filter by view mode
    if (args.viewMode === "active") {
      query = query.filter((q) => 
        q.eq(q.field("archivedAt"), undefined)
      );
    } else {
      query = query.filter((q) => 
        q.neq(q.field("archivedAt"), undefined)
      );
    }
    

    return await query.order("desc").paginate(args.paginationOpts);
  },
});

// Get statistics for centralized updates
export const getCentralizedStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) {
      return {
        total: 0,
        active: 0,
        archived: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        withProposals: 0,
        unread: 0,
      };
    }

    // Load all user's updates at once using indexed query
    // This is efficient for typical use cases (<1000 updates per user)
    // For larger scales, implement counter documents updated on mutations
    const allUpdates = await ctx.db
      .query("centralizedUpdates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Calculate statistics from the loaded documents
    const total = allUpdates.length;
    const active = allUpdates.filter(u => !u.processed && !u.archivedAt).length;
    const archived = allUpdates.filter(u => u.archivedAt !== undefined).length;
    const pending = allUpdates.filter(u => !u.processed).length;
    const approved = allUpdates.filter(u => u.approved === true).length;
    const rejected = allUpdates.filter(u => u.rejected === true).length;
    const withProposals = allUpdates.filter(u =>
      !u.archivedAt && u.trackerProposals && u.trackerProposals.length > 0
    ).length;
    const unread = allUpdates.filter(u => !u.archivedAt && !u.viewedAt).length;

    return {
      total,
      active,
      archived,
      pending,
      approved,
      rejected,
      withProposals,
      unread,
    };
  },
});

// Internal mutation for workflow use
export const internalCreateUpdate = internalMutation({
  args: {
    userId: v.string(),
    source: v.union(v.literal("email"), v.literal("manual")),
    sourceId: v.optional(v.string()),
    trackerMatches: v.optional(v.array(v.object({
      trackerId: v.id("trackers"),
      trackerName: v.string(),
      trackerColor: v.optional(v.string()),
      confidence: v.number(),
    }))),
    type: v.string(),
    category: v.string(),
    title: v.string(),
    summary: v.optional(v.string()),
    urgency: v.optional(v.string()),
    fromName: v.optional(v.string()),
    fromId: v.optional(v.string()),
    sourceSubject: v.optional(v.string()),
    sourceQuote: v.optional(v.string()),
    sourceDate: v.optional(v.number()),
    trackerProposals: v.optional(v.array(v.object({
      trackerId: v.id("trackers"),
      trackerName: v.string(),
      rowId: v.string(),
      isNewRow: v.boolean(),
      columnUpdates: v.array(v.object({
        columnKey: v.string(),
        columnName: v.string(),
        columnType: v.string(),
        columnColor: v.optional(v.string()),
        currentValue: v.optional(v.union(v.string(), v.number(), v.boolean(), v.null())),
        proposedValue: v.union(v.string(), v.number(), v.boolean(), v.null()),
        confidence: v.number(),
      })),
    }))),
  },
  handler: async (ctx, args) => {
    const { userId, ...updateData } = args;
    
    const updateId = await ctx.db.insert("centralizedUpdates", {
      userId,
      ...updateData,
      trackerMatches: updateData.trackerMatches || [], // Provide default empty array if undefined
      processed: false,
      createdAt: Date.now(),
    });
    
    return { success: true, updateId };
  },
});

// Reject proposals
export const rejectProposals = mutation({
  args: {
    updateId: v.id("centralizedUpdates"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    
    const update = await ctx.db.get(args.updateId);
    if (!update) {
      throw new Error("Update not found");
    }
    
    if (update.userId !== userId) {
      throw new Error("Not authorized to reject this update");
    }
    
    if (update.processed) {
      throw new Error("Update has already been processed");
    }
    
    await ctx.db.patch(args.updateId, {
      processed: true,
      processedAt: Date.now(),
      rejected: true,
      rejectedAt: Date.now(),
      archivedAt: Date.now(),
    });
    
    return { success: true };
  },
});

// Dismiss/archive an update without processing
export const archiveUpdate = mutation({
  args: {
    updateId: v.id("centralizedUpdates"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const update = await ctx.db.get(args.updateId);
    if (!update) {
      throw new Error("Update not found");
    }

    if (update.userId !== userId) {
      throw new Error("Not authorized to archive this update");
    }

    await ctx.db.patch(args.updateId, {
      archivedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Mark a single update as viewed
 */
export const markAsViewed = mutation({
  args: {
    updateId: v.id("centralizedUpdates"),
  },
  handler: async (ctx, { updateId }) => {
    const userId = await requireAuth(ctx);

    const update = await ctx.db.get(updateId);
    if (!update) {
      throw new Error("Update not found");
    }

    if (update.userId !== userId) {
      throw new Error("Not authorized to mark this update");
    }

    // Only mark if not already viewed
    if (!update.viewedAt) {
      await ctx.db.patch(updateId, {
        viewedAt: Date.now(),
        viewedBy: userId,
      });
    }

    return { success: true };
  },
});

/**
 * Mark all active (non-archived) updates as viewed for the current user
 * This should only be called from explicit user action (e.g., "Mark All as Read" button)
 */
export const markAllAsViewed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    // Get all unviewed updates for this user (with safety limit)
    const updates = await ctx.db
      .query("centralizedUpdates")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q =>
        q.and(
          q.eq(q.field("viewedAt"), undefined),
          q.eq(q.field("archivedAt"), undefined)
        )
      )
      .take(500); // Safety limit - generous but prevents runaway growth

    // Batch update
    await Promise.all(
      updates.map(update =>
        ctx.db.patch(update._id, {
          viewedAt: Date.now(),
          viewedBy: userId,
        })
      )
    );

    return {
      success: true,
      count: updates.length
    };
  },
});

// Get available trackers for the current user
export const getUserTrackers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await optionalAuth(ctx);
    if (!userId) {
      return [];
    }

    const trackers = await ctx.db
      .query("trackers")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .collect();

    return trackers.map(tracker => ({
      _id: tracker._id,
      name: tracker.name,
      slug: tracker.slug,
      columns: tracker.columns,
      primaryKeyColumn: tracker.primaryKeyColumn,
    }));
  },
});

// Update proposal values with edited data
export const updateProposalWithEdits = mutation({
  args: {
    updateId: v.id("centralizedUpdates"),
    editedProposals: v.array(v.object({
      trackerId: v.id("trackers"),
      rowId: v.string(),
      editedColumns: v.array(v.object({
        columnKey: v.string(),
        newValue: v.union(v.string(), v.number(), v.boolean(), v.null()),
        targetColumnKey: v.optional(v.string()), // For column remapping
      })),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Validate update access
    await validateUpdateAccess(ctx, args.updateId, userId);

    // Process each edited proposal
    const results = [];
    for (const editedProposal of args.editedProposals) {
      // Validate tracker access
      const { tracker, error: trackerError } = await validateTrackerAccess(
        ctx,
        editedProposal.trackerId,
        userId
      );

      if (!tracker) {
        results.push({
          trackerId: editedProposal.trackerId,
          rowId: editedProposal.rowId,
          success: false,
          error: trackerError || "Tracker not found",
        });
        continue;
      }

      // Build the data object with edited values and check for primary key changes
      const dataToUpdate: Record<string, any> = {};
      let primaryKeyChanged = false;
      let newPrimaryKeyValue: any = null;

      for (const edit of editedProposal.editedColumns) {
        const targetKey = edit.targetColumnKey || edit.columnKey;

        // Validate column exists in tracker
        const columnExists = tracker.columns.some(col => col.key === targetKey);
        if (!columnExists) {
          results.push({
            trackerId: editedProposal.trackerId,
            rowId: editedProposal.rowId,
            success: false,
            error: `Column ${targetKey} not found in tracker`,
          });
          continue;
        }

        // Check if this is the primary key column
        if (targetKey === tracker.primaryKeyColumn) {
          primaryKeyChanged = true;
          newPrimaryKeyValue = edit.newValue;
        }

        dataToUpdate[targetKey] = edit.newValue;
      }

      // If primary key is being changed, check for duplicates
      if (primaryKeyChanged && newPrimaryKeyValue !== null) {
        const { isDuplicate, error: dupError } = await checkPrimaryKeyDuplicate(
          ctx,
          editedProposal.trackerId,
          tracker.primaryKeyColumn,
          newPrimaryKeyValue,
          editedProposal.rowId
        );

        if (isDuplicate) {
          results.push({
            trackerId: editedProposal.trackerId,
            rowId: editedProposal.rowId,
            success: false,
            error: dupError || "Duplicate primary key",
          });
          continue;
        }
      }

      if (Object.keys(dataToUpdate).length === 0) {
        results.push({
          trackerId: editedProposal.trackerId,
          rowId: editedProposal.rowId,
          success: false,
          error: "No valid columns to update",
        });
        continue;
      }

      try {
        // Upsert the tracker row (isNewRow is false for edits)
        await upsertTrackerRow(
          ctx,
          editedProposal.trackerId,
          editedProposal.rowId,
          dataToUpdate,
          userId,
          false // isNewRow - edits are always on existing proposals
        );

        results.push({
          trackerId: editedProposal.trackerId,
          rowId: editedProposal.rowId,
          success: true,
        });
      } catch (error) {
        results.push({
          trackerId: editedProposal.trackerId,
          rowId: editedProposal.rowId,
          success: false,
          error: String(error),
        });
      }
    }

    // Mark update as processed
    await ctx.db.patch(args.updateId, {
      processed: true,
      processedAt: Date.now(),
      approved: true,
      approvedAt: Date.now(),
      approvedBy: userId,
      archivedAt: Date.now(),
    });

    return { success: true, results };
  },
});