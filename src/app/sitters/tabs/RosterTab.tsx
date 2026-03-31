'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MoreVertical, User, Power } from 'lucide-react';
import { Section } from '@/components/layout';
import { AppErrorState, AppFilterBar } from '@/components/app';
import {
  DataTableShell,
  EmptyState,
  Table,
  TableSkeleton,
  Button,
  StatusChip,
  Modal,
  Input,
  IconButton,
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui';
import { MobileFilterDrawer } from '@/components/app/MobileFilterDrawer';
import { toastSuccess, toastError } from '@/lib/toast';

type SitterRow = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
  commissionPercentage?: number;
  onboardingStatus?: string;
};

const defaultAddForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  commissionPercentage: 80,
};

export function RosterTab() {
  const router = useRouter();
  const [rows, setRows] = useState<SitterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({ search: '', active: 'all' });
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [total, setTotal] = useState(0);

  // Part A: Add sitter modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(defaultAddForm);
  const [addLoading, setAddLoading] = useState(false);

  // Part B: Row action menu state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (filters.search) params.set('search', filters.search);
      if (filters.active && filters.active !== 'all') params.set('status', filters.active);
      const res = await fetch(`/api/sitters?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load sitters');
      setRows(Array.isArray(json.items) ? json.items : []);
      setTotal(typeof json.total === 'number' ? json.total : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sitters');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, pageSize, filters.search, filters.active]);

  const filtered = useMemo(() => rows, [rows]);
  const activeFilterCount = Number(Boolean(filters.search)) + Number(filters.active !== 'all');

  // Part A: Handle add sitter submit
  async function handleAddSitter() {
    if (!addForm.firstName.trim() || !addForm.lastName.trim() || !addForm.email.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/ops/sitters/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: addForm.firstName.trim(),
          lastName: addForm.lastName.trim(),
          email: addForm.email.trim(),
          phone: addForm.phone.trim() || undefined,
          commissionPercentage: addForm.commissionPercentage,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to invite sitter');
      // Copy invite link to clipboard
      if (json.inviteLink) {
        try { await navigator.clipboard.writeText(json.inviteLink); } catch {}
      }
      toastSuccess('Sitter invited — invite link copied to clipboard');
      setShowAddModal(false);
      setAddForm(defaultAddForm);
      void load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to add sitter');
    } finally {
      setAddLoading(false);
    }
  }

  // Part B: Handle deactivate / reactivate
  async function handleToggleActive(sitter: SitterRow) {
    const newActive = !sitter.isActive;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sitters/${sitter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to update sitter');
      toastSuccess(newActive ? `${sitter.firstName} reactivated` : `${sitter.firstName} deactivated`);
      setConfirmDeactivateId(null);
      setMenuOpenId(null);
      void load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to update sitter');
    } finally {
      setActionLoading(false);
    }
  }

  // Find the sitter being confirmed for deactivation
  const confirmSitter = confirmDeactivateId ? rows.find((r) => r.id === confirmDeactivateId) : null;

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          <span className="inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Add sitter
          </span>
        </Button>
        <Link href="/bookings?view=calendar">
          <Button variant="secondary" size="sm">View schedule</Button>
        </Link>
      </div>

      {/* Part A: Add sitter modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          if (!addLoading) {
            setShowAddModal(false);
            setAddForm(defaultAddForm);
          }
        }}
        title="Add sitter"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowAddModal(false);
                setAddForm(defaultAddForm);
              }}
              disabled={addLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddSitter}
              disabled={addLoading || !addForm.firstName.trim() || !addForm.lastName.trim() || !addForm.email.trim()}
            >
              {addLoading ? 'Adding\u2026' : 'Add sitter'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="First name"
            required
            value={addForm.firstName}
            onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
            placeholder="First name"
            size="sm"
          />
          <Input
            label="Last name"
            required
            value={addForm.lastName}
            onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
            placeholder="Last name"
            size="sm"
          />
          <Input
            label="Email"
            required
            type="email"
            value={addForm.email}
            onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="email@example.com"
            size="sm"
          />
          <Input
            label="Phone"
            type="tel"
            value={addForm.phone}
            onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="(optional)"
            size="sm"
          />
          <Input
            label="Commission %"
            type="number"
            min={0}
            max={100}
            value={String(addForm.commissionPercentage)}
            onChange={(e) =>
              setAddForm((f) => ({
                ...f,
                commissionPercentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              }))
            }
            size="sm"
          />
        </div>
      </Modal>

      {/* Part B: Deactivate confirmation modal */}
      <Modal
        isOpen={!!confirmSitter}
        onClose={() => {
          if (!actionLoading) setConfirmDeactivateId(null);
        }}
        title={confirmSitter?.isActive ? 'Deactivate sitter' : 'Reactivate sitter'}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDeactivateId(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant={confirmSitter?.isActive ? 'danger' : 'primary'}
              size="sm"
              onClick={() => confirmSitter && handleToggleActive(confirmSitter)}
              disabled={actionLoading}
            >
              {actionLoading
                ? (confirmSitter?.isActive ? 'Deactivating\u2026' : 'Reactivating\u2026')
                : (confirmSitter?.isActive ? 'Deactivate' : 'Reactivate')}
            </Button>
          </>
        }
      >
        {confirmSitter?.isActive ? (
          <p className="text-sm text-text-secondary">
            Deactivate {confirmSitter.firstName} {confirmSitter.lastName}? They won&apos;t be assigned new bookings.
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            Reactivate {confirmSitter?.firstName} {confirmSitter?.lastName}? They will be available for new bookings.
          </p>
        )}
      </Modal>

      <Section>
        <MobileFilterDrawer triggerLabel="Filters" activeCount={activeFilterCount}>
          <AppFilterBar
            filters={[
              { key: 'search', label: 'Search', type: 'search', placeholder: 'Name or email' },
              {
                key: 'active',
                label: 'Availability',
                type: 'select',
                options: [
                  { value: 'all', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ],
              },
            ]}
            values={filters}
            onChange={(k, v) => {
              setFilters((p) => ({ ...p, [k]: v }));
              setPage(1);
            }}
            onClear={() => {
              setFilters({ search: '', active: 'all' });
              setPage(1);
            }}
          />
        </MobileFilterDrawer>
      </Section>

      <Section>
        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : error ? (
          <AppErrorState title="Couldn't load sitters" onRetry={() => void load()} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No sitters found" description="Add or activate sitters to resolve staffing quickly." />
        ) : (
          <>
            <DataTableShell stickyHeader>
              <Table<SitterRow>
                forceTableLayout
                columns={[
                  {
                    key: 'name',
                    header: 'Sitter',
                    mobileOrder: 1,
                    mobileLabel: 'Sitter',
                    render: (r) => (
                      <div>
                        <div className="font-medium">{r.firstName} {r.lastName}</div>
                        {r.email && <div className="text-xs text-text-secondary">{r.email}</div>}
                      </div>
                    ),
                  },
                  { key: 'phone', header: 'Phone', mobileOrder: 2, mobileLabel: 'Phone', render: (r) => r.phone || '\u2014' },
                  {
                    key: 'active',
                    header: 'Status',
                    mobileOrder: 3,
                    mobileLabel: 'Status',
                    render: (r) => {
                      const status = r.onboardingStatus || (r.isActive ? 'active' : 'deactivated');
                      const chipMap: Record<string, { variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral'; label: string }> = {
                        active: { variant: 'success', label: 'Active' },
                        invited: { variant: 'info', label: 'Invited' },
                        onboarding: { variant: 'warning', label: 'Onboarding' },
                        pending_review: { variant: 'warning', label: 'Pending Review' },
                        rejected: { variant: 'danger', label: 'Rejected' },
                        deactivated: { variant: 'neutral', label: 'Inactive' },
                      };
                      const chip = chipMap[status] || { variant: 'neutral' as const, label: status };
                      return <StatusChip variant={chip.variant}>{chip.label}</StatusChip>;
                    },
                  },
                  {
                    key: 'commission',
                    header: 'Commission',
                    mobileOrder: 4,
                    mobileLabel: 'Commission',
                    hideBelow: 'md',
                    render: (r) => `${r.commissionPercentage || 0}%`,
                  },
                  {
                    key: 'actions',
                    header: '',
                    mobileOrder: 5,
                    render: (r) => (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex justify-end"
                      >
                        <DropdownMenu
                          trigger={
                            <IconButton
                              icon={<MoreVertical className="w-4 h-4" />}
                              variant="ghost"
                              size="sm"
                              aria-label={`Actions for ${r.firstName} ${r.lastName}`}
                            />
                          }
                          placement="bottom-end"
                        >
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              icon={<User className="w-4 h-4" />}
                              onClick={() => router.push(`/sitters/${r.id}`)}
                            >
                              View profile
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              icon={<Power className="w-4 h-4" />}
                              variant={r.isActive ? 'danger' : 'default'}
                              onClick={() => setConfirmDeactivateId(r.id)}
                            >
                              {r.isActive ? 'Deactivate' : 'Reactivate'}
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenu>
                      </div>
                    ),
                  },
                ]}
                data={filtered}
                keyExtractor={(r) => r.id}
                onRowClick={(r) => router.push(`/sitters/${r.id}`)}
                emptyMessage="No sitters"
              />
            </DataTableShell>
            <div className="mt-4 flex items-center justify-between border-t border-border-muted pt-3">
              <p className="text-xs text-text-tertiary tabular-nums">
                Showing {((page - 1) * pageSize) + 1}&ndash;{Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * pageSize >= total}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Section>
    </>
  );
}
