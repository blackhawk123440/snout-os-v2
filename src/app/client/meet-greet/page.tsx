'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutWrapper } from '@/components/layout';
import { AppCard, AppCardBody, AppPageHeader } from '@/components/app';
import { toastSuccess, toastError } from '@/lib/toast';
import { Button } from '@/components/ui';
import { useSubmitMeetGreet, useClientPets, useClientMe } from '@/lib/api/client-hooks';
import { Calendar, Clock, ArrowLeft, Check, Heart } from 'lucide-react';

const inputClass = 'w-full min-h-[44px] rounded-xl border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus';

const TIME_SLOTS = [
  { value: 'morning', label: 'Morning (9am-12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm-4pm)' },
  { value: 'evening', label: 'Evening (4pm-7pm)' },
  { value: 'flexible', label: 'Flexible / any time' },
];

export default function MeetGreetPage() {
  const router = useRouter();
  const submitMutation = useSubmitMeetGreet();
  const { data: petsData } = useClientPets();
  const { data: meData } = useClientMe();

  const pets = petsData?.pets ?? [];
  const address = meData?.address ?? '';

  const [step, setStep] = useState<'form' | 'sent'>('form');
  const [form, setForm] = useState({
    date1: '',
    time1: 'morning',
    date2: '',
    time2: 'afternoon',
    meetAddress: '',
    petNames: '',
    concerns: '',
    services: '' as string,
  });

  const handleSubmit = async () => {
    if (!form.date1) { toastError('Please select at least one preferred date'); return; }

    // Build structured preferred time string
    const slot1 = TIME_SLOTS.find((t) => t.value === form.time1)?.label ?? form.time1;
    const dateStr1 = new Date(form.date1 + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    let preferredDateTime = `Option 1: ${dateStr1}, ${slot1}`;
    if (form.date2) {
      const slot2 = TIME_SLOTS.find((t) => t.value === form.time2)?.label ?? form.time2;
      const dateStr2 = new Date(form.date2 + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      preferredDateTime += `\nOption 2: ${dateStr2}, ${slot2}`;
    }

    // Build notes
    const parts: string[] = [];
    if (form.meetAddress || address) parts.push(`Address: ${form.meetAddress || address}`);
    if (form.petNames) parts.push(`Pets: ${form.petNames}`);
    else if (pets.length > 0) parts.push(`Pets: ${pets.map((p: any) => p.name).filter(Boolean).join(', ')}`);
    if (form.services) parts.push(`Interested in: ${form.services}`);
    if (form.concerns) parts.push(`Notes: ${form.concerns}`);

    try {
      await submitMutation.mutateAsync({
        preferredDateTime,
        notes: parts.join('\n') || undefined,
      });
      toastSuccess('Meet & greet request sent!');
      setStep('sent');
    } catch {
      toastError('Failed to send request');
    }
  };

  return (
    <LayoutWrapper variant="narrow">
      <AppPageHeader
        title="Meet & Greet"
        subtitle="A free intro visit before your first booking"
        action={
          <button type="button" onClick={() => router.back()} className="min-h-[44px] text-sm font-medium text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-4 h-4 inline mr-1" />Back
          </button>
        }
      />

      {step === 'sent' ? (
        <AppCard>
          <AppCardBody>
            <div className="text-center py-6">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-success-bg">
                <Check className="h-6 w-6 text-status-success-text" />
              </div>
              <h2 className="text-xl font-bold text-text-primary">Request sent!</h2>
              <p className="mt-2 text-sm text-text-secondary max-w-sm mx-auto">
                We&apos;ll reach out to confirm the date and match you with a sitter. You&apos;ll get a message when it&apos;s confirmed.
              </p>
              <div className="mt-6 space-y-2">
                <Button variant="primary" size="md" onClick={() => router.push('/client/home')} className="w-full">
                  Back to home
                </Button>
                <Button variant="secondary" size="md" onClick={() => router.push('/client/messages')} className="w-full">
                  View messages
                </Button>
              </div>
            </div>
          </AppCardBody>
        </AppCard>
      ) : (
        <div className="space-y-4">
          {/* Info card */}
          <AppCard>
            <AppCardBody>
              <div className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-accent-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">What to expect</p>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                    A meet & greet is a free, no-commitment visit where you meet your sitter, show them your home,
                    introduce your pets, and discuss your care preferences. Usually takes 15-30 minutes.
                  </p>
                </div>
              </div>
            </AppCardBody>
          </AppCard>

          {/* Scheduling */}
          <AppCard>
            <AppCardBody>
              <h3 className="text-sm font-semibold text-text-primary mb-3">When works for you?</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> First choice *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={form.date1}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setForm((f) => ({ ...f, date1: e.target.value }))}
                      className={inputClass}
                    />
                    <select
                      value={form.time1}
                      onChange={(e) => setForm((f) => ({ ...f, time1: e.target.value }))}
                      className={inputClass}
                    >
                      {TIME_SLOTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Second choice (optional)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={form.date2}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setForm((f) => ({ ...f, date2: e.target.value }))}
                      className={inputClass}
                    />
                    <select
                      value={form.time2}
                      onChange={(e) => setForm((f) => ({ ...f, time2: e.target.value }))}
                      className={inputClass}
                    >
                      {TIME_SLOTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </AppCardBody>
          </AppCard>

          {/* Details */}
          <AppCard>
            <AppCardBody>
              <h3 className="text-sm font-semibold text-text-primary mb-3">Help us prepare</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Address</label>
                  <input
                    type="text"
                    value={form.meetAddress || address}
                    onChange={(e) => setForm((f) => ({ ...f, meetAddress: e.target.value }))}
                    placeholder="Where should we meet?"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">
                    Your pets {pets.length > 0 && `(${pets.map((p: any) => p.name).join(', ')})`}
                  </label>
                  <input
                    type="text"
                    value={form.petNames || (pets.length > 0 ? pets.map((p: any) => p.name).filter(Boolean).join(', ') : '')}
                    onChange={(e) => setForm((f) => ({ ...f, petNames: e.target.value }))}
                    placeholder="Who will we be meeting?"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Services interested in</label>
                  <select
                    value={form.services}
                    onChange={(e) => setForm((f) => ({ ...f, services: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Select a service</option>
                    <option value="Dog Walking">Dog Walking</option>
                    <option value="Drop-ins">Drop-in Visits</option>
                    <option value="Housesitting">House Sitting</option>
                    <option value="24/7 Care">24/7 Care</option>
                    <option value="Multiple services">Multiple services</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Anything we should know? (optional)</label>
                  <textarea
                    value={form.concerns}
                    onChange={(e) => setForm((f) => ({ ...f, concerns: e.target.value }))}
                    placeholder="Special needs, concerns, questions..."
                    rows={3}
                    maxLength={1000}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            </AppCardBody>
          </AppCard>

          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={submitMutation.isPending || !form.date1}
            isLoading={submitMutation.isPending}
            className="w-full"
          >
            Request meet & greet
          </Button>
          <p className="text-xs text-text-disabled text-center">Free and non-binding. No payment required.</p>
        </div>
      )}
    </LayoutWrapper>
  );
}
