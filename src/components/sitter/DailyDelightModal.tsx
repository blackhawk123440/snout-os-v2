'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Button, Modal } from '@/components/ui';
import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { useAuth } from '@/lib/auth-client';
import { useOffline } from '@/hooks/useOffline';
import {
  addPendingPhoto,
  removePendingPhoto,
  getPendingPhotosForBooking,
  enqueueAction,
} from '@/lib/offline';
import { formatServiceName } from '@/lib/format-utils';

const MAX_PHOTOS = 5;
const MAX_SIZE_MB = 5;
const ACCEPT = 'image/jpeg,image/png,image/webp';

type PendingPhotoEntry = { id: string; objectUrl: string };

export interface DailyDelightBooking {
  id: string;
  clientName: string;
  service: string;
  startAt: string;
  endAt: string;
  pets: Array<{ id: string; name?: string | null; species?: string | null }>;
}

const formatTimeRange = (startAt: string, endAt: string) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

const buildStubDelight = (booking: DailyDelightBooking) => {
  const petNames =
    booking.pets.length > 0
      ? booking.pets.map((pet) => pet.name || pet.species || 'pet').join(', ')
      : 'your pet';
  const timeRange = formatTimeRange(booking.startAt, booking.endAt);
  return `Today with ${petNames} went smoothly.\n\nHighlights:\n- ${formatServiceName(booking.service)} completed during ${timeRange}.\n- Appetite, energy, and comfort looked normal.\n- No concerns observed during the visit.\n\nWe are ready for the next check-in.`;
};

type ToneOption = 'warm' | 'playful' | 'professional';

