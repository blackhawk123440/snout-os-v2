/**
 * Diagnostics Panel for Messaging
 *
 * Dev + owner-only panel that shows exactly why threads aren't showing.
 * Provides actionable diagnostics for troubleshooting.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { useAuth } from '@/lib/auth-client';
import { isMessagingEnabled } from '@/lib/flags';
import { ProofRunnerButton } from './ProofRunnerButton';
import { MessagingDebugDrawer } from './MessagingDebugDrawer';

interface DiagnosticsPanelProps {
  threadsCount: number;
  threadsLoading: boolean;
  threadsError: Error | null;
  lastFetchUrl?: string;
  lastFetchStatus?: number;
  lastFetchResponseSize?: number;
  onSeed?: () => Promise<void>;
}

export function DiagnosticsPanel({
  threadsCount,
  threadsLoading,
  threadsError,
  lastFetchUrl,
  lastFetchStatus,
  lastFetchResponseSize,
  onSeed,
}: DiagnosticsPanelProps) {
  const { user, isOwner } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  const [userInfo, setUserInfo] = useState<{ email?: string; role?: string } | null>(null);

  // Get actual resolved API base URL from client (same logic as apiRequest in client.ts)
  useEffect(() => {
    // Use NEXT_PUBLIC_API_URL if set, otherwise empty (relative URLs)
    const resolvedUrl = process.env.NEXT_PUBLIC_API_URL || '';
    setApiBaseUrl(resolvedUrl || '(relative - same origin)');
  }, []);

  // Get user info from NextAuth session (already available via useAuth hook)
  useEffect(() => {
    if (user) {
      setUserInfo({ email: user.email, role: user.role });
    }
  }, [user]);

  // Always show to owners (dev + staging) - check AFTER all hooks
  if (!isOwner) {
    return null;
  }

  const messagingFlag = isMessagingEnabled();
  const messagingFlagValue = process.env.NEXT_PUBLIC_ENABLE_MESSAGING_V1 || 'false';

  // Determine issue with precise error categorization
  let issue: string | null = null;
  let issueSeverity: 'error' | 'warning' | 'info' = 'info';

  if (!messagingFlag) {
    issue = 'Messaging flag is OFF';
    issueSeverity = 'error';
  } else if (threadsError || lastFetchStatus) {
    // Precise error categorization
    if (lastFetchStatus === 401 || lastFetchStatus === 403) {
      issue = 'JWT/auth mismatch: You\'re not logged in to API / JWT missing';
      issueSeverity = 'error';
    } else if (lastFetchStatus === 404) {
      issue = 'Wrong API base URL or route not deployed: /api/messages/threads not found';
      issueSeverity = 'error';
    } else if (lastFetchStatus && lastFetchStatus >= 500) {
      issue = 'API down: Server error (5xx)';
      issueSeverity = 'error';
    } else if (threadsError) {
      issue = `API Error: ${threadsError.message}`;
      issueSeverity = 'error';
    }
  } else if (!threadsLoading && threadsCount === 0 && messagingFlag) {
    issue = 'DB empty — seed required';
    issueSeverity = 'warning';
  } else if (threadsLoading) {
    issue = 'Loading threads...';
    issueSeverity = 'info';
  }

  const borderColor = issueSeverity === 'error'
    ? tokens.colors.error[500]
    : issueSeverity === 'warning'
      ? tokens.colors.warning[500]
      : tokens.colors.info[500];

  const statusColor = messagingFlag ? tokens.colors.success[600] : tokens.colors.error[600];

  return (
    <div className="fixed bottom-5 right-5 z-[1000] max-w-[400px]">
      <Card
        className="bg-surface-primary shadow-lg"
        style={{ border: `2px solid ${borderColor}` }}
      >
        <div className="p-3">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <strong className="text-sm">Ops / Diagnostics</strong>
              {issue && (
                <Badge
                  variant={issueSeverity === 'error' ? 'error' : issueSeverity === 'warning' ? 'warning' : 'info'}
                  className="text-xs"
                >
                  {issueSeverity === 'error' ? 'ERROR' : issueSeverity === 'warning' ? 'WARNING' : 'INFO'}
                </Badge>
              )}
            </div>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide' : 'Show'}
            </Button>
          </div>

          {expanded && (
            <div className="flex flex-col gap-3 text-xs">
              {/* Feature Flag */}
              <div>
                <div className="font-semibold mb-1">
                  Feature Flag:
                </div>
                <div className="font-mono" style={{ color: statusColor }}>
                  NEXT_PUBLIC_ENABLE_MESSAGING_V1 = {messagingFlagValue}
                </div>
                {!messagingFlag && (
                  <div className="mt-1 text-error">
                    Set to 'true' to enable messaging
                  </div>
                )}
              </div>

              {/* API URL */}
              <div>
                <div className="font-semibold mb-1">
                  API Base URL (resolved):
                </div>
                <div className="font-mono break-all">
                  {apiBaseUrl}
                </div>
                <div className="mt-1 text-text-tertiary text-[10px]">
                  Raw: {process.env.NEXT_PUBLIC_API_URL || 'not set'}
                </div>
              </div>

              {/* User Info */}
              <div>
                <div className="font-semibold mb-1">
                  User (from session):
                </div>
                <div>
                  {userInfo?.email || user?.email || 'Not logged in'} ({userInfo?.role || user?.role || 'unknown'})
                </div>
              </div>

              {/* Last Fetch */}
              {lastFetchUrl && (
                <div>
                  <div className="font-semibold mb-1">
                    Last Fetch:
                  </div>
                  <div className="font-mono break-all text-[10px]">
                    {lastFetchUrl}
                  </div>
                  {lastFetchStatus && (
                    <div className="mt-1">
                      Status: <Badge variant={lastFetchStatus >= 400 ? 'error' : 'success'}>{lastFetchStatus}</Badge>
                      {lastFetchResponseSize !== undefined && (
                        <span className="ml-2">
                          Size: {lastFetchResponseSize} bytes
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error Details */}
              {threadsError && (
                <div>
                  <div className="font-semibold mb-1 text-error">
                    Error:
                  </div>
                  <div className="font-mono break-words text-[10px] text-error">
                    {threadsError.message}
                  </div>
                  {process.env.NODE_ENV === 'development' && threadsError.stack && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[10px]">Stack Trace</summary>
                      <pre className="overflow-auto max-h-[200px] mt-1 text-[9px]">
                        {threadsError.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Thread Count */}
              <div>
                <div className="font-semibold mb-1">
                  Threads:
                </div>
                <div>
                  {threadsLoading ? 'Loading...' : `${threadsCount} found`}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {issue === 'DB empty — seed required' && onSeed && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={onSeed}
                    className="w-full"
                  >
                    Create Demo Data
                  </Button>
                )}
                <MessagingDebugDrawer />
                <ProofRunnerButton />
              </div>

              {/* Help Text */}
              <div className="p-2 rounded-sm bg-neutral-50 text-[10px]">
                <div className="font-semibold mb-1">
                  Troubleshooting:
                </div>
                <ul className="m-0 pl-3">
                  {!messagingFlag && (
                    <li>Set NEXT_PUBLIC_ENABLE_MESSAGING_V1=true in .env.local (local) or Render env (staging)</li>
                  )}
                  {lastFetchStatus === 401 && (
                    <li>Check JWT token in localStorage. Try logging out and back in.</li>
                  )}
                  {lastFetchStatus === 404 && (
                    <li>Verify API base URL is correct. Check that /api/messages/threads route exists.</li>
                  )}
                  {threadsCount === 0 && !threadsLoading && (
                    <li>Database is empty. Click "Create Demo Data" above or run: npx tsx scripts/seed-messaging-data.ts</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
