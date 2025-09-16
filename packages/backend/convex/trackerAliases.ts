import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers/auth";

/**
 * Tracker Row Alias System
 * Allows rows to be identified by alternative names in emails
 * e.g., "green dress" → SKU "12"
 */

// Resolve alias to row ID (internal for workflow use)
export const resolveAlias = internalQuery({
  args: {
    trackerId: v.id("trackers"),
    searchTerm: v.string()
  },
  handler: async (ctx, { trackerId, searchTerm }) => {
    const normalized = searchTerm.toLowerCase().trim();

    // Try exact match first
    const alias = await ctx.db
      .query("trackerRowAliases")
      .withIndex("by_tracker_alias", q =>
        q.eq("trackerId", trackerId)
         .eq("alias", normalized)
      )
      .first();

    if (alias) {
      console.log(`Resolved alias "${searchTerm}" to row ID "${alias.rowId}"`);
      return { rowId: alias.rowId };
    }

    // No match found
    return null;
  }
});

// Add alias for a row
export const addRowAlias = mutation({
  args: {
    trackerId: v.id("trackers"),
    rowId: v.string(),
    alias: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Validate alias
    const normalized = args.alias.toLowerCase().trim();
    if (normalized.length === 0) {
      throw new Error("Alias cannot be empty");
    }
    if (normalized.length > 100) {
      throw new Error("Alias must be 100 characters or less");
    }

    // Prevent circular/self-referencing aliases
    if (normalized === args.rowId.toLowerCase()) {
      throw new Error("Cannot create an alias that is the same as the row ID");
    }

    // Check if alias already exists for this tracker
    const existing = await ctx.db
      .query("trackerRowAliases")
      .withIndex("by_tracker_alias", q =>
        q.eq("trackerId", args.trackerId)
         .eq("alias", normalized)
      )
      .first();

    if (existing) {
      if (existing.rowId === args.rowId) {
        throw new Error(`Alias "${args.alias}" already exists for this row`);
      } else {
        throw new Error(`Alias "${args.alias}" is already used for row "${existing.rowId}"`);
      }
    }

    // Verify tracker exists and user owns it
    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }
    if (tracker.userId !== userId) {
      throw new Error("Not authorized to modify this tracker");
    }

    // Add the alias
    const aliasId = await ctx.db.insert("trackerRowAliases", {
      trackerId: args.trackerId,
      rowId: args.rowId,
      alias: normalized,
      userId,
      createdAt: Date.now(),
    });

    console.log(`Added alias "${normalized}" for row "${args.rowId}" in tracker ${args.trackerId}`);

    return { success: true, aliasId };
  }
});

// Remove an alias
export const removeRowAlias = mutation({
  args: {
    aliasId: v.id("trackerRowAliases"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Get the alias
    const alias = await ctx.db.get(args.aliasId);
    if (!alias) {
      throw new Error("Alias not found");
    }

    // Verify user owns the tracker
    const tracker = await ctx.db.get(alias.trackerId);
    if (!tracker || tracker.userId !== userId) {
      throw new Error("Not authorized to remove this alias");
    }

    // Delete the alias
    await ctx.db.delete(args.aliasId);

    console.log(`Removed alias "${alias.alias}" for row "${alias.rowId}"`);

    return { success: true };
  }
});

// List all aliases for a specific row
export const getRowAliases = query({
  args: {
    trackerId: v.id("trackers"),
    rowId: v.string(),
  },
  handler: async (ctx, args) => {
    const aliases = await ctx.db
      .query("trackerRowAliases")
      .withIndex("by_tracker_row", q =>
        q.eq("trackerId", args.trackerId)
         .eq("rowId", args.rowId)
      )
      .collect();

    return aliases.map(a => ({
      _id: a._id,
      alias: a.alias,
      createdAt: a.createdAt,
      createdBy: a.userId,
    }));
  }
});

// List all aliases for a tracker (for management UI)
export const getAllTrackerAliases = query({
  args: {
    trackerId: v.id("trackers"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    if (!userId) {
      return [];
    }

    // Verify user owns the tracker
    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker || tracker.userId !== userId) {
      return [];
    }

    const aliases = await ctx.db
      .query("trackerRowAliases")
      .withIndex("by_tracker_alias", q => q.eq("trackerId", args.trackerId))
      .collect();

    // Group by rowId for easier display
    const grouped: Record<string, typeof aliases> = {};
    for (const alias of aliases) {
      if (!grouped[alias.rowId]) {
        grouped[alias.rowId] = [];
      }
      grouped[alias.rowId].push(alias);
    }

    return grouped;
  }
});

// Bulk add aliases (useful for CSV import)
export const bulkAddAliases = mutation({
  args: {
    trackerId: v.id("trackers"),
    aliases: v.array(v.object({
      rowId: v.string(),
      alias: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Verify tracker exists and user owns it
    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Tracker not found");
    }
    if (tracker.userId !== userId) {
      throw new Error("Not authorized to modify this tracker");
    }

    const results = {
      success: [] as string[],
      failed: [] as { alias: string; reason: string }[],
    };

    for (const { rowId, alias } of args.aliases) {
      const normalized = alias.toLowerCase().trim();

      if (normalized.length === 0) {
        results.failed.push({ alias, reason: "Empty alias" });
        continue;
      }

      // Check for duplicates
      const existing = await ctx.db
        .query("trackerRowAliases")
        .withIndex("by_tracker_alias", q =>
          q.eq("trackerId", args.trackerId)
           .eq("alias", normalized)
        )
        .first();

      if (existing) {
        results.failed.push({
          alias,
          reason: `Already exists for row ${existing.rowId}`
        });
        continue;
      }

      // Add the alias
      await ctx.db.insert("trackerRowAliases", {
        trackerId: args.trackerId,
        rowId,
        alias: normalized,
        userId,
        createdAt: Date.now(),
      });

      results.success.push(alias);
    }

    return results;
  }
});