'use client';

import { useState } from 'react';
import { useAction } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";

interface ConnectEmailProps {
  onConnected?: () => void;
}

export default function ConnectEmail({ onConnected: _onConnected }: ConnectEmailProps) {
  const [loading, setLoading] = useState(false);
  // const [selectedProvider, setSelectedProvider] = useState<'google' | 'microsoft' | null>(null);
  
  const initiateNylasAuth = useAction(api.nylas.actions.initiateNylasAuth);

  const handleConnect = async (provider?: 'google' | 'microsoft') => {
    setLoading(true);
    
    try {
      const redirectUri = `${window.location.origin}/emailsummary/callback`;
      
      const result = await initiateNylasAuth({
        redirectUri,
        provider: provider || undefined,
      });
      
      // Redirect to Nylas OAuth
      window.location.href = result.authUrl;
    } catch (error) {
      console.error('Failed to initiate auth:', error);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-8">
      <div className="max-w-2xl mx-auto text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="h-10 w-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Connect Your Email
        </h2>
        
        <p className="text-gray-600 mb-8">
          Connect your email account to get AI-powered summaries of your recent emails. 
          Your data is encrypted and secure.
        </p>

        {/* Provider Selection */}
        <div className="space-y-4 mb-6">
          <button
            onClick={() => handleConnect('google')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {/* Gmail Icon */}
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#34A853" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="font-medium text-gray-700">Connect with Gmail</span>
          </button>

          <button
            onClick={() => handleConnect('microsoft')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {/* Outlook Icon */}
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#0078D4" d="M24 7.875v8.25l-9 2.625V5.25l9 2.625zM13.5 6.75v10.5L3 19.5V4.5l10.5 2.25zm-6 2.625v5.25l3-.75v-3.75l-3-.75z"/>
            </svg>
            <span className="font-medium text-gray-700">Connect with Outlook</span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <button
            onClick={() => handleConnect()}
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </span>
            ) : (
              'Connect Any Email Provider'
            )}
          </button>
        </div>

        {/* Security Note */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Your data is secure</p>
              <p>
                We use industry-standard encryption to protect your emails. 
                We only read your emails to generate summaries and never store the full content.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}