/**
 * Proof Runner Button
 * 
 * One-click proof runner that automatically verifies all messaging features
 * and displays results in a visible panel.
 */

'use client';

import { useState } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';

interface ProofResult {
  check: string;
  status: 'pass' | 'fail' | 'pending';
  url?: string;
  statusCode?: number;
  responseSize?: number;
  error?: string;
}

export function ProofRunnerButton() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProofResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const runProof = async () => {
    setRunning(true);
    setResults([]);
    setShowResults(true);

    const newResults: ProofResult[] = [];

    // 1. Seed proof scenarios
    newResults.push({ check: 'Seed proof scenarios', status: 'pending' });
    setResults([...newResults]);
    try {
      const seedRes = await fetch('/api/messages/seed-proof', { method: 'POST' });
      const seedData = await seedRes.json();
      newResults[0] = {
        check: 'Seed proof scenarios',
        status: seedRes.ok ? 'pass' : 'fail',
        url: '/api/messages/seed-proof',
        statusCode: seedRes.status,
        responseSize: JSON.stringify(seedData).length,
        error: seedRes.ok ? undefined : seedData.error || 'Unknown error',
      };
    } catch (error: any) {
      newResults[0] = {
        check: 'Seed proof scenarios',
        status: 'fail',
        url: '/api/messages/seed-proof',
        error: error.message,
      };
    }
    setResults([...newResults]);

    // Wait a moment for seed to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Get threads
    newResults.push({ check: 'Get threads list', status: 'pending' });
    setResults([...newResults]);
    try {
      const threadsRes = await fetch('/api/messages/threads');
      const threadsData = await threadsRes.json();
      const threads = threadsData.items || threadsData.threads || threadsData || [];
      newResults[1] = {
        check: 'Get threads list',
        status: threadsRes.ok && threads.length > 0 ? 'pass' : 'fail',
        url: '/api/messages/threads',
        statusCode: threadsRes.status,
        responseSize: JSON.stringify(threadsData).length,
        error: threadsRes.ok && threads.length === 0 ? 'No threads found' : !threadsRes.ok ? 'Request failed' : undefined,
      };

      // 3. Get messages for first thread
      if (threads.length > 0) {
        const threadId = threads[0].id;
        newResults.push({ check: 'Get thread messages', status: 'pending' });
        setResults([...newResults]);
        try {
          const messagesRes = await fetch(`/api/messages/threads/${threadId}/messages`);
          const messagesData = await messagesRes.json();
          const messages = messagesData.items || messagesData.messages || messagesData || [];
          newResults[2] = {
            check: 'Get thread messages',
            status: messagesRes.ok ? 'pass' : 'fail',
            url: `/api/messages/threads/${threadId}/messages`,
            statusCode: messagesRes.status,
            responseSize: JSON.stringify(messagesData).length,
            error: !messagesRes.ok ? 'Request failed' : undefined,
          };

          // 4. Get routing history
          newResults.push({ check: 'Get routing history', status: 'pending' });
          setResults([...newResults]);
          try {
            const routingRes = await fetch(`/api/routing/threads/${threadId}/history`);
            newResults[3] = {
              check: 'Get routing history',
              status: routingRes.ok ? 'pass' : 'fail',
              url: `/api/routing/threads/${threadId}/history`,
              statusCode: routingRes.status,
              responseSize: routingRes.headers.get('content-length') ? parseInt(routingRes.headers.get('content-length')!) : undefined,
              error: !routingRes.ok ? 'Request failed' : undefined,
            };
          } catch (error: any) {
            newResults[3] = {
              check: 'Get routing history',
              status: 'fail',
              url: `/api/routing/threads/${threadId}/history`,
              error: error.message,
            };
          }

          // 5. Retry failed message (if exists)
          const failedMessage = messages.find((m: any) => m.deliveryStatus === 'failed');
          if (failedMessage) {
            newResults.push({ check: 'Retry failed message', status: 'pending' });
            setResults([...newResults]);
            try {
              const retryRes = await fetch(`/api/messages/${failedMessage.id}/retry`, { method: 'POST' });
              const retryData = await retryRes.json();
              newResults[4] = {
                check: 'Retry failed message',
                status: retryRes.ok ? 'pass' : 'fail',
                url: `/api/messages/${failedMessage.id}/retry`,
                statusCode: retryRes.status,
                responseSize: JSON.stringify(retryData).length,
                error: !retryRes.ok ? retryData.error || 'Request failed' : undefined,
              };
            } catch (error: any) {
              newResults[4] = {
                check: 'Retry failed message',
                status: 'fail',
                url: `/api/messages/${failedMessage.id}/retry`,
                error: error.message,
              };
            }
          }
        } catch (error: any) {
          newResults[2] = {
            check: 'Get thread messages',
            status: 'fail',
            error: error.message,
          };
        }
      }
    } catch (error: any) {
      newResults[1] = {
        check: 'Get threads list',
        status: 'fail',
        url: '/api/messages/threads',
        error: error.message,
      };
    }

    setResults([...newResults]);
    setRunning(false);
  };

  if (!showResults && results.length === 0) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={runProof}
        disabled={running}
        style={{ width: '100%' }}
      >
        {running ? 'Running Proof...' : 'Run Messaging Proof'}
      </Button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
      <Button
        variant="secondary"
        size="sm"
        onClick={runProof}
        disabled={running}
        style={{ width: '100%' }}
      >
        {running ? 'Running Proof...' : 'Run Messaging Proof'}
      </Button>

      {showResults && (
        <Card style={{ padding: tokens.spacing[3], maxHeight: '400px', overflowY: 'auto' }}>
          <div style={{ fontSize: tokens.typography.fontSize.sm[0], fontWeight: tokens.typography.fontWeight.semibold, marginBottom: tokens.spacing[2] }}>
            Proof Results
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
            {results.map((result, idx) => (
              <div
                key={idx}
                style={{
                  padding: tokens.spacing[2],
                  backgroundColor: result.status === 'pass' ? tokens.colors.success[50] : result.status === 'fail' ? tokens.colors.error[50] : tokens.colors.neutral[50],
                  borderRadius: tokens.borderRadius.sm,
                  border: `1px solid ${result.status === 'pass' ? tokens.colors.success[200] : result.status === 'fail' ? tokens.colors.error[200] : tokens.colors.border.default}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2], marginBottom: tokens.spacing[1] }}>
                  <Badge variant={result.status === 'pass' ? 'success' : result.status === 'fail' ? 'error' : 'neutral'}>
                    {result.status === 'pending' ? '...' : result.status === 'pass' ? 'PASS' : 'FAIL'}
                  </Badge>
                  <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>{result.check}</span>
                </div>
                {result.url && (
                  <div style={{ fontSize: tokens.typography.fontSize.xs[0], fontFamily: 'monospace', color: tokens.colors.text.secondary, marginTop: tokens.spacing[1] }}>
                    {result.url}
                  </div>
                )}
                {result.statusCode && (
                  <div style={{ fontSize: tokens.typography.fontSize.xs[0], marginTop: tokens.spacing[1] }}>
                    Status: <Badge variant={result.statusCode >= 400 ? 'error' : 'success'}>{result.statusCode}</Badge>
                    {result.responseSize && <span style={{ marginLeft: tokens.spacing[2] }}>Size: {result.responseSize} bytes</span>}
                  </div>
                )}
                {result.error && (
                  <div style={{ fontSize: tokens.typography.fontSize.xs[0], color: tokens.colors.error[600], marginTop: tokens.spacing[1] }}>
                    Error: {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
