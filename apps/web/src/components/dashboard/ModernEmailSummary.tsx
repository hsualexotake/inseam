'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAction, useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Mail, RefreshCw, Package, Truck, AlertTriangle, CheckCircle, Clock, Inbox } from "lucide-react";
import Link from "next/link";

interface EmailUpdate {
  type: 'shipment' | 'delivery' | 'delay' | 'approval' | 'action' | 'general';
  summary: string;
  from: string;
  urgency: 'high' | 'medium' | 'low';
}

interface SimplifiedEmailSummary {
  quickSummary: string;
  updates: EmailUpdate[];
  actionsNeeded: string[];
}

export default function ModernEmailSummary() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [structuredSummary, setStructuredSummary] = useState<SimplifiedEmailSummary | null>(null);
  
  const connectionStatus = useQuery(api.nylas.queries.getConnectionStatus);
  const fetchRecentEmails = useAction(api.nylas.actions.fetchRecentEmails);
  const summarizeInbox = useAction(api.emails.summarizeInbox);

  const fetchEmailsAndSummarize = useCallback(async () => {
    setLoading(true);
    try {
      await fetchRecentEmails({ limit: 5, offset: 0 });
      const summaryResult = await summarizeInbox({ emailCount: 5 });
      setSummary(summaryResult.summary);
      
      // Parse the JSON summary
      try {
        const parsed = JSON.parse(summaryResult.summary);
        setStructuredSummary(parsed);
      } catch (e) {
        console.error('Failed to parse summary:', e);
        // Fallback to text display
        setStructuredSummary(null);
      }
    } catch (err) {
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchRecentEmails, summarizeInbox]);

  useEffect(() => {
    if (connectionStatus?.connected && !summary) {
      fetchEmailsAndSummarize().catch(console.error);
    }
  }, [connectionStatus, summary, fetchEmailsAndSummarize]);

  const handleRefresh = () => {
    setSummary(null);
    setStructuredSummary(null);
    fetchEmailsAndSummarize();
  };

  if (!connectionStatus?.connected) {
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

  const getUpdateColor = (type: string, urgency: string) => {
    if (urgency === 'high' || type === 'delay') {
      return 'bg-red-50 border-red-200 text-red-900';
    }
    if (urgency === 'medium' || type === 'approval' || type === 'action') {
      return 'bg-yellow-50 border-yellow-200 text-yellow-900';
    }
    return 'bg-blue-50 border-blue-200 text-blue-900';
  };

  const getIconColor = (type: string, urgency: string) => {
    if (urgency === 'high' || type === 'delay') {
      return 'text-red-600';
    }
    if (urgency === 'medium' || type === 'approval' || type === 'action') {
      return 'text-yellow-600';
    }
    return 'text-blue-600';
  };

  const renderStructuredSummary = () => {
    if (!structuredSummary) return null;

    return (
      <div className="space-y-4">
        {/* Quick Summary */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-sm font-medium text-gray-900">{structuredSummary.quickSummary}</p>
        </div>

        {/* Updates */}
        {structuredSummary.updates && structuredSummary.updates.length > 0 && (
          <div className="space-y-2">
            {structuredSummary.updates.map((update, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border ${getUpdateColor(update.type, update.urgency)}`}
              >
                <div className={`mt-0.5 ${getIconColor(update.type, update.urgency)}`}>
                  {getUpdateIcon(update.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{update.summary}</p>
                  <p className="text-xs opacity-75 mt-1">From: {update.from}</p>
                </div>
              </div>
            ))}
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
              {structuredSummary.actionsNeeded.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 rounded border-gray-300" />
                  <span className="text-sm text-gray-700">{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Empty state - only show if truly no data */}
        {(!structuredSummary.updates || structuredSummary.updates.length === 0) && 
         (!structuredSummary.actionsNeeded || structuredSummary.actionsNeeded.length === 0) && 
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