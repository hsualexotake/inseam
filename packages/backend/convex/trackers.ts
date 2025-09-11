import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { ColumnDefinition } from "./types";
import { 
  validateRowData, 
  generateSlug, 
  validateColumns,
  parseCSV,
  mapCSVToTrackerData
} from "./lib/trackerValidation";
import { defaultTemplates } from "./lib/trackerTemplates";
import { validateImportData } from "./lib/trackerBulkImport";
import { TRACKER_LIMITS } from "./lib/trackerConstants";
import { processBatchImport, deleteAllTrackerData } from "./lib/trackerBatchProcessor";

// ============================================
// TRACKER MANAGEMENT MUTATIONS
// ============================================

export const createTracker = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    columns: v.array(v.object({
      id: v.string(),
      name: v.string(),
      key: v.string(),
      type: v.union(
        v.literal("text"),
        v.literal("number"),
        v.literal("date"),
        v.literal("select"),
        v.literal("boolean")
      ),
      required: v.boolean(),
      options: v.optional(v.array(v.string())),
      order: v.number(),
      width: v.optional(v.number()),
      aiEnabled: v.optional(v.boolean()),
      aiAliases: v.optional(v.array(v.string())),
    })),
    primaryKeyColumn: v.string(),
    templateKey: v.optional(v.string()), // Use a template
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate input lengths
    if (args.name.length > TRACKER_LIMITS.NAME_MAX_LENGTH) {
      throw new Error(`Tracker name must be ${TRACKER_LIMITS.NAME_MAX_LENGTH} characters or less`);
    }
    if (args.description && args.description.length > TRACKER_LIMITS.DESCRIPTION_MAX_LENGTH) {
      throw new Error(`Description must be ${TRACKER_LIMITS.DESCRIPTION_MAX_LENGTH} characters or less`);
    }
    if (args.columns.length > TRACKER_LIMITS.MAX_COLUMNS) {
      throw new Error(`Cannot create more than ${TRACKER_LIMITS.MAX_COLUMNS} columns`);
    }

    // Use template if provided
    let columns = args.columns;
    let primaryKeyColumn = args.primaryKeyColumn;
    
    if (args.templateKey && defaultTemplates[args.templateKey]) {
      const template = defaultTemplates[args.templateKey];
      columns = template.columns;
      primaryKeyColumn = template.primaryKeyColumn;
    }

    // Validate columns
    const columnValidation = validateColumns(columns as ColumnDefinition[]);
    if (!columnValidation.isValid) {
      throw new Error(`Invalid columns: ${columnValidation.errors.map(e => e.message).join(", ")}`);
    }

    // Check primary key column exists
    const primaryKeyExists = columns.some(col => col.key === primaryKeyColumn);
    if (!primaryKeyExists) {
      throw new Error(`Primary key column "${primaryKeyColumn}" does not exist`);
    }

    // Generate unique slug
    let slug = generateSlug(args.name);
    let slugCounter = 0;
    let finalSlug = slug;
    
    // Check for existing slug and make unique if needed
    while (true) {
      const existing = await ctx.db
        .query("trackers")
        .withIndex("by_slug", q => q.eq("slug", finalSlug))
        .first();
      
      if (!existing) break;
      
      slugCounter++;
      finalSlug = `${slug}-${slugCounter}`;
      
      // Prevent infinite loop in edge cases
      if (slugCounter > TRACKER_LIMITS.MAX_SLUG_GENERATION_ATTEMPTS) {
        throw new Error("Unable to generate unique slug. Please try a different name.");
      }
    }

    // Create tracker
    const trackerId = await ctx.db.insert("trackers", {
      name: args.name,
      slug: finalSlug,
      description: args.description,
      columns: columns as ColumnDefinition[],
      primaryKeyColumn,
      userId: identity.subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: true,
    });

    return { trackerId, slug: finalSlug };
  },
});

export const updateTracker = mutation({
  args: {
    trackerId: v.id("trackers"),
    updates: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      columns: v.optional(v.array(v.object({
        id: v.string(),
        name: v.string(),
        key: v.string(),
        type: v.union(
          v.literal("text"),
          v.literal("number"),
          v.literal("date"),
          v.literal("select"),
          v.literal("boolean")
        ),
        required: v.boolean(),
        options: v.optional(v.array(v.string())),
        order: v.number(),
        width: v.optional(v.number()),
        aiEnabled: v.optional(v.boolean()),
        aiAliases: v.optional(v.array(v.string())),
      }))),
      isActive: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }

    if (tracker.userId !== identity.subject) {
      throw new Error("Not authorized to update this tracker");
    }

    // Validate columns if being updated
    if (args.updates.columns) {
      const columnValidation = validateColumns(args.updates.columns as ColumnDefinition[]);
      if (!columnValidation.isValid) {
        throw new Error(`Invalid columns: ${columnValidation.errors.map(e => e.message).join(", ")}`);
      }
    }

    // Build update object with proper typing
    const updateData: Partial<{
      name: string;
      description?: string;
      columns: ColumnDefinition[];
      updatedAt: number;
    }> = {
      ...args.updates,
      updatedAt: Date.now(),
    };
    
    // Only include columns if they're being updated
    if (args.updates.columns) {
      updateData.columns = args.updates.columns as ColumnDefinition[];
    }
    
    await ctx.db.patch(args.trackerId, updateData);

    return { success: true };
  },
});

