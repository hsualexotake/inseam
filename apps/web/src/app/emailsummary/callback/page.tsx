'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAction } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('Processing authentication...');
  const [error, setError] = useState<string | null>(null);
  
  const handleNylasCallback = useAction(api.nylas.actions.handleNylasCallback);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Check for OAuth errors
    if (error) {
      setError(`Authentication failed: ${error}`);
      setStatus('');
      // Redirect back to main page after delay
      setTimeout(() => {
        router.push('/emailsummary');
      }, 3000);
      return;
    }
    
    if (!code || !state) {
      setError('Invalid callback parameters');
      setStatus('');
      setTimeout(() => {
        router.push('/emailsummary');
      }, 3000);
      return;
    }
    
    try {
      setStatus('Connecting your email account...');
      
      const result = await handleNylasCallback({ 
        code, 
        state 
      });
      
      if (result.success) {
        setStatus(`Successfully connected ${result.email}!`);
        setError(null);
        
        // Redirect to main page after success
        setTimeout(() => {
          router.push('/emailsummary');
        }, 1500);
      }
    } catch (err: any) {
      console.error('Callback error:', err);
      
      // Check if it's an authentication error
      if (err.message?.toLowerCase().includes('sign in') || 
          err.message?.toLowerCase().includes('authenticate')) {
        setError('Please sign in first');
        setStatus('');
        // Redirect to sign-in with return URL
        setTimeout(() => {
          router.push('/sign-in?redirect_url=/emailsummary');
        }, 1500);
        return;
      }
      
      setError(err.message || 'Failed to connect email account');
      setStatus('');
      
      // Redirect back after error
      setTimeout(() => {
        router.push('/emailsummary');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {status && !error && (
            <>
              {/* Loading spinner */}
              <div className="mb-4 flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {status}
              </h2>
              <p className="text-gray-600">
                Please wait while we complete the connection...
              </p>
            </>
          )}
          
          {error && (
            <>
              {/* Error icon */}
              <div className="mb-4 flex justify-center">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connection Failed
              </h2>
              <p className="text-red-600 mb-4">
                {error}
              </p>
              <p className="text-gray-600 text-sm">
                Redirecting you back...
              </p>
            </>
          )}
          
          {status && status.includes('Successfully') && (
            <>
              {/* Success icon */}
              <div className="mb-4 flex justify-center">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {status}
              </h2>
              <p className="text-gray-600 text-sm">
                Redirecting to your email summary...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}