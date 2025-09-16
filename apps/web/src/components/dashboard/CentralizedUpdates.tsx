"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useAction, usePaginatedQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import {
  Mail, ChevronDown, ChevronUp,
  RefreshCw, X, Database, CheckCircle, XCircle,
  Package, AlertCircle
} from "lucide-react";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import EditableProposalCard from "./centralized-updates/EditableProposalCard";

interface TrackerMatch {
  trackerId: Id<"trackers">;
  trackerName: string;
  confidence: number;
}

interface ColumnUpdate {
  columnKey: string;
  columnName: string;
  columnType: string;
  currentValue?: string | number | boolean | null;
  proposedValue: string | number | boolean | null;
  confidence: number;
}

interface TrackerProposal {
  trackerId: Id<"trackers">;
  trackerName: string;
  rowId: string;
  isNewRow: boolean;
  columnUpdates: ColumnUpdate[];
}

interface CentralizedUpdate {
  _id: Id<"centralizedUpdates">;
  source: string;
  sourceId?: string;
  trackerMatches: TrackerMatch[];
  type: string;
  category: string;
  title: string;
  summary: string;
  urgency?: string;
  fromName?: string;
  fromId?: string;
  sourceSubject?: string;
  sourceQuote?: string;
  sourceDate?: number;
  trackerProposals?: TrackerProposal[];
  processed: boolean;
  approved?: boolean;
  rejected?: boolean;
  createdAt: number;
}