export const deleteTracker = mutation({
  args: {
    trackerId: v.id("trackers"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }

    if (tracker.userId !== identity.subject) {
      throw new Error("Not authorized to delete this tracker");
    }

    // Delete all associated data using the shared function
    await deleteAllTrackerData(ctx.db, args.trackerId);

    // Delete the tracker
    await ctx.db.delete(args.trackerId);

    return { success: true };
  },
});

// ============================================
// DATA MANAGEMENT MUTATIONS
// ============================================

export const addRow = mutation({
  args: {
    trackerId: v.id("trackers"),
    data: v.record(v.string(), v.union(
      v.string(),
      v.number(),
      v.boolean(),
      v.null()
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }
    
    // Check authorization
    if (tracker.userId !== identity.subject) {
      throw new Error("Not authorized to add data to this tracker");
    }

    // Validate data against column definitions
    const validation = validateRowData(tracker.columns, args.data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(", ")}`);
    }

    // Get primary key value for rowId
    const primaryKeyValue = validation.data[tracker.primaryKeyColumn];
    if (!primaryKeyValue) {
      throw new Error(`Primary key "${tracker.primaryKeyColumn}" is required`);
    }

    // Check for duplicate primary key
    const existing = await ctx.db
      .query("trackerData")
      .withIndex("by_tracker_row", q => 
        q.eq("trackerId", args.trackerId)
         .eq("rowId", String(primaryKeyValue))
      )
      .first();

    if (existing) {
      throw new Error(`Row with ${tracker.primaryKeyColumn} "${primaryKeyValue}" already exists`);
    }

    // Insert the row
    await ctx.db.insert("trackerData", {
      trackerId: args.trackerId,
      rowId: String(primaryKeyValue),
      data: validation.data,
      createdAt: Date.now(),
      createdBy: identity.subject,
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    });

    return { rowId: String(primaryKeyValue), data: validation.data };
  },
});

export const updateRow = mutation({
  args: {
    trackerId: v.id("trackers"),
    rowId: v.string(),
    updates: v.record(v.string(), v.union(
      v.string(),
      v.number(),
      v.boolean(),
      v.null()
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }
    
    // Verify user owns the tracker
    if (tracker.userId !== identity.subject) {
      throw new Error("Not authorized to update this tracker");
    }

    // Find the row
    const row = await ctx.db
      .query("trackerData")
      .withIndex("by_tracker_row", q => 
        q.eq("trackerId", args.trackerId)
         .eq("rowId", args.rowId)
      )
      .first();

    if (!row) {
      throw new Error("Row not found");
    }

    // Merge updates with existing data, handling null/undefined properly
    const mergedData = { ...row.data };
    for (const [key, value] of Object.entries(args.updates)) {
      // Explicitly handle null (keep it) but skip undefined
      if (value !== undefined) {
        mergedData[key] = value;
      }
    }

    // Validate merged data
    const validation = validateRowData(tracker.columns, mergedData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(", ")}`);
    }

    // Update the row
    await ctx.db.patch(row._id, {
      data: validation.data,
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    });

    return { success: true, data: validation.data };
  },
});

export const deleteRow = mutation({
  args: {
    trackerId: v.id("trackers"),
    rowId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify user owns the tracker
    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }
    
    if (tracker.userId !== identity.subject) {
      throw new Error("Not authorized to delete from this tracker");
    }

    // Find the row
    const row = await ctx.db
      .query("trackerData")
      .withIndex("by_tracker_row", q => 
        q.eq("trackerId", args.trackerId)
         .eq("rowId", args.rowId)
      )
      .first();

    if (!row) {
      throw new Error("Row not found");
    }

    await ctx.db.delete(row._id);

    return { success: true };
  },
});

