'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Home, Phone, Share2 } from 'lucide-react';
import { LayoutWrapper, ClientRefreshButton } from '@/components/layout';
import { ChangePasswordSection } from '@/components/auth/ChangePasswordSection';
import { AppCard, AppCardBody, AppCardHeader, AppErrorState } from '@/components/app';
import { Button, Modal } from '@/components/ui';
import { toastSuccess, toastError } from '@/lib/toast';
import {
  useClientProfile,
  useUpdateClientProfile,
  useAddEmergencyContact,
  useDeleteEmergencyContact,
  useClientReferral,
  type ClientProfileData,
  type ClientEmergencyContact,
} from '@/lib/api/client-hooks';

const inputClass = 'w-full min-h-[44px] rounded-xl border border-border-default bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus';

export default function ClientProfilePage() {
  const { data, isLoading: loading, error, refetch } = useClientProfile();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const profileData = data?.profile ?? null;
  const contacts = data?.contacts ?? [];

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/client/delete-account', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed');
      setDeleteModalOpen(false);
      await signOut({ callbackUrl: '/login' });
    } catch (e) { toastError(e instanceof Error ? e.message : 'Failed to delete account'); }
    finally { setDeleting(false); }
  };

  return (
    <LayoutWrapper variant="narrow">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-text-primary font-heading leading-tight sm:text-2xl">
            Profile
          </h1>
          <p className="text-[14px] text-text-secondary mt-0.5">Your account settings</p>
        </div>
        <ClientRefreshButton onRefresh={refetch} loading={loading} />
      </div>

      {loading ? (
        <ProfileSkeleton />
      ) : error ? (
        <AppErrorState title="Couldn't load profile" subtitle={error.message || 'Unable to load'} onRetry={() => void refetch()} />
      ) : profileData ? (
        <div className="space-y-4 mt-4 pb-8">
          <div className="grid gap-4 md:grid-cols-2">
            <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
              <AppCardHeader title="Your account should stay simple and trustworthy" />
              <AppCardBody className="space-y-2 text-sm text-text-secondary">
                <p>Keep contact details, home information, and emergency contacts up to date so your care team never has to guess when they are preparing for a visit.</p>
                <p>This page is also where security and export controls live, so you always know how your account is being managed.</p>
              </AppCardBody>
            </AppCard>
            <AppCard>
              <AppCardHeader title="Best next moves" />
              <AppCardBody className="space-y-2 text-sm text-text-secondary">
                <p>Review your address and phone details before upcoming visits.</p>
                <p>Add emergency contacts and home access information so the team can act confidently if plans change.</p>
              </AppCardBody>
            </AppCard>
          </div>

          {/* Account header */}
          <div className="rounded-2xl bg-accent-tertiary p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-accent-primary flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-text-inverse">
                  {(profileData.firstName || profileData.name || 'C').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-text-primary truncate">{profileData.name || 'Client'}</p>
                {profileData.email && <p className="text-[13px] text-text-secondary truncate mt-0.5">{profileData.email}</p>}
              </div>
            </div>
          </div>

          <EditableProfileSection data={profileData} onSaved={refetch} />
          <HomeAccessSection data={profileData} onSaved={refetch} />
          <EmergencyContactsSection contacts={contacts} onChanged={refetch} />
          <ReferralSection />

          <ChangePasswordSection />

          <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Account</h3>
            </div>
            <div className="px-5 pb-5 space-y-2">
              <a href="/client/settings/export" className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-border-default bg-surface-primary px-4 text-[13px] font-medium text-text-secondary hover:bg-surface-secondary transition-colors">
                Export your data
              </a>
              <Button variant="secondary" size="md" onClick={() => signOut({ callbackUrl: '/login' })} className="w-full">
                Sign out
              </Button>
            </div>
          </div>

          <div className="pt-6 mt-2 border-t border-border-muted">
            <div className="rounded-2xl border border-border-default bg-surface-primary p-5 shadow-sm">
              <p className="mb-2 text-[14px] font-semibold text-text-primary">Delete account</p>
              <p className="mb-3 text-[13px] text-text-tertiary">Permanently delete your account. This cannot be undone.</p>
              <Button variant="danger" size="md" onClick={() => setDeleteModalOpen(true)}>
                Delete account
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal isOpen={deleteModalOpen} onClose={() => !deleting && setDeleteModalOpen(false)} title="Delete account" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={() => void handleDeleteAccount()} disabled={deleting}>
              {deleting ? 'Deleting\u2026' : 'Delete account'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-tertiary">Are you sure? This will permanently delete your account.</p>
      </Modal>
    </LayoutWrapper>
  );
}

/* ─── Editable Profile Section ──────────────────────────────────────── */

function EditableProfileSection({ data, onSaved }: { data: ClientProfileData; onSaved: () => void }) {
  const updateProfile = useUpdateClientProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '' });

  const handleEdit = () => {
    setDraft({
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        firstName: draft.firstName.trim() || null,
        lastName: draft.lastName.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        address: draft.address.trim() || null,
      });
      toastSuccess('Profile updated');
      setEditing(false);
      onSaved();
    } catch { toastError('Failed to save'); }
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Personal info</h3>
        {!editing && <button type="button" onClick={handleEdit} className="min-h-[44px] text-[12px] font-semibold text-accent-primary hover:underline">Edit</button>}
      </div>
      <div className="px-5 pb-5">
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[11px] text-text-tertiary mb-1">First name</label><input value={draft.firstName} onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-[11px] text-text-tertiary mb-1">Last name</label><input value={draft.lastName} onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))} className={inputClass} /></div>
            </div>
            <div><label className="block text-[11px] text-text-tertiary mb-1">Email</label><input type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} className={inputClass} /></div>
            <div><label className="block text-[11px] text-text-tertiary mb-1">Phone</label><input type="tel" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} className={inputClass} /></div>
            <div><label className="block text-[11px] text-text-tertiary mb-1">Address</label><input value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} placeholder="123 Main St, City, State" className={inputClass} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="md" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="primary" size="md" onClick={handleSave} disabled={updateProfile.isPending} isLoading={updateProfile.isPending}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-text-tertiary">Name</p>
              <p className="text-[14px] font-medium text-text-primary mt-0.5">{data.name || 'Client'}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-tertiary">Email</p>
              <p className="text-[14px] text-text-primary mt-0.5">{data.email || '\u2014'}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-tertiary">Phone</p>
              <p className="text-[14px] text-text-primary mt-0.5">{data.phone || '\u2014'}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-tertiary">Address</p>
              {data.address ? <p className="text-[14px] text-text-primary mt-0.5">{data.address}</p> : <p className="text-[13px] text-text-tertiary italic mt-0.5">No address on file</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Referral Section ──────────────────────────────────────────────── */

function ReferralSection() {
  const { data, isLoading } = useClientReferral();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!data?.referralCode) return;
    const text = `Book pet care with Snout and we both get $10 off! Use code ${data.referralCode} at snoutservices.com`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      await navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return null;

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
          <Share2 className="w-3.5 h-3.5" /> Refer a friend
        </h3>
      </div>
      <div className="px-5 pb-5">
        <p className="text-[13px] text-text-secondary mb-3">
          Share your code and you both get $10 off your next booking.
        </p>
        {data?.referralCode ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-border-default bg-surface-secondary px-4 py-2.5 font-mono text-sm font-semibold text-text-primary tracking-wider">
                {data.referralCode}
              </div>
              <Button variant="secondary" size="md" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy code'}
              </Button>
            </div>
            {data.referralCount > 0 && (
              <p className="text-[12px] text-text-tertiary">
                {data.referralCount} friend{data.referralCount !== 1 ? 's' : ''} joined with your code
              </p>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-text-tertiary italic">Referral code unavailable</p>
        )}
      </div>
    </div>
  );
}

