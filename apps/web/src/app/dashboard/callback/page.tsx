'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useAction } from 'convex/react';
import { api } from '@packages/backend/convex/_generated/api';

export default function DashboardCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing email connection...');

  const handleNylasCallback = useAction(api.nylas.actions.handleNylasCallback);

  useEffect(() => {
    const processCallback = async () => {
      // Get URL parameters
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Get return URL from session storage
      const returnUrl = sessionStorage.getItem('nylas_return_url');

      // Handle OAuth errors
      if (error) {
        console.error('OAuth error:', error, errorDescription);
        setStatus('error');
        setMessage(errorDescription || 'Failed to connect email account');

        // Redirect after delay
        setTimeout(() => {
          router.push(returnUrl || '/dashboard');
        }, 3000);
        return;
      }

      // Ensure we have required parameters
      if (!code || !state) {
        console.error('Missing required OAuth parameters');
        setStatus('error');
        setMessage('Invalid callback parameters');

        setTimeout(() => {
          router.push(returnUrl || '/dashboard');
        }, 3000);
        return;
      }

      try {
        // Exchange code for grant
        const result = await handleNylasCallback({
          code,
          state,
        });

        if (result.success) {
          setStatus('success');
          setMessage(`Email ${result.email} connected successfully!`);

          // Clear session storage
          sessionStorage.removeItem('nylas_return_url');

          // Redirect to dashboard
          setTimeout(() => {
            router.push(returnUrl || '/dashboard');
          }, 1500);
        } else {
          throw new Error('Failed to connect email');
        }
      } catch (error) {
        console.error('Callback processing error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to connect email account');

        // Redirect after delay
        setTimeout(() => {
          router.push(returnUrl || '/dashboard');
        }, 3000);
      }
    };

    // Only process if user is authenticated
    if (isLoaded && isSignedIn) {
      processCallback();
    } else if (isLoaded && !isSignedIn) {
      // Redirect to sign in if not authenticated
      router.push('/sign-in?redirect_url=/dashboard');
    }
  }, [searchParams, router, isLoaded, isSignedIn, handleNylasCallback]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Connecting Your Email
              </h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-green-100 rounded-full">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Success!
              </h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500 mt-2">Redirecting to dashboard...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-red-100 rounded-full">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Connection Failed
              </h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500 mt-2">Redirecting to dashboard...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}