'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Switch, Textarea } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';

type TierFormValues = {
  name: string;
  pointTarget: number;
  minCompletionRate: number | '';
  minResponseRate: number | '';
  priorityLevel: number;
  commissionSplit: number;
  canTakeHouseSits: boolean;
  canTakeTwentyFourHourCare: boolean;
  isDefault: boolean;
  benefits: string;
  description: string;
};

const defaultValues: TierFormValues = {
  name: '',
  pointTarget: 0,
  minCompletionRate: '',
  minResponseRate: '',
  priorityLevel: 0,
  commissionSplit: 70,
  canTakeHouseSits: false,
  canTakeTwentyFourHourCare: false,
  isDefault: false,
  benefits: '',
  description: '',
};

interface TierFormProps {
  mode: 'create' | 'edit';
  tierId?: string;
  initialValues?: Partial<TierFormValues>;
}

export function TierForm({ mode, tierId, initialValues }: TierFormProps) {
  const [form, setForm] = useState<TierFormValues>({
    ...defaultValues,
    ...initialValues,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = mode === 'create' ? 'Create Policy Tier' : 'Edit Policy Tier';
  const submitLabel = mode === 'create' ? 'Create Tier' : 'Save Changes';
  const endpoint = mode === 'create' ? '/api/sitter-tiers' : `/api/sitter-tiers/${tierId}`;
  const method = mode === 'create' ? 'POST' : 'PATCH';

  const canSubmit = useMemo(() => form.name.trim().length > 0 && !saving, [form.name, saving]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const benefits = form.benefits.trim() ? JSON.parse(form.benefits) : null;
      const payload = {
        name: form.name.trim(),
        pointTarget: Number(form.pointTarget),
        minCompletionRate: form.minCompletionRate === '' ? null : Number(form.minCompletionRate),
        minResponseRate: form.minResponseRate === '' ? null : Number(form.minResponseRate),
        priorityLevel: Number(form.priorityLevel),
        commissionSplit: Number(form.commissionSplit),
        canTakeHouseSits: form.canTakeHouseSits,
        canTakeTwentyFourHourCare: form.canTakeTwentyFourHourCare,
        isDefault: form.isDefault,
        benefits,
        description: form.description.trim() || null,
      };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${mode} tier`);
      }

      window.location.href = '/settings/tiers';
    } catch (err: any) {
      if (String(err?.message || '').includes('JSON')) {
        setError('Benefits must be valid JSON (for example: {"priorityBooking": true}).');
      } else {
        setError(err?.message || `Failed to ${mode} tier`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} style={{ padding: tokens.spacing[4], display: 'flex', flexDirection: 'column', gap: tokens.spacing[4] }}>
        <div>
          <h2 style={{ fontSize: tokens.typography.fontSize.lg[0], fontWeight: tokens.typography.fontWeight.semibold }}>
            {title}
          </h2>
          <p style={{ color: tokens.colors.text.secondary, marginTop: tokens.spacing[1], fontSize: tokens.typography.fontSize.sm[0] }}>
            Policy tiers define sitter permissions and compensation. Reliability tier remains SRS.
          </p>
        </div>

        {error && (
          <div style={{ color: tokens.colors.error[700], background: tokens.colors.error[50], padding: tokens.spacing[3], borderRadius: tokens.borderRadius.md }}>
            {error}
          </div>
        )}

        <Input
          label="Tier name"
          placeholder="Certified"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: tokens.spacing[3] }}>
          <Input
            label="Point target"
            type="number"
            min={0}
            value={String(form.pointTarget)}
            onChange={(event) => setForm((prev) => ({ ...prev, pointTarget: Number(event.target.value || 0) }))}
          />
          <Input
            label="Priority level"
            type="number"
            min={0}
            value={String(form.priorityLevel)}
            onChange={(event) => setForm((prev) => ({ ...prev, priorityLevel: Number(event.target.value || 0) }))}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: tokens.spacing[3] }}>
          <Input
            label="Min completion rate (%)"
            type="number"
            min={0}
            max={100}
            value={form.minCompletionRate === '' ? '' : String(form.minCompletionRate)}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                minCompletionRate: event.target.value === '' ? '' : Number(event.target.value),
              }))
            }
          />
          <Input
            label="Min response rate (%)"
            type="number"
            min={0}
            max={100}
            value={form.minResponseRate === '' ? '' : String(form.minResponseRate)}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                minResponseRate: event.target.value === '' ? '' : Number(event.target.value),
              }))
            }
          />
          <Input
            label="Commission split (%)"
            type="number"
            min={0}
            max={100}
            value={String(form.commissionSplit)}
            onChange={(event) => setForm((prev) => ({ ...prev, commissionSplit: Number(event.target.value || 0) }))}
          />
        </div>

        <Textarea
          label="Description"
          placeholder="Who this policy tier is for and what it unlocks."
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          rows={3}
        />

        <Textarea
          label="Benefits JSON (optional)"
          placeholder='{"priorityRouting": true, "holidayMultiplier": 1.15}'
          value={form.benefits}
          onChange={(event) => setForm((prev) => ({ ...prev, benefits: event.target.value }))}
          rows={4}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: tokens.spacing[3] }}>
          <Switch
            label="House sits allowed"
            checked={form.canTakeHouseSits}
            onChange={(checked) => setForm((prev) => ({ ...prev, canTakeHouseSits: checked }))}
          />
          <Switch
            label="24-hour care allowed"
            checked={form.canTakeTwentyFourHourCare}
            onChange={(checked) => setForm((prev) => ({ ...prev, canTakeTwentyFourHourCare: checked }))}
          />
          <Switch
            label="Set as default tier"
            checked={form.isDefault}
            onChange={(checked) => setForm((prev) => ({ ...prev, isDefault: checked }))}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: tokens.spacing[2] }}>
          <Link href="/settings/tiers">
            <Button variant="secondary" type="button">Cancel</Button>
          </Link>
          <Button variant="primary" type="submit" disabled={!canSubmit}>
            {saving ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
