import { DatabaseReader } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { FOLDER_LIMITS, DEFAULT_FOLDER_COLOR } from "./folderConstants";

export function validateFolderName(name: string): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: "Folder name is required" };
  }
  if (name.length > FOLDER_LIMITS.MAX_NAME_LENGTH) {
    return { isValid: false, error: `Folder name must be ${FOLDER_LIMITS.MAX_NAME_LENGTH} characters or less` };
  }
  return { isValid: true };
}

export function validateFolderColor(color?: string): string {
  if (!color) return DEFAULT_FOLDER_COLOR;

  // Basic hex color validation
  const hexRegex = /^#[0-9A-F]{6}$/i;
  if (!hexRegex.test(color)) {
    return DEFAULT_FOLDER_COLOR;
  }
  return color;
}

export async function getFolderDepth(
  db: DatabaseReader,
  folderId: Id<"trackerFolders"> | undefined
): Promise<number> {
  if (!folderId) return 0;

  let depth = 0;
  let currentId: Id<"trackerFolders"> | undefined = folderId;

  while (currentId && depth < FOLDER_LIMITS.MAX_DEPTH + 1) {
    const folderDoc: Doc<"trackerFolders"> | null = await db.get(currentId);
    if (!folderDoc) break;
    currentId = folderDoc.parentId;
    depth++;
  }

  return depth;
}

export async function isDescendantOf(
  db: DatabaseReader,
  folderId: Id<"trackerFolders">,
  potentialAncestorId: Id<"trackerFolders">
): Promise<boolean> {
  if (folderId === potentialAncestorId) return true;

  let currentId: Id<"trackerFolders"> | undefined = folderId;
  let iterations = 0;

  while (currentId && iterations < FOLDER_LIMITS.MAX_DEPTH + 1) {
    const folderDoc: Doc<"trackerFolders"> | null = await db.get(currentId);
    if (!folderDoc) return false;
    if (folderDoc.parentId === potentialAncestorId) return true;
    currentId = folderDoc.parentId;
    iterations++;
  }

  return false;
}

export async function validateFolderMove(
  db: DatabaseReader,
  folderId: Id<"trackerFolders">,
  newParentId: Id<"trackerFolders"> | undefined
): Promise<{ isValid: boolean; error?: string }> {
  // Can't move to itself
  if (newParentId && folderId === newParentId) {
    return { isValid: false, error: "Cannot move folder to itself" };
  }

  // Check for circular reference
  if (newParentId) {
    const wouldCreateCycle = await isDescendantOf(db, newParentId, folderId);
    if (wouldCreateCycle) {
      return { isValid: false, error: "Cannot move folder to its own descendant" };
    }
  }

  // Check depth limit
  const newDepth = await getFolderDepth(db, newParentId);
  if (newDepth >= FOLDER_LIMITS.MAX_DEPTH) {
    return { isValid: false, error: `Maximum folder depth of ${FOLDER_LIMITS.MAX_DEPTH} exceeded` };
  }

  return { isValid: true };
}

export interface FolderNode {
  _id: Id<"trackerFolders">;
  name: string;
  color?: string;
  order: number;
  children: FolderNode[];
}

export function buildFolderTree(folders: Array<{
  _id: Id<"trackerFolders">;
  name: string;
  parentId?: Id<"trackerFolders">;
  color?: string;
  order: number;
}>): FolderNode[] {
  const folderMap = new Map<Id<"trackerFolders">, FolderNode>();
  const rootFolders: FolderNode[] = [];

  // First pass: create all nodes
  folders.forEach(folder => {
    folderMap.set(folder._id, {
      _id: folder._id,
      name: folder.name,
      color: folder.color,
      order: folder.order,
      children: [],
    });
  });

  // Second pass: build tree
  folders.forEach(folder => {
    const node = folderMap.get(folder._id)!;
    if (folder.parentId) {
      const parent = folderMap.get(folder.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphaned folder, add to root
        rootFolders.push(node);
      }
    } else {
      rootFolders.push(node);
    }
  });

  // Sort by order
  const sortByOrder = (a: FolderNode, b: FolderNode) => a.order - b.order;
  rootFolders.sort(sortByOrder);
  folderMap.forEach(node => {
    node.children.sort(sortByOrder);
  });

  return rootFolders;
}

export async function getFolderPath(
  db: DatabaseReader,
  folderId: Id<"trackerFolders">
): Promise<Array<{ _id: Id<"trackerFolders">; name: string }>> {
  const path: Array<{ _id: Id<"trackerFolders">; name: string }> = [];
  let currentId: Id<"trackerFolders"> | undefined = folderId;
  let iterations = 0;

  while (currentId && iterations < FOLDER_LIMITS.MAX_DEPTH + 1) {
    const folderDoc: Doc<"trackerFolders"> | null = await db.get(currentId);
    if (!folderDoc) break;

    path.unshift({
      _id: folderDoc._id,
      name: folderDoc.name,
    });

    currentId = folderDoc.parentId;
    iterations++;
  }

  return path;
}