export default function CentralizedUpdates() {
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [processingUpdates, setProcessingUpdates] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [dismissedProposals, setDismissedProposals] = useState<Set<string>>(new Set());
  
  // Fetch paginated centralized updates
  const {
    results: paginatedUpdates,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.centralizedUpdates.getCentralizedUpdates,
    { viewMode },
    { initialNumItems: 10 }
  );
  
  const updates = paginatedUpdates as CentralizedUpdate[] | undefined;
  
  // Queries and mutations
  const stats = useQuery(api.centralizedUpdates.getCentralizedStats);
  const availableTrackers = useQuery(api.centralizedUpdates.getUserTrackers) || [];
  const updateProposalWithEdits = useMutation(api.centralizedUpdates.updateProposalWithEdits);
  const rejectProposals = useMutation(api.centralizedUpdates.rejectProposals);
  const archiveUpdate = useMutation(api.centralizedUpdates.archiveUpdate);
  const summarizeEmails = useAction(api.centralizedEmails.summarizeCentralizedInbox);
  const emailConnection = useQuery(api.emails.getEmailConnection);
  const initiateEmailAuth = useAction(api.nylas.actions.initiateNylasAuth);
  
  // Toggle expanded state
  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedUpdates);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedUpdates(newExpanded);
  };
  
  
  // Handle refresh (fetch new emails)
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await summarizeEmails({ emailCount: 5 });
      if (result.success) {
        console.log(`Created ${result.updatesCreated} updates from emails`);
      }
    } catch (error) {
      console.error("Failed to fetch updates:", error);
    } finally {
      setLoading(false);
    }
  }, [summarizeEmails]);
  
  // Handle connect email
  const handleConnectEmail = async () => {
    setConnecting(true);
    
    try {
      sessionStorage.setItem('nylas_return_url', '/dashboard');
      
      const redirectUri = `${window.location.origin}/emailsummary/callback`;
      const result = await initiateEmailAuth({
        redirectUri,
        provider: 'google',
      });
      
      window.location.href = result.authUrl;
    } catch (error) {
      console.error('Failed to initiate email auth:', error);
      setConnecting(false);
    }
  };
  
  // Handle applying edited proposals
  const handleApplyEditedProposal = useCallback(async (
    updateId: Id<"centralizedUpdates">,
    editedProposal: {
      trackerId: Id<"trackers">;
      rowId: string;
      editedColumns: Array<{
        columnKey: string;
        newValue: string | number | boolean | null;
        targetColumnKey?: string;
      }>;
    }
  ) => {
    if (processingUpdates.has(updateId)) return;

    setProcessingUpdates(prev => new Set(prev).add(updateId));
    try {
      await updateProposalWithEdits({
        updateId,
        editedProposals: [editedProposal]
      });
    } catch (error: any) {
      alert(`Failed to apply changes: ${error?.message || 'Unknown error'}`);
      console.error("Failed to apply proposal:", error);
    } finally {
      setProcessingUpdates(prev => {
        const next = new Set(prev);
        next.delete(updateId);
        return next;
      });
    }
  }, [updateProposalWithEdits, processingUpdates]);
  
  // Handle rejecting proposals
  const handleRejectProposals = useCallback(async (updateId: Id<"centralizedUpdates">) => {
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
  
  // Handle dismissing an update
  const handleDismissUpdate = useCallback(async (updateId: Id<"centralizedUpdates">) => {
    try {
      await archiveUpdate({ updateId });
    } catch (error) {
      console.error("Failed to dismiss update:", error);
    }
  }, [archiveUpdate]);

  // Handle dismissing a single proposal
  const handleDismissProposal = (updateId: string, proposalKey: string) => {
    setDismissedProposals(prev => new Set(prev).add(`${updateId}-${proposalKey}`));
  };
  
  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 7) return new Date(timestamp).toLocaleDateString();
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };
  
  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600";
    if (confidence >= 0.7) return "text-yellow-600";
    return "text-orange-600";
  };
  
  // Get urgency badge color
  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };
  
  if (!updates) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">Loading centralized updates...</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Centralized Updates</h2>
            <p className="text-sm text-gray-600 mt-1">
              AI-powered tracker updates from emails
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh/Connect Button */}
            {emailConnection ? (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-900 hover:bg-gray-800 text-white rounded-md disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? "Processing..." : "Process Emails"}
              </button>
            ) : (
              <button
                onClick={handleConnectEmail}
                disabled={connecting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-900 hover:bg-gray-800 text-white rounded-md disabled:opacity-50 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                {connecting ? "Connecting..." : "Connect Email"}
              </button>
            )}
          </div>
        </div>
        
        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("active")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === "active" 
                ? "bg-gray-900 text-white" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Active ({stats?.pending || 0})
          </button>
          <button
            onClick={() => setViewMode("archived")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === "archived" 
                ? "bg-gray-900 text-white" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Archived ({stats?.approved || 0})
          </button>
        </div>
        
        {/* Stats summary */}
        {stats && stats.withProposals > 0 && viewMode === "active" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
            <Database className="h-4 w-4" />
            {stats.withProposals} update{stats.withProposals > 1 ? 's' : ''} with tracker proposals
          </div>
        )}
      </div>
      
      {/* Updates list */}
      <div className="divide-y divide-gray-100">
        {updates.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {viewMode === "active" 
              ? "No active updates. Process emails to see tracker proposals."
              : "No archived updates yet."}
          </div>
        ) : (
          updates.map((update) => {
            const isExpanded = expandedUpdates.has(update._id);
            const isProcessing = processingUpdates.has(update._id);
            
            return (
              <div key={update._id} className={`${isProcessing ? "opacity-50" : ""}`}>
                {/* Summary view */}
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {update.fromName || "Unknown sender"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(update.createdAt)}
                        </span>
                        {update.urgency && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getUrgencyColor(update.urgency)}`}>
                            {update.urgency}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900">{update.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{update.summary}</p>
                      
                      {/* Tracker badges */}
                      {update.trackerMatches.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {update.trackerMatches.map((match) => (
                            <div
                              key={match.trackerId}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs"
                            >
                              <Package className="h-3 w-3" />
                              <span>{match.trackerName}</span>
                              <span className={`font-semibold ${getConfidenceColor(match.confidence)}`}>
                                {Math.round(match.confidence * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Proposal count */}
                      {update.trackerProposals && update.trackerProposals.length > 0 && (
                        <div className="mt-2 text-sm text-blue-600">
                          {update.trackerProposals.length} tracker update{update.trackerProposals.length > 1 ? 's' : ''} proposed
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {update.processed ? (
                        <div className="flex items-center gap-1 text-xs">
                          {update.approved && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Approved
                            </span>
                          )}
                          {update.rejected && (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-3.5 w-3.5" />
                              Rejected
                            </span>
                          )}
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleDismissUpdate(update._id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Dismiss"
                          >
                            <X className="h-4 w-4 text-gray-400" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => toggleExpanded(update._id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Expanded proposals view */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                    {/* Source quote */}
                    {update.sourceQuote && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Email excerpt:</p>
                        <p className="text-sm text-gray-700 italic">&ldquo;{update.sourceQuote}&rdquo;</p>
                      </div>
                    )}

                    {/* Tracker proposals using new EditableProposalCard */}
                    {update.trackerProposals && update.trackerProposals.length > 0 ? (
                      <>
                        {update.trackerProposals.map((proposal) => {
                          const proposalKey = `${proposal.trackerId}-${proposal.rowId}`;
                          const isDismissed = dismissedProposals.has(`${update._id}-${proposalKey}`);

                          if (isDismissed || update.processed) {
                            if (update.processed && update.approved) {
                              return (
                                <div key={proposalKey} className="bg-white rounded-lg border border-green-200 p-4">
                                  <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="h-5 w-5" />
                                    <span className="font-medium">Applied to {proposal.trackerName}</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }

                          return (
                            <EditableProposalCard
                              key={proposalKey}
                              proposal={proposal}
                              availableTrackers={availableTrackers}
                              onApply={(editedProposal) => handleApplyEditedProposal(update._id, editedProposal)}
                              onDiscard={() => handleDismissProposal(update._id, proposalKey)}
                              isProcessing={isProcessing}
                            />
                          );
                        })}

                        {/* Reject all button if not processed */}
                        {!update.processed && update.trackerProposals.some(p =>
                          !dismissedProposals.has(`${update._id}-${p.trackerId}-${p.rowId}`)
                        ) && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRejectProposals(update._id)}
                              disabled={isProcessing}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
                            >
                              Reject All Remaining
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No tracker proposals for this update</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Load More button */}
      {status === "CanLoadMore" && (
        <div className="p-4 border-t border-gray-200 text-center">
          <button
            onClick={() => loadMore(10)}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}