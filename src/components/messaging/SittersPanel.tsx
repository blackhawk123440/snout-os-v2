/**
 * Sitters Panel - Embedded in Messages tab
 *
 * Owner can view sitter list, status, and filter threads by sitter
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Table, TableColumn, EmptyState, Skeleton } from '@/components/ui';
import { Users } from 'lucide-react';
import { useSitters } from '@/lib/api/numbers-hooks';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { z } from 'zod';

const windowSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  sitterId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.string(),
  thread: z.object({
    id: z.string(),
    client: z.object({
      id: z.string(),
      name: z.string(),
    }),
  }),
});

function useSitterWindows(sitterId: string | null) {
  return useQuery({
    queryKey: ['sitter', sitterId, 'windows'],
    queryFn: () => apiGet(`/api/assignments/windows?sitterId=${sitterId}`, z.array(windowSchema)),
    enabled: !!sitterId,
  });
}

export function SittersPanel() {
  const router = useRouter();
  const { data: sitters = [], isLoading } = useSitters();
  const [selectedSitterId, setSelectedSitterId] = useState<string | null>(null);
  const { data: windows = [] } = useSitterWindows(selectedSitterId);

  const activeWindows = windows.filter((w: any) => w.status === 'active');
  const futureWindows = windows.filter((w: any) => w.status === 'future');
  const pastWindows = windows.filter((w: any) => w.status === 'past');

  const sitterColumns: TableColumn<any>[] = [
    {
      key: 'name',
      header: 'Sitter Name',
      render: (s) => s.name && s.name !== s.id ? s.name : 'Unknown Sitter'
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => {
        const activeCount = activeWindows.filter((w: any) => w.sitterId === s.id).length;
        return (
          <div className="flex gap-2 items-center">
            <Badge variant={activeCount > 0 ? 'success' : 'default'}>
              {activeCount > 0 ? `${activeCount} active` : 'Inactive'}
            </Badge>
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) => (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedSitterId(s.id);
            }}
          >
            View Threads
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => {
              router.push(`/messages?tab=inbox&sitterId=${s.id}`);
            }}
          >
            Open Inbox View
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <Skeleton height={400} />;
  }

  if (sitters.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No sitters found"
          description="No sitters exist in this org yet. Add sitters in Bookings → Sitters Management."
          icon={<Users className="w-12 h-12 text-neutral-300" />}
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold mb-2">
          Sitters
        </h2>
        <p className="text-text-secondary text-sm">
          View sitter list, status, and threads. Click "View Threads" to see a sitter's active assignments.
        </p>
      </div>

      <Card className="mb-4">
        <Table data={sitters} columns={sitterColumns} />
      </Card>

      {selectedSitterId && (
        <Card>
          <div className="mb-3">
            <h3 className="text-lg font-semibold">
              {(() => { const s = sitters.find((s: any) => s.id === selectedSitterId); return s?.name && s.name !== s.id ? s.name : 'Sitter'; })()} &mdash; Assignment Windows
            </h3>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setSelectedSitterId(null)}
              className="mt-2"
            >
              Close
            </Button>
          </div>

          {activeWindows.length > 0 && (
            <div className="mb-4">
              <h4 className="text-base font-medium mb-2">
                Active Windows ({activeWindows.length})
              </h4>
              <div className="flex flex-col gap-2">
                {activeWindows.map((w: any) => (
                  <div
                    key={w.id}
                    className="p-3 border border-border-default rounded-sm bg-status-success-bg"
                  >
                    <div className="font-medium">
                      {w.thread.client.name}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {new Date(w.startsAt).toLocaleString()} - {new Date(w.endsAt).toLocaleString()}
                    </div>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => router.push(`/messages?tab=inbox&thread=${w.threadId}`)}
                      className="mt-2"
                    >
                      Open Thread
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {futureWindows.length > 0 && (
            <div className="mb-4">
              <h4 className="text-base font-medium mb-2">
                Future Windows ({futureWindows.length})
              </h4>
              <div className="flex flex-col gap-2">
                {futureWindows.map((w: any) => (
                  <div
                    key={w.id}
                    className="p-3 border border-border-default rounded-sm"
                  >
                    <div className="font-medium">
                      {w.thread.client.name}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {new Date(w.startsAt).toLocaleString()} - {new Date(w.endsAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastWindows.length > 0 && (
            <div>
              <h4 className="text-base font-medium mb-2">
                Past Windows ({pastWindows.length})
              </h4>
              <div className="flex flex-col gap-2">
                {pastWindows.slice(0, 5).map((w: any) => (
                  <div
                    key={w.id}
                    className="p-3 border border-border-default rounded-sm opacity-70"
                  >
                    <div className="font-medium">
                      {w.thread.client.name}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {new Date(w.startsAt).toLocaleString()} - {new Date(w.endsAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {pastWindows.length > 5 && (
                  <div className="text-sm text-text-secondary">
                    ... and {pastWindows.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}

          {activeWindows.length === 0 && futureWindows.length === 0 && pastWindows.length === 0 && (
            <EmptyState
              title="No assignment windows"
              description="This sitter has no assignment windows yet"
            />
          )}
        </Card>
      )}
    </div>
  );
}
