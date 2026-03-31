/**
 * Automation type editor - /automations/[id]
 * Edit one automation type: enabled, sendTo*, message templates. Test message.
 * id = bookingConfirmation | nightBeforeReminder | paymentReminder | sitterAssignment | postVisitThankYou | ownerNewBookingAlert
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Textarea,
  Skeleton,
  Flex,
} from '@/components/ui';
import { OwnerAppShell } from '@/components/layout';
import { AppErrorState } from '@/components/app';
import { AUTOMATION_TYPE_IDS, type AutomationTypeId } from '@/lib/automations/types';

const TYPE_META: Record<
  AutomationTypeId,
  { name: string; description: string; recipients: ('client' | 'sitter' | 'owner')[] }
> = {
  bookingConfirmation: {
    name: 'Booking Confirmation',
    description: 'Sends confirmation when a booking is confirmed',
    recipients: ['client', 'sitter', 'owner'],
  },
  nightBeforeReminder: {
    name: 'Night Before Reminder',
    description: 'Sends reminders the night before appointments',
    recipients: ['client', 'sitter', 'owner'],
  },
  paymentReminder: {
    name: 'Payment Reminder',
    description: 'Sends payment reminders to clients',
    recipients: ['client', 'owner'],
  },
  sitterAssignment: {
    name: 'Sitter Assignment',
    description: 'Notifies sitters and owners when a sitter is assigned',
    recipients: ['sitter', 'owner', 'client'],
  },
  postVisitThankYou: {
    name: 'Post Visit Thank You',
    description: 'Sends thank you messages after visits',
    recipients: ['client', 'sitter'],
  },
  ownerNewBookingAlert: {
    name: 'Owner New Booking Alert',
    description: 'Alerts owner when a new booking is created',
    recipients: ['client', 'owner'],
  },
  checkinNotification: {
    name: 'Check-In Notification',
    description: 'Notifies client and owner when sitter starts a visit',
    recipients: ['client', 'owner'],
  },
  checkoutNotification: {
    name: 'Check-Out Notification',
    description: 'Notifies client and owner when sitter ends a visit',
    recipients: ['client', 'owner'],
  },
  bookingCancellation: {
    name: 'Booking Cancellation',
    description: 'Notifies all parties when a booking is cancelled',
    recipients: ['client', 'sitter', 'owner'],
  },
  visitReportNotification: {
    name: 'Visit Report Notification',
    description: 'Notifies client when sitter submits a visit report',
    recipients: ['client'],
  },
};

const RECIPIENT_LABEL: Record<'client' | 'sitter' | 'owner', string> = {
  client: 'Client',
  sitter: 'Sitter',
  owner: 'Owner',
};

const TEMPLATE_KEYS: Record<'client' | 'sitter' | 'owner', string> = {
  client: 'messageTemplateClient',
  sitter: 'messageTemplateSitter',
  owner: 'messageTemplateOwner',
};

export default function AutomationTypeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params.id as string) || '';
  const validId = id && AUTOMATION_TYPE_IDS.includes(id as AutomationTypeId);
  const typeId = validId ? (id as AutomationTypeId) : null;

  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [block, setBlock] = useState<Record<string, unknown>>({});
  const [blockInit, setBlockInit] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);

  const { data: blockData, isLoading: loading, error: loadError, refetch } = useQuery({
    queryKey: ['automations', typeId],
    queryFn: async () => {
      const res = await fetch(`/api/automations/${typeId}`);
      if (!res.ok) throw new Error('Failed to load automation');
      return res.json();
    },
    enabled: !!typeId,
  });

  useEffect(() => {
    if (blockData && !blockInit) {
      setBlock(blockData);
      setBlockInit(true);
    }
  }, [blockData, blockInit]);

  useEffect(() => {
    if (!typeId) router.replace('/automations');
  }, [typeId, router]);

  const update = (updates: Record<string, unknown>) => {
    setBlock((prev) => ({ ...prev, ...updates }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!typeId) throw new Error('Invalid automation type');
      const res = await fetch(`/api/automations/${typeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: (data) => {
      setBlock(data);
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  const handleSave = () => saveMutation.mutate();

  const handleTest = async (template: string) => {
    if (!template?.trim()) {
      setTestError('Enter a template to test');
      return;
    }
    if (!testPhone.trim()) {
      setTestError('Enter a phone number');
      return;
    }
    setTestError(null);
    setTestSuccess(false);
    setTesting(true);
    try {
      const res = await fetch('/api/automations/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: template.trim(), phoneNumber: testPhone.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTestSuccess(true);
        setTimeout(() => setTestSuccess(false), 3000);
      } else {
        setTestError(data.error || 'Send failed');
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setTesting(false);
    }
  };

  if (!typeId) return null;

  const meta = TYPE_META[typeId];

  if (loading) {
    return (
      <OwnerAppShell>
        <PageHeader title="Edit automation" />
        <div className="p-6">
          <Skeleton height={400} />
        </div>
      </OwnerAppShell>
    );
  }

  if (loadError) {
    return (
      <OwnerAppShell>
        <AppErrorState title="Couldn't load automation" subtitle={loadError instanceof Error ? loadError.message : 'Unable to load'} onRetry={() => void refetch()} />
      </OwnerAppShell>
    );
  }

  return (
    <OwnerAppShell>
      <PageHeader
        title={meta.name}
        description={meta.description}
        actions={
          <>
            <Link href="/automations">
              <Button variant="secondary">Back</Button>
            </Link>
            <Button variant="primary" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      <div className="p-6 max-w-[720px]">
        <Card className="mb-4">
          <div className="p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!block.enabled}
                onChange={(e) => update({ enabled: e.target.checked })}
              />
              <span>Enabled</span>
            </label>
          </div>
        </Card>

        {meta.recipients.map((recipient) => {
          const sendKey = recipient === 'client' ? 'sendToClient' : recipient === 'sitter' ? 'sendToSitter' : 'sendToOwner';
          const templateKey = TEMPLATE_KEYS[recipient];
          return (
            <Card key={recipient} className="mb-4">
              <div className="p-4">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={!!block[sendKey]}
                    onChange={(e) => update({ [sendKey]: e.target.checked })}
                  />
                  <span>Send to {RECIPIENT_LABEL[recipient]}</span>
                </label>
                <Textarea
                  label={`Message template (${RECIPIENT_LABEL[recipient]})`}
                  value={String(block[templateKey] ?? '')}
                  onChange={(e) => update({ [templateKey]: e.target.value })}
                  placeholder="Use {{firstName}}, {{service}}, {{datesTimes}}, etc."
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                />
              </div>
            </Card>
          );
        })}

        <Card className="mb-4">
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-3">
              Test message
            </h3>
            <Input
              label="Phone number"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+1..."
              style={{ marginBottom: '0.75rem' }}
            />
            <p className="text-sm text-text-secondary mb-2">
              Sends the first non-empty template above to this number.
            </p>
            <Flex gap={2} align="center">
              <Button
                variant="secondary"
                onClick={() => {
                  const firstTemplate =
                    (block.messageTemplateClient as string)?.trim() ||
                    (block.messageTemplateSitter as string)?.trim() ||
                    (block.messageTemplateOwner as string)?.trim() ||
                    '';
                  handleTest(firstTemplate);
                }}
                disabled={testing}
              >
                {testing ? 'Sending…' : 'Send test'}
              </Button>
              {testSuccess && <span className="text-success">Sent.</span>}
              {testError && <span className="text-error">{testError}</span>}
            </Flex>
          </div>
        </Card>

        <p className="text-sm text-text-secondary">
          <Link href="/ops/automation-failures">View automation failures</Link> for debugging.
        </p>
      </div>
    </OwnerAppShell>
  );
}
