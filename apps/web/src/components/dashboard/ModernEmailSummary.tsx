'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAction, useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Mail, RefreshCw, Package, Truck, AlertTriangle, CheckCircle, Clock, Inbox, ChevronDown, ChevronUp, Quote } from "lucide-react";
import Link from "next/link";
import { getCategoryBadge, getUpdateColor, getIconColor } from "@/utils/categoryHelpers";

interface EmailUpdate {
  type: 'shipment' | 'delivery' | 'delay' | 'approval' | 'action' | 'general';
  category?: 'fashion_ops' | 'general';
  summary: string;
  from: string;
  urgency: 'high' | 'medium' | 'low';
  sourceEmailId?: string;
  sourceSubject?: string;
  sourceQuote?: string;
  sourceDate?: number;
}

interface ActionItem {
  action: string;
  sourceEmailId?: string;
  sourceSubject?: string;
  sourceQuote?: string;
}

interface SKUUpdate {
  skuCode: string;
  trackingNumber?: string;
  status?: string;
  deliveryDate?: string;
  quantity?: number;
  supplier?: string;
  sourceEmailId: string;
  sourceQuote: string;
}

interface SimplifiedEmailSummary {
  quickSummary: string;
  updates: EmailUpdate[];
  actionsNeeded: (string | ActionItem)[];
  skuUpdates?: SKUUpdate[];
}

