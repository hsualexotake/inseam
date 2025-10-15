"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import {
  Folder,
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderNode {
  _id: Id<"trackerFolders">;
  name: string;
  color?: string;
  order: number;
  children: FolderNode[];
}

interface FolderSidebarProps {
  selectedFolderId?: Id<"trackerFolders"> | null;
  onFolderSelect: (folderId: Id<"trackerFolders"> | null) => void;
  onCreateFolder: () => void;
  onEditFolder: (folderId: Id<"trackerFolders">) => void;
  onTrackerSelect?: (trackerId: Id<"trackers">) => void;
  className?: string;
}

export default function FolderSidebar({
  selectedFolderId,
  onFolderSelect,
  onCreateFolder,
  onEditFolder,
  onTrackerSelect,
  className,
}: FolderSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const folderTree = useQuery(api.trackerFolders.getFolderTree) ?? [];
  const allTrackers = useQuery(api.trackers.listTrackers, { activeOnly: true }) ?? [];
  const deleteFolder = useMutation(api.trackerFolders.deleteFolder);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleDeleteFolder = async (folderId: Id<"trackerFolders">) => {
    if (!confirm("Are you sure you want to delete this folder? Trackers will be moved to the parent folder.")) {
      return;
    }

    try {
      await deleteFolder({ folderId });
      if (selectedFolderId === folderId) {
        onFolderSelect(null);
      }
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  };

  const renderFolder = (folder: FolderNode, level = 0) => {
    const isExpanded = expandedFolders.has(folder._id);
    const isSelected = selectedFolderId === folder._id;
    const hasChildren = folder.children.length > 0;
    const foldersTrackers = allTrackers.filter(t => t.folderId === folder._id);
    const hasTrackers = foldersTrackers.length > 0;
    const hasContent = hasChildren || hasTrackers;

    return (
      <div key={folder._id}>
        <div
          className={cn(
            "group relative flex items-center gap-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100 transition-colors",
            isSelected && "bg-blue-50 hover:bg-blue-100"
          )}
          style={{ paddingLeft: level === 0 ? '8px' : `${level * 12 + 8}px`, paddingRight: '8px' }}
          onClick={() => {
            if (hasContent) {
              toggleFolder(folder._id);
            }
            onFolderSelect(folder._id);
          }}
        >
          <div className="flex items-center gap-2 flex-1">
            {isExpanded ? (
              <FolderOpen
                className="h-4 w-4 flex-shrink-0"
                style={{ color: folder.color || "#6B7280" }}
              />
            ) : (
              <Folder
                className="h-4 w-4 flex-shrink-0"
                style={{ color: folder.color || "#6B7280" }}
              />
            )}
            <span className={cn(
              "text-sm truncate",
              isSelected ? "font-medium text-gray-900" : "text-gray-700"
            )}>
              {folder.name}
            </span>
          </div>

          <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-inherit">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditFolder(folder._id);
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <Edit2 className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(folder._id);
              }}
              className="p-1 hover:bg-red-100 rounded"
            >
              <Trash2 className="h-3.5 w-3.5 text-gray-500 hover:text-red-600" />
            </button>
          </div>
        </div>

        {isExpanded && hasContent && (
          <div>
            {/* Render trackers in this folder */}
            {foldersTrackers.map((tracker) => (
              <div
                key={tracker._id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100 transition-colors"
                style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
                onClick={() => onTrackerSelect?.(tracker._id)}
              >
                <div className="w-5" />
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tracker.color || "#9CA3AF" }}
                />
                <span className="text-sm text-gray-700 truncate">
                  {tracker.name}
                </span>
              </div>
            ))}

            {/* Render subfolders */}
            {folder.children.map((child) => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="p-3 border-b">
        <h3 className="text-sm font-semibold text-gray-700">Folders</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* All Trackers */}
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100 transition-colors mb-2",
            selectedFolderId === null && "bg-blue-50 hover:bg-blue-100"
          )}
          onClick={() => onFolderSelect(null)}
        >
          <Home className="h-4 w-4 text-gray-600" />
          <span className={cn(
            "text-sm",
            selectedFolderId === null ? "font-medium text-gray-900" : "text-gray-700"
          )}>
            All Trackers
          </span>
        </div>

        {/* Folder Tree */}
        <div className="space-y-0.5">
          {folderTree.map((folder) => renderFolder(folder))}
        </div>

        {/* Empty State */}
        {folderTree.length === 0 && (
          <div className="text-center py-8">
            <Folder className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-3">No folders yet</p>
          </div>
        )}
      </div>

      {/* Add Folder Button */}
      <div className="p-3 border-t">
        <button
          onClick={onCreateFolder}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Folder
        </button>
      </div>
    </div>
  );
}