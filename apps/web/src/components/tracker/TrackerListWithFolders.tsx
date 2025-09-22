"use client";

import React, { useState } from "react";
import { useQuery, useMutation, Authenticated, AuthLoading } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import Link from "next/link";
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Database,
  FileSpreadsheet,
  Package,
  Truck,
  Grid3x3,
  Folder,
  ChevronRight,
  MoreVertical,
  FolderInput,
} from "lucide-react";
import FolderSidebar from "./FolderSidebar";
import CreateFolderModal from "./CreateFolderModal";

const iconMap: Record<string, any> = {
  fashion: Package,
  logistics: Truck,
  simple: Grid3x3,
  default: FileSpreadsheet,
};

export default function TrackerListWithFolders() {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading authentication...</div>
        </div>
      </AuthLoading>
      <Authenticated>
        <TrackerListContent />
      </Authenticated>
    </>
  );
}

function TrackerListContent() {
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"trackerFolders"> | null | 'unfiled'>(null);
  const [deletingId, setDeletingId] = useState<Id<"trackers"> | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [movingTracker, setMovingTracker] = useState<Id<"trackers"> | null>(null);

  // Determine the query parameters based on selection
  const queryParams = selectedFolderId === null
    ? { activeOnly: true } // All trackers - don't filter by folder
    : selectedFolderId === 'unfiled'
    ? { activeOnly: true, folderId: null } // Unfiled only
    : { activeOnly: true, folderId: selectedFolderId }; // Specific folder

  const trackers = useQuery(api.trackers.listTrackers, queryParams);

  const currentFolder = useQuery(
    api.trackerFolders.getFolder,
    selectedFolderId && selectedFolderId !== 'unfiled' ? { folderId: selectedFolderId } : "skip"
  );

  const allFolders = useQuery(api.trackerFolders.listFolders);

  const deleteTracker = useMutation(api.trackers.deleteTracker);
  const moveTrackerToFolder = useMutation(api.trackers.moveTrackerToFolder);

  const handleDelete = async (trackerId: Id<"trackers">, trackerName: string) => {
    if (!confirm(`Are you sure you want to delete "${trackerName}"? This will delete all associated data.`)) {
      return;
    }

    setDeletingId(trackerId);
    try {
      await deleteTracker({ trackerId });
    } catch (error) {
      console.error("Failed to delete tracker:", error);
      alert("Failed to delete tracker. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleMoveTracker = async (trackerId: Id<"trackers">, newFolderId: Id<"trackerFolders"> | null) => {
    try {
      await moveTrackerToFolder({ trackerId, folderId: newFolderId });
      setMovingTracker(null);
    } catch (error) {
      console.error("Failed to move tracker:", error);
      alert("Failed to move tracker. Please try again.");
    }
  };

  const getTrackerIcon = (tracker: any) => {
    const Icon = iconMap[tracker.templateKey as string] || iconMap.default;
    return <Icon className="w-4 h-4" />;
  };

  const getBreadcrumbText = () => {
    if (selectedFolderId === 'unfiled') return 'Unfiled Trackers';
    if (!selectedFolderId) return 'All Trackers';
    return currentFolder?.name || 'Loading...';
  };

  return (
    <div className="flex h-full">
      {/* Folder Sidebar */}
      <FolderSidebar
        selectedFolderId={selectedFolderId}
        onFolderSelect={setSelectedFolderId}
        onCreateFolder={() => setShowCreateFolder(true)}
        onEditFolder={setEditingFolder}
      />

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
            <button
              onClick={() => setSelectedFolderId(null)}
              className="hover:text-gray-900"
            >
              All Trackers
            </button>
            {selectedFolderId && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-900 font-medium">
                  {getBreadcrumbText()}
                </span>
              </>
            )}
          </div>

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {getBreadcrumbText()}
              </h1>
              {selectedFolderId === 'unfiled' && (
                <p className="text-gray-600 mt-1">Trackers not assigned to any folder</p>
              )}
            </div>
            <Link
              href="/tracker/builder"
              className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Tracker
            </Link>
          </div>

          {/* Tracker List */}
          {!trackers ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Loading trackers...
            </div>
          ) : trackers.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 text-center">
              <Database className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {selectedFolderId === 'unfiled'
                  ? 'No unfiled trackers'
                  : selectedFolderId
                  ? 'No trackers in this folder'
                  : 'No trackers yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {selectedFolderId
                  ? 'Add trackers to this folder or create a new tracker.'
                  : 'Get started by creating your first tracker.'}
              </p>
              <Link
                href="/tracker/builder"
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Your First Tracker
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {trackers.map((tracker) => {
                const isDeleting = deletingId === tracker._id;
                const isMoving = movingTracker === tracker._id;

                return (
                  <div
                    key={tracker._id}
                    className={`bg-white rounded-lg border ${
                      isDeleting ? 'opacity-50 border-red-200' : 'border-gray-200'
                    } hover:shadow-md transition-all relative`}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            tracker.color ? '' : 'bg-gray-100'
                          }`} style={tracker.color ? { backgroundColor: `${tracker.color}20` } : {}}>
                            <div style={{ color: tracker.color || '#6B7280' }}>
                              {getTrackerIcon(tracker)}
                            </div>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {tracker.name}
                            </h3>
                            {tracker.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {tracker.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Dropdown menu */}
                        <div className="relative">
                          <button
                            className="p-1 hover:bg-gray-100 rounded"
                            disabled={isDeleting}
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-4">
                        {tracker.folderId && allFolders && (
                          <span className="inline-flex items-center gap-1">
                            <Folder className="w-3 h-3" />
                            {allFolders.find(f => f._id === tracker.folderId)?.name || 'Unknown'}
                          </span>
                        )}
                        {!tracker.folderId && (
                          <span className="text-gray-500">No folder</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/tracker/view/${tracker.slug}`}
                          className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                        <Link
                          href={`/tracker/edit/${tracker._id}`}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(tracker._id, tracker.name)}
                          disabled={isDeleting}
                          className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 transition-colors flex items-center justify-center gap-2"
                        >
                          {isDeleting ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setMovingTracker(tracker._id)}
                          className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <FolderInput className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Move Tracker Dropdown */}
                    {isMoving && (
                      <div className="absolute inset-0 bg-white rounded-lg border-2 border-blue-500 p-6 z-10">
                        <h4 className="font-semibold mb-3">Move to folder:</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          <button
                            onClick={() => handleMoveTracker(tracker._id, null)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors"
                          >
                            No folder (root)
                          </button>
                          {allFolders?.map((folder) => (
                            <button
                              key={folder._id}
                              onClick={() => handleMoveTracker(tracker._id, folder._id)}
                              disabled={folder._id === tracker.folderId}
                              className={`w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2 ${
                                folder._id === tracker.folderId ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: folder.color || '#6B7280' }}
                              />
                              {folder.name}
                              {folder._id === tracker.folderId && (
                                <span className="text-xs text-gray-500 ml-auto">(current)</span>
                              )}
                            </button>
                          ))}
                          <button
                            onClick={() => setMovingTracker(null)}
                            className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Folder Modal */}
      <CreateFolderModal
        isOpen={showCreateFolder}
        onClose={() => {
          setShowCreateFolder(false);
          setEditingFolder(null);
        }}
        parentFolderId={selectedFolderId && selectedFolderId !== 'unfiled' ? selectedFolderId : undefined}
        editingFolder={editingFolder}
      />
    </div>
  );
}