/* ─── Home Access Section ───────────────────────────────────────────── */

function MaskedField({ label, value }: { label: string; value: string | null }) {
  const [revealed, setRevealed] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-[11px] text-text-tertiary">{label}</p>
        <p className="text-[13px] text-text-primary font-mono">{revealed ? value : '\u2022\u2022\u2022\u2022\u2022\u2022'}</p>
      </div>
      <button type="button" onClick={() => setRevealed(!revealed)} className="min-h-[44px] min-w-[44px] text-[12px] font-medium text-accent-primary hover:underline">
        {revealed ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function HomeAccessSection({ data, onSaved }: { data: ClientProfileData; onSaved: () => void }) {
  const updateProfile = useUpdateClientProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    keyLocation: '', lockboxCode: '', doorAlarmCode: '',
    wifiNetwork: '', wifiPassword: '', entryInstructions: '', parkingNotes: '',
  });
  const hasAny = data.keyLocation || data.lockboxCode || data.doorAlarmCode || data.wifiNetwork || data.entryInstructions || data.parkingNotes;

  const handleEdit = () => {
    setDraft({
      keyLocation: data.keyLocation || '', lockboxCode: data.lockboxCode || '',
      doorAlarmCode: data.doorAlarmCode || '', wifiNetwork: data.wifiNetwork || '',
      wifiPassword: data.wifiPassword || '', entryInstructions: data.entryInstructions || '',
      parkingNotes: data.parkingNotes || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      const body: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(draft)) body[k] = v.trim() || null;
      await updateProfile.mutateAsync(body as any);
      toastSuccess('Home access info saved');
      setEditing(false);
      onSaved();
    } catch { toastError('Failed to save'); }
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
          <Home className="w-3.5 h-3.5" /> Home access
        </h3>
        {!editing && <button type="button" onClick={handleEdit} className="min-h-[44px] text-[12px] font-semibold text-accent-primary hover:underline">Edit</button>}
      </div>
      <div className="px-5 pb-5">
        {editing ? (
          <div className="space-y-3">
            <div><label className="block text-[11px] text-text-tertiary mb-1">Key location</label><input value={draft.keyLocation} onChange={(e) => setDraft((d) => ({ ...d, keyLocation: e.target.value }))} placeholder="Under the mat, lockbox on porch\u2026" className={inputClass} /></div>
            <div><label className="block text-[11px] text-text-tertiary mb-1">Lockbox code</label><input value={draft.lockboxCode} onChange={(e) => setDraft((d) => ({ ...d, lockboxCode: e.target.value }))} placeholder="1234" className={inputClass} /></div>
            <div><label className="block text-[11px] text-text-tertiary mb-1">Door / alarm code</label><input value={draft.doorAlarmCode} onChange={(e) => setDraft((d) => ({ ...d, doorAlarmCode: e.target.value }))} placeholder="4567#" className={inputClass} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[11px] text-text-tertiary mb-1">WiFi network</label><input value={draft.wifiNetwork} onChange={(e) => setDraft((d) => ({ ...d, wifiNetwork: e.target.value }))} className={inputClass} /></div>
              <div><label className="block text-[11px] text-text-tertiary mb-1">WiFi password</label><input value={draft.wifiPassword} onChange={(e) => setDraft((d) => ({ ...d, wifiPassword: e.target.value }))} className={inputClass} /></div>
            </div>
            <div><label className="block text-[11px] text-text-tertiary mb-1">Entry instructions</label><textarea value={draft.entryInstructions} onChange={(e) => setDraft((d) => ({ ...d, entryInstructions: e.target.value }))} rows={2} placeholder="Use side gate, ring doorbell\u2026" className={`${inputClass} resize-y`} /></div>
            <div><label className="block text-[11px] text-text-tertiary mb-1">Parking</label><input value={draft.parkingNotes} onChange={(e) => setDraft((d) => ({ ...d, parkingNotes: e.target.value }))} placeholder="Driveway, street parking\u2026" className={inputClass} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="md" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="primary" size="md" onClick={handleSave} disabled={updateProfile.isPending} isLoading={updateProfile.isPending}>Save</Button>
            </div>
          </div>
        ) : hasAny ? (
          <div className="space-y-2.5">
            {data.keyLocation && <div><p className="text-[11px] text-text-tertiary">Key location</p><p className="text-[13px] text-text-primary">{data.keyLocation}</p></div>}
            <MaskedField label="Lockbox code" value={data.lockboxCode} />
            <MaskedField label="Door / alarm code" value={data.doorAlarmCode} />
            {data.wifiNetwork && <div><p className="text-[11px] text-text-tertiary">WiFi</p><p className="text-[13px] text-text-primary">{data.wifiNetwork}</p></div>}
            <MaskedField label="WiFi password" value={data.wifiPassword} />
            {data.entryInstructions && <div><p className="text-[11px] text-text-tertiary">Entry instructions</p><p className="text-[13px] text-text-secondary whitespace-pre-wrap">{data.entryInstructions}</p></div>}
            {data.parkingNotes && <div><p className="text-[11px] text-text-tertiary">Parking</p><p className="text-[13px] text-text-secondary">{data.parkingNotes}</p></div>}
          </div>
        ) : (
          <p className="text-[13px] text-text-tertiary italic">No home access info yet. Tap edit to add key location, codes, and entry instructions.</p>
        )}
      </div>
    </div>
  );
}

