"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Folder } from "lucide-react";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import TrackerActionsDropdown from "@/components/ui/tracker-actions-dropdown";

interface TrackerCardProps {
  tracker: {
    _id: Id<"trackers">;
    name: string;
    slug: string;
    description?: string;
    color?: string;
    folderId?: Id<"trackerFolders"> | null;
  };
  folder?: {
    name: string;
    color?: string;
  };
  folders?: Array<{
    _id: Id<"trackerFolders">;
    name: string;
    color?: string | null;
  }> | null;
  isDeleting: boolean;
  onDelete: (trackerId: Id<"trackers">, trackerName: string) => void;
  onMoveToFolder: (trackerId: Id<"trackers">, folderId: Id<"trackerFolders"> | null) => void;
}

export default function TrackerCard({
  tracker,
  folder,
  folders,
  isDeleting,
  onDelete,
  onMoveToFolder,
}: TrackerCardProps) {
  const router = useRouter();

  const folderColor = folder?.color || '#6B7280';

  return (
    <div
      className={`bg-white rounded-2xl border ${
        isDeleting ? 'opacity-50 border-red-200' : 'border-gray-200'
      } hover:shadow-lg hover:border-gray-300 transition-all group overflow-hidden`}
      style={{
        borderTopWidth: tracker.color ? '4px' : undefined,
        borderTopColor: tracker.color ? `${tracker.color}99` : undefined // Adding 99 (60% opacity in hex)
      }}
    >
      <div className="p-7 flex flex-col h-full">
        {/* Header Section */}
        <div className="flex-1">
          <div className="mb-4">
            <h3 className="text-heading-lg mb-2 truncate group-hover:text-black transition-colors">
              {tracker.name}
            </h3>
            {tracker.description && (
              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                {tracker.description}
              </p>
            )}
          </div>

          {/* Metadata Section */}
          <div className="text-xs text-gray-500 mt-4">
            {tracker.folderId && folder ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded"
                style={{
                  backgroundColor: `${folderColor}15`,
                  color: folderColor
                }}
              >
                <Folder className="w-3 h-3" />
                {folder.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded text-gray-400">
                <Folder className="w-3 h-3" />
                Unfiled
              </span>
            )}
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2 pt-6 mt-auto">
          <Link
            href={`/tracker/view/${tracker.slug}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 hover:shadow-md hover:scale-105 transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </Link>
          <button
            onClick={() => router.push(`/tracker/edit/${tracker._id}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 hover:shadow-md hover:scale-105 transition-all"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <TrackerActionsDropdown
            trackerId={tracker._id}
            trackerName={tracker.name}
            currentFolderId={tracker.folderId}
            folders={folders}
            onDelete={() => onDelete(tracker._id, tracker.name)}
            onMoveToFolder={(folderId) => onMoveToFolder(tracker._id, folderId)}
            isDeleting={isDeleting}
          />
        </div>
      </div>
    </div>
  );
}