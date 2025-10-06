"use client";

import { useState, useCallback } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Sparkles, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import type { Id } from "@packages/backend/convex/_generated/dataModel";

interface ColumnUpdate {
  columnKey: string;
  columnName: string;
  columnType: string;
  columnColor?: string;
  currentValue?: string | number | boolean | null;
  proposedValue: string | number | boolean | null;
  confidence: number;
}

interface TrackerProposal {
  trackerId: Id<"trackers">;
  trackerName: string;
  trackerColor?: string;
  rowId: string;
  isNewRow: boolean;
  columnUpdates: ColumnUpdate[];
}

interface CentralizedUpdate {
  _id: Id<"centralizedUpdates">;
  source: string;
  sourceId?: string;
  type: string;
  category: string;
  title: string;
  summary?: string;
  fromName?: string;
  sourceSubject?: string;
  sourceQuote?: string;
  trackerProposals?: TrackerProposal[];
  processed: boolean;
  approved?: boolean;
  rejected?: boolean;
  createdAt: number;
  viewedAt?: number;
}

interface GroupedProposal {
  updateId: Id<"centralizedUpdates">;
  proposal: TrackerProposal;
  fromName?: string;
  createdAt: number;
  update: CentralizedUpdate;
}

export default function TrackerUpdatesSection() {
  const [processingUpdates, setProcessingUpdates] = useState<Set<string>>(new Set());
  const [expandedTrackers, setExpandedTrackers] = useState<Set<string>>(new Set());
  const [hoveredUpdate, setHoveredUpdate] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Fetch centralized updates with proposals
  const {
    results: paginatedUpdates,
  } = usePaginatedQuery(
    api.centralizedUpdates.getCentralizedUpdates,
    { viewMode: "active" },
    { initialNumItems: 20 }
  );

  const updates = (paginatedUpdates as CentralizedUpdate[] | undefined) || [];

  // Mutations
  const updateProposalWithEdits = useMutation(api.centralizedUpdates.updateProposalWithEdits);
  const rejectProposals = useMutation(api.centralizedUpdates.rejectProposals);

  // Group proposals by tracker
  const trackerGroups = new Map<string, GroupedProposal[]>();

  updates.forEach((update) => {
    if (update.trackerProposals && update.trackerProposals.length > 0) {
      update.trackerProposals.forEach((proposal) => {
        const key = proposal.trackerId;
        if (!trackerGroups.has(key)) {
          trackerGroups.set(key, []);
        }
        trackerGroups.get(key)!.push({
          updateId: update._id,
          proposal,
          fromName: update.fromName,
          createdAt: update.createdAt,
          update,
        });
      });
    }
  });

  // Toggle expanded state
  const toggleExpanded = (trackerId: string) => {
    const newExpanded = new Set(expandedTrackers);
    if (newExpanded.has(trackerId)) {
      newExpanded.delete(trackerId);
    } else {
      newExpanded.add(trackerId);
    }
    setExpandedTrackers(newExpanded);
  };

  // Handle approve
  const handleApprove = useCallback(async (
    updateId: Id<"centralizedUpdates">,
    proposal: TrackerProposal
  ) => {
    const processingKey = `${updateId}-${proposal.trackerId}`;
    if (processingUpdates.has(processingKey)) return;

    setProcessingUpdates(prev => new Set(prev).add(processingKey));
    try {
      const editedProposal = {
        trackerId: proposal.trackerId,
        rowId: proposal.rowId,
        editedColumns: proposal.columnUpdates.map(col => ({
          columnKey: col.columnKey,
          newValue: col.proposedValue,
          targetColumnKey: col.columnKey,
        })),
      };
      await updateProposalWithEdits({ updateId, editedProposals: [editedProposal] });
    } catch (error: any) {
      alert(`Failed to approve: ${error?.message || 'Unknown error'}`);
      console.error("Failed to approve proposal:", error);
    } finally {
      setProcessingUpdates(prev => {
        const next = new Set(prev);
        next.delete(processingKey);
        return next;
      });
    }
  }, [updateProposalWithEdits, processingUpdates]);

  // Handle reject
  const handleReject = useCallback(async (updateId: Id<"centralizedUpdates">) => {
    if (processingUpdates.has(updateId)) return;

    setProcessingUpdates(prev => new Set(prev).add(updateId));
    try {
      await rejectProposals({ updateId });
    } catch (error: any) {
      alert(`Failed to reject: ${error?.message || 'Unknown error'}`);
      console.error("Failed to reject proposals:", error);
    } finally {
      setProcessingUpdates(prev => {
        const next = new Set(prev);
        next.delete(updateId);
        return next;
      });
    }
  }, [rejectProposals, processingUpdates]);

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  // Calculate last refresh time (most recent update)
  const lastRefreshTime = updates.length > 0
    ? formatTimeAgo(Math.max(...updates.map(u => u.createdAt)))
    : "Never";

  return (
    <div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900">Tracker Updates</h2>
        </div>
        <p className="text-sm text-gray-600">
          Last Refreshed: <span className="font-medium">{lastRefreshTime}</span>
        </p>
      </div>

      {/* Tracker Cards - Flat, non-collapsible */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {trackerGroups.size === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No tracker updates yet. Process emails to see proposals.
          </div>
        ) : (
          Array.from(trackerGroups.entries()).map(([trackerId, proposals]) => {
            const firstProposal = proposals[0].proposal;
            const isExpanded = expandedTrackers.has(trackerId);

            return (
              <div
                key={trackerId}
                className="border border-gray-200 rounded-lg bg-white"
              >
                {/* Tracker Card Header - Clickable */}
                <button
                  onClick={() => toggleExpanded(trackerId)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900">
                    {firstProposal.trackerName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {proposals.length} update{proposals.length !== 1 ? 's' : ''}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Updates - Collapsible */}
                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {proposals.map((item, idx) => {
                      const { updateId, proposal, fromName, createdAt, update } = item;
                      const processingKey = `${updateId}-${proposal.trackerId}`;
                      const isProcessing = processingUpdates.has(processingKey) || processingUpdates.has(updateId);

                      // Create a readable description of the update
                      const updateDescription = proposal.columnUpdates
                        .map(col => `${col.columnName} to ${col.proposedValue}`)
                        .join(", ");

                      const uniqueUpdateKey = `${updateId}-${idx}`;
                      const isHovered = hoveredUpdate === uniqueUpdateKey;
                      const isDropdownOpen = openDropdown === uniqueUpdateKey;

                      return (
                        <div
                          key={uniqueUpdateKey}
                          className={`relative ${isProcessing ? 'opacity-50' : ''}`}
                        >
                          <div
                            className="p-3 group hover:bg-gray-50 transition-colors"
                            onMouseEnter={() => setHoveredUpdate(uniqueUpdateKey)}
                            onMouseLeave={() => setHoveredUpdate(null)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              {/* Left: Update info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 mb-1">
                                  Update {updateDescription}
                                </p>
                                <p className="text-xs text-gray-500">
                                  from {fromName || "Unknown"} • {formatTimeAgo(createdAt)}
                                </p>
                              </div>

                              {/* Right: Actions */}
                              {!update.processed && (
                                <div className="flex items-center gap-1 relative">
                                  {/* Approve/Reject buttons - show on hover */}
                                  {isHovered && (
                                    <>
                                      <button
                                        onClick={() => handleApprove(updateId, proposal)}
                                        disabled={isProcessing}
                                        className="px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-1"
                                        title="Approve"
                                      >
                                        <Check className="h-3 w-3" />
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleReject(updateId)}
                                        disabled={isProcessing}
                                        className="px-2 py-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1"
                                        title="Reject"
                                      >
                                        <X className="h-3 w-3" />
                                        Reject
                                      </button>
                                    </>
                                  )}

                                  {/* Dropdown icon - always visible */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdown(isDropdownOpen ? null : uniqueUpdateKey);
                                    }}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                    title="View email details"
                                  >
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                  </button>

                                  {/* Dropdown menu */}
                                  {isDropdownOpen && (
                                    <>
                                      {/* Backdrop to close dropdown */}
                                      <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setOpenDropdown(null)}
                                      />
                                      {/* Dropdown content */}
                                      <div className="absolute right-0 top-8 z-20 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
                                        <div className="space-y-3">
                                          {/* Email Subject */}
                                          {update.sourceSubject && (
                                            <div>
                                              <p className="text-xs font-medium text-gray-500 mb-1">Email Subject</p>
                                              <p className="text-sm text-gray-900">{update.sourceSubject}</p>
                                            </div>
                                          )}

                                          {/* Email Title */}
                                          {update.title && (
                                            <div>
                                              <p className="text-xs font-medium text-gray-500 mb-1">Title</p>
                                              <p className="text-sm text-gray-900">{update.title}</p>
                                            </div>
                                          )}

                                          {/* Email Excerpt */}
                                          {update.sourceQuote && (
                                            <div>
                                              <p className="text-xs font-medium text-gray-500 mb-1">Email Excerpt</p>
                                              <p className="text-sm text-gray-700 italic bg-gray-50 p-2 rounded">
                                                &ldquo;{update.sourceQuote}&rdquo;
                                              </p>
                                            </div>
                                          )}

                                          {/* Source */}
                                          <div>
                                            <p className="text-xs font-medium text-gray-500 mb-1">Source</p>
                                            <p className="text-sm text-gray-900">
                                              {fromName || "Unknown"} • {update.source}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
