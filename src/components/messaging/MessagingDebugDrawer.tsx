/**
 * Messaging Debug Drawer
 *
 * Owner-only, non-prod only drawer showing MessageDelivery and webhook events
 */

'use client';

import { useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { useAuth } from '@/lib/auth-client';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { z } from 'zod';

const debugDataSchema = z.object({
  deliveries: z.array(z.object({
    id: z.string(),
    createdAt: z.string(),
    direction: z.string(),
    status: z.string(),
    providerMessageSid: z.string().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    fromE164: z.string().nullable(),
    toE164: z.string().nullable(),
    threadId: z.string().nullable(),
    messageId: z.string(),
  })),
  webhookEvents: z.array(z.object({
    messageSid: z.string(),
    fromE164: z.string(),
    toE164: z.string(),
    signatureValid: z.boolean(),
    orgId: z.string(),
    threadId: z.string().nullable(),
    createdAt: z.string(),
  })),
});

function useMessagingDebug() {
  return useQuery({
    queryKey: ['ops', 'messaging-debug'],
    queryFn: () => apiGet('/api/ops/messaging-debug', debugDataSchema),
    enabled: process.env.NODE_ENV !== 'production',
    refetchInterval: 10000, // Refresh every 10s
  });
}

export function MessagingDebugDrawer() {
  const { isOwner } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useMessagingDebug();

  // Owner-only, non-prod only
  if (!isOwner || process.env.NODE_ENV === 'production') {
    return null;
  }

  const handleCopyDiagnostics = () => {
    const diagnostics = {
      deliveries: data?.deliveries || [],
      webhookEvents: data?.webhookEvents || [],
      timestamp: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    alert('Diagnostics JSON copied to clipboard');
  };

  return (
    <div>
      <Button
        variant="tertiary"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full"
      >
        {expanded ? 'Hide' : 'Show'} Messaging Debug
      </Button>

      {expanded && (
        <Card className="mt-2 max-h-[600px] overflow-auto">
          <div className="p-3">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold">
                Messaging Debug (Last 50)
              </h4>
              <Button
                variant="tertiary"
                size="sm"
                onClick={handleCopyDiagnostics}
              >
                Copy JSON
              </Button>
            </div>

            {isLoading ? (
              <div>Loading...</div>
            ) : (
              <>
                {/* MessageDelivery */}
                <div className="mb-4">
                  <h5 className="text-xs font-semibold mb-2">
                    MessageDelivery ({data?.deliveries.length || 0})
                  </h5>
                  <div className="font-mono overflow-x-auto text-[10px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border-default">
                          <th className="text-left p-1">Created</th>
                          <th className="text-left p-1">Direction</th>
                          <th className="text-left p-1">Status</th>
                          <th className="text-left p-1">MessageSid</th>
                          <th className="text-left p-1">From</th>
                          <th className="text-left p-1">To</th>
                          <th className="text-left p-1">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.deliveries.slice(0, 50).map((delivery) => (
                          <tr key={delivery.id} className="border-b border-border-default">
                            <td className="p-1">{new Date(delivery.createdAt).toLocaleTimeString()}</td>
                            <td className="p-1">{delivery.direction}</td>
                            <td className="p-1">
                              <Badge variant={delivery.status === 'sent' || delivery.status === 'delivered' ? 'success' : delivery.status === 'failed' ? 'error' : 'warning'}>
                                {delivery.status}
                              </Badge>
                            </td>
                            <td className="p-1 font-mono text-[9px]">
                              {delivery.providerMessageSid || '-'}
                            </td>
                            <td className="p-1 font-mono text-[9px]">
                              {delivery.fromE164 || '-'}
                            </td>
                            <td className="p-1 font-mono text-[9px]">
                              {delivery.toE164 || '-'}
                            </td>
                            <td className="p-1 text-[9px] text-error">
                              {delivery.errorCode ? `${delivery.errorCode}: ${delivery.errorMessage}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Webhook Events */}
                <div>
                  <h5 className="text-xs font-semibold mb-2">
                    Inbound Webhook Events ({data?.webhookEvents.length || 0})
                  </h5>
                  <div className="font-mono overflow-x-auto text-[10px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border-default">
                          <th className="text-left p-1">Created</th>
                          <th className="text-left p-1">MessageSid</th>
                          <th className="text-left p-1">From</th>
                          <th className="text-left p-1">To</th>
                          <th className="text-left p-1">Signature</th>
                          <th className="text-left p-1">ThreadId</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.webhookEvents.slice(0, 50).map((event, idx) => (
                          <tr key={idx} className="border-b border-border-default">
                            <td className="p-1">{new Date(event.createdAt).toLocaleTimeString()}</td>
                            <td className="p-1 font-mono text-[9px]">{event.messageSid}</td>
                            <td className="p-1 font-mono text-[9px]">{event.fromE164}</td>
                            <td className="p-1 font-mono text-[9px]">{event.toE164}</td>
                            <td className="p-1">
                              <Badge variant={event.signatureValid ? 'success' : 'error'}>
                                {event.signatureValid ? 'Valid' : 'Invalid'}
                              </Badge>
                            </td>
                            <td className="p-1 font-mono text-[9px]">
                              {event.threadId || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
