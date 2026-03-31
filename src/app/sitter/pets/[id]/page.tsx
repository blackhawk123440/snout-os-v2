'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  UtensilsCrossed, Pill, PawPrint, Home, Stethoscope, Phone,
  ClipboardList, FileText, BookOpen, AlertTriangle, ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui';
import {
  SitterCard,
  SitterCardHeader,
  SitterCardBody,
  SitterPageHeader,
} from '@/components/sitter';
import { toastSuccess, toastError } from '@/lib/toast';
import { useSitterPetDetail, useAddSitterPetHealthLog } from '@/lib/api/sitter-portal-hooks';

interface HealthLog {
  id: string;
  type: string;
  note: string;
  createdAt: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
}

interface PetDetail {
  id: string;
  name: string | null;
  species: string | null;
  breed: string | null;
  weight: number | null;
  gender: string | null;
  birthday: string | null;
  color: string | null;
  photoUrl: string | null;
  isFixed: boolean;
  feedingInstructions: string | null;
  medicationNotes: string | null;
  behaviorNotes: string | null;
  houseRules: string | null;
  walkInstructions: string | null;
  vetName: string | null;
  vetPhone: string | null;
  vetAddress: string | null;
  vetClinicName: string | null;
  notes: string | null;
  healthLogs: HealthLog[];
  emergencyContacts: EmergencyContact[];
}

const formatDate = (d: string | null) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
};

const healthLogIcon = (type: string) => {
  const cls = "w-4 h-4";
  switch (type) {
    case 'daily': return <BookOpen className={cls} />;
    case 'alert': return <AlertTriangle className={cls} />;
    case 'vet': return <Stethoscope className={cls} />;
    case 'allergy': return <ShieldAlert className={cls} />;
    default: return <ClipboardList className={cls} />;
  }
};

