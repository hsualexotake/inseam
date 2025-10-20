import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { modules } from "../../test.setup";

describe("TrackerFolders - Comprehensive Tests", () => {
  let t: ReturnType<typeof convexTest>;

  const mockUser1 = {
    subject: "user_folder_test_123",
    issuer: "https://example.clerk.dev"
  };

  const mockUser2 = {
    subject: "user_folder_test_456",
    issuer: "https://example.clerk.dev"
  };

  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  // Helper to create a test tracker
  async function createTestTracker(userId: string, name: string, folderId?: Id<"trackerFolders">) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("trackers", {
        userId,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        description: "Test tracker",
        columns: [
          {
            id: "col_1",
            key: "sku",
            name: "SKU",
            type: "text",
            required: true,
            order: 0,
            width: 100
          }
        ],
        primaryKeyColumn: "sku",
        folderId,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    });
  }

  describe("createFolder", () => {
    it("should create a folder with valid data", async () => {
      const result = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        {
          name: "Test Folder",
          color: "#FF0000"
        }
      );

      expect(result.folderId).toBeDefined();

      // Verify folder was created
      const folder = await t.run(async (ctx) => await ctx.db.get(result.folderId));
      expect(folder).toBeDefined();
      expect(folder?.name).toBe("Test Folder");
      expect(folder?.color).toBe("#FF0000");
      expect(folder?.userId).toBe(mockUser1.subject);
    });

    it("should create nested folders (parent-child)", async () => {
      // Create parent folder
      const parent = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Parent Folder" }
      );

      // Create child folder
      const child = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        {
          name: "Child Folder",
          parentId: parent.folderId
        }
      );

      const childFolder = await t.run(async (ctx) => await ctx.db.get(child.folderId));
      expect(childFolder?.parentId).toBe(parent.folderId);
    });

    it("should reject empty folder names", async () => {
      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerFolders.createFolder,
          { name: "" }
        )
      ).rejects.toThrow(/required/i);

      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerFolders.createFolder,
          { name: "   " }
        )
      ).rejects.toThrow(/required/i);
    });

    it("should reject folder names that are too long", async () => {
      const longName = "x".repeat(51); // MAX_NAME_LENGTH is 50

      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerFolders.createFolder,
          { name: longName }
        )
      ).rejects.toThrow();
    });

    it("should enforce maximum folder depth", async () => {
      // Create nested folder structure up to max depth
      let parentId: Id<"trackerFolders"> | undefined = undefined;

      // MAX_DEPTH is 3
      for (let i = 0; i < 3; i++) {
        const result: { folderId: Id<"trackerFolders"> } = await t.withIdentity(mockUser1).mutation(
          api.trackerFolders.createFolder,
          {
            name: `Folder Level ${i}`,
            parentId
          }
        );
        parentId = result.folderId;
      }

      // Try to create one more level - should fail
      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerFolders.createFolder,
          {
            name: "Too Deep",
            parentId
          }
        )
      ).rejects.toThrow(/maximum folder depth/i);
    });

    it("should enforce maximum folders per user", async () => {
      // Create max folders (MAX_FOLDERS_PER_USER is 50)
      const creationPromises = [];
      for (let i = 0; i < 50; i++) {
        creationPromises.push(
          t.withIdentity(mockUser1).mutation(
            api.trackerFolders.createFolder,
            { name: `Folder ${i}` }
          )
        );
      }
      await Promise.all(creationPromises);

      // Try to create one more - should fail
      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerFolders.createFolder,
          { name: "Too Many" }
        )
      ).rejects.toThrow(/maximum.*folders/i);
    });

    it("should assign correct order to sibling folders", async () => {
      // Create multiple folders at the same level
      const folder1 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Folder 1" }
      );

      const folder2 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Folder 2" }
      );

      const folder3 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Folder 3" }
      );

      const f1 = await t.run(async (ctx) => await ctx.db.get(folder1.folderId));
      const f2 = await t.run(async (ctx) => await ctx.db.get(folder2.folderId));
      const f3 = await t.run(async (ctx) => await ctx.db.get(folder3.folderId));

      expect(f1?.order).toBeLessThan(f2!.order);
      expect(f2?.order).toBeLessThan(f3!.order);
    });

    it("should prevent unauthenticated folder creation", async () => {
      await expect(
        t.mutation(api.trackerFolders.createFolder, { name: "Test" })
      ).rejects.toThrow(/sign in/i);
    });
  });

  describe("updateFolder", () => {
    it("should update folder name", async () => {
      const { folderId } = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Original Name" }
      );

      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.updateFolder,
        {
          folderId,
          name: "Updated Name"
        }
      );

      const folder = await t.run(async (ctx) => await ctx.db.get(folderId));
      expect(folder?.name).toBe("Updated Name");
    });

    it("should update folder color", async () => {
      const { folderId } = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Test", color: "#FF0000" }
      );

      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.updateFolder,
        {
          folderId,
          color: "#00FF00"
        }
      );

      const folder = await t.run(async (ctx) => await ctx.db.get(folderId));
      expect(folder?.color).toBe("#00FF00");
    });

    it("should move folder to different parent", async () => {
      const parent1 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Parent 1" }
      );

      const parent2 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Parent 2" }
      );

      const child = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        {
          name: "Child",
          parentId: parent1.folderId
        }
      );

      // Move to parent2
      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.updateFolder,
        {
          folderId: child.folderId,
          parentId: parent2.folderId
        }
      );

      const folder = await t.run(async (ctx) => await ctx.db.get(child.folderId));
      expect(folder?.parentId).toBe(parent2.folderId);
    });

    it("should move folder to root (null parent)", async () => {
      const parent = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Parent" }
      );

      const child = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        {
          name: "Child",
          parentId: parent.folderId
        }
      );

      // Move to root
      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.updateFolder,
        {
          folderId: child.folderId,
          parentId: null
        }
      );

      const folder = await t.run(async (ctx) => await ctx.db.get(child.folderId));
      expect(folder?.parentId).toBeUndefined();
    });

    it("should prevent circular folder references", async () => {
      const parent = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Parent" }
      );

      const child = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        {
          name: "Child",
          parentId: parent.folderId
        }
      );

      // Try to make parent a child of child (circular)
      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerFolders.updateFolder,
          {
            folderId: parent.folderId,
            parentId: child.folderId
          }
        )
      ).rejects.toThrow(/descendant/i);
    });

    it("should prevent moving folder to itself", async () => {
      const folder = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Test" }
      );

      await expect(
        t.withIdentity(mockUser1).mutation(
          api.trackerFolders.updateFolder,
          {
            folderId: folder.folderId,
            parentId: folder.folderId
          }
        )
      ).rejects.toThrow();
    });

    it("should prevent unauthorized updates", async () => {
      const { folderId } = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Test" }
      );

      await expect(
        t.withIdentity(mockUser2).mutation(
          api.trackerFolders.updateFolder,
          {
            folderId,
            name: "Hacked"
          }
        )
      ).rejects.toThrow(/not authorized/i);
    });
  });

  describe("deleteFolder", () => {
    it("should delete empty folder", async () => {
      const { folderId } = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Test" }
      );

      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.deleteFolder,
        { folderId }
      );

      const folder = await t.run(async (ctx) => await ctx.db.get(folderId));
      expect(folder).toBeNull();
    });

    it("should move trackers to parent when deleting folder", async () => {
      const parent = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Parent" }
      );

      const child = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        {
          name: "Child",
          parentId: parent.folderId
        }
      );

      // Create tracker in child folder
      const trackerId = await createTestTracker(mockUser1.subject, "Test Tracker", child.folderId);

      // Delete child folder
      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.deleteFolder,
        { folderId: child.folderId }
      );

      // Tracker should now be in parent folder
      const tracker = await t.run(async (ctx) => await ctx.db.get(trackerId));
      expect(tracker?.folderId).toBe(parent.folderId);
    });

    it("should move trackers to root when deleting root-level folder", async () => {
      const folder = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Folder" }
      );

      const trackerId = await createTestTracker(mockUser1.subject, "Test Tracker", folder.folderId);

      // Delete folder
      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.deleteFolder,
        { folderId: folder.folderId }
      );

      // Tracker should now be at root (undefined folderId)
      const tracker = await t.run(async (ctx) => await ctx.db.get(trackerId));
      expect(tracker?.folderId).toBeUndefined();
    });

    it("should move subfolders to parent when deleting folder", async () => {
      const grandparent = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Grandparent" }
      );

      const parent = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        {
          name: "Parent",
          parentId: grandparent.folderId
        }
      );

      const child = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        {
          name: "Child",
          parentId: parent.folderId
        }
      );

      // Delete parent
      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.deleteFolder,
        { folderId: parent.folderId }
      );

      // Child should now be child of grandparent
      const childFolder = await t.run(async (ctx) => await ctx.db.get(child.folderId));
      expect(childFolder?.parentId).toBe(grandparent.folderId);
    });

    it("should prevent unauthorized deletion", async () => {
      const { folderId } = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Test" }
      );

      await expect(
        t.withIdentity(mockUser2).mutation(
          api.trackerFolders.deleteFolder,
          { folderId }
        )
      ).rejects.toThrow(/not authorized/i);
    });
  });

  describe("listFolders", () => {
    it("should return all user folders", async () => {
      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Folder 1" }
      );

      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Folder 2" }
      );

      // Create folder for user2
      await t.withIdentity(mockUser2).mutation(
        api.trackerFolders.createFolder,
        { name: "User 2 Folder" }
      );

      const folders = await t.withIdentity(mockUser1).query(
        api.trackerFolders.listFolders,
        {}
      );

      expect(folders).toHaveLength(2);
      expect(folders.every(f => f.userId === mockUser1.subject)).toBe(true);
    });

    it("should return empty array for new user", async () => {
      const folders = await t.withIdentity(mockUser1).query(
        api.trackerFolders.listFolders,
        {}
      );

      expect(folders).toHaveLength(0);
    });
  });

  describe("getFolderTree", () => {
    it("should build correct folder hierarchy", async () => {
      const root1 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Root 1" }
      );

      const root2 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Root 2" }
      );

      const child1 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        {
          name: "Child 1",
          parentId: root1.folderId
        }
      );

      const grandchild = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        {
          name: "Grandchild",
          parentId: child1.folderId
        }
      );

      const tree = await t.withIdentity(mockUser1).query(
        api.trackerFolders.getFolderTree,
        {}
      );

      // Should have 2 root folders
      expect(tree).toHaveLength(2);

      // Find root1 and verify its structure
      const root1Node = tree.find(n => n._id === root1.folderId);
      expect(root1Node).toBeDefined();
      expect(root1Node?.children).toHaveLength(1);
      expect(root1Node?.children[0]._id).toBe(child1.folderId);
      expect(root1Node?.children[0].children[0]._id).toBe(grandchild.folderId);

      // Root2 should have no children
      const root2Node = tree.find(n => n._id === root2.folderId);
      expect(root2Node?.children).toHaveLength(0);
    });
  });

  describe("reorderFolders", () => {
    it("should reorder sibling folders", async () => {
      const folder1 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Folder 1" }
      );

      const folder2 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Folder 2" }
      );

      const folder3 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Folder 3" }
      );

      // Reorder: 3, 1, 2
      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.reorderFolders,
        {
          folderIds: [folder3.folderId, folder1.folderId, folder2.folderId]
        }
      );

      const f1 = await t.run(async (ctx) => await ctx.db.get(folder1.folderId));
      const f2 = await t.run(async (ctx) => await ctx.db.get(folder2.folderId));
      const f3 = await t.run(async (ctx) => await ctx.db.get(folder3.folderId));

      expect(f3?.order).toBe(0);
      expect(f1?.order).toBe(1);
      expect(f2?.order).toBe(2);
    });

    it("should prevent reordering unauthorized folders", async () => {
      const folder1 = await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.createFolder,
        { name: "Folder 1" }
      );

      await expect(
        t.withIdentity(mockUser2).mutation(
          api.trackerFolders.reorderFolders,
          { folderIds: [folder1.folderId] }
        )
      ).rejects.toThrow(/not authorized/i);
    });
  });

  describe("Edge Cases", () => {
    it("should handle special characters in folder names", async () => {
      const specialNames = [
        "Folder with spaces",
        "Folder-with-dashes",
        "Folder_with_underscores",
        "Folder.with.dots",
        "Folder (with parentheses)",
        "Folder [with brackets]",
      ];

      for (const name of specialNames) {
        const result = await t.withIdentity(mockUser1).mutation(
          api.trackerFolders.createFolder,
          { name }
        );

        const folder = await t.run(async (ctx) => await ctx.db.get(result.folderId));
        expect(folder?.name).toBe(name);
      }
    });

    it("should handle unicode in folder names", async () => {
      const unicodeNames = [
        "文件夹", // Chinese
        "フォルダ", // Japanese
        "폴더", // Korean
        "Папка", // Russian
        "Carpeta 📁", // Spanish with emoji
      ];

      for (const name of unicodeNames) {
        const result = await t.withIdentity(mockUser1).mutation(
          api.trackerFolders.createFolder,
          { name }
        );

        const folder = await t.run(async (ctx) => await ctx.db.get(result.folderId));
        expect(folder?.name).toBe(name);
      }
    });

    it("should handle concurrent folder operations", async () => {
      // Create multiple folders concurrently
      const promises = Array(10).fill(null).map((_, i) =>
        t.withIdentity(mockUser1).mutation(
          api.trackerFolders.createFolder,
          { name: `Concurrent Folder ${i}` }
        )
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);

      // All should have unique IDs
      const ids = new Set(results.map(r => r.folderId));
      expect(ids.size).toBe(10);
    });

    it("should preserve data integrity when deleting deeply nested folders", async () => {
      // Create 3-level deep structure (MAX_DEPTH is 3)
      let parentId: Id<"trackerFolders"> | undefined = undefined;
      const folderIds: Id<"trackerFolders">[] = [];

      for (let i = 0; i < 3; i++) {
        const result: { folderId: Id<"trackerFolders"> } = await t.withIdentity(mockUser1).mutation(
          api.trackerFolders.createFolder,
          {
            name: `Level ${i}`,
            parentId
          }
        );
        folderIds.push(result.folderId);
        parentId = result.folderId;
      }

      // Create tracker at deepest level
      const trackerId = await createTestTracker(mockUser1.subject, "Deep Tracker", folderIds[2]);

      // Delete level 1 folder (middle folder)
      await t.withIdentity(mockUser1).mutation(
        api.trackerFolders.deleteFolder,
        { folderId: folderIds[1] }
      );

      // Level 2 should now be child of level 0
      const level2 = await t.run(async (ctx) => await ctx.db.get(folderIds[2]));
      expect(level2?.parentId).toBe(folderIds[0]);

      // Tracker should still exist
      const tracker = await t.run(async (ctx) => await ctx.db.get(trackerId));
      expect(tracker).toBeDefined();
    });
  });
});
