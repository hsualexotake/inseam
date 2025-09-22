"use client";

import React, { useState } from "react";
import { useQuery, useMutation, Authenticated, AuthLoading } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import Link from "next/link";
import {
  Plus,
  Eye,
  Database,
  Folder,
  ChevronRight,
} from "lucide-react";
import FolderSidebar from "./FolderSidebar";
import CreateFolderModal from "./CreateFolderModal";
import TrackerActionsDropdown from "@/components/ui/tracker-actions-dropdown";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

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
    } catch (error) {
      console.error("Failed to move tracker:", error);
      alert("Failed to move tracker. Please try again.");
    }
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

                return (
                  <div
                    key={tracker._id}
                    className={`bg-white rounded-lg border ${
                      isDeleting ? 'opacity-50 border-red-200' : 'border-gray-200'
                    } hover:shadow-md transition-all`}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {tracker.name}
                          </h3>
                          {tracker.description && (
                            <p className="text-sm text-gray-600">
                              {tracker.description}
                            </p>
                          )}
                        </div>

                        {/* Actions Dropdown */}
                        <TrackerActionsDropdown
                          trackerId={tracker._id}
                          trackerName={tracker.name}
                          currentFolderId={tracker.folderId}
                          folders={allFolders}
                          onEdit={() => router.push(`/tracker/edit/${tracker._id}`)}
                          onDelete={() => handleDelete(tracker._id, tracker.name)}
                          onMoveToFolder={(folderId) => handleMoveTracker(tracker._id, folderId)}
                          isDeleting={isDeleting}
                        />
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
                          className="flex-1 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                      </div>
                    </div>
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