'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, EmptyState, Skeleton } from '@/components/ui';

interface LogEntry {
  id: string;
  direction: string;
  body: string;
  deliveryStatus: string;
  createdAt: string;
  providerMessageSid?: string;
}

const STATUS_BADGE: Record<string, string> = {
  delivered: 'success',
  sent: 'default',
  received: 'success',
  failed: 'error',
  queued: 'warning',
};

export function ProviderMessageLog({ provider }: { provider: 'openphone' | 'twilio' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['provider-logs', provider],
    queryFn: async () => {
      const res = await fetch(`/api/settings/messaging-provider/logs?provider=${provider}&limit=30`);
      const json = await res.json().catch(() => ({}));
      return (json.logs || []) as LogEntry[];
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height={48} style={{ borderRadius: 8 }} />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title="No messages yet" description={`Messages sent via ${provider === 'openphone' ? 'OpenPhone' : 'Twilio'} will appear here.`} />;
  }

  return (
    <div className="space-y-1">
      {data.map((log) => (
        <div key={log.id} className="flex items-center gap-3 rounded-lg border border-border-default px-3 py-2 text-sm">
          <span className={`text-xs ${log.direction === 'inbound' ? 'text-status-info-text' : 'text-text-tertiary'}`}>
            {log.direction === 'inbound' ? '\u2b07' : '\u2b06'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-text-primary">{log.body}</p>
          </div>
          <Badge variant={STATUS_BADGE[log.deliveryStatus] as any || 'default'}>
            {log.deliveryStatus}
          </Badge>
          <span className="shrink-0 text-xs text-text-tertiary tabular-nums">
            {new Date(log.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  );
}
