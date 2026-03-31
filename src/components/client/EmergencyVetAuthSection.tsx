'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldAlert, FileSignature } from 'lucide-react';
import { Button } from '@/components/ui';
import { toastSuccess, toastError } from '@/lib/toast';

interface AuthData {
  id: string;
  authorizedUpToCents: number;
  vetName: string | null;
  vetPhone: string | null;
  vetAddress: string | null;
  additionalInstructions: string | null;
  signedAt: string;
  signatureName: string;
  expiresAt: string;
  isExpired: boolean;
}

export interface EmergencyVetAuthSectionProps {
  petId: string;
  petName: string;
  businessName?: string;
}

export function EmergencyVetAuthSection({ petId, petName, businessName = 'your pet care provider' }: EmergencyVetAuthSectionProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['client', 'pet', petId, 'emergency-auth'],
    queryFn: async () => {
      const res = await fetch(`/api/client/pets/${petId}/emergency-auth`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const auth: AuthData | null = data?.data || null;
  const petVet = data?.petVet;

  if (isLoading) {
    return <div className="h-20 animate-pulse rounded-xl bg-surface-tertiary" />;
  }

  // Active authorization
  if (auth && !auth.isExpired) {
    return (
      <div className="rounded-xl border border-status-success-border bg-status-success-bg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-status-success-text" />
          <span className="text-sm font-semibold text-status-success-text">Emergency care authorized</span>
        </div>
        <p className="text-sm text-status-success-text-secondary">
          Up to ${(auth.authorizedUpToCents / 100).toFixed(0)} approved
          {auth.vetName ? ` · Vet: ${auth.vetName}` : ''}
        </p>
        <p className="mt-1 text-xs text-status-success-text-secondary">
          Valid until {new Date(auth.expiresAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="mt-2 text-xs font-medium text-status-success-text underline"
        >
          View or update
        </button>
        {showModal && (
          <AuthModal
            petId={petId}
            petName={petName}
            businessName={businessName}
            existing={auth}
            petVet={petVet}
            onClose={() => setShowModal(false)}
            onSaved={() => {
              setShowModal(false);
              void queryClient.invalidateQueries({ queryKey: ['client', 'pet', petId, 'emergency-auth'] });
            }}
          />
        )}
      </div>
    );
  }

  // Expired authorization
  if (auth?.isExpired) {
    return (
      <div className="rounded-xl border border-status-warning-border bg-status-warning-bg p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-4 w-4 text-status-warning-text" />
          <span className="text-sm font-semibold text-status-warning-text">Authorization expired</span>
        </div>
        <p className="text-sm text-status-warning-text-secondary">
          {petName}&apos;s emergency vet authorization expired on {new Date(auth.expiresAt).toLocaleDateString()}.
        </p>
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)} className="mt-2">
          Renew authorization
        </Button>
        {showModal && (
          <AuthModal
            petId={petId}
            petName={petName}
            businessName={businessName}
            existing={auth}
            petVet={petVet}
            onClose={() => setShowModal(false)}
            onSaved={() => {
              setShowModal(false);
              void queryClient.invalidateQueries({ queryKey: ['client', 'pet', petId, 'emergency-auth'] });
            }}
          />
        )}
      </div>
    );
  }

  // No authorization
  return (
    <div className="rounded-xl border border-border-default bg-surface-primary p-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="h-4 w-4 text-text-tertiary" />
        <span className="text-sm font-medium text-text-primary">Emergency authorization</span>
      </div>
      <p className="text-xs text-text-tertiary">
        Authorize {businessName} to approve emergency vet care for {petName} if you can&apos;t be reached.
      </p>
      <Button variant="secondary" size="sm" onClick={() => setShowModal(true)} className="mt-3">
        <FileSignature className="h-3.5 w-3.5 mr-1" />
        Authorize emergency care
      </Button>
      {showModal && (
        <AuthModal
          petId={petId}
          petName={petName}
          businessName={businessName}
          existing={null}
          petVet={petVet}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            void queryClient.invalidateQueries({ queryKey: ['client', 'pet', petId, 'emergency-auth'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Authorization Modal ──────────────────────────────────────────────

function AuthModal({
  petId,
  petName,
  businessName,
  existing,
  petVet,
  onClose,
  onSaved,
}: {
  petId: string;
  petName: string;
  businessName: string;
  existing: AuthData | null;
  petVet?: { name?: string; phone?: string; address?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(existing ? (existing.authorizedUpToCents / 100).toString() : '500');
  const [vetName, setVetName] = useState(existing?.vetName || petVet?.name || '');
  const [vetPhone, setVetPhone] = useState(existing?.vetPhone || petVet?.phone || '');
  const [vetAddress, setVetAddress] = useState(existing?.vetAddress || petVet?.address || '');
  const [instructions, setInstructions] = useState(existing?.additionalInstructions || '');
  const [signatureName, setSignatureName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) {
      toastError('Enter a valid dollar amount');
      return;
    }
    if (!signatureName.trim()) {
      toastError('Type your full name to sign');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/client/pets/${petId}/emergency-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorizedUpToCents: cents,
          vetName: vetName.trim() || null,
          vetPhone: vetPhone.trim() || null,
          vetAddress: vetAddress.trim() || null,
          additionalInstructions: instructions.trim() || null,
          signatureName: signatureName.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      toastSuccess('Emergency authorization signed');
      onSaved();
    } catch (err: any) {
      toastError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled outline-none focus:border-border-focus focus:ring-1 focus:ring-border-focus';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-default bg-surface-primary px-5 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Emergency Vet Authorization</h2>
          <button type="button" onClick={onClose} className="text-sm text-text-tertiary hover:text-text-primary">
            Cancel
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Authorize up to</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-text-tertiary">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
                min="1"
                className={inputClass}
              />
            </div>
          </div>

          {/* Vet info */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Preferred vet</label>
            <input value={vetName} onChange={(e) => setVetName(e.target.value)} placeholder="Vet name" className={`${inputClass} mb-2`} />
            <input value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} placeholder="Vet phone" type="tel" className={`${inputClass} mb-2`} />
            <input value={vetAddress} onChange={(e) => setVetAddress(e.target.value)} placeholder="Vet address" className={inputClass} />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Additional instructions (optional)</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Allergies, medications, special conditions..."
              rows={2}
              className={`${inputClass} resize-y`}
            />
          </div>

          {/* Legal text */}
          <div className="rounded-lg bg-surface-secondary p-3 text-xs text-text-secondary leading-relaxed">
            I authorize {businessName} and their sitters to approve emergency veterinary care
            for <strong>{petName}</strong> up to the authorized amount if I cannot be reached within
            30 minutes of an emergency. This authorization is valid for one year from the date of signing.
          </div>

          {/* Signature */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Type your full name to sign
            </label>
            <input
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Your full legal name"
              className={`${inputClass} font-serif italic`}
            />
            <p className="mt-1 text-[10px] text-text-disabled">
              By typing your name, you agree to the authorization above.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={() => void handleSave()}
            disabled={saving || !signatureName.trim() || !amount}
            className="w-full"
          >
            <FileSignature className="h-4 w-4 mr-2" />
            {saving ? 'Signing...' : 'Sign and save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
