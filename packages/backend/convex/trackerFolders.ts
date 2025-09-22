import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./helpers/auth";
import {
  validateFolderName,
  validateFolderColor,
  validateFolderMove,
  buildFolderTree,
  getFolderPath as getFolderPathHelper,
  getFolderDepth,
} from "./lib/folderHelpers";
import { FOLDER_LIMITS } from "./lib/folderConstants";

// ============================================
// FOLDER MUTATIONS
// ============================================

export const createFolder = mutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.id("trackerFolders")),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Validate name
    const nameValidation = validateFolderName(args.name);
    if (!nameValidation.isValid) {
      throw new Error(nameValidation.error);
    }

    // Check folder limit
    const existingFolders = await ctx.db
      .query("trackerFolders")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    if (existingFolders.length >= FOLDER_LIMITS.MAX_FOLDERS_PER_USER) {
      throw new Error(`Maximum of ${FOLDER_LIMITS.MAX_FOLDERS_PER_USER} folders allowed`);
    }

    // Check depth if parent provided
    if (args.parentId) {
      const depth = await getFolderDepth(ctx.db, args.parentId);
      if (depth >= FOLDER_LIMITS.MAX_DEPTH) {
        throw new Error(`Maximum folder depth of ${FOLDER_LIMITS.MAX_DEPTH} exceeded`);
      }
    }

    // Validate and set color
    const color = validateFolderColor(args.color);

    // Get next order value
    const siblings = await ctx.db
      .query("trackerFolders")
      .withIndex("by_user_parent", q =>
        q.eq("userId", userId).eq("parentId", args.parentId ?? undefined)
      )
      .collect();

    const maxOrder = siblings.reduce((max, folder) =>
      Math.max(max, folder.order), 0
    );

    // Create folder
    const folderId = await ctx.db.insert("trackerFolders", {
      name: args.name,
      parentId: args.parentId,
      userId: userId,
      color,
      order: maxOrder + 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { folderId };
  },
});

export const updateFolder = mutation({
  args: {
    folderId: v.id("trackerFolders"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    parentId: v.optional(v.union(v.id("trackerFolders"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (folder.userId !== userId) {
      throw new Error("Not authorized to update this folder");
    }

    const updates: any = { updatedAt: Date.now() };

    // Update name if provided
    if (args.name !== undefined) {
      const nameValidation = validateFolderName(args.name);
      if (!nameValidation.isValid) {
        throw new Error(nameValidation.error);
      }
      updates.name = args.name;
    }

    // Update color if provided
    if (args.color !== undefined) {
      updates.color = validateFolderColor(args.color);
    }

    // Update parent if provided
    if (args.parentId !== undefined) {
      const newParentId = args.parentId === null ? undefined : args.parentId;
      const moveValidation = await validateFolderMove(ctx.db, args.folderId, newParentId);
      if (!moveValidation.isValid) {
        throw new Error(moveValidation.error);
      }
      updates.parentId = newParentId;
    }

    await ctx.db.patch(args.folderId, updates);
    return { success: true };
  },
});

export const deleteFolder = mutation({
  args: {
    folderId: v.id("trackerFolders"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    if (folder.userId !== userId) {
      throw new Error("Not authorized to delete this folder");
    }

    // Move all trackers in this folder to parent (or root)
    const trackersInFolder = await ctx.db
      .query("trackers")
      .withIndex("by_user_folder", q =>
        q.eq("userId", userId).eq("folderId", args.folderId)
      )
      .collect();

    for (const tracker of trackersInFolder) {
      await ctx.db.patch(tracker._id, {
        folderId: folder.parentId,
        updatedAt: Date.now(),
      });
    }

    // Move all subfolders to parent
    const subfolders = await ctx.db
      .query("trackerFolders")
      .withIndex("by_user_parent", q =>
        q.eq("userId", userId).eq("parentId", args.folderId)
      )
      .collect();

    for (const subfolder of subfolders) {
      await ctx.db.patch(subfolder._id, {
        parentId: folder.parentId,
        updatedAt: Date.now(),
      });
    }

    // Delete the folder
    await ctx.db.delete(args.folderId);

    return { success: true };
  },
});

export const reorderFolders = mutation({
  args: {
    folderIds: v.array(v.id("trackerFolders")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Update order for each folder
    for (let i = 0; i < args.folderIds.length; i++) {
      const folder = await ctx.db.get(args.folderIds[i]);
      if (!folder || folder.userId !== userId) {
        throw new Error("Invalid folder or not authorized");
      }

      await ctx.db.patch(args.folderIds[i], {
        order: i,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// ============================================
// FOLDER QUERIES
// ============================================

export const listFolders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const folders = await ctx.db
      .query("trackerFolders")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    return folders;
  },
});

export const getFolderTree = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const folders = await ctx.db
      .query("trackerFolders")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    return buildFolderTree(folders);
  },
});

export const getFolderPath = query({
  args: {
    folderId: v.id("trackerFolders"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      return [];
    }

    return await getFolderPathHelper(ctx.db, args.folderId);
  },
});

export const getFolderContents = query({
  args: {
    folderId: v.optional(v.id("trackerFolders")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Get subfolders
    const folders = await ctx.db
      .query("trackerFolders")
      .withIndex("by_user_parent", q =>
        q.eq("userId", userId).eq("parentId", args.folderId ?? undefined)
      )
      .collect();

    // Get trackers in this folder
    const trackers = await ctx.db
      .query("trackers")
      .withIndex("by_user_folder_active", q =>
        q.eq("userId", userId)
         .eq("folderId", args.folderId ?? undefined)
         .eq("isActive", true)
      )
      .collect();

    return {
      folders: folders.sort((a, b) => a.order - b.order),
      trackers: trackers.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

export const getFolder = query({
  args: {
    folderId: v.id("trackerFolders"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      return null;
    }

    return folder;
  },
});