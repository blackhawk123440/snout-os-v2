"use client";

/**
 * Proof Page - Runtime Verification
 *
 * Owner-only page that proves:
 * 1. Web→API wiring (shows resolved API base URL and makes direct calls)
 * 2. Worker execution (triggers job and shows audit event)
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api/client';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ProofResult {
  endpoint: string;
  fullUrl: string;
  status: 'pending' | 'pass' | 'fail';
  statusCode?: number;
  error?: string;
  responseTime?: number;
  data?: any;
}

interface WorkerProof {
  found: boolean;
  event?: {
    id: string;
    eventType: string;
    timestamp: string;
    jobId: string;
    bullmqJobId: string;
    payload: any;
  };
  message?: string;
}

export default function ProofPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [results, setResults] = useState<ProofResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [workerProof, setWorkerProof] = useState<WorkerProof | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');

  // Redirect if not owner
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    if ((session.user as any)?.sitterId) {
      router.push('/sitter/inbox');
      return;
    }
  }, [session, sessionStatus, router]);

  // Get resolved API base URL
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    setApiBaseUrl(baseUrl);

    // Load latest worker proof
    if (baseUrl && session) {
      loadLatestProof();
    }
  }, [session]);

  const loadLatestProof = async () => {
    try {
      const response = await apiGet<WorkerProof>('/api/ops/proof/latest');
      setWorkerProof(response);
    } catch (error: any) {
      console.error('Failed to load proof:', error);
    }
  };

  const testEndpoint = async (
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
  ): Promise<ProofResult> => {
    const startTime = Date.now();
    const fullUrl = `${apiBaseUrl}${endpoint}`;

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });

      const responseTime = Date.now() - startTime;
      const contentType = response.headers.get('content-type');
      let data: any = null;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        endpoint,
        fullUrl,
        status: response.ok ? 'pass' : 'fail',
        statusCode: response.status,
        responseTime,
        data: response.ok ? data : null,
        error: response.ok ? undefined : `Status ${response.status}: ${data?.error || data?.message || 'Unknown error'}`,
      };
    } catch (error: any) {
      return {
        endpoint,
        fullUrl,
        status: 'fail',
        error: error.message || 'Network error',
        responseTime: Date.now() - startTime,
      };
    }
  };

  const runApiTests = async () => {
    setLoading(true);
    setResults([]);

    const tests: Array<{ endpoint: string; method?: 'GET' | 'POST' }> = [
      { endpoint: '/health', method: 'GET' },
      { endpoint: '/api/messages/threads', method: 'GET' },
    ];

    const testResults: ProofResult[] = [];

    for (const test of tests) {
      const result = await testEndpoint(test.endpoint, test.method || 'GET');
      testResults.push(result);
      setResults([...testResults]);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setLoading(false);
  };

  const triggerWorkerProof = async () => {
    setTriggering(true);
    try {
      await apiPost('/api/ops/proof/trigger', {});

      // Poll for the audit event (worker should process within seconds)
      let attempts = 0;
      const maxAttempts = 20; // 10 seconds max
      const triggerTime = Date.now();

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadLatestProof();

        if (workerProof?.found && workerProof.event) {
          const eventTime = new Date(workerProof.event.timestamp).getTime();
          // Check if event is recent (within last 30 seconds)
          if (triggerTime - eventTime < 30000) {
            break;
          }
        }
        attempts++;
      }

      // Final refresh
      await loadLatestProof();
    } catch (error: any) {
      console.error('Failed to trigger proof:', error);
      alert(`Failed to trigger proof: ${error.message}`);
    } finally {
      setTriggering(false);
    }
  };

  if (sessionStatus === 'loading') {
    return <div className="p-8">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  const allPassed = results.length > 0 && results.every(r => r.status === 'pass');

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <h1 className="text-[2rem] mb-4">System Verification</h1>

      {/* API Base URL */}
      <div className="bg-neutral-100 p-4 rounded-lg mb-8">
        <h2 className="text-xl mb-2">Resolved API Base URL</h2>
        <div className="font-mono text-base font-bold text-[#0070f3]">
          {apiBaseUrl || '(not set)'}
        </div>
        {apiBaseUrl && (
          <div className="text-sm text-neutral-500 mt-2">
            All API calls will use this base URL
          </div>
        )}
      </div>

      {/* API Tests */}
      <div className="mb-8">
        <h2 className="text-2xl mb-4">API Connectivity</h2>
        <button
          onClick={runApiTests}
          disabled={loading || !apiBaseUrl}
          style={{
            backgroundColor: loading || !apiBaseUrl ? '#ccc' : '#0070f3',
            cursor: loading || !apiBaseUrl ? 'not-allowed' : 'pointer',
          }}
          className="py-3 px-6 text-base text-white border-none rounded-md mb-4"
        >
          {loading ? 'Running Tests...' : 'Test API Calls'}
        </button>

        {results.length > 0 && (
          <div className="grid gap-4">
            {results.map((result, idx) => (
              <div
                key={idx}
                style={{
                  border: `2px solid ${result.status === 'pass' ? '#22c55e' : result.status === 'fail' ? '#ef4444' : '#e5e7eb'}`,
                  backgroundColor: result.status === 'pass' ? '#f0fdf4' : result.status === 'fail' ? '#fef2f2' : '#f9fafb',
                }}
                className="rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-2xl">
                    {result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏳'}
                  </span>
                  <strong>{result.endpoint}</strong>
                  {result.statusCode && (
                    <span
                      style={{
                        backgroundColor: result.statusCode === 200 ? '#22c55e' : result.statusCode === 401 ? '#f59e0b' : '#ef4444',
                      }}
                      className="py-1 px-2 rounded text-white text-sm"
                    >
                      {result.statusCode}
                    </span>
                  )}
                  {result.responseTime && (
                    <span className="text-sm text-neutral-500">
                      {result.responseTime}ms
                    </span>
                  )}
                </div>
                <div className="font-mono text-sm text-neutral-500 mt-2 break-all">
                  <strong>Full URL:</strong> {result.fullUrl}
                </div>
                {result.error && (
                  <div className="text-error font-mono text-sm mt-2">
                    Error: {result.error}
                  </div>
                )}
                {result.data && result.status === 'pass' && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-neutral-500">
                      View Response
                    </summary>
                    <pre className="mt-2 p-2 bg-neutral-50 rounded overflow-auto text-xs max-h-[200px]">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Worker Proof */}
      <div className="mb-8">
        <h2 className="text-2xl mb-4">Worker Execution Proof</h2>
        <button
          onClick={triggerWorkerProof}
          disabled={triggering || !apiBaseUrl}
          style={{
            backgroundColor: triggering || !apiBaseUrl ? '#ccc' : '#10b981',
            cursor: triggering || !apiBaseUrl ? 'not-allowed' : 'pointer',
          }}
          className="py-3 px-6 text-base text-white border-none rounded-md mb-4"
        >
          {triggering ? 'Triggering...' : 'Trigger Worker Proof'}
        </button>

        {workerProof && (
          <div
            style={{
              border: `2px solid ${workerProof.found ? '#22c55e' : '#f59e0b'}`,
              backgroundColor: workerProof.found ? '#f0fdf4' : '#fef3c7',
            }}
            className="rounded-lg p-4"
          >
            {workerProof.found && workerProof.event ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">✅</span>
                  <strong>Worker Proof Found</strong>
                </div>
                <div className="font-mono text-sm mt-2">
                  <div><strong>Event ID:</strong> {workerProof.event.id}</div>
                  <div><strong>Event Type:</strong> {workerProof.event.eventType}</div>
                  <div><strong>Timestamp:</strong> {workerProof.event.timestamp}</div>
                  <div><strong>Job ID:</strong> {workerProof.event.jobId}</div>
                  <div><strong>BullMQ Job ID:</strong> {workerProof.event.bullmqJobId}</div>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-neutral-500">
                    View Payload
                  </summary>
                  <pre className="mt-2 p-2 bg-neutral-50 rounded overflow-auto text-xs max-h-[200px]">
                    {JSON.stringify(workerProof.event.payload, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              <div>
                <span className="text-2xl">⏳</span>
                <strong> {workerProof.message || 'No proof events found. Trigger a proof job first.'}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      {results.length > 0 && (
        <div
          style={{
            backgroundColor: allPassed ? '#f0fdf4' : '#fef2f2',
            border: `2px solid ${allPassed ? '#22c55e' : '#ef4444'}`,
          }}
          className="p-4 rounded-lg"
        >
          <h3 className="text-xl mb-2">
            {allPassed ? '✅ All API Tests Passed' : '❌ Some Tests Failed'}
          </h3>
          <div className="text-sm text-neutral-500">
            API Base URL: <code>{apiBaseUrl}</code>
            <br />
            All requests are made directly to the API service, not through Next.js API routes.
          </div>
        </div>
      )}
    </div>
  );
}