export const bulkImport = mutation({
  args: {
    trackerId: v.id("trackers"),
    rows: v.array(v.record(v.string(), v.union(
      v.string(),
      v.number(),
      v.boolean(),
      v.null()
    ))),
    mode: v.union(v.literal("append"), v.literal("replace"), v.literal("update")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Add size limits for production
    if (args.rows.length > TRACKER_LIMITS.MAX_IMPORT_ROWS) {
      throw new Error(`Cannot import more than ${TRACKER_LIMITS.MAX_IMPORT_ROWS} rows at once. Please split your data into smaller batches.`);
    }

    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }

    // Validate permissions and tracker state
    validateImportData(tracker, identity.subject);

    // If replace mode, delete all existing data first
    if (args.mode === "replace") {
      await deleteAllTrackerData(ctx.db, args.trackerId);
    }

    // Use the shared batch processor
    return await processBatchImport({
      rows: args.rows,
      tracker,
      mode: args.mode,
      userId: identity.subject,
      db: ctx.db,
      startIndex: 0,
    });
  },
});

// ============================================
// QUERIES
// ============================================

export const getTracker = query({
  args: {
    trackerId: v.optional(v.id("trackers")),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.trackerId && !args.slug) {
      throw new Error("Either trackerId or slug must be provided");
    }

    let tracker;
    if (args.trackerId) {
      tracker = await ctx.db.get(args.trackerId);
    } else if (args.slug) {
      tracker = await ctx.db
        .query("trackers")
        .withIndex("by_slug", q => q.eq("slug", args.slug!))
        .first();
    }

    return tracker;
  },
});

export const listTrackers = query({
  args: {
    userId: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = args.userId || identity?.subject;

    if (!userId) {
      return [];
    }

    // Use the appropriate index based on filtering needs
    if (args.activeOnly) {
      return await ctx.db
        .query("trackers")
        .withIndex("by_user_active", q => 
          q.eq("userId", userId).eq("isActive", true)
        )
        .collect();
    } else {
      return await ctx.db
        .query("trackers")
        .withIndex("by_user", q => q.eq("userId", userId))
        .collect();
    }
  },
});

export const getTrackerData = query({
  args: {
    trackerId: v.id("trackers"),
    paginationOpts: paginationOptsValidator,
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }

    // Use Convex's built-in pagination
    const paginatedResults = await ctx.db
      .query("trackerData")
      .withIndex("by_tracker", q => q.eq("trackerId", args.trackerId))
      .order(args.sortOrder || "asc")
      .paginate(args.paginationOpts);

    // If sorting by a specific field is needed, we need to handle it differently
    // Note: For complex sorting, consider creating additional indexes
    if (args.sortBy) {
      // Sort the current page of results
      paginatedResults.page.sort((a, b) => {
        const aVal = a.data[args.sortBy!];
        const bVal = b.data[args.sortBy!];
        
        // Handle null/undefined values
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (aVal < bVal) return args.sortOrder === "desc" ? 1 : -1;
        if (aVal > bVal) return args.sortOrder === "desc" ? -1 : 1;
        return 0;
      });
    }

    return {
      tracker,
      ...paginatedResults,
    };
  },
});

export const getTemplates = query({
  args: {},
  handler: async (_ctx, _args) => {
    return Object.entries(defaultTemplates).map(([key, template]) => ({
      key,
      ...template,
    }));
  },
});

export const importCSV = mutation({
  args: {
    trackerId: v.id("trackers"),
    csvContent: v.string(),
    mode: v.union(v.literal("append"), v.literal("replace"), v.literal("update")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Add CSV size limit
    if (args.csvContent.length > TRACKER_LIMITS.MAX_CSV_SIZE_BYTES) {
      throw new Error(`CSV file too large. Maximum size is ${TRACKER_LIMITS.MAX_CSV_SIZE_BYTES / (1024 * 1024)}MB.`);
    }

    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }

    // Validate permissions and tracker state
    validateImportData(tracker, identity.subject);

    // Parse CSV
    const { headers, rows } = parseCSV(args.csvContent);
    
    // Validate row count
    if (rows.length > TRACKER_LIMITS.MAX_IMPORT_ROWS) {
      throw new Error(`CSV contains too many rows (${rows.length}). Maximum is ${TRACKER_LIMITS.MAX_IMPORT_ROWS} rows.`);
    }
    
    // Map CSV to tracker data format
    const mappedData = mapCSVToTrackerData(headers, rows, tracker.columns);

    // If replace mode, delete all existing data first
    if (args.mode === "replace") {
      await deleteAllTrackerData(ctx.db, args.trackerId);
    }

    // Use the shared batch processor
    return await processBatchImport({
      rows: mappedData,
      tracker,
      mode: args.mode,
      userId: identity.subject,
      db: ctx.db,
      startIndex: 0,
    });
  },
});