"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
// import { useRouter } from "next/navigation"; // Commented out - not currently used
import { 
  Mail, MessageSquare, Phone, Package, Truck, AlertTriangle, 
  CheckCircle, ChevronDown, ChevronUp, 
  Zap, Bell, RefreshCw, X
} from "lucide-react";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import { getCategoryBadge, getCategoryColor } from "@/utils/categoryHelpers";

// Source configurations
const sourceConfig = {
  email: { label: "Email", icon: Mail, color: "bg-blue-100 text-blue-800" },
  wechat: { label: "WeChat", icon: MessageSquare, color: "bg-green-100 text-green-800" },
  whatsapp: { label: "WhatsApp", icon: Phone, color: "bg-emerald-100 text-emerald-800" },
  sms: { label: "SMS", icon: Phone, color: "bg-purple-100 text-purple-800" },
  manual: { label: "Manual", icon: Bell, color: "bg-gray-100 text-gray-800" },
};

// Type configurations
const typeConfig = {
  shipment: { label: "Shipment Update", icon: Package, color: "text-blue-600 bg-blue-50" },
  delivery: { label: "Delivered", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  delay: { label: "Delayed", icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  delayed: { label: "Delayed", icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  approval: { label: "Approval", icon: CheckCircle, color: "text-purple-600 bg-purple-50" },
  action: { label: "Action Required", icon: Zap, color: "text-orange-600 bg-orange-50" },
  general: { label: "Update", icon: Bell, color: "text-gray-600 bg-gray-50" },
  in_transit: { label: "In Transit", icon: Truck, color: "text-indigo-600 bg-indigo-50" },
};

// Urgency colors - commented out as currently unused
// const urgencyConfig = {
//   high: "border-l-4 border-red-400",
//   medium: "border-l-4 border-yellow-400",
//   low: "border-l-4 border-gray-300",
// };

interface Update {
  _id: Id<"updates">;
  source: string;
  sourceId?: string;
  type: string;
  category?: string; // 'fashion_ops' or 'general'
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
  // Match various SKU patterns
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
  // Try to extract SKU from various sources
  let sku = null;
  
  // Check skuUpdates first
  if (update.skuUpdates && update.skuUpdates.length > 0) {
    sku = update.skuUpdates[0].skuCode;
  }
  
  // Then try summary and sourceQuote
  if (!sku) {
    sku = extractSKU(update.summary) || extractSKU(update.sourceQuote || '');
  }
  
  // Get type label
  const typeConf = typeConfig[update.type as keyof typeof typeConfig] || typeConfig.general;
  const typeLabel = typeConf.label;
  
  // Format title
  const formattedTitle = sku ? `SKU ${sku}: ${typeLabel}` : update.title;
  
  // Format summary - extract key information
  let formattedSummary = update.summary;
  
  // Remove redundant SKU mentions from summary
  if (sku) {
    formattedSummary = formattedSummary
      .replace(new RegExp(`SKU[:\\s]+${sku}`, 'gi'), '')
      .replace(new RegExp(`\\b${sku}\\b`, 'gi'), '')
      .replace(/^[\s,;]+|[\s,;]+$/g, ''); // Clean up leading/trailing punctuation
  }
  
  // Extract and format key details based on update type
  if (update.type === 'delay' || update.type === 'delayed') {
    // Extract new date
    const dateMatch = formattedSummary.match(/(?:to|date[:\s]+|is[:\s]+)([A-Za-z]+ \d+(?:,? \d{4})?)/i);
    if (dateMatch) {
      formattedSummary = `New delivery date: ${dateMatch[1]}`;
    } else if (formattedSummary.toLowerCase().includes('delayed')) {
      // Clean up delayed messages
      formattedSummary = formattedSummary.replace(/(?:has been |is )?delayed/gi, '').trim();
      if (formattedSummary.startsWith('to ')) {
        formattedSummary = `New date: ${formattedSummary.substring(3)}`;
      }
    }
  } else if (update.type === 'delivery') {
    // Extract delivery confirmation
    const delivered = formattedSummary.match(/delivered(?:[:\s]+(.+))?/i);
    if (delivered && delivered[1]) {
      formattedSummary = `Delivered: ${delivered[1]}`;
    } else {
      formattedSummary = "Successfully delivered";
    }
  } else if (update.type === 'shipment') {
    // Clean up shipment messages
    formattedSummary = formattedSummary.replace(/^(?:Shipment |Package )/i, '');
  }
  
  // Final cleanup
  formattedSummary = formattedSummary
    .replace(/^Delivery for\s+/i, '')
    .replace(/^has been\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Capitalize first letter
  if (formattedSummary) {
    formattedSummary = formattedSummary.charAt(0).toUpperCase() + formattedSummary.slice(1);
  }
  
  return { formattedTitle, formattedSummary };
};

export default function UnifiedUpdates() {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all"); // New category filter
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  // const router = useRouter(); // Commented out - not currently used
  
  // Fetch updates
  const updates = useQuery(api.updates.getRecentUpdates, {
    source: sourceFilter === "all" ? undefined : sourceFilter,
    limit: 20,
  }) as Update[] | undefined;
  
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
  
  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 7) return new Date(timestamp).toLocaleDateString();
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    return "just now";
  };
  
  // Handle refresh (fetch new emails)
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await summarizeEmails({ emailCount: 5 });
    } catch (error) {
      console.error("Failed to fetch updates:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle connect email
  const handleConnectEmail = async () => {
    setConnecting(true);
    
    try {
      // Store the return URL in sessionStorage
      sessionStorage.setItem('nylas_return_url', '/dashboard');
      
      const redirectUri = `${window.location.origin}/emailsummary/callback`;
      const result = await initiateEmailAuth({
        redirectUri,
        provider: 'google', // Default to Google for now
      });
      
      // Redirect to Nylas OAuth
      window.location.href = result.authUrl;
    } catch (error) {
      console.error('Failed to initiate email auth:', error);
      setConnecting(false);
    }
  };
  
  // Handle action completion
  const handleCompleteAction = async (updateId: Id<"updates">, actionIndex: number) => {
    try {
      await completeAction({ updateId, actionIndex });
    } catch (error) {
      console.error("Failed to complete action:", error);
    }
  };
  
  // Handle dismissing an update
  const handleDismissUpdate = async (updateId: Id<"updates">) => {
    try {
      await acknowledgeUpdate({ updateId });
    } catch (error) {
      console.error("Failed to dismiss update:", error);
    }
  };
  
  // Get unique sources from updates
  const availableSources = new Set(updates?.map(u => u.source) || []);
  availableSources.add("email"); // Always show email option
  
  if (!updates) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">Loading updates...</div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recent Updates</h2>
            <p className="text-sm text-gray-500 mt-1">
              All updates from email, messaging, and manual entries
            </p>
          </div>
          {emailConnection ? (
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          ) : (
            <button
              onClick={handleConnectEmail}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Mail className="h-4 w-4" />
              {connecting ? "Connecting..." : "Connect Email"}
            </button>
          )}
        </div>
        
        {/* Category filters */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500 uppercase">Category:</span>
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              categoryFilter === "all"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setCategoryFilter("fashion_ops")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              categoryFilter === "fashion_ops"
                ? "bg-yellow-600 text-white"
                : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            }`}
          >
            📦 Fashion Ops
          </button>
          <button
            onClick={() => setCategoryFilter("general")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              categoryFilter === "general"
                ? "bg-blue-600 text-white"
                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
            }`}
          >
            📧 General
          </button>
        </div>
        
        {/* Source filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSourceFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sourceFilter === "all"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All Sources
            {stats && <span className="ml-1.5 text-xs opacity-75">({stats.total})</span>}
          </button>
          {Array.from(availableSources).map(source => {
            const config = sourceConfig[source as keyof typeof sourceConfig];
            if (!config) return null;
            const Icon = config.icon;
            const count = stats?.sources[source] || 0;
            
            return (
              <button
                key={source}
                onClick={() => setSourceFilter(source)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sourceFilter === source
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.label}
                {count > 0 && <span className="text-xs opacity-75">({count})</span>}
              </button>
            );
          })}
        </div>
        
        {/* Stats summary */}
        {stats && stats.pendingActions > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
            <Zap className="h-4 w-4" />
            {stats.pendingActions} pending action{stats.pendingActions > 1 ? 's' : ''}
          </div>
        )}
      </div>
      
      {/* Updates list */}
      <div className="divide-y divide-gray-100">
        {updates.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No updates found. Try refreshing to fetch new updates.
          </div>
        ) : (
          updates.map((update) => {
            const isExpanded = expandedUpdates.has(update._id);
            const sourceConf = sourceConfig[update.source as keyof typeof sourceConfig] || sourceConfig.manual;
            const typeConf = typeConfig[update.type as keyof typeof typeConfig] || typeConfig.general;
            const urgencyClass = getCategoryColor(update.category, update.urgency);
            const SourceIcon = sourceConf.icon;
            const TypeIcon = typeConf.icon;
            
            // Format the update for better presentation
            const { formattedTitle, formattedSummary } = formatUpdate(update);
            
            // Filter by category if needed
            if (categoryFilter !== "all" && update.category !== categoryFilter) {
              return null;
            }
            
            return (
              <div
                key={update._id}
                className={`p-4 hover:bg-gray-50 transition-colors ${urgencyClass}`}
              >
                <div className="flex items-start gap-3">
                  {/* Type icon */}
                  <div className={`p-2 rounded-lg ${typeConf.color}`}>
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 text-sm">
                          {formattedTitle}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {formattedSummary}
                        </p>
                      </div>
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
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${sourceConf.color}`}>
                        <SourceIcon className="h-3 w-3" />
                        {sourceConf.label}
                      </span>
                      {getCategoryBadge(update.category)}
                      {update.fromName && (
                        <span>from {update.fromName}</span>
                      )}
                      <span>{formatTimeAgo(update.createdAt)}</span>
                      {update.processed && (
                        <span className="text-green-600">✓ Processed</span>
                      )}
                    </div>
                    
                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="mt-4 space-y-3">
                        {/* Source quote */}
                        {update.sourceQuote && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <Mail className="h-4 w-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-gray-600 mb-1">
                                  Source: {update.sourceSubject || "Email"}
                                </p>
                                <p className="text-sm text-gray-700 italic">
                                  &ldquo;{update.sourceQuote}&rdquo;
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* SKU Updates */}
                        {update.skuUpdates && update.skuUpdates.length > 0 && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <h4 className="text-xs font-medium text-blue-900 mb-2">
                              SKU Updates
                            </h4>
                            <div className="space-y-1">
                              {update.skuUpdates.map((sku, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                  <span className="font-mono text-blue-800">{sku.skuCode}</span>
                                  <span className="text-blue-700">
                                    {sku.field}: {sku.oldValue && `${sku.oldValue} → `}{sku.newValue}
                                  </span>
                                  <span className={`text-xs ${
                                    sku.confidence >= 0.8 ? "text-green-600" : 
                                    sku.confidence >= 0.5 ? "text-yellow-600" : "text-red-600"
                                  }`}>
                                    {(sku.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Action items */}
                        {update.actionsNeeded && update.actionsNeeded.length > 0 && (
                          <div className="bg-orange-50 rounded-lg p-3">
                            <h4 className="text-xs font-medium text-orange-900 mb-2">
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
                                  <span className={`text-sm ${
                                    action.completed ? "line-through text-gray-500" : "text-orange-800"
                                  }`}>
                                    {action.action}
                                  </span>
                                  {action.completedAt && (
                                    <span className="text-xs text-gray-500">
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
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}