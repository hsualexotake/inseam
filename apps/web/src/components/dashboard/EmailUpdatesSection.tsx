"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction, usePaginatedQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Mail, RefreshCw, CheckCheck, Package, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Check, X } from "lucide-react";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import { getColorClasses } from "../ui/ColorPicker";
import ProcessingSteps, { type ProcessingStep } from "./ProcessingSteps";
import { AnimatePresence, motion } from "framer-motion";
import EditableProposalCard from "./centralized-updates/EditableProposalCard";
import ManualProposalCreator from "./centralized-updates/ManualProposalCreator";

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
}

type ViewMode = "active" | "archived";

export default function EmailUpdatesSection() {
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [showProcessingSteps, setShowProcessingSteps] = useState(false);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [processingUpdates, setProcessingUpdates] = useState<Set<string>>(new Set());
  const [dismissedProposals, setDismissedProposals] = useState<Set<string>>(new Set());
  const [showingManualProposal, setShowingManualProposal] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

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

  const updates = (paginatedUpdates as CentralizedUpdate[] | undefined) || [];

  // Queries and mutations
  const stats = useQuery(api.centralizedUpdates.getCentralizedStats);
  const availableTrackers = useQuery(api.centralizedUpdates.getUserTrackers) || [];
  const markAllAsViewed = useMutation(api.centralizedUpdates.markAllAsViewed);
  const markAsViewed = useMutation(api.centralizedUpdates.markAsViewed);
  const updateProposalWithEdits = useMutation(api.centralizedUpdates.updateProposalWithEdits);
  const rejectProposals = useMutation(api.centralizedUpdates.rejectProposals);
  const archiveUpdate = useMutation(api.centralizedUpdates.archiveUpdate);
  const summarizeEmails = useAction(api.centralizedEmails.summarizeCentralizedInbox);
  const emailConnection = useQuery(api.nylas.queries.getEmailConnection);
  const initiateEmailAuth = useAction(api.nylas.actions.initiateNylasAuth);

  // Query workflow status when we have an active workflow
  const workflowStatus = useQuery(
    api.centralizedEmails.getWorkflowStatus,
    activeWorkflowId ? { workflowId: activeWorkflowId } : "skip"
  );

  // Calculate unread count from stats (consistent across all views)
  const unreadCount = stats?.unread || 0;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

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
      const timeoutId = setTimeout(() => {
        setActiveWorkflowId(null);
        setShowProcessingSteps(false);
        setProcessingSteps([]);
      }, 2000);
      timeoutsRef.current.push(timeoutId);
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

      const timeoutId = setTimeout(() => {
        setActiveWorkflowId(null);
        setShowProcessingSteps(false);
        setProcessingSteps([]);
      }, 3000);
      timeoutsRef.current.push(timeoutId);
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

          const timeoutId = setTimeout(() => {
            setShowProcessingSteps(false);
            setProcessingSteps([]);
            setActiveWorkflowId(null);
          }, 3000);
          timeoutsRef.current.push(timeoutId);
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
        } else {
          // Shouldn't happen, but handle it
          setProcessingSteps([
            { ...initialSteps[0], status: "completed", description: "Started processing" },
            { ...initialSteps[1], status: "pending" },
            { ...initialSteps[2], status: "pending" },
            { ...initialSteps[3], status: "pending" }
          ]);

          const timeoutId = setTimeout(() => {
            setShowProcessingSteps(false);
            setProcessingSteps([]);
          }, 3000);
          timeoutsRef.current.push(timeoutId);
        }
      } else {
        // Show error in steps
        setProcessingSteps([
          { ...initialSteps[0], status: "completed", description: result.message || "No emails to process" },
          { ...initialSteps[1], status: "pending", description: "Skipped" },
          { ...initialSteps[2], status: "pending", description: "Skipped" },
          { ...initialSteps[3], status: "pending", description: "Skipped" }
        ]);

        const timeoutId = setTimeout(() => {
          setShowProcessingSteps(false);
          setProcessingSteps([]);
        }, 3000);
        timeoutsRef.current.push(timeoutId);
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

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsViewed();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, [markAllAsViewed]);

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

  // Handle quick approve
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

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <h2 className="text-heading-lg mb-1">Email Updates</h2>
        <p className="text-caption mb-4">Latest updates from your tracked sources</p>

        {/* Tabs and Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("active")}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === "active"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Active
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium leading-none text-white bg-blue-600 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode("archived")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === "archived"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Archived
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All as Read
            </button>
            {emailConnection ? (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-gray-900 hover:bg-gray-800 text-white rounded-md disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? "Processing..." : "Process Emails"}
              </button>
            ) : (
              <button
                onClick={handleConnectEmail}
                disabled={connecting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm bg-gray-900 hover:bg-gray-800 text-white rounded-md disabled:opacity-50 transition-colors"
              >
                <Mail className="h-4 w-4" />
                {connecting ? "Connecting..." : "Connect Email"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Processing Steps - separate from header */}
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
            className="flex-shrink-0 px-4 py-3 border-b border-gray-200 overflow-hidden"
          >
            <ProcessingSteps steps={processingSteps} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {updates.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            {viewMode === "active"
              ? "No active updates. Process emails to see tracker proposals."
              : "No archived updates yet."}
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="sticky top-0 grid grid-cols-[1fr_3fr_1.2fr_auto] gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div>Source</div>
              <div>Subject</div>
              <div>Trackers</div>
              <div className="w-6"></div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {updates.map((update) => {
                const isExpanded = expandedUpdates.has(update._id);
                const isProcessing = processingUpdates.has(update._id);
                const hasProposals = update.trackerProposals && update.trackerProposals.length > 0;

                return (
                  <div key={update._id} className={isProcessing ? "opacity-50" : ""}>
                    {/* Table Row */}
                    <div
                      className="grid grid-cols-[1fr_3fr_1.2fr_auto] gap-4 px-4 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleExpanded(update._id)}
                    >
                      {/* Source */}
                      <div className="flex items-start gap-2 min-w-0">
                        <Mail className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="text-primary truncate flex items-center gap-2">
                            {update.fromName || "Unknown sender"}
                            {!update.viewedAt && (
                              <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold text-blue-600 bg-blue-100 rounded">
                                New
                              </span>
                            )}
                          </div>
                          <div className="text-caption mt-0.5">
                            {formatTimeAgo(update.createdAt)}
                          </div>
                        </div>
                      </div>

                      {/* Subject */}
                      <div className="min-w-0">
                        <div className="text-primary truncate">
                          {update.sourceSubject || update.title || "No subject"}
                        </div>
                        <div className="text-caption truncate mt-0.5">
                          {update.sourceQuote || update.summary || "No preview available"}
                        </div>
                      </div>

                      {/* Trackers */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {update.trackerMatches && update.trackerMatches.length > 0 ? (
                          update.trackerMatches.map((match) => (
                            <div
                              key={match.trackerId}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getColorClasses(match.trackerColor, 'badge')}`}
                            >
                              <Package className="h-3 w-3" />
                              <span>{match.trackerName}</span>
                              {match.confidence > 0 && (
                                <span className="text-xs opacity-75">+{match.confidence}</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </div>

                      {/* Expand Icon */}
                      <div className="flex items-center justify-center w-6">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 bg-gray-50 border-t border-gray-100">
                        {/* Source quote */}
                        {update.sourceQuote && (
                          <div className="bg-white rounded-lg p-3 mt-4">
                            <p className="text-xs text-gray-500 mb-1">Email excerpt:</p>
                            <p className="text-sm text-gray-700 italic">&ldquo;{update.sourceQuote}&rdquo;</p>
                          </div>
                        )}

                        {/* Tracker proposals */}
                        {hasProposals ? (
                          <div className="space-y-3 mt-4">
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
                          </div>
                        ) : (
                          <div className="py-4 mt-4">
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
                                  onClick={(e) => {
                                    e.stopPropagation();
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
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Load More - inside scrollable area */}
        {status === "CanLoadMore" && (
          <div className="p-4 border-t border-gray-100 text-center">
            <button
              onClick={() => loadMore(10)}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