export default function SitterPetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { data: pet, isLoading: loading, error, refetch } = useSitterPetDetail(id) as {
    data: PetDetail | undefined;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl pb-8">
        <SitterPageHeader title="Pet details" subtitle="Loading..." />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <SitterCard key={i}>
              <SitterCardBody>
                <div className="h-12 animate-pulse rounded bg-surface-tertiary" />
              </SitterCardBody>
            </SitterCard>
          ))}
        </div>
      </div>
    );
  }

  if (error || !pet) {
    return (
      <div className="mx-auto max-w-3xl pb-8">
        <SitterPageHeader
          title="Pet details"
          action={<Button variant="secondary" size="sm" onClick={() => router.back()}>Back</Button>}
        />
        <SitterCard>
          <SitterCardBody>
            <p className="text-sm text-text-secondary">{error?.message || 'Pet not found'}</p>
            <Button variant="secondary" size="sm" onClick={() => void refetch()} className="mt-2">Retry</Button>
          </SitterCardBody>
        </SitterCard>
      </div>
    );
  }

  const subtitle = [pet.species, pet.breed].filter(Boolean).join(' \u00b7 ');
  const details = [
    pet.weight ? `${pet.weight} lbs` : null,
    pet.gender === 'female' ? '\u2640' : pet.gender === 'male' ? '\u2642' : null,
    pet.color,
  ].filter(Boolean).join(' \u00b7 ');

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <SitterPageHeader
        title={pet.name || 'Pet details'}
        subtitle={subtitle}
        action={<Button variant="secondary" size="sm" onClick={() => router.back()}>Back</Button>}
      />

      <div className="space-y-4">
        {/* Header card */}
        <SitterCard>
          <SitterCardBody>
            <div className="flex items-center gap-4">
              {pet.photoUrl ? (
                <img src={pet.photoUrl} alt={pet.name || 'Pet'} className="h-16 w-16 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-tertiary text-text-tertiary">
                  <PawPrint className="w-7 h-7" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-text-primary">{pet.name}</h2>
                <p className="text-sm text-text-secondary">{subtitle}</p>
                {details && <p className="text-sm text-text-tertiary">{details}</p>}
              </div>
            </div>
          </SitterCardBody>
        </SitterCard>

        {/* 1. Feeding — most critical during visit */}
        <CareSection
          icon="feeding"
          title="Feeding"
          content={pet.feedingInstructions}
          placeholder="No feeding instructions on file."
        />

        {/* 2. Medications */}
        <CareSection
          icon="medication"
          title="Medications"
          content={pet.medicationNotes}
          placeholder="No medication notes on file."
        />

        {/* 3. Behavior & Walk */}
        <SitterCard>
          <SitterCardHeader>
            <div className="flex items-center gap-2">
              <PawPrint className="w-4 h-4 text-text-tertiary" />
              <h3 className="text-sm font-semibold text-text-primary">Behavior & Walk Notes</h3>
            </div>
          </SitterCardHeader>
          <SitterCardBody>
            <div className="space-y-2">
              {pet.behaviorNotes && (
                <div>
                  <p className="text-xs font-medium text-text-tertiary mb-0.5">Behavior</p>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{pet.behaviorNotes}</p>
                </div>
              )}
              {pet.walkInstructions && (
                <div>
                  <p className="text-xs font-medium text-text-tertiary mb-0.5">Walk instructions</p>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{pet.walkInstructions}</p>
                </div>
              )}
              {!pet.behaviorNotes && !pet.walkInstructions && (
                <p className="text-sm text-text-tertiary italic">No behavior or walk notes on file.</p>
              )}
            </div>
          </SitterCardBody>
        </SitterCard>

        {/* House Rules */}
        <CareSection
          icon="house"
          title="House Rules"
          content={pet.houseRules}
          placeholder="No house rules on file."
        />

        {/* 4. Vet info */}
        <SitterCard>
          <SitterCardHeader>
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-text-tertiary" />
              <h3 className="text-sm font-semibold text-text-primary">Veterinarian</h3>
            </div>
          </SitterCardHeader>
          <SitterCardBody>
            {pet.vetName || pet.vetClinicName || pet.vetPhone ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-text-primary">
                  {[pet.vetName, pet.vetClinicName].filter(Boolean).join(' \u00b7 ')}
                </p>
                {pet.vetPhone && (
                  <a
                    href={`tel:${pet.vetPhone}`}
                    className="inline-flex items-center gap-2 min-h-[44px] rounded-lg bg-surface-tertiary px-4 text-sm font-medium text-accent-primary hover:bg-surface-secondary transition"
                  >
                    <Phone className="w-4 h-4 shrink-0" /> Call vet: {pet.vetPhone}
                  </a>
                )}
                {pet.vetAddress && <p className="text-sm text-text-tertiary">{pet.vetAddress}</p>}
              </div>
            ) : (
              <p className="text-sm text-text-tertiary italic">No vet info on file.</p>
            )}
          </SitterCardBody>
        </SitterCard>

        {/* Emergency Contacts */}
        <SitterCard>
          <SitterCardHeader>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-text-tertiary" />
              <h3 className="text-sm font-semibold text-text-primary">Emergency Contacts</h3>
            </div>
          </SitterCardHeader>
          <SitterCardBody>
            {pet.emergencyContacts.length === 0 ? (
              <p className="text-sm text-text-tertiary italic">No emergency contacts on file.</p>
            ) : (
              <div className="space-y-3">
                {pet.emergencyContacts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {c.name}{c.relationship ? ` (${c.relationship})` : ''}
                      </p>
                    </div>
                    <a
                      href={`tel:${c.phone}`}
                      className="inline-flex items-center gap-1 min-h-[44px] rounded-lg bg-surface-tertiary px-3 text-sm font-medium text-accent-primary hover:bg-surface-secondary transition"
                      aria-label={`Call ${c.name}`}
                    >
                      <Phone className="w-4 h-4 shrink-0" /> {c.phone}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </SitterCardBody>
        </SitterCard>

        {/* Health Timeline + Add note */}
        <SitterHealthTimeline petId={id} healthLogs={pet.healthLogs} onAdded={refetch} />

        {/* General notes */}
        <CareSection
          icon="notes"
          title="Notes"
          content={pet.notes}
          placeholder="No additional notes."
        />
      </div>
    </div>
  );
}

/* ─── Read-only care section ────────────────────────────────────────── */

const CARE_ICONS: Record<string, JSX.Element> = {
  feeding: <UtensilsCrossed className="w-4 h-4 text-text-tertiary" />,
  medication: <Pill className="w-4 h-4 text-text-tertiary" />,
  house: <Home className="w-4 h-4 text-text-tertiary" />,
  notes: <FileText className="w-4 h-4 text-text-tertiary" />,
};

function CareSection({
  icon, title, content, placeholder,
}: {
  icon: string;
  title: string;
  content: string | null;
  placeholder: string;
}) {
  return (
    <SitterCard>
      <SitterCardHeader>
        <div className="flex items-center gap-2">
          {CARE_ICONS[icon] ?? <FileText className="w-4 h-4 text-text-tertiary" />}
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        </div>
      </SitterCardHeader>
      <SitterCardBody>
        <p className={`text-sm whitespace-pre-wrap ${content ? 'text-text-secondary' : 'text-text-tertiary italic'}`}>
          {content || placeholder}
        </p>
      </SitterCardBody>
    </SitterCard>
  );
}

/* ─── Sitter health timeline with add ───────────────────────────────── */

function SitterHealthTimeline({
  petId, healthLogs, onAdded,
}: {
  petId: string;
  healthLogs: Array<{ id: string; type: string; note: string; createdAt: string }>;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('daily');
  const [note, setNote] = useState('');
  const addHealthLog = useAddSitterPetHealthLog(petId);

  const handleSubmit = async () => {
    if (!note.trim()) return;
    try {
      await addHealthLog.mutateAsync({ type, note: note.trim() });
      toastSuccess('Health note added');
      setNote('');
      setAdding(false);
      onAdded();
    } catch {
      toastError('Failed to add health note');
    }
  };

  return (
    <SitterCard>
      <SitterCardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-text-tertiary" />
            <h3 className="text-sm font-semibold text-text-primary">Health Timeline</h3>
          </div>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="min-h-[44px] min-w-[44px] text-sm font-medium text-accent-primary hover:underline"
            >
              Add note
            </button>
          )}
        </div>
      </SitterCardHeader>
      <SitterCardBody>
        {adding && (
          <div className="mb-4 space-y-2 rounded-lg border border-border-default p-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none"
            >
              <option value="daily">Daily note</option>
              <option value="alert">Alert</option>
              <option value="vet">Vet visit</option>
              <option value="allergy">Allergy</option>
            </select>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened during the visit?"
              rows={2}
              maxLength={2000}
              className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none resize-y"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setAdding(false); setNote(''); }} className="min-h-[44px] px-4 text-sm font-medium text-text-secondary hover:text-text-primary">Cancel</button>
              <button type="button" onClick={handleSubmit} disabled={addHealthLog.isPending || !note.trim()} className="min-h-[44px] rounded-lg bg-accent-primary px-4 text-sm font-semibold text-text-inverse hover:opacity-90 transition disabled:opacity-50">{addHealthLog.isPending ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
        )}
        {healthLogs.length === 0 ? (
          <p className="text-sm text-text-tertiary italic">No health notes yet.</p>
        ) : (
          <div className="space-y-3">
            {healthLogs.map((log) => (
              <div key={log.id} className="flex gap-3">
                <span className="shrink-0 mt-0.5 text-text-tertiary">{healthLogIcon(log.type)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-tertiary">
                    {formatDate(log.createdAt)} &mdash; {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
                  </p>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{log.note}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SitterCardBody>
    </SitterCard>
  );
}