export default function ModernEmailSummary() {
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false); // Prevent double-fetching
  const [summary, setSummary] = useState<string | null>(null);
  const [structuredSummary, setStructuredSummary] = useState<SimplifiedEmailSummary | null>(null);
  const [expandedUpdates, setExpandedUpdates] = useState<Set<number>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<number>>(new Set());
  
  const connectionStatus = useQuery(api.emails.getEmailConnection);
  const fetchRecentEmails = useAction(api.nylas.actions.fetchRecentEmails);
  const summarizeInbox = useAction(api.emails.summarizeInbox);

  const processEmailSKUUpdates = useAction(api.tracking.processEmailSKUUpdates);

  const fetchEmailsAndSummarize = useCallback(async () => {
    // Prevent double-fetching
    if (isFetching) return;
    
    setIsFetching(true);
    setLoading(true);
    try {
      const emailsData = await fetchRecentEmails({ limit: 5, offset: 0 });
      const summaryResult = await summarizeInbox({ 
        emailCount: 5
      });
      setSummary(summaryResult.summary);
      
      // Parse the JSON summary
      try {
        const parsed = JSON.parse(summaryResult.summary);
        setStructuredSummary(parsed);
        
        // Process SKU updates if present
        if (parsed.skuUpdates && parsed.skuUpdates.length > 0) {
          // Process all emails that might have SKU updates
          if (emailsData && emailsData.emails) {
            for (const email of emailsData.emails) {
              try {
                await processEmailSKUUpdates({
                  emailId: email.id,
                  emailSubject: email.subject || '',
                  emailContent: email.body || email.snippet || '',
                  skuUpdates: parsed.skuUpdates.filter((u: SKUUpdate) => 
                    u.sourceEmailId === email.id || 
                    // If no sourceEmailId, check if the quote appears in this email
                    (email.body && email.body.includes(u.sourceQuote))
                  ),
                });
              } catch (err) {
                console.error('Failed to process SKU updates for email:', email.id, err);
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse summary:', e);
        // Fallback to text display
        setStructuredSummary(null);
      }
    } catch (err) {
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
      setIsFetching(false); // Reset fetching state
    }
  }, [fetchRecentEmails, summarizeInbox, processEmailSKUUpdates, isFetching]);

  useEffect(() => {
    if (connectionStatus && !summary) {
      fetchEmailsAndSummarize().catch(console.error);
    }
  }, [connectionStatus, summary, fetchEmailsAndSummarize]);

  const handleRefresh = () => {
    setSummary(null);
    setStructuredSummary(null);
    // Fetch and process any new emails
    fetchEmailsAndSummarize();
  };

  if (!connectionStatus) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Email AI Summary</h2>
        </div>
        <div className="text-center py-12">
          <div className="bg-gray-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Mail className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 mb-4">No email account connected</p>
          <Link
            href="/emailsummary"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Connect Email
          </Link>
        </div>
      </div>
    );
  }

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'shipment':
        return <Package className="h-4 w-4" />;
      case 'delivery':
        return <Truck className="h-4 w-4" />;
      case 'delay':
        return <AlertTriangle className="h-4 w-4" />;
      case 'approval':
        return <CheckCircle className="h-4 w-4" />;
      case 'action':
        return <Clock className="h-4 w-4" />;
      default:
        return <Inbox className="h-4 w-4" />;
    }
  };

  const toggleUpdateExpanded = (index: number) => {
    setExpandedUpdates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleActionExpanded = (index: number) => {
    setExpandedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const renderStructuredSummary = () => {
    if (!structuredSummary) return null;
    
    // Count categories
    const fashionOpsCount = structuredSummary.updates?.filter(u => u.category === 'fashion_ops').length || 0;
    const generalCount = structuredSummary.updates?.filter(u => u.category === 'general' || !u.category).length || 0;

    return (
      <div className="space-y-4">
        {/* Quick Summary */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-sm font-medium text-gray-900">{structuredSummary.quickSummary}</p>
          {(fashionOpsCount > 0 || generalCount > 0) && (
            <div className="flex items-center gap-3 mt-2">
              {fashionOpsCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-yellow-700">
                  📦 {fashionOpsCount} fashion ops
                </span>
              )}
              {generalCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-700">
                  📧 {generalCount} general
                </span>
              )}
            </div>
          )}
        </div>

        {/* Updates */}
        {structuredSummary.updates && structuredSummary.updates.length > 0 && (
          <div className="space-y-2">
            {structuredSummary.updates.map((update, idx) => {
              const isExpanded = expandedUpdates.has(idx);
              const hasSource = update.sourceQuote && update.sourceSubject;
              
              return (
                <div
                  key={idx}
                  className={`rounded-lg border ${getUpdateColor(update.type, update.urgency, update.category)}`}
                >
                  <div className="flex items-start gap-3 p-3">
                    <div className={`mt-0.5 ${getIconColor(update.type, update.urgency, update.category)}`}>
                      {getUpdateIcon(update.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium flex-1">{update.summary}</p>
                        {getCategoryBadge(update.category)}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-xs opacity-75">From: {update.from}</p>
                        {hasSource && (
                          <button
                            onClick={() => toggleUpdateExpanded(idx)}
                            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <Quote className="h-3 w-3" />
                            View source
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expandable Source Quote */}
                  {hasSource && isExpanded && (
                    <div className="border-t bg-white/50 p-3">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Quote className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-600 mb-1">
                              From: &ldquo;{update.sourceSubject}&rdquo;
                              {update.sourceDate && (
                                <span className="ml-2 text-gray-400">
                                  {new Date(update.sourceDate * 1000).toLocaleDateString()}
                                </span>
                              )}
                            </p>
                            <blockquote className="text-sm text-gray-700 border-l-2 border-gray-300 pl-3 italic">
                              &ldquo;{update.sourceQuote}&rdquo;
                            </blockquote>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions Needed */}
        {structuredSummary.actionsNeeded && structuredSummary.actionsNeeded.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              Actions Needed
            </h3>
            <ul className="space-y-2">
              {structuredSummary.actionsNeeded.map((actionItem, idx) => {
                const isExpanded = expandedActions.has(idx);
                const action = typeof actionItem === 'string' ? actionItem : actionItem.action;
                const hasSource = typeof actionItem === 'object' && actionItem.sourceQuote;
                
                return (
                  <li key={idx} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5 rounded border-gray-300" />
                      <div className="flex-1">
                        <span className="text-sm text-gray-700">{action}</span>
                        {hasSource && (
                          <button
                            onClick={() => toggleActionExpanded(idx)}
                            className="ml-2 text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                          >
                            <Quote className="h-3 w-3" />
                            View source
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Expandable Source Quote for Actions */}
                    {hasSource && isExpanded && typeof actionItem === 'object' && (
                      <div className="ml-6 p-2 bg-white/70 rounded border border-yellow-100">
                        <p className="text-xs font-medium text-gray-600 mb-1">
                          From: &ldquo;{actionItem.sourceSubject}&rdquo;
                        </p>
                        <blockquote className="text-xs text-gray-700 border-l-2 border-yellow-300 pl-2 italic">
                          &ldquo;{actionItem.sourceQuote}&rdquo;
                        </blockquote>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* SKU Updates - New Section */}
        {structuredSummary.skuUpdates && structuredSummary.skuUpdates.length > 0 && (
          <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-600" />
              SKU Tracking Updates
            </h3>
            <div className="space-y-2">
              {structuredSummary.skuUpdates.map((update, idx) => (
                <div key={idx} className="bg-white rounded-md p-3 border border-purple-100">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-mono font-semibold text-purple-900">
                        {update.skuCode}
                      </p>
                      <div className="mt-1 space-y-1 text-xs text-gray-600">
                        {update.trackingNumber && (
                          <p>Tracking: <span className="font-mono">{update.trackingNumber}</span></p>
                        )}
                        {update.status && (
                          <p>Status: <span className="font-medium capitalize">{update.status}</span></p>
                        )}
                        {update.deliveryDate && (
                          <p>Delivery: {update.deliveryDate}</p>
                        )}
                        {update.quantity && (
                          <p>Quantity: {update.quantity}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                      Auto-tracked
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-purple-700 mt-3">
              {structuredSummary.skuUpdates.length} SKU{structuredSummary.skuUpdates.length !== 1 ? 's' : ''} automatically tracked from emails
            </p>
          </div>
        )}

        {/* Empty state - only show if truly no data */}
        {(!structuredSummary.updates || structuredSummary.updates.length === 0) && 
         (!structuredSummary.actionsNeeded || structuredSummary.actionsNeeded.length === 0) && 
         (!structuredSummary.skuUpdates || structuredSummary.skuUpdates.length === 0) && 
         !structuredSummary.quickSummary && (
          <div className="text-center py-8 text-gray-500">
            <Inbox className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No emails to summarize</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Email AI Summary</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading summary...</div>
        </div>
      ) : structuredSummary ? (
        <div>
          {renderStructuredSummary()}
          <div className="pt-4">
            <Link
              href="/emailsummary"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all emails →
            </Link>
          </div>
        </div>
      ) : summary ? (
        // Fallback to formatted text display if JSON parsing fails
        <div className="space-y-4">
          <div className="rounded-lg p-4 border border-gray-200">
            <div className="space-y-3">
              <pre className="whitespace-pre-wrap text-sm text-gray-600 font-mono">
                {summary}
              </pre>
            </div>
          </div>
          <div className="pt-4">
            <Link
              href="/emailsummary"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all emails →
            </Link>
          </div>
        </div>
      ) : (
        <div className="py-12 flex items-center justify-center text-gray-400">
          No summary available
        </div>
      )}
    </div>
  );
}