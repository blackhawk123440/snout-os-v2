'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { SitterPageHeader, SitterEmptyState, SitterSkeletonList } from '@/components/sitter';
import { toastSuccess, toastError } from '@/lib/toast';
import { formatServiceName } from '@/lib/format-utils';
import { Sparkles } from 'lucide-react';

const MAX_PHOTOS = 5;
const ACCEPT = 'image/jpeg,image/png,image/webp';

interface BookingOption {
  id: string;
  service: string;
  startAt: string;
  clientName: string;
  pets: Array<{ id: string; name?: string | null; species?: string | null }>;
}

/* ─── Quick-fill chip options ───────────────────────────────────────── */

const WALK_DURATIONS = ['15', '20', '30', '45', '60'];
const POTTY_OPTIONS = ['Normal', '#1 only', '#2 only', 'Both', 'None'];
const FOOD_OPTIONS = ['Ate well', 'Ate some', "Didn't eat", 'N/A'];
const WATER_OPTIONS = ['Drank well', 'Drank some', 'Refreshed bowl', 'N/A'];
const MED_OPTIONS = ['Given as directed', 'Not needed', 'Refused'];

function QuickChips({
  options,
  value,
  onSelect,
  suffix,
}: {
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {options.map((opt) => {
        const label = suffix ? `${opt} ${suffix}` : opt;
        const isActive = value === opt || value === label;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(isActive ? '' : opt)}
            className={`min-h-[36px] rounded-full px-3 py-1 text-xs font-medium transition ${
              isActive
                ? 'bg-accent-primary text-text-inverse'
                : 'border border-border-default bg-surface-primary text-text-secondary hover:bg-surface-secondary'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function SitterReportNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingIdParam = searchParams.get('bookingId');
  const isPostCheckout = searchParams.get('postCheckout') === 'true';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: bookingsData, isLoading: loadingBookings } = useQuery<BookingOption[]>({
    queryKey: ['sitter', 'completed-bookings'],
    queryFn: async () => {
      const res = await fetch('/api/sitter/bookings');
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.bookings)) {
        return json.bookings
          .filter((b: { status: string }) => b.status === 'completed')
          .slice(0, 30);
      }
      return [];
    },
  });
  const bookings = bookingsData ?? [];

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(bookingIdParam);
  const [walkDuration, setWalkDuration] = useState('');
  const [potty, setPotty] = useState('');
  const [food, setFood] = useState('');
  const [water, setWater] = useState('');
  const [medication, setMedication] = useState('');
  const [behaviorNotes, setBehaviorNotes] = useState('');
  const [personalNote, setPersonalNote] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sentReportId, setSentReportId] = useState<string | null>(null);
  const [petReports, setPetReports] = useState<Record<string, Record<string, string>>>({});
  const [expanding, setExpanding] = useState(false);

  const updatePetReport = (petId: string, field: string, value: string) => {
    setPetReports((prev) => ({
      ...prev,
      [petId]: { ...prev[petId], [field]: value },
    }));
  };

  // Auto-select booking when data loads
  useEffect(() => {
    if (bookings.length > 0 && !selectedBookingId) {
      if (bookingIdParam && bookings.some((b) => b.id === bookingIdParam)) {
        setSelectedBookingId(bookingIdParam);
      } else {
        setSelectedBookingId(bookings[0].id);
      }
    }
  }, [bookings, selectedBookingId, bookingIdParam]);

  useEffect(() => {
    if (bookingIdParam) setSelectedBookingId(bookingIdParam);
  }, [bookingIdParam]);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  const buildReportText = () => {
    const parts: string[] = [];
    if (walkDuration.trim()) parts.push(`Walk: ${walkDuration.trim()} min`);
    if (potty.trim()) parts.push(`Potty: ${potty.trim()}`);
    if (food.trim()) parts.push(`Food: ${food.trim()}`);
    if (water.trim()) parts.push(`Water: ${water.trim()}`);
    if (medication.trim()) parts.push(`Medication: ${medication.trim()}`);
    if (behaviorNotes.trim()) parts.push(`Behavior: ${behaviorNotes.trim()}`);
    if (personalNote.trim()) parts.push(personalNote.trim());
    return parts.join('. ') || 'Visit completed.';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !selectedBookingId) return;
    const remaining = MAX_PHOTOS - mediaUrls.length;
    if (remaining <= 0) {
      toastError(`Maximum ${MAX_PHOTOS} photos`);
      return;
    }
    const toAdd = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('bookingId', selectedBookingId);
      toAdd.forEach((f) => formData.append('files', f));
      const res = await fetch('/api/upload/report-media', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toastError(data.error || 'Upload failed');
        return;
      }
      setMediaUrls((prev) => [...prev, ...(data.urls || [])].slice(0, MAX_PHOTOS));
      toastSuccess('Photos added');
    } catch {
      toastError('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (url: string) => {
    setMediaUrls((prev) => prev.filter((u) => u !== url));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBookingId) throw new Error('Select a visit');
      const reportText = buildReportText();
      const res = await fetch(`/api/bookings/${selectedBookingId}/daily-delight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: reportText,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          walkDuration: walkDuration ? parseInt(walkDuration, 10) : undefined,
          pottyNotes: potty || undefined,
          foodNotes: food || undefined,
          waterNotes: water || undefined,
          medicationNotes: medication || undefined,
          behaviorNotes: behaviorNotes || undefined,
          personalNote: personalNote || undefined,
          petReports: Object.keys(petReports).length > 0
            ? JSON.stringify(
                Object.entries(petReports).map(([petId, data]) => {
                  const pet = selectedBooking?.pets?.find((p) => p.id === petId);
                  return { petId, petName: pet?.name || 'Pet', ...data };
                })
              )
            : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to submit report');
      return data;
    },
    onSuccess: (data) => {
      toastSuccess(`Sent to ${selectedBooking?.clientName || 'client'}`);
      setSentReportId(data.reportId ?? null);
    },
    onError: (err: Error) => {
      toastError(err.message || 'Failed to submit report');
    },
  });

  const handleSubmit = () => {
    if (!selectedBookingId) { toastError('Select a visit'); return; }
    setSentReportId(null);
    submitMutation.mutate();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const inputClass =
    'w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus';

  if (loadingBookings) {
    return (
      <div className="mx-auto max-w-2xl pb-8">
        <SitterPageHeader title="New report" subtitle="Loading\u2026" />
        <SitterSkeletonList count={3} />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="mx-auto max-w-2xl pb-8">
        <SitterPageHeader title="New report" subtitle="No completed visits" />
        <SitterEmptyState
          title="No completed visits"
          subtitle="Complete a visit first, then you can submit a report."
          cta={{ label: 'Today', onClick: () => router.push('/sitter/today') }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <SitterPageHeader
        title={isPostCheckout ? 'Send report' : 'New report'}
        subtitle={selectedBooking ? `${formatServiceName(selectedBooking.service)} \u00b7 ${selectedBooking.clientName}` : 'Visit report for client'}
        action={
          <Button variant="secondary" size="sm" onClick={() => router.back()}>
            {isPostCheckout ? 'Skip' : 'Cancel'}
          </Button>
        }
      />

      <div className="space-y-5">
        {/* Visit selector */}
        {!isPostCheckout && (
          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary">Visit</label>
            <select
              value={selectedBookingId ?? ''}
              onChange={(e) => setSelectedBookingId(e.target.value || null)}
              className={inputClass}
            >
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {formatDate(b.startAt)} \u00b7 {formatServiceName(b.service)} \u00b7 {b.clientName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Structured visit details with quick-fill chips */}
        <div className="rounded-xl border border-border-default bg-surface-primary p-4 space-y-4">
          <p className="text-sm font-semibold text-text-primary">Visit details</p>

          {/* Walk duration */}
          <div>
            <label className="block text-xs font-medium text-text-secondary">Walk duration (min)</label>
            <QuickChips options={WALK_DURATIONS} value={walkDuration} onSelect={setWalkDuration} suffix="min" />
            <input
              type="text"
              inputMode="numeric"
              value={walkDuration}
              onChange={(e) => setWalkDuration(e.target.value.replace(/\D/g, ''))}
              placeholder="Or type custom\u2026"
              className={`${inputClass} mt-2`}
            />
          </div>

          {/* Potty */}
          <div>
            <label className="block text-xs font-medium text-text-secondary">Potty</label>
            <QuickChips options={POTTY_OPTIONS} value={potty} onSelect={setPotty} />
          </div>

          {/* Food */}
          <div>
            <label className="block text-xs font-medium text-text-secondary">Food</label>
            <QuickChips options={FOOD_OPTIONS} value={food} onSelect={setFood} />
          </div>

          {/* Water */}
          <div>
            <label className="block text-xs font-medium text-text-secondary">Water</label>
            <QuickChips options={WATER_OPTIONS} value={water} onSelect={setWater} />
          </div>

          {/* Medication */}
          <div>
            <label className="block text-xs font-medium text-text-secondary">Medication</label>
            <QuickChips options={MED_OPTIONS} value={medication} onSelect={setMedication} />
          </div>

          {/* Behavior */}
          <div>
            <label className="block text-xs font-medium text-text-secondary">Behavior</label>
            <input
              type="text"
              value={behaviorNotes}
              onChange={(e) => setBehaviorNotes(e.target.value)}
              placeholder="How was their mood? Happy, calm, anxious\u2026"
              className={`${inputClass} mt-1.5`}
            />
          </div>
        </div>

        {/* Personal note */}
        <div className="rounded-xl border border-border-default bg-surface-primary p-4">
          <label className="block text-sm font-semibold text-text-primary mb-2">Personal note to client</label>
          <textarea
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            placeholder={`"${selectedBooking?.pets?.[0]?.name || 'Your pet'} was so happy today! They played fetch and napped on the couch."`}
            rows={3}
            maxLength={2000}
            className={`${inputClass} resize-y`}
          />
          <p className="mt-1 text-xs text-text-tertiary">This appears as a personal message on the client&apos;s report card.</p>
          {selectedBookingId && (
            <button
              type="button"
              disabled={expanding || (!personalNote.trim() && !buildReportText().trim())}
              onClick={async () => {
                if (!selectedBookingId) return;
                setExpanding(true);
                try {
                  const bulletPoints = buildReportText() + (personalNote.trim() ? '. ' + personalNote.trim() : '');
                  const res = await fetch(`/api/sitter/bookings/${selectedBookingId}/report-assist`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      bulletPoints,
                      petNames: selectedBooking?.pets?.map(p => p.name).filter(Boolean),
                    }),
                  });
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || 'AI generation failed');
                  }
                  const data = await res.json();
                  if (data.data?.expandedReport) {
                    setPersonalNote(data.data.expandedReport);
                    toastSuccess('Report expanded with AI');
                  }
                } catch (err: any) {
                  toastError(err?.message || 'AI generation failed');
                } finally {
                  setExpanding(false);
                }
              }}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-accent-primary/30 bg-accent-primary/5 px-3 py-2 text-xs font-medium text-accent-primary transition hover:bg-accent-primary/10 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {expanding ? 'Generating...' : 'Expand to full report'}
            </button>
          )}
        </div>

        {/* Per-pet notes (multi-pet bookings) */}
        {/* Per-pet health checklist */}
        {selectedBooking && selectedBooking.pets && selectedBooking.pets.length >= 1 && (
          <div className="rounded-xl border border-border-default bg-surface-primary p-4">
            <p className="text-sm font-semibold text-text-primary mb-3">
              {selectedBooking.pets.length > 1 ? 'Per-pet checklist' : `${selectedBooking.pets[0]?.name || 'Pet'} checklist`}
            </p>
            <div className="space-y-4">
              {selectedBooking.pets.map((pet) => (
                <div key={pet.id} className="rounded-lg border border-border-default p-3">
                  <p className="text-sm font-medium text-text-primary mb-2">
                    {pet.name || pet.species || 'Pet'}
                  </p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-text-tertiary">Food</span>
                      <QuickChips options={FOOD_OPTIONS} value={petReports[pet.id]?.food || ''} onSelect={(v) => updatePetReport(pet.id, 'food', v)} />
                    </div>
                    <div>
                      <span className="text-xs text-text-tertiary">Water</span>
                      <QuickChips options={WATER_OPTIONS} value={petReports[pet.id]?.water || ''} onSelect={(v) => updatePetReport(pet.id, 'water', v)} />
                    </div>
                    <div>
                      <span className="text-xs text-text-tertiary">Potty</span>
                      <QuickChips options={POTTY_OPTIONS} value={petReports[pet.id]?.potty || ''} onSelect={(v) => updatePetReport(pet.id, 'potty', v)} />
                    </div>
                    <div>
                      <span className="text-xs text-text-tertiary">Medication</span>
                      <QuickChips options={MED_OPTIONS} value={petReports[pet.id]?.meds || ''} onSelect={(v) => updatePetReport(pet.id, 'meds', v)} />
                    </div>
                    <div>
                      <span className="text-xs text-text-tertiary">Behavior notes</span>
                      <input
                        placeholder="Happy, playful, calm, anxious..."
                        value={petReports[pet.id]?.behavior || ''}
                        onChange={(e) => updatePetReport(pet.id, 'behavior', e.target.value)}
                        className={`${inputClass} mt-1`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        <div className="rounded-xl border border-border-default bg-surface-primary p-4">
          <p className="mb-3 text-sm font-semibold text-text-primary">Photos</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading || mediaUrls.length >= MAX_PHOTOS}
          />
          {mediaUrls.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {mediaUrls.map((url, i) => (
                <div key={url} className="relative">
                  <img src={url} alt={`Photo ${i + 1}`} className="h-[120px] w-[120px] rounded-xl object-cover border border-border-default" />
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 rounded bg-accent-primary/80 px-1.5 py-0.5 text-[10px] font-bold text-text-inverse">
                      Hero
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-status-danger-fill text-xs text-status-danger-text-on-fill shadow"
                    aria-label="Remove photo"
                  >
                    \u00d7
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || mediaUrls.length >= MAX_PHOTOS}
              className="flex-1 min-h-[44px] rounded-lg border border-border-default bg-surface-primary text-sm font-medium text-text-secondary transition hover:bg-surface-secondary disabled:opacity-50"
            >
              {uploading ? 'Uploading\u2026' : mediaUrls.length >= MAX_PHOTOS ? `${MAX_PHOTOS} photos max` : 'Add photos'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-text-tertiary">First photo becomes the hero image on the client&apos;s report. Up to {MAX_PHOTOS} photos.</p>
        </div>

        {/* Success state */}
        {sentReportId && (
          <div className="rounded-xl border border-status-success-border bg-status-success-bg p-4">
            <p className="font-semibold text-status-success-text">Sent to {selectedBooking?.clientName || 'client'}</p>
            <p className="mt-0.5 text-sm text-status-success-text-secondary">The client will see this in their visit reports.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/sitter/reports/edit/${sentReportId}`)}
              >
                Edit (15 min)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/sitter/today')}
              >
                Back to today
              </Button>
            </div>
          </div>
        )}

        {/* Submit */}
        {!sentReportId && (
          <Button
            variant="primary"
            size="md"
            onClick={() => void handleSubmit()}
            disabled={submitMutation.isPending}
            className="w-full min-h-[44px]"
          >
            {submitMutation.isPending ? 'Sending\u2026' : `Send to ${selectedBooking?.clientName || 'client'}`}
          </Button>
        )}
      </div>
    </div>
  );
}