export interface DailyDelightModalProps {
  booking: DailyDelightBooking | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DailyDelightModal({ booking, isOpen, onClose }: DailyDelightModalProps) {
  const { user } = useAuth();
  const { isOnline, refreshQueuedCount } = useOffline();
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [tone, setTone] = useState<ToneOption>('warm');
  const [isStubDraft, setIsStubDraft] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhotoEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [structured, setStructured] = useState({
    potty: '',
    food: '',
    water: '',
    meds: '',
    walkDurationMins: '',
    notes: '',
  });

  const orgId = user?.orgId || 'default';
  const sitterId = user?.sitterId || '';

  const loadPendingPhotos = useCallback(async () => {
    if (!booking) return;
    const photos = await getPendingPhotosForBooking(booking.id);
    const entries: PendingPhotoEntry[] = photos.map((p) => ({
      id: p.id,
      objectUrl: URL.createObjectURL(p.blob),
    }));
    setPendingPhotos(entries);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- booking.id sufficient; full booking causes extra effect runs on parent re-renders
  }, [booking?.id]);

  useEffect(() => {
    if (!isOpen || !booking) return;
    setDraft('');
    setIsStubDraft(false);
    setLoading(false);
    setMediaUrls([]);
    setPendingPhotos([]);
    setSendStatus('idle');
    setSendError(null);
    setStructured({ potty: '', food: '', water: '', meds: '', walkDurationMins: '', notes: '' });
    if (!isOnline) void loadPendingPhotos();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- booking?.id + loadPendingPhotos sufficient; full booking causes extra runs
  }, [isOpen, booking?.id, isOnline, loadPendingPhotos]);

  const pendingRef = useRef<PendingPhotoEntry[]>([]);
  pendingRef.current = pendingPhotos;
  useEffect(
    () => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.objectUrl)),
    []
  );

  const totalCount = mediaUrls.length + pendingPhotos.length;
  const remaining = MAX_PHOTOS - totalCount;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !booking) return;
    if (remaining <= 0) {
      toastError(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }
    const toAdd = Array.from(files).slice(0, remaining);
    for (const f of toAdd) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toastError(`${f.name} is too large (max ${MAX_SIZE_MB}MB)`);
        continue;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        toastError(`${f.name}: only JPEG, PNG, WebP allowed`);
        continue;
      }
    }
    setUploading(true);
    try {
      if (isOnline) {
        const formData = new FormData();
        formData.set('bookingId', booking.id);
        toAdd.forEach((f) => formData.append('files', f));
        const res = await fetch('/api/upload/report-media', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toastError(data.error || 'Upload failed');
          return;
        }
        setMediaUrls((prev) => [...prev, ...(data.urls || [])].slice(0, MAX_PHOTOS));
        toastSuccess('Photos added');
      } else {
        for (const f of toAdd) {
          const id = await addPendingPhoto(booking.id, f, f.type);
          setPendingPhotos((prev) => {
            const next = [...prev, { id, objectUrl: URL.createObjectURL(f) }];
            return next.slice(0, MAX_PHOTOS);
          });
        }
        toastSuccess('Photos queued for upload — will sync when online');
        void refreshQueuedCount();
      }
    } catch {
      toastError('Failed to add photos');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const buildFromStructured = () => {
    const parts: string[] = [];
    if (structured.potty.trim()) parts.push(`Potty: ${structured.potty.trim()}`);
    if (structured.food.trim()) parts.push(`Food: ${structured.food.trim()}`);
    if (structured.water.trim()) parts.push(`Water: ${structured.water.trim()}`);
    if (structured.meds.trim()) parts.push(`Meds: ${structured.meds.trim()}`);
    if (structured.walkDurationMins.trim()) parts.push(`Walk: ${structured.walkDurationMins.trim()} min`);
    if (structured.notes.trim()) parts.push(`Notes: ${structured.notes.trim()}`);
    const built = parts.length ? parts.join('. ') + (structured.notes.trim() ? '' : '.') : '';
    setDraft((prev) => (built ? (prev ? `${prev}\n\n${built}` : built) : prev));
    if (built) setIsStubDraft(false);
  };

  const removePhoto = (urlOrId: string) => {
    if (mediaUrls.includes(urlOrId)) {
      setMediaUrls((prev) => prev.filter((u) => u !== urlOrId));
      return;
    }
    const entry = pendingPhotos.find((p) => p.id === urlOrId || p.objectUrl === urlOrId);
    if (entry) {
      URL.revokeObjectURL(entry.objectUrl);
      void removePendingPhoto(entry.id);
      setPendingPhotos((prev) => prev.filter((p) => p.id !== entry.id));
    }
  };

  const generate = async () => {
    if (!booking) return;
    if (!isOnline) {
      const fallback = buildStubDelight(booking);
      setDraft(fallback);
      setIsStubDraft(true);
      toastInfo('Offline — using a local draft. Edit and send when ready.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/daily-delight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fallback = buildStubDelight(booking);
        setDraft(fallback);
        setIsStubDraft(true);
        toastWarning('Could not generate right now. A local draft is ready.');
        return;
      }
      setDraft(typeof data.report === 'string' && data.report.trim() ? data.report : buildStubDelight(booking));
      setIsStubDraft(false);
      toastSuccess('Daily Delight generated');
    } catch {
      const fallback = buildStubDelight(booking);
      setDraft(fallback);
      setIsStubDraft(true);
      toastWarning('Could not generate right now. A local draft is ready.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!draft.trim() || !booking) {
      toastError('Add or generate content first');
      return;
    }
    setSending(true);
    setSendStatus('sending');
    setSendError(null);
    try {
      if (isOnline) {
        const res = await fetch(`/api/bookings/${booking.id}/daily-delight`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report: draft.trim(),
            tone,
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSendStatus('failed');
          setSendError(data.error || 'Failed to send');
          return;
        }
        setSendStatus('sent');
        setTimeout(() => onClose(), 1200);
      } else {
        const photoIds = pendingPhotos.map((p) => p.id);
        await enqueueAction('delight.create', {
          orgId,
          sitterId,
          bookingId: booking.id,
          payload: { report: draft.trim(), tone, photoIds },
        });
        setPendingPhotos((prev) => {
          prev.forEach((p) => URL.revokeObjectURL(p.objectUrl));
          return [];
        });
        void refreshQueuedCount();
        toastSuccess('Queued — will sync when online');
        onClose();
      }
    } catch {
      setSendStatus('failed');
      setSendError('Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={booking ? `✨ Daily Delight — ${booking.clientName}` : '✨ Daily Delight'}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" size="md" onClick={() => void generate()} disabled={loading}>
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-amber-400" />
                Generating…
              </span>
            ) : draft ? (
              'Regenerate'
            ) : (
              'Generate'
            )}
          </Button>
          <Button variant="secondary" size="md" onClick={() => {}} disabled>
            Save draft
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => void handleSend()}
            disabled={loading || sending || !draft.trim() || sendStatus === 'sent'}
          >
            {sendStatus === 'sent' ? 'Sent' : sending ? 'Sending…' : 'Send'}
          </Button>
        </>
      }
    >
      {booking ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-default bg-surface-secondary p-4">
            <p className="font-semibold text-text-primary">{formatServiceName(booking.service)}</p>
            <p className="text-sm text-text-secondary">{formatTimeRange(booking.startAt, booking.endAt)}</p>
            {booking.pets.length > 0 && (
              <p className="mt-1 text-sm text-text-secondary">
                {booking.pets
                  .map((pet) => (pet.name ? `${pet.name}${pet.species ? ` (${pet.species})` : ''}` : pet.species || 'Pet'))
                  .join(', ')}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-tertiary">Visit details (optional)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Potty</label>
                <input
                  type="text"
                  value={structured.potty}
                  onChange={(e) => setStructured((s) => ({ ...s, potty: e.target.value }))}
                  placeholder="e.g. normal, accident"
                  className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm outline-none focus:border-border-focus"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Food</label>
                <input
                  type="text"
                  value={structured.food}
                  onChange={(e) => setStructured((s) => ({ ...s, food: e.target.value }))}
                  placeholder="e.g. ate well"
                  className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm outline-none focus:border-border-focus"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Water</label>
                <input
                  type="text"
                  value={structured.water}
                  onChange={(e) => setStructured((s) => ({ ...s, water: e.target.value }))}
                  placeholder="e.g. refreshed"
                  className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm outline-none focus:border-border-focus"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Meds</label>
                <input
                  type="text"
                  value={structured.meds}
                  onChange={(e) => setStructured((s) => ({ ...s, meds: e.target.value }))}
                  placeholder="e.g. given as directed"
                  className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm outline-none focus:border-border-focus"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-tertiary">Walk (min)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={structured.walkDurationMins}
                  onChange={(e) => setStructured((s) => ({ ...s, walkDurationMins: e.target.value.replace(/\D/g, '') }))}
                  placeholder="e.g. 20"
                  className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm outline-none focus:border-border-focus"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-text-tertiary">Notes</label>
              <textarea
                value={structured.notes}
                onChange={(e) => setStructured((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Any other details…"
                rows={2}
                className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm outline-none focus:border-border-focus"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={buildFromStructured} className="mt-2">
              Build from form
            </Button>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-border-default bg-surface-secondary p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading || mediaUrls.length >= MAX_PHOTOS}
            />
            {(mediaUrls.length > 0 || pendingPhotos.length > 0) && (
              <div className="mb-3 flex flex-wrap gap-2">
                {mediaUrls.map((url) => (
                  <div key={url} className="relative">
                    <img
                      src={url}
                      alt="Report photo"
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {pendingPhotos.map((p) => (
                  <div key={p.id} className="relative">
                    <img
                      src={p.objectUrl}
                      alt="Queued photo"
                      className="h-16 w-16 rounded-lg object-cover ring-2 ring-amber-400"
                    />
                    <span className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-amber-900/80 px-1 py-0.5 text-[10px] text-amber-100">
                      Queued upload
                    </span>
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || totalCount >= MAX_PHOTOS}
              className="w-full rounded-xl border border-border-strong bg-surface-primary px-4 py-3 text-sm font-medium text-text-secondary transition hover:bg-surface-secondary disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : totalCount >= MAX_PHOTOS ? `${MAX_PHOTOS} photos max` : 'Add photos (optional)'}
            </button>
          </div>
          <div className="rounded-2xl border border-border-default bg-surface-primary p-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-tertiary">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as ToneOption)}
              disabled={loading}
              className="mb-4 w-full rounded-xl border border-border-strong bg-surface-primary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20"
            >
              <option value="warm">Warm</option>
              <option value="playful">Playful</option>
              <option value="professional">Professional</option>
            </select>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-tertiary">Your message</label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Generate a Daily Delight, then fine-tune here."
              disabled={loading}
              className={`min-h-44 w-full resize-y rounded-xl border border-border-strong bg-surface-primary p-3 text-sm text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20 ${loading ? 'animate-pulse' : ''}`}
            />
          </div>
          {isStubDraft && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              We filled in a warm draft so you can keep moving. Edit and send when ready.
            </div>
          )}
          {sendStatus === 'failed' && sendError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p className="font-medium">Failed to send</p>
              <p className="mt-0.5 text-xs">{sendError}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleSend()}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