/* ─── Emergency Contacts Section ────────────────────────────────────── */

function EmergencyContactsSection({ contacts, onChanged }: { contacts: ClientEmergencyContact[]; onChanged: () => void }) {
  const addContact = useAddEmergencyContact();
  const deleteContact = useDeleteEmergencyContact();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', phone: '', relationship: '' });

  const handleAdd = async () => {
    if (!draft.name.trim() || !draft.phone.trim()) { toastError('Name and phone are required'); return; }
    if (draft.phone.replace(/\D/g, '').length < 10) { toastError('Please enter a valid phone number'); return; }
    try {
      await addContact.mutateAsync({ name: draft.name.trim(), phone: draft.phone.trim(), relationship: draft.relationship.trim() || undefined });
      toastSuccess('Contact added');
      setDraft({ name: '', phone: '', relationship: '' });
      setAdding(false);
      onChanged();
    } catch { toastError('Failed to add contact'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteContact.mutateAsync(id);
      toastSuccess('Contact removed');
      onChanged();
    } catch { toastError('Failed to remove'); }
  };

  return (
    <div className="rounded-2xl border border-border-default bg-surface-primary shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
          <Phone className="w-3.5 h-3.5" /> Emergency contacts
        </h3>
        {!adding && <button type="button" onClick={() => setAdding(true)} className="min-h-[44px] text-[12px] font-semibold text-accent-primary hover:underline">Add</button>}
      </div>
      <div className="px-5 pb-5">
        {contacts.length > 0 && (
          <div className="space-y-3 mb-3">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1">
                <div>
                  <p className="text-[14px] font-medium text-text-primary">{c.name}{c.relationship ? ` (${c.relationship})` : ''}</p>
                  <a href={`tel:${c.phone}`} className="text-[13px] text-accent-primary hover:underline">{c.phone}</a>
                </div>
                <button type="button" onClick={() => handleDelete(c.id)} className="min-h-[44px] min-w-[44px] text-[12px] text-status-danger-text hover:underline">Remove</button>
              </div>
            ))}
          </div>
        )}
        {contacts.length === 0 && !adding && (
          <p className="text-[13px] text-text-tertiary italic mb-2">No emergency contacts yet. Add one so your sitter knows who to call.</p>
        )}
        {adding && (
          <div className="space-y-3 rounded-xl border border-border-default bg-surface-secondary p-4">
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Name" className={inputClass} />
            <input type="tel" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="Phone number" className={inputClass} />
            <input value={draft.relationship} onChange={(e) => setDraft((d) => ({ ...d, relationship: e.target.value }))} placeholder="Relationship (optional)" className={inputClass} />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="md" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="primary" size="md" onClick={handleAdd} disabled={addContact.isPending} isLoading={addContact.isPending}>Add</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Skeleton ──────────────────────────────────────────────────────── */

function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse mt-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-border-default bg-surface-primary overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="h-3 w-24 rounded bg-surface-tertiary" />
          </div>
          <div className="px-5 pb-5 space-y-2">
            <div className="h-4 w-40 rounded bg-surface-tertiary" />
            <div className="h-3 w-48 rounded bg-surface-tertiary" />
            <div className="h-3 w-36 rounded bg-surface-tertiary" />
          </div>
        </div>
      ))}
    </div>
  );
}
