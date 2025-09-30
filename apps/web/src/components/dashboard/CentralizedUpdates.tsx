"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useAction, usePaginatedQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import {
  Mail, ChevronDown, ChevronUp,
  RefreshCw, CheckCircle, XCircle,
  Package, AlertCircle, CheckCheck, Check, X
} from "lucide-react";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import EditableProposalCard from "./centralized-updates/EditableProposalCard";
import ManualProposalCreator from "./centralized-updates/ManualProposalCreator";
import ProcessingSteps, { type ProcessingStep } from "./ProcessingSteps";
import { AnimatePresence, motion } from "framer-motion";
import { getColorClasses } from "../ui/ColorPicker";

interface TrackerMatch {
  trackerId: Id<"trackers">;
  trackerName: string;
  trackerColor?: string;
  confidence: number;
}

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
  trackerMatches: TrackerMatch[];
  type: string;
  category: string;
  title: string;
  summary?: string;
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
  viewedAt?: number;
  viewedBy?: string;
}

export default function CentralizedUpdates() {
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [processingUpdates, setProcessingUpdates] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [dismissedProposals, setDismissedProposals] = useState<Set<string>>(new Set());
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [showProcessingSteps, setShowProcessingSteps] = useState(false);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [showingManualProposal, setShowingManualProposal] = useState<Set<string>>(new Set());

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
  const markAsViewed = useMutation(api.centralizedUpdates.markAsViewed);
  const markAllAsViewed = useMutation(api.centralizedUpdates.markAllAsViewed);
  const summarizeEmails = useAction(api.centralizedEmails.summarizeCentralizedInbox); // Action with duplicate prevention
  const emailConnection = useQuery(api.nylas.queries.getEmailConnection);
  const initiateEmailAuth = useAction(api.nylas.actions.initiateNylasAuth);

  // Query workflow status when we have an active workflow
  const workflowStatus = useQuery(
    api.centralizedEmails.getWorkflowStatus,
    activeWorkflowId ? { workflowId: activeWorkflowId } : "skip"
  );
  
  // Toggle expanded state
  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedUpdates);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      // Mark as viewed when user expands to look at details
      markAsViewed({ updateId: id as Id<"centralizedUpdates"> })
        .catch(error => {
          console.log('Failed to mark as viewed:', error);
        });
    }
    setExpandedUpdates(newExpanded);
  };

  // Update processing steps based on workflow status
  useEffect(() => {
    if (!workflowStatus || !activeWorkflowId) return;

    const steps = [...processingSteps];

    // Update steps based on workflow progress
    if (workflowStatus.status === "completed") {
      // Mark all steps as completed
      steps[0] = { ...steps[0], status: "completed", description: "Emails fetched" };
      steps[1] = { ...steps[1], status: "completed", description: "Content analyzed" };
      steps[2] = { ...steps[2], status: "completed", description: "Trackers matched" };
      steps[3] = { ...steps[3], status: "completed", description: "Updates created successfully" };

      setProcessingSteps(steps);

      // Clear workflow and hide steps after a short delay
      setTimeout(() => {
        setActiveWorkflowId(null);
        setShowProcessingSteps(false);
        setProcessingSteps([]);
      }, 2000);
    } else if (workflowStatus.status === "failed") {
      // Mark as failed
      const failedStep = workflowStatus.stepsCompleted || 0;
      for (let i = 0; i < failedStep; i++) {
        steps[i] = { ...steps[i], status: "completed" };
      }
      if (failedStep < steps.length) {
        steps[failedStep] = { ...steps[failedStep], status: "completed", description: "Failed" };
      }

      setProcessingSteps(steps);

      setTimeout(() => {
        setActiveWorkflowId(null);
        setShowProcessingSteps(false);
        setProcessingSteps([]);
      }, 3000);
    } else if (workflowStatus.status === "inProgress") {
      // Update based on current step
      const currentStepIndex = workflowStatus.stepsCompleted || 0;

      // Mark completed steps
      for (let i = 0; i < currentStepIndex; i++) {
        steps[i] = { ...steps[i], status: "completed" };
      }

      // Update descriptions based on step
      if (currentStepIndex === 0 && steps[0]) {
        steps[0] = { ...steps[0], status: "active", description: "Fetching emails..." };
      } else if (currentStepIndex === 1 && steps[1]) {
        steps[0] = { ...steps[0], status: "completed", description: "Emails fetched" };
        steps[1] = { ...steps[1], status: "active", description: "Extracting information" };
      } else if (currentStepIndex === 2 && steps[2]) {
        steps[0] = { ...steps[0], status: "completed", description: "Emails fetched" };
        steps[1] = { ...steps[1], status: "completed", description: "Content analyzed" };
        steps[2] = { ...steps[2], status: "active", description: "Matching to trackers..." };
      } else if (currentStepIndex === 3 && steps[3]) {
        steps[0] = { ...steps[0], status: "completed", description: "Emails fetched" };
        steps[1] = { ...steps[1], status: "completed", description: "Content analyzed" };
        steps[2] = { ...steps[2], status: "completed", description: "Trackers matched" };
        steps[3] = { ...steps[3], status: "active", description: "Creating updates..." };
      }

      setProcessingSteps(steps);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowStatus, activeWorkflowId]); // processingSteps intentionally omitted to prevent infinite loop

  // Handle refresh (fetch new emails)
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setShowProcessingSteps(true);

    // Initialize steps
    const initialSteps: ProcessingStep[] = [
      {
        id: "fetch",
        title: "Fetching emails",
        description: "Checking inbox for new messages...",
        status: "active"
      },
      {
        id: "analyze",
        title: "Analyzing content",
        description: "Waiting to process",
        status: "pending"
      },
      {
        id: "trackers",
        title: "Finding trackers",
        description: "Waiting to match",
        status: "pending"
      },
      {
        id: "proposals",
        title: "Creating proposals",
        description: "Waiting to generate",
        status: "pending"
      }
    ];

    setProcessingSteps(initialSteps);

    try {
      const result = await summarizeEmails({ emailCount: 5 });

      if (result.success) {
        const totalEmails = result.statistics?.totalEmails || 0;

        if (totalEmails === 0) {
          // No new emails to process
          setProcessingSteps([
            { ...initialSteps[0], status: "completed", description: "No new emails found" },
            { ...initialSteps[1], status: "pending", description: "No emails to analyze" },
            { ...initialSteps[2], status: "pending", description: "No matching needed" },
            { ...initialSteps[3], status: "pending", description: "No updates created" }
          ]);

          setTimeout(() => {
            setShowProcessingSteps(false);
            setProcessingSteps([]);
            setActiveWorkflowId(null);
          }, 3000);
        } else if (result.workflowId) {
          // Store the workflow ID to track its progress
          setActiveWorkflowId(result.workflowId);

          // Update first step to show email count
          const updatedSteps = [...initialSteps];
          updatedSteps[0] = {
            ...updatedSteps[0],
            status: "completed",
            description: `Found ${totalEmails} new email${totalEmails > 1 ? 's' : ''}`
          };
          updatedSteps[1] = { ...updatedSteps[1], status: "active", description: "Extracting information" };
          setProcessingSteps(updatedSteps);

          // The useEffect will handle updating steps based on workflow status
        } else {
          // Shouldn't happen, but handle it
          setProcessingSteps([
            { ...initialSteps[0], status: "completed", description: "Started processing" },
            { ...initialSteps[1], status: "pending" },
            { ...initialSteps[2], status: "pending" },
            { ...initialSteps[3], status: "pending" }
          ]);

          setTimeout(() => {
            setShowProcessingSteps(false);
            setProcessingSteps([]);
          }, 3000);
        }

        console.log(`Started workflow to process ${totalEmails} emails`);
      } else {
        // Show error in steps
        setProcessingSteps([
          { ...initialSteps[0], status: "completed", description: result.message || "No emails to process" },
          { ...initialSteps[1], status: "pending", description: "Skipped" },
          { ...initialSteps[2], status: "pending", description: "Skipped" },
          { ...initialSteps[3], status: "pending", description: "Skipped" }
        ]);

        setTimeout(() => {
          setShowProcessingSteps(false);
          setProcessingSteps([]);
        }, 3000);
      }
    } catch (error) {
      console.error("Failed to fetch updates:", error);
      setProcessingSteps([
        { id: "fetch", title: "Fetching emails", description: "Failed to connect", status: "completed" },
        { id: "analyze", title: "Analyzing content", description: "Skipped", status: "pending" },
        { id: "trackers", title: "Finding trackers", description: "Skipped", status: "pending" },
        { id: "proposals", title: "Creating proposals", description: "Skipped", status: "pending" }
      ]);

      setTimeout(() => {
        setShowProcessingSteps(false);
        setProcessingSteps([]);
      }, 3000);
    } finally {
      setLoading(false);
    }
  }, [summarizeEmails]);
  
  // Handle connect email
  const handleConnectEmail = async () => {
    setConnecting(true);
    
    try {
      sessionStorage.setItem('nylas_return_url', '/dashboard');
      
      const redirectUri = `${window.location.origin}/dashboard/callback`;
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

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsViewed();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, [markAllAsViewed]);

  // Handle quick approve (uses same mutation as EditableProposalCard)
  const handleQuickApprove = useCallback(async (updateId: Id<"centralizedUpdates">, update: CentralizedUpdate) => {
    if (processingUpdates.has(updateId) || !update.trackerProposals) return;

    setProcessingUpdates(prev => new Set(prev).add(updateId));
    try {
      // Format proposals exactly like EditableProposalCard does
      const editedProposals = update.trackerProposals.map(proposal => ({
        trackerId: proposal.trackerId,
        rowId: proposal.rowId,
        editedColumns: proposal.columnUpdates.map(col => ({
          columnKey: col.columnKey,
          newValue: col.proposedValue,
          targetColumnKey: col.columnKey,
        })),
      }));

      await updateProposalWithEdits({ updateId, editedProposals });
    } catch (error: any) {
      alert(`Failed to approve: ${error?.message || 'Unknown error'}`);
      console.error("Failed to approve proposals:", error);
    } finally {
      setProcessingUpdates(prev => {
        const next = new Set(prev);
        next.delete(updateId);
        return next;
      });
    }
  }, [updateProposalWithEdits, processingUpdates]);

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
            {/* Mark All as Read Button - only show in active view with unviewed items */}
            {viewMode === "active" && stats && stats.active > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                title="Mark all active updates as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark All as Read
              </button>
            )}

            {/* Refresh/Connect Button */}
            {emailConnection ? (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-md disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? "Processing..." : "Process Emails"}
              </button>
            ) : (
              <button
                onClick={handleConnectEmail}
                disabled={connecting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-md disabled:opacity-50 transition-colors"
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
            Active ({stats?.active || 0})
          </button>
          <button
            onClick={() => setViewMode("archived")}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === "archived" 
                ? "bg-gray-900 text-white" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Archived ({stats?.archived || 0})
          </button>
        </div>

        {/* Processing Steps - shown when processing */}
        <AnimatePresence mode="wait">
          {showProcessingSteps && (
            <motion.div
              key="processing-steps"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
                opacity: { duration: 0.2 }
              }}
              className="mt-4 overflow-hidden"
            >
              <ProcessingSteps steps={processingSteps} />
            </motion.div>
          )}
        </AnimatePresence>
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
          <AnimatePresence mode="popLayout">
            {updates.map((update, index) => {
              const isExpanded = expandedUpdates.has(update._id);
              const isProcessing = processingUpdates.has(update._id);
              const shouldShowAsNew = !update.viewedAt && viewMode === "active";
              const hasProposals = update.trackerProposals && update.trackerProposals.length > 0;

              return (
                <motion.div
                  key={update._id}
                  layout
                  initial={{ opacity: 0, y: -20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    delay: index * 0.05 // Stagger effect for multiple items
                  }}
                  className={`${isProcessing ? "opacity-50" : ""} relative overflow-hidden border-l-4 ${
                    shouldShowAsNew
                      ? hasProposals
                        ? "border-yellow-500 bg-gradient-to-r from-yellow-50/30 to-transparent"
                        : "border-blue-500 bg-gradient-to-r from-blue-50/30 to-transparent"
                      : "border-transparent hover:border-gray-200"
                  } transition-colors`}
                >
                  {/* New item highlight pulse - shows for recent items */}
                  {Date.now() - update.createdAt < 5000 && (
                    <motion.div
                      className={`absolute inset-0 bg-gradient-to-r ${hasProposals ? 'from-yellow-50' : 'from-blue-50'} to-transparent pointer-events-none`}
                      initial={{ opacity: 0.8 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 2, ease: "easeOut" }}
                    />
                  )}
                {/* Summary view */}
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Dot indicator for unviewed updates - yellow if has proposals, blue otherwise */}
                        {shouldShowAsNew && (
                          <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${hasProposals ? 'bg-yellow-400' : 'bg-blue-400'} opacity-75`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${hasProposals ? 'bg-yellow-500' : 'bg-blue-500'}`}></span>
                          </span>
                        )}
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {update.fromName || "Unknown sender"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(update.createdAt)}
                        </span>
                        {/* NEW badge for unviewed updates - yellow if has proposals, blue otherwise */}
                        {shouldShowAsNew && (
                          <span className={`px-1.5 py-0.5 text-xs font-semibold ${hasProposals ? 'text-yellow-600 bg-yellow-100' : 'text-blue-600 bg-blue-100'} rounded`}>
                            NEW
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900">{update.title}</h3>

                      {/* Tracker badges with data - only show if there are proposals */}
                      {update.trackerProposals && update.trackerProposals.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {/* Show tracker name badge */}
                          {update.trackerMatches.map((match) => (
                            <div
                              key={match.trackerId}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getColorClasses(match.trackerColor, 'badge')}`}
                            >
                              <Package className={`h-3 w-3 ${getColorClasses(match.trackerColor, 'icon')}`} />
                              <span>{match.trackerName}</span>
                            </div>
                          ))}

                          {/* Show column update badges from first proposal */}
                          {update.trackerProposals[0].columnUpdates.map((col) => (
                            <div
                              key={col.columnKey}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border ${getColorClasses(col.columnColor || update.trackerMatches[0]?.trackerColor, 'badge')}`}
                            >
                              <span className="font-medium">{col.columnName}:</span>
                              <span>{String(col.proposedValue || '-')}</span>
                            </div>
                          ))}
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
                          {/* Approve button - only show if has proposals */}
                          {hasProposals && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickApprove(update._id, update);
                              }}
                              disabled={isProcessing}
                              className="p-1 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                              title="Approve all proposals"
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDismissUpdate(update._id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Archive"
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
                      <div className="py-4">
                        {showingManualProposal.has(update._id) ? (
                          <ManualProposalCreator
                            availableTrackers={availableTrackers}
                            onApply={(editedProposal) => {
                              handleApplyEditedProposal(update._id, editedProposal);
                              setShowingManualProposal(prev => {
                                const next = new Set(prev);
                                next.delete(update._id);
                                return next;
                              });
                            }}
                            onCancel={() => {
                              setShowingManualProposal(prev => {
                                const next = new Set(prev);
                                next.delete(update._id);
                                return next;
                              });
                            }}
                            isProcessing={isProcessing}
                          />
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="mb-3">No tracker proposals for this update</p>
                            <button
                              onClick={() => {
                                setShowingManualProposal(prev => new Set(prev).add(update._id));
                              }}
                              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm"
                            >
                              Add Proposal Manually
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                </motion.div>
              );
            })}
          </AnimatePresence>
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