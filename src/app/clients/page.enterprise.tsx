'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, UserPlus } from 'lucide-react';
import { OwnerAppShell, LayoutWrapper, PageHeader } from '@/components/layout';
import { AppCard, AppCardBody, AppCardHeader } from '@/components/app';
import { Button, Modal, TableSkeleton } from '@/components/ui';
import { toastSuccess, toastError } from '@/lib/toast';
import { DirectoryTab } from './tabs/DirectoryTab';
import { WaitlistTab } from './tabs/WaitlistTab';

type ClientsTab = 'directory' | 'waitlist';

function ClientsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as ClientsTab | null;
  const [activeTab, setActiveTab] = useState<ClientsTab>(
    tabParam === 'waitlist' ? 'waitlist' : 'directory'
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', phone: '', email: '', address: '' });
  const [addLoading, setAddLoading] = useState(false);

  async function handleAddClient() {
    if (!addForm.firstName.trim() || !addForm.lastName.trim() || !addForm.phone.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: addForm.firstName.trim(),
          lastName: addForm.lastName.trim(),
          phone: addForm.phone.trim(),
          email: addForm.email.trim() || undefined,
          address: addForm.address.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to add client');
      toastSuccess('Client added');
      setShowAddModal(false);
      setAddForm({ firstName: '', lastName: '', phone: '', email: '', address: '' });
      // Trigger a page refresh to reload the directory
      router.refresh();
    } catch (err: any) {
      toastError(err.message || 'Failed to add client');
    } finally {
      setAddLoading(false);
    }
  }

  const changeTab = (tab: ClientsTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'directory') params.delete('tab');
    else params.set('tab', tab);
    router.replace(`/clients${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
  };

  return (
    <OwnerAppShell>
      <LayoutWrapper variant="wide">
        <PageHeader
          title="Clients"
          subtitle={activeTab === 'directory'
            ? 'Manage every client relationship, from first request through repeat care and retention.'
            : 'Keep waitlisted families warm and visible so availability turns into booked revenue faster.'}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-lg border border-border-default bg-surface-primary p-0.5">
                <button
                  type="button"
                  onClick={() => changeTab('directory')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    activeTab === 'directory'
                      ? 'bg-surface-inverse text-text-inverse'
                      : 'text-text-secondary hover:bg-surface-tertiary'
                  }`}
                >
                  Directory
                </button>
                <button
                  type="button"
                  onClick={() => changeTab('waitlist')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    activeTab === 'waitlist'
                      ? 'bg-surface-inverse text-text-inverse'
                      : 'text-text-secondary hover:bg-surface-tertiary'
                  }`}
                >
                  Waitlist
                </button>
              </div>
              <Button variant="secondary" onClick={() => setShowAddModal(true)} leftIcon={<UserPlus className="w-3.5 h-3.5" />}>
                Add client
              </Button>
              <Link href="/bookings/new">
                <Button leftIcon={<Plus className="w-3.5 h-3.5" />}>New booking</Button>
              </Link>
            </div>
          }
        />

        <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]">
          <AppCard className="bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.12),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
            <AppCardHeader title={activeTab === 'directory' ? 'Your client relationship hub' : 'Your waitlist follow-up hub'} />
            <AppCardBody className="space-y-3">
              <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                {activeTab === 'directory'
                  ? 'A polished client system should make every family easy to find, easy to support, and easy to move back into active booking without extra admin friction.'
                  : 'The waitlist should feel like a live revenue opportunity, not a forgotten spreadsheet. Keep leads visible, then turn openings into fast follow-up and confident booking.'}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="secondary" size="sm" onClick={() => setShowAddModal(true)} leftIcon={<UserPlus className="h-3.5 w-3.5" />}>
                  Add client
                </Button>
                <Link href="/bookings/new">
                  <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>Create booking</Button>
                </Link>
              </div>
            </AppCardBody>
          </AppCard>

          <AppCard>
            <AppCardHeader title="What elite looks like" />
            <AppCardBody className="space-y-2 text-sm text-text-secondary">
              <p>Families should feel remembered, not re-entered, every time they come back.</p>
              <p>Owners should be able to find contact details, recent activity, and booking history without digging.</p>
              <p>Waitlist follow-up should stay close to the booking workflow so open capacity turns into revenue quickly.</p>
            </AppCardBody>
          </AppCard>
        </div>

        {activeTab === 'directory' && <DirectoryTab />}
        {activeTab === 'waitlist' && <WaitlistTab />}

        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add client">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">First name *</label>
                <input type="text" value={addForm.firstName} onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Last name *</label>
                <input type="text" value={addForm.lastName} onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Phone *</label>
              <input type="tel" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
              <input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Address</label>
              <input type="text" value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} className="w-full min-h-[44px] rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleAddClient} disabled={addLoading || !addForm.firstName.trim() || !addForm.lastName.trim() || !addForm.phone.trim()}>
                {addLoading ? 'Adding...' : 'Add client'}
              </Button>
            </div>
          </div>
        </Modal>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}

export default function ClientsEnterprisePage() {
  return (
    <Suspense fallback={<OwnerAppShell><LayoutWrapper variant="wide"><TableSkeleton rows={8} cols={4} /></LayoutWrapper></OwnerAppShell>}>
      <ClientsContent />
    </Suspense>
  );
}
