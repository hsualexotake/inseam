"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import { X, Folder } from "lucide-react";
import { DEFAULT_FOLDER_COLORS } from "@packages/backend/convex/lib/folderConstants";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentFolderId?: Id<"trackerFolders">;
  editingFolder?: {
    _id: Id<"trackerFolders">;
    name: string;
    color?: string;
  } | null;
}

export default function CreateFolderModal({
  isOpen,
  onClose,
  parentFolderId,
  editingFolder,
}: CreateFolderModalProps) {
  const [name, setName] = useState(editingFolder?.name || "");
  const [color, setColor] = useState(editingFolder?.color || DEFAULT_FOLDER_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const createFolder = useMutation(api.trackerFolders.createFolder);
  const updateFolder = useMutation(api.trackerFolders.updateFolder);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Folder name is required");
      return;
    }

    if (name.length > 50) {
      setError("Folder name must be 50 characters or less");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingFolder) {
        await updateFolder({
          folderId: editingFolder._id,
          name: name.trim(),
          color,
        });
      } else {
        await createFolder({
          name: name.trim(),
          parentId: parentFolderId,
          color,
        });
      }
      onClose();
      setName("");
      setColor(DEFAULT_FOLDER_COLORS[0]);
    } catch (error: any) {
      setError(error.message || "Failed to save folder");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingFolder ? "Edit Folder" : "Create New Folder"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Folder Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Folder Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter folder name"
              autoFocus
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Folder Color
            </label>
            <div className="grid grid-cols-8 gap-2">
              {DEFAULT_FOLDER_COLORS.map((colorOption) => (
                <button
                  key={colorOption}
                  type="button"
                  onClick={() => setColor(colorOption)}
                  className={`relative w-10 h-10 rounded-lg border-2 transition-all ${
                    color === colorOption
                      ? "border-gray-900 shadow-md scale-110"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  style={{ backgroundColor: colorOption }}
                >
                  {color === colorOption && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
              <Folder className="h-5 w-5" style={{ color }} />
              <span className="text-sm font-medium text-gray-900">
                {name || "Untitled Folder"}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : editingFolder ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}