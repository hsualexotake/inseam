"use client";

import React, { useState } from "react";
import { useQuery, useMutation, Authenticated, AuthLoading } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Id } from "@packages/backend/convex/_generated/dataModel";
import Link from "next/link";
import {
  Plus,
  Database,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import FolderSidebar from "./FolderSidebar";
import CreateFolderModal from "./CreateFolderModal";
import TrackerCard from "./TrackerCard";

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
  const [editingFolder, setEditingFolder] = useState<{
    _id: Id<"trackerFolders">;
    name: string;
    color?: string;
  } | null>(null);

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

  const handleEditFolder = (folderId: Id<"trackerFolders">) => {
    const folder = allFolders?.find(f => f._id === folderId);
    if (folder) {
      setEditingFolder({
        _id: folder._id,
        name: folder.name,
        color: folder.color || undefined
      });
      setShowCreateFolder(true);
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
        onEditFolder={handleEditFolder}
      />

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <motion.div
            className="flex items-center gap-2 text-sm text-gray-600 mb-6"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
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
          </motion.div>

          {/* Header */}
          <motion.div
            className="flex justify-between items-center mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
          >
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
          </motion.div>

          {/* Tracker List */}
          {!trackers ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Loading trackers...
            </div>
          ) : trackers.length === 0 ? (
            <motion.div
              className="bg-gray-50 rounded-lg p-12 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
            >
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
            </motion.div>
          ) : (
            <motion.div
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1,
                    delayChildren: 0.2,
                  }
                }
              }}
            >
              {trackers.map((tracker) => {
                const folder = allFolders?.find(f => f._id === tracker.folderId);
                const isDeleting = deletingId === tracker._id;

                return (
                  <motion.div
                    key={tracker._id}
                    variants={{
                      hidden: { opacity: 0, y: 20, scale: 0.95 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        transition: {
                          duration: 0.3,
                          ease: "easeOut"
                        }
                      }
                    }}
                  >
                    <TrackerCard
                      tracker={tracker}
                      folder={folder}
                      folders={allFolders}
                      isDeleting={isDeleting}
                      onDelete={handleDelete}
                      onMoveToFolder={handleMoveTracker}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
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