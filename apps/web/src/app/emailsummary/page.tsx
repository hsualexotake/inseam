'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAction, useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { useAuth } from '@clerk/nextjs';
import ConnectEmail from './components/ConnectEmail';
import EmailSummary from './components/EmailSummary';
import EmailList from './components/EmailList';
import LoadingState from './components/LoadingState';
import type { FormattedEmail, ConnectionStatus } from '@packages/backend/convex/nylas/types';

export default function EmailSummaryPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emails, setEmails] = useState<FormattedEmail[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);

  const connectionStatusData = useQuery(api.emails.getEmailConnection);
  const fetchRecentEmails = useAction(api.nylas.actions.fetchRecentEmails);
  const summarizeInbox = useAction(api.emails.summarizeInbox);
  const disconnectEmail = useAction(api.nylas.actions.disconnectEmail);

  const fetchEmailsAndSummarize = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch emails directly (simplified approach)
      const emailResult = await fetchRecentEmails({ limit: 5, offset: 0 });
      setEmails(emailResult.emails);
      
      // Generate AI summary
      const summaryResult = await summarizeInbox({ emailCount: 5 });
      setSummary(summaryResult.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchRecentEmails, summarizeInbox]);

  // Check authentication and redirect if needed
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // User is not signed in, redirect to sign-in page
      window.location.href = '/sign-in?redirect_url=/emailsummary';
    }
  }, [isLoaded, isSignedIn]);

  // Update connection status from query
  useEffect(() => {
    if (connectionStatusData) {
      // Transform to ConnectionStatus format
      setConnectionStatus({
        connected: true,
        email: connectionStatusData.email,
        provider: connectionStatusData.provider,
        message: 'Email connected'
      });
      
      // If connected and we haven't fetched emails yet
      if (emails.length === 0) {
        // Wrap in error handling to prevent unhandled promise rejection
        fetchEmailsAndSummarize().catch(err => {
          console.error('Auto-fetch failed:', err);
          // Error is already handled in fetchEmailsAndSummarize
        });
      }
    } else if (connectionStatusData === null) {
      // No connection
      setConnectionStatus({
        connected: false,
        message: 'No email account connected'
      });
    }
  }, [connectionStatusData, emails.length, fetchEmailsAndSummarize]);

  const handleEmailConnected = async () => {
    // Fetch emails after connection
    await fetchEmailsAndSummarize();
  };

  const handleRefresh = async () => {
    await fetchEmailsAndSummarize();
  };

  const handleDisconnect = async () => {
    try {
      await disconnectEmail();
      // Clear local state
      setEmails([]);
      setSummary(null);
      setError(null);
      // Connection status will update automatically via the query
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError('Failed to disconnect email account');
    }
  };

  // Show loading while Clerk is loading or redirecting
  if (!isLoaded || !isSignedIn) {
    return <LoadingState message="Loading..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Email Summary</h1>
              <p className="text-gray-600 mt-2">
                AI-powered summary of your recent emails
              </p>
            </div>
            
            {connectionStatus && connectionStatus.connected && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Connected account:</p>
                <p className="font-medium text-gray-900">{connectionStatus.email}</p>
                <p className="text-xs text-gray-500">{connectionStatus.provider}</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        {!connectionStatus?.connected ? (
          <ConnectEmail onConnected={handleEmailConnected} />
        ) : (
          <>
            {/* Action Buttons */}
            <div className="mb-6 flex gap-4">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh Emails'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Disconnect Email
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">Error: {error}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && <LoadingState message="Fetching and summarizing emails..." />}

            {/* Content */}
            {!loading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AI Summary */}
                <div className="lg:col-span-2">
                  <EmailSummary summary={summary} loading={loading} />
                </div>
                
                {/* Email List */}
                <div className="lg:col-span-2">
                  <EmailList emails={emails} loading={loading} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}