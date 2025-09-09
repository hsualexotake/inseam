"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { 
  Mail, ChevronDown, ChevronUp, 
  RefreshCw, X, Filter, Layers, Tag, Zap
} from "lucide-react";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import {
  Cell,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MAX_TABLE_HEIGHT,
  UPDATES_FETCH_LIMIT,
  EMAIL_FETCH_COUNT,
  sourceConfig,
  getTypeConfig,
  badgeStyles
} from "@/config/updates.config";

interface Update {
  _id: Id<"updates">;
  source: string;
  sourceId?: string;
  type: string;
  category?: string;
  title: string;
  summary: string;
  urgency?: string;
  fromName?: string;
  fromId?: string;
  sourceSubject?: string;
  sourceQuote?: string;
  sourceDate?: number;
  skuUpdates?: Array<{
    skuCode: string;
    field: string;
    oldValue?: string;
    newValue: string;
    confidence: number;
  }>;
  actionsNeeded?: Array<{
    action: string;
    completed: boolean;
    completedAt?: number;
  }>;
  createdAt: number;
  processed: boolean;
}

// Helper function to extract SKU from text
const extractSKU = (text: string): string | null => {
  const patterns = [
    /SKU[:\s]+([A-Z0-9-]+)/i,
    /\b([A-Z]{2,}-\d{4}-[A-Z0-9-]+)\b/i,
    /\b([A-Z0-9]{2,}-[A-Z0-9-]+)\b/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  return null;
};

// Helper function to format update title and summary
const formatUpdate = (update: Update): { formattedTitle: string; formattedSummary: string } => {
  let sku = null;
  
  if (update.skuUpdates && update.skuUpdates.length > 0) {
    sku = update.skuUpdates[0].skuCode;
  }
  
  if (!sku) {
    sku = extractSKU(update.summary) || extractSKU(update.sourceQuote || '');
  }
  
  const typeConf = getTypeConfig(update.type);
  const typeLabel = typeConf.label;
  
  const formattedTitle = sku ? `SKU ${sku}: ${typeLabel}` : update.title;
  
  let formattedSummary = update.summary;
  
  if (sku) {
    formattedSummary = formattedSummary
      .replace(new RegExp(`SKU[:\\s]+${sku}`, 'gi'), '')
      .replace(new RegExp(`\\b${sku}\\b`, 'gi'), '')
      .replace(/^[\s,;]+|[\s,;]+$/g, '');
  }
  
  if (update.type === 'delay' || update.type === 'delayed') {
    const dateMatch = formattedSummary.match(/(?:to|date[:\s]+|is[:\s]+)([A-Za-z]+ \d+(?:,? \d{4})?)/i);
    if (dateMatch) {
      formattedSummary = `New delivery date: ${dateMatch[1]}`;
    } else if (formattedSummary.toLowerCase().includes('delayed')) {
      formattedSummary = formattedSummary.replace(/(?:has been |is )?delayed/gi, '').trim();
      if (formattedSummary.startsWith('to ')) {
        formattedSummary = `New date: ${formattedSummary.substring(3)}`;
      }
    }
  } else if (update.type === 'delivery') {
    const delivered = formattedSummary.match(/delivered(?:[:\s]+(.+))?/i);
    if (delivered && delivered[1]) {
      formattedSummary = `Delivered: ${delivered[1]}`;
    } else {
      formattedSummary = "Successfully delivered";
    }
  } else if (update.type === 'shipment') {
    formattedSummary = formattedSummary.replace(/^(?:Shipment |Package )/i, '');
  }
  
  formattedSummary = formattedSummary
    .replace(/^Delivery for\s+/i, '')
    .replace(/^has been\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (formattedSummary) {
    formattedSummary = formattedSummary.charAt(0).toUpperCase() + formattedSummary.slice(1);
  }
  
  return { formattedTitle, formattedSummary };
};

export default function UnifiedUpdates() {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  
  // Fetch updates
  const updatesQuery = useQuery(api.updates.getRecentUpdates, {
    source: sourceFilter === "all" ? undefined : sourceFilter,
    limit: UPDATES_FETCH_LIMIT,
  });
  
  // Type-safe updates with validation
  const updates = useMemo(() => {
    if (!updatesQuery) return undefined;
    return Array.isArray(updatesQuery) ? updatesQuery as Update[] : undefined;
  }, [updatesQuery]);
  
  const stats = useQuery(api.updates.getUpdateStats);
  const completeAction = useMutation(api.updates.completeAction);
  const acknowledgeUpdate = useMutation(api.updates.acknowledgeUpdate);
  const summarizeEmails = useAction(api.emails.summarizeInbox);
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
  
  // Toggle selected state
  const toggleSelected = (id: string) => {
    const newSelected = new Set(selectedUpdates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedUpdates(newSelected);
  };
  
  // Toggle all selected
  const toggleAllSelected = () => {
    if (selectedUpdates.size === filteredUpdates?.length) {
      setSelectedUpdates(new Set());
    } else {
      setSelectedUpdates(new Set(filteredUpdates?.map(u => u._id) || []));
    }
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
  
  // Format date and time
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return date.toLocaleString('en-US', options);
  };
  
  // Handle refresh (fetch new emails)
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await summarizeEmails({ emailCount: EMAIL_FETCH_COUNT });
    } catch (error) {
      console.error("Failed to fetch updates:", error);
      // TODO: Add user-facing error notification here
      // Could use a toast library or error state
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
  
  // Handle action completion
  const handleCompleteAction = useCallback(async (updateId: Id<"updates">, actionIndex: number) => {
    try {
      await completeAction({ updateId, actionIndex });
    } catch (error) {
      console.error("Failed to complete action:", error);
      // TODO: Add user-facing error notification
    }
  }, [completeAction]);
  
  // Handle dismissing an update
  const handleDismissUpdate = useCallback(async (updateId: Id<"updates">) => {
    try {
      await acknowledgeUpdate({ updateId });
    } catch (error) {
      console.error("Failed to dismiss update:", error);
      // TODO: Add user-facing error notification
    }
  }, [acknowledgeUpdate]);
  
  // Get unique sources from updates
  const availableSources = new Set(updates?.map(u => u.source) || []);
  availableSources.add("email");
  
  // Calculate active filters count
  const activeFiltersCount = 
    (categoryFilter !== "all" ? 1 : 0) + 
    (sourceFilter !== "all" ? 1 : 0);
  
  // Build filter options for dropdown - memoized
  const filterOptions = useMemo(() => [
    { label: "— CATEGORY —", onClick: () => {}, Icon: <Layers className="h-3 w-3" /> },
    { label: "All Categories", onClick: () => setCategoryFilter("all"), Icon: null },
    { label: "Fashion Ops", onClick: () => setCategoryFilter("fashion_ops"), Icon: null },
    { label: "General", onClick: () => setCategoryFilter("general"), Icon: null },
    { label: "— SOURCE —", onClick: () => {}, Icon: <Tag className="h-3 w-3" /> },
    { label: `All Sources${stats ? ` (${stats.total})` : ''}`, onClick: () => setSourceFilter("all"), Icon: null },
    ...Array.from(availableSources).map(source => {
      const config = sourceConfig[source as keyof typeof sourceConfig];
      if (!config) return null;
      const Icon = config.icon;
      const count = stats?.sources[source] || 0;
      return {
        label: `${config.label}${count > 0 ? ` (${count})` : ''}`,
        onClick: () => setSourceFilter(source),
        Icon: <Icon className="h-3.5 w-3.5" />
      };
    }).filter(Boolean),
    ...(activeFiltersCount > 0 ? [
      { label: "— ACTIONS —", onClick: () => {}, Icon: null },
      { 
        label: "Clear all filters", 
        onClick: () => {
          setCategoryFilter("all");
          setSourceFilter("all");
        },
        Icon: <X className="h-3.5 w-3.5 text-red-600" />
      }
    ] : [])
  ].filter(item => item !== null) as Array<{label: string; onClick: () => void; Icon: React.ReactNode | null}>, [stats, activeFiltersCount, availableSources]);
  
  // Filter updates by category - memoized for performance
  const filteredUpdates = useMemo(() => {
    if (!updates) return undefined;
    if (categoryFilter === "all") return updates;
    return updates.filter(update => update.category === categoryFilter);
  }, [updates, categoryFilter]);
  
  if (!updates) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">Loading updates...</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col" style={{ maxHeight: `${MAX_TABLE_HEIGHT}px` }}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="heading-large">Recent Updates</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter Dropdown using new component */}
            <DropdownMenu
              options={filterOptions}
              activeFiltersCount={activeFiltersCount}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
            </DropdownMenu>
            
            {/* Refresh/Connect Button */}
            {emailConnection ? (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#11111198] hover:bg-[#111111d1] text-white shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none rounded-lg backdrop-blur-sm disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            ) : (
              <button
                onClick={handleConnectEmail}
                disabled={connecting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#11111198] hover:bg-[#111111d1] text-white shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none rounded-lg backdrop-blur-sm disabled:opacity-50 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                {connecting ? "Connecting..." : "Connect Email"}
              </button>
            )}
          </div>
        </div>
        
        {/* Stats summary */}
        {stats && stats.pendingActions > 0 && (
          <div className="mt-3 flex items-center gap-2 body-text text-orange-600">
            <Zap className="h-4 w-4" />
            {stats.pendingActions} pending action{stats.pendingActions > 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      {/* Table */}
      <div className="overflow-y-auto flex-1 relative">
        {filteredUpdates && filteredUpdates.length === 0 ? (
          <div className="p-6 text-center body-text">
            No updates found. Try refreshing to fetch new updates.
          </div>
        ) : (
          <Table aria-label="Recent updates" selectionMode="multiple">
            <TableHeader className="sticky top-0 z-10 bg-white border-b border-gray-200">
              <Column width={40} minWidth={40}>
                <Checkbox 
                  slot="selection"
                  isSelected={selectedUpdates.size === filteredUpdates?.length}
                  onChange={() => toggleAllSelected()}
                />
              </Column>
              <Column width={250} minWidth={200}>Source</Column>
              <Column isRowHeader>Update</Column>
              <Column width={280} minWidth={200}>SKU Update</Column>
              <Column width={80} minWidth={80}>Actions</Column>
            </TableHeader>
            <TableBody>
              {filteredUpdates?.map((update) => {
                const isExpanded = expandedUpdates.has(update._id);
                const isSelected = selectedUpdates.has(update._id);
                const sourceConf = sourceConfig[update.source as keyof typeof sourceConfig] || sourceConfig.manual;
                const { formattedTitle, formattedSummary } = formatUpdate(update);
                
                return (
                  <Row key={update._id}>
                    <Cell>
                      <Checkbox 
                        slot="selection"
                        isSelected={isSelected}
                        onChange={() => toggleSelected(update._id)}
                      />
                    </Cell>
                    <Cell>
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div className="flex flex-col">
                          <span className="body-text text-gray-700">
                            {update.fromName || "Unknown sender"}
                          </span>
                          <span className="caption-text text-gray-500">
                            {formatDateTime(update.createdAt)}
                          </span>
                        </div>
                      </div>
                    </Cell>
                    <Cell>
                      <div className="space-y-1">
                        <div className="action-text text-gray-900">{formattedTitle}</div>
                        <div className="body-text text-gray-600">{formattedSummary}</div>
                        
                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="mt-4 space-y-3 border-t pt-3">
                            {/* Process Summary Box */}
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="action-text text-gray-700">Process</span>
                                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                              </div>
                              
                              <div className="text-sm relative">
                                {/* Source */}
                                <div className="flex items-start gap-3 relative">
                                  <div className="flex flex-col items-center">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                    <div className="w-px h-14 bg-gray-300"></div>
                                  </div>
                                  <div className="flex-1 pb-3">
                                    <p className="caption-text mb-1.5">Source</p>
                                    <div className="inline-flex items-center gap-2 bg-gray-100 rounded px-3 py-1.5 ml-2">
                                      <sourceConf.icon className="h-4 w-4 text-gray-500" />
                                      <span className="body-text text-gray-700">
                                        {update.sourceSubject || update.title || "Update notification"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Read */}
                                <div className="flex items-start gap-3 -mt-3">
                                  <div className="flex flex-col items-center">
                                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                    {(update.skuUpdates && update.skuUpdates.length > 0) && (
                                      <div className="w-px h-20 bg-gray-300"></div>
                                    )}
                                  </div>
                                  <div className="flex-1 pb-3">
                                    <p className="caption-text mb-1.5">Read</p>
                                    <p className="body-text italic ml-2">
                                      {update.sourceQuote ? `"${update.sourceQuote}"` : 
                                       update.summary ? `"${update.summary}"` : ""}
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Update/SKU Updates */}
                                {update.skuUpdates && update.skuUpdates.length > 0 && (
                                  <div className="flex items-start gap-3 -mt-3">
                                    <div className="flex flex-col items-center">
                                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                    </div>
                                    <div className="flex-1 pb-3">
                                      <p className="caption-text mb-1.5">Update</p>
                                      <div className="ml-2 space-y-1.5">
                                        {update.skuUpdates.map((sku, idx) => (
                                          <div key={idx} className="flex items-center gap-3">
                                            <span className="inline-block bg-gray-100 rounded px-2.5 py-1 font-mono body-text text-gray-700">
                                              {sku.skuCode}
                                            </span>
                                            <span className="body-text text-gray-700">{sku.field}: {sku.newValue}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Action items */}
                            {update.actionsNeeded && update.actionsNeeded.length > 0 && (
                              <div className="bg-orange-50 rounded-lg p-3">
                                <h4 className="caption-text font-semibold text-orange-900 mb-2">
                                  Actions Required
                                </h4>
                                <div className="space-y-2">
                                  {update.actionsNeeded.map((action, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={action.completed}
                                        onChange={() => handleCompleteAction(update._id, idx)}
                                        className="h-4 w-4 text-orange-600 rounded"
                                        disabled={action.completed}
                                      />
                                      <span className={`body-text ${
                                        action.completed ? "line-through text-gray-500" : "text-orange-800"
                                      }`}>
                                        {action.action}
                                      </span>
                                      {action.completedAt && (
                                        <span className="caption-text">
                                          ({formatTimeAgo(action.completedAt)})
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Cell>
                    <Cell>
                      {update.skuUpdates && update.skuUpdates.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {update.skuUpdates.map((sku, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-block ${badgeStyles.sku} px-2 py-0.5 rounded text-xs font-mono`}>
                                {sku.skuCode}
                              </span>
                              <span className={`inline-block ${badgeStyles.field} px-2 py-0.5 rounded text-xs capitalize`}>
                                {sku.field}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className={`inline-block ${badgeStyles.value} px-2 py-0.5 rounded text-xs font-medium`}>
                                {sku.newValue}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </Cell>
                    <Cell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDismissUpdate(update._id)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors group"
                          title="Dismiss update"
                        >
                          <X className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                        </button>
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
                    </Cell>
                  </Row>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}