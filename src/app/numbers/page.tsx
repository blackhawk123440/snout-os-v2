/**
 * Numbers Inventory Page - Refactored with Safety Guardrails
 * 
 * Requirements:
 * - No hard deletes (state transitions only)
 * - Standardized Actions menu (⋯) for every number
 * - Actions enabled/disabled based on state, never hidden
 * - Tooltips for disabled actions
 * - Confirmation modals for risky actions
 * - Deactivate Sitter functionality
 */

'use client';

import { useState } from 'react';
import React from 'react';
import { MoreVertical, Eye, ArrowLeftRight, UserPlus, Undo2, Ban, CheckCircle2, Trash2, UserX } from 'lucide-react';
import { OwnerAppShell } from '@/components/layout';
import { PageHeader, Card, Button, Badge, Skeleton, Table, TableColumn, EmptyState, Modal, Input, Textarea, Tooltip, Drawer, DropdownMenu, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, IconButton } from '@/components/ui';
import { useAuth } from '@/lib/auth-client';
import {
  useNumbers,
  useBuyNumber,
  useImportNumber,
  useQuarantineNumber,
  useReleaseNumber,
  useAssignToSitter,
  useReleaseToPool,
  useReleaseFromTwilio,
  useSitters,
  useNumberDetail,
  useChangeNumberClass,
  useDeactivateSitter,
  useSitterAssignmentWindows,
  type Number,
} from '@/lib/api/numbers-hooks';

type ActionType = 
  | 'view-details'
  | 'change-class'
  | 'assign-sitter'
  | 'release-to-pool'
  | 'quarantine'
  | 'restore'
  | 'release-from-twilio';

interface ActionState {
  enabled: boolean;
  tooltip?: string;
}

function getActionState(
  action: ActionType,
  number: Number & { activeThreadCount?: number | null },
): ActionState {
  const activeThreads = number.activeThreadCount ?? 0;
  const isQuarantined = number.status === 'quarantined';
  const isActive = number.status === 'active';
  const isSitterNumber = number.class === 'sitter';
  const hasSitter = !!number.assignedSitterId;

  switch (action) {
    case 'view-details':
      return { enabled: true };

    case 'change-class':
      return {
        enabled: activeThreads === 0,
        tooltip: activeThreads > 0 
          ? `Cannot change class: ${activeThreads} active thread(s) using this number`
          : undefined,
      };

    case 'assign-sitter':
      return {
        enabled: isSitterNumber && !isQuarantined && isActive,
        tooltip: !isSitterNumber
          ? 'Only sitter numbers can be assigned'
          : isQuarantined
          ? 'Cannot assign quarantined number'
          : !isActive
          ? 'Number must be active'
          : undefined,
      };

    case 'release-to-pool':
      return {
        enabled: isSitterNumber && activeThreads === 0 && isActive,
        tooltip: !isSitterNumber
          ? 'Only sitter numbers can be released to pool'
          : activeThreads > 0
          ? `Cannot release: ${activeThreads} active thread(s) using this number`
          : !isActive
          ? 'Number must be active'
          : undefined,
      };

    case 'quarantine':
      return {
        enabled: isActive,
        tooltip: !isActive ? 'Number must be active to quarantine' : undefined,
      };

    case 'restore':
      return {
        enabled: isQuarantined,
        tooltip: !isQuarantined ? 'Number must be quarantined to restore' : undefined,
      };

    case 'release-from-twilio':
      return {
        enabled: activeThreads === 0 && !hasSitter && !isQuarantined && isActive,
        tooltip: activeThreads > 0
          ? `Cannot release: ${activeThreads} active thread(s) using this number`
          : hasSitter
          ? 'Cannot release: number is assigned to a sitter'
          : isQuarantined
          ? 'Cannot release: number is quarantined'
          : !isActive
          ? 'Number must be active'
          : undefined,
      };

    default:
      return { enabled: false };
  }
}

export default function NumbersPage() {
  const { isOwner, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<{ class?: string; status?: string }>({});
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showQuarantineModal, setShowQuarantineModal] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null);
  const [showReleaseModal, setShowReleaseModal] = useState<string | null>(null);
  const [showReleaseToPoolModal, setShowReleaseToPoolModal] = useState<string | null>(null);
  const [showChangeClassModal, setShowChangeClassModal] = useState<string | null>(null);
  const [showDeactivateSitterModal, setShowDeactivateSitterModal] = useState<string | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState<string | null>(null);
  const [showReleaseFromTwilioModal, setShowReleaseFromTwilioModal] = useState<string | null>(null);
  
  const [buyForm, setBuyForm] = useState({ class: 'front_desk' as 'front_desk' | 'sitter' | 'pool', areaCode: '', quantity: 1 });
  const [importForm, setImportForm] = useState({ e164: '', numberSid: '', class: 'front_desk' as 'front_desk' | 'sitter' | 'pool' });
  const [quarantineForm, setQuarantineForm] = useState({ reason: '', reasonDetail: '' });
  const [assignForm, setAssignForm] = useState({ sitterId: '' });
  const [changeClassForm, setChangeClassForm] = useState({ class: 'front_desk' as 'front_desk' | 'sitter' | 'pool' });
  const [selectedNumber, setSelectedNumber] = useState<Number | null>(null);

  const { data: numbers = [], isLoading } = useNumbers(filters);
  const { data: sitters = [] } = useSitters();
  const { data: numberDetail } = useNumberDetail(showDetailsDrawer);
  const buyNumber = useBuyNumber();
  const importNumber = useImportNumber();
  const quarantineNumber = useQuarantineNumber();
  const releaseNumber = useReleaseNumber();
  const assignToSitter = useAssignToSitter();
  const releaseToPool = useReleaseToPool();
  const releaseFromTwilio = useReleaseFromTwilio();
  const changeNumberClass = useChangeNumberClass();
  const deactivateSitter = useDeactivateSitter();

  // Get assignment windows for selected sitter (if deactivating)
  const { data: assignmentWindows = [] } = useSitterAssignmentWindows(
    showDeactivateSitterModal || null
  );
  const activeAssignments = assignmentWindows.filter((w: any) => w.status === 'active').length;

  if (authLoading) {
    return (
      <OwnerAppShell>
        <PageHeader title="Numbers" />
        <div className="p-4">
          <Skeleton height={400} />
        </div>
      </OwnerAppShell>
    );
  }

  if (!isOwner) {
    return (
      <OwnerAppShell>
        <PageHeader title="Numbers" />
        <div className="p-4">
          <Card>
            <p>Access denied. Owner access required.</p>
          </Card>
        </div>
      </OwnerAppShell>
    );
  }

  const handleBuy = async () => {
    try {
      await buyNumber.mutateAsync(buyForm);
      setShowBuyModal(false);
      setBuyForm({ class: 'front_desk', areaCode: '', quantity: 1 });
      alert('Number purchased successfully');
    } catch (error: any) {
      alert(`Failed to buy number: ${error.message}`);
    }
  };

  const handleImport = async () => {
    if (!importForm.e164 && !importForm.numberSid) {
      alert('Please enter either E164 or Number SID');
      return;
    }

    // Validate and format E.164 if provided
    if (importForm.e164) {
      let cleaned = importForm.e164.replace(/[\s\-\(\)]/g, '');
      
      if (!cleaned.startsWith('+')) {
        if (cleaned.startsWith('1') && cleaned.length === 11) {
          cleaned = '+' + cleaned;
        } else if (cleaned.length === 10) {
          cleaned = '+1' + cleaned;
        } else {
          alert('E.164 format invalid. Please enter number in E.164 format (e.g., +15551234567)');
          return;
        }
      }

      if (!/^\+[1-9]\d{1,14}$/.test(cleaned)) {
        alert('Invalid E.164 format. Must start with + followed by country code and number (e.g., +15551234567)');
        return;
      }

      importForm.e164 = cleaned;
    }

    try {
      await importNumber.mutateAsync(importForm);
      setShowImportModal(false);
      setImportForm({ e164: '', numberSid: '', class: 'front_desk' });
      alert('Number imported successfully');
    } catch (error: any) {
      alert(`Failed to import number: ${error.message}`);
    }
  };

  const handleQuarantine = async () => {
    if (!showQuarantineModal || !quarantineForm.reason) return;
    try {
      const result = await quarantineNumber.mutateAsync({
        numberId: showQuarantineModal,
        reason: quarantineForm.reason,
        reasonDetail: quarantineForm.reasonDetail,
      });
      alert(`Number quarantined. Impact: ${result.impact.message}`);
      setShowQuarantineModal(null);
      setQuarantineForm({ reason: '', reasonDetail: '' });
    } catch (error: any) {
      alert(`Failed to quarantine: ${error.message}`);
    }
  };

  const handleRelease = async (forceRestore = false) => {
    if (!showReleaseModal) return;
    try {
      await releaseNumber.mutateAsync({
        numberId: showReleaseModal,
        forceRestore,
        restoreReason: forceRestore ? 'Manual owner override' : undefined,
      });
      setShowReleaseModal(null);
      alert(forceRestore ? 'Number restored from quarantine (cooldown overridden)' : 'Number released from quarantine');
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      if (errorMsg.includes('Cooldown period not complete')) {
        alert(`${errorMsg}\n\nUse "Restore Now" to override the cooldown period.`);
      } else {
        alert(`Failed to release: ${errorMsg}`);
      }
    }
  };

  const handleAssign = async () => {
    if (!showAssignModal || !assignForm.sitterId) return;
    try {
      await assignToSitter.mutateAsync({
        numberId: showAssignModal,
        sitterId: assignForm.sitterId,
      });
      setShowAssignModal(null);
      setAssignForm({ sitterId: '' });
      alert('Number assigned to sitter');
    } catch (error: any) {
      alert(`Failed to assign: ${error.message}`);
    }
  };

  const handleReleaseToPool = async () => {
    if (!showReleaseToPoolModal) return;
    try {
      const result = await releaseToPool.mutateAsync(showReleaseToPoolModal);
      alert(`Number released to pool. Impact: ${result.impact.message}`);
      setShowReleaseToPoolModal(null);
    } catch (error: any) {
      alert(`Failed to release to pool: ${error.message}`);
    }
  };

  const handleChangeClass = async () => {
    if (!showChangeClassModal) return;
    try {
      await changeNumberClass.mutateAsync({
        numberId: showChangeClassModal,
        class: changeClassForm.class,
      });
      alert(`Number class changed to ${changeClassForm.class}`);
      setShowChangeClassModal(null);
      setChangeClassForm({ class: 'front_desk' });
    } catch (error: any) {
      alert(`Failed to change class: ${error.message}`);
    }
  };

  const handleDeactivateSitter = async () => {
    if (!showDeactivateSitterModal) return;
    try {
      const result = await deactivateSitter.mutateAsync(showDeactivateSitterModal);
      alert(`Sitter deactivated. ${result.message}`);
      setShowDeactivateSitterModal(null);
    } catch (error: any) {
      alert(`Failed to deactivate sitter: ${error.message}`);
    }
  };

  const renderActionMenuItem = (
    action: ActionType,
    label: string,
    number: Number & { activeThreadCount?: number | null },
    onClick: () => void,
    icon?: React.ReactNode,
  ) => {
    const state = getActionState(action, number);
    const isDanger = action === 'quarantine' || action === 'release-from-twilio';
    
    return (
      <DropdownMenuItem
        onClick={state.enabled ? onClick : undefined}
        disabled={!state.enabled}
        tooltip={!state.enabled ? state.tooltip : undefined}
        variant={isDanger ? 'danger' : 'default'}
        icon={icon}
      >
        {label}
      </DropdownMenuItem>
    );
  };

  const numberColumns: TableColumn<Number & { activeThreadCount?: number | null; capacityStatus?: string | null; maxConcurrentThreads?: number | null }>[] = [
    { key: 'e164', header: 'Number', render: (n) => n.e164 },
    { key: 'class', header: 'Class', render: (n) => (
      <Badge variant={n.class === 'front_desk' ? 'default' : n.class === 'sitter' ? 'info' : 'neutral'}>
        {n.class === 'front_desk' ? 'Front Desk' : n.class === 'sitter' ? 'Sitter' : 'Pool'}
      </Badge>
    )},
    { key: 'status', header: 'Status', render: (n) => (
      <Badge variant={n.status === 'active' ? 'success' : n.status === 'quarantined' ? 'warning' : 'error'}>
        {n.status}
      </Badge>
    )},
    { key: 'activeThreadCount', header: 'Active Threads', render: (n) => {
      if (n.class !== 'pool') return '-';
      return n.activeThreadCount !== null && n.activeThreadCount !== undefined 
        ? `${n.activeThreadCount}${n.maxConcurrentThreads ? ` / ${n.maxConcurrentThreads}` : ''}`
        : '-';
    }},
    { key: 'capacityStatus', header: 'Capacity', render: (n) => {
      if (n.class !== 'pool' || !n.capacityStatus) return '-';
      return (
        <Badge variant={n.capacityStatus === 'At Capacity' ? 'warning' : 'success'}>
          {n.capacityStatus}
        </Badge>
      );
    }},
    { key: 'assignedSitter', header: 'Assigned To', render: (n) => n.assignedSitter?.name || 'Unassigned' },
    { key: 'lastUsedAt', header: 'Last Used', render: (n) => n.lastUsedAt ? new Date(n.lastUsedAt).toLocaleDateString() : 'Never' },
    { 
      key: 'actions', 
      header: 'Actions', 
      render: (n) => {
        return (
          <DropdownMenu
            trigger={
              <IconButton
                icon={<MoreVertical size={16} />}
                variant="ghost"
                size="sm"
                aria-label="Actions menu"
              />
            }
            placement="bottom-end"
          >
            <DropdownMenuGroup label="Actions">
              {renderActionMenuItem('view-details', 'View Details', n, () => {
                setSelectedNumber(n);
                setShowDetailsDrawer(n.id);
              }, <Eye size={14} />)}
              {renderActionMenuItem('change-class', 'Change Class', n, () => {
                setSelectedNumber(n);
                setChangeClassForm({ class: n.class });
                setShowChangeClassModal(n.id);
              }, <ArrowLeftRight size={14} />)}
              {renderActionMenuItem('assign-sitter', 'Assign/Reassign Sitter', n, () => {
                setSelectedNumber(n);
                setAssignForm({ sitterId: n.assignedSitterId || '' });
                setShowAssignModal(n.id);
              }, <UserPlus size={14} />)}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup label="Lifecycle">
              {renderActionMenuItem('release-to-pool', 'Release to Pool', n, () => {
                setSelectedNumber(n);
                setShowReleaseToPoolModal(n.id);
              }, <Undo2 size={14} />)}
              {renderActionMenuItem('quarantine', 'Quarantine', n, () => {
                setSelectedNumber(n);
                setShowQuarantineModal(n.id);
              }, <Ban size={14} />)}
              {renderActionMenuItem('restore', 'Restore', n, () => {
                setSelectedNumber(n);
                setShowReleaseModal(n.id);
              }, <CheckCircle2 size={14} />)}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup label="Danger Zone">
              {renderActionMenuItem('release-from-twilio', 'Release from Twilio', n, () => {
                setSelectedNumber(n);
                setShowReleaseFromTwilioModal(n.id);
              }, <Trash2 size={14} />)}
              {n.class === 'sitter' && n.assignedSitterId && (
                <DropdownMenuItem
                  onClick={() => {
                    setShowDeactivateSitterModal(n.assignedSitterId!);
                  }}
                  variant="danger"
                  icon={<UserX size={14} />}
                >
                  Deactivate Sitter
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenu>
        );
      },
    },
  ];

  const frontDeskCount = numbers.filter(n => n.class === 'front_desk').length;
  const poolCount = numbers.filter(n => n.class === 'pool').length;
  const sitterCount = numbers.filter(n => n.class === 'sitter').length;

  const selectedSitter = showDeactivateSitterModal 
    ? sitters.find(s => s.id === showDeactivateSitterModal)
    : null;
  const sitterNumbers = showDeactivateSitterModal
    ? numbers.filter(n => n.assignedSitterId === showDeactivateSitterModal)
    : [];

  return (
    <OwnerAppShell>
      <PageHeader
        title="Number Inventory"
        description="Support tool for managing business messaging numbers, routing capacity, and sitter assignments"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowBuyModal(true)} variant="primary">
              Buy Number
            </Button>
            <Button onClick={() => setShowImportModal(true)} variant="secondary">
              Import Number
            </Button>
          </div>
        }
      />
      <div className="p-6">
        <Card className="mb-4 border border-border-default bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="info">Support Tool</Badge>
              </div>
              <p className="text-sm font-semibold text-text-primary">Numbers should stay out of the normal owner path until they need specialist attention.</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                This page is best used for provisioning numbers, handling capacity issues, quarantining lines, and managing sitter assignments. Most owners should only visit it when messaging operations need intervention.
              </p>
            </div>
            <div className="max-w-sm text-sm text-text-secondary">
              Use this area when a line is exhausted, a sitter number needs reassignment, or a messaging provider change requires manual review.
            </div>
          </div>
        </Card>

        {/* Pool Exhausted Banner */}
        {(() => {
          const poolExhausted = numbers.some(n => n.class === 'pool' && (n as any).capacityStatus === 'At Capacity');
          if (poolExhausted) {
            return (
              <Card className="mb-4 bg-status-danger-bg border-2 border-error">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-error">
                    ⚠️ Pool Exhausted
                  </span>
                  <span className="text-text-primary">
                    One or more pool numbers are at capacity. Inbound messages will be routed to owner inbox. Consider adding more pool numbers or adjusting capacity settings.
                  </span>
                </div>
              </Card>
            );
          }
          return null;
        })()}

        {/* Summary Cards */}
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Card>
            <div className="text-xl font-bold">
              {frontDeskCount}
            </div>
            <div className="text-text-secondary text-sm">
              Front desk lines
            </div>
          </Card>
          <Card>
            <div className="text-xl font-bold">
              {poolCount}
            </div>
            <div className="text-text-secondary text-sm">
              Pool lines
            </div>
          </Card>
          <Card>
            <div className="text-xl font-bold">
              {sitterCount}
            </div>
            <div className="text-text-secondary text-sm">
              Sitter lines
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-4">
          <div className="flex gap-3 items-center">
            <label className="font-medium">Filter by Class:</label>
            <select
              value={filters.class || ''}
              onChange={(e) => setFilters({ ...filters, class: e.target.value || undefined })}
              className="p-2 rounded-md border border-border-default"
            >
              <option value="">All</option>
              <option value="front_desk">Front Desk</option>
              <option value="pool">Pool</option>
              <option value="sitter">Sitter</option>
            </select>
            <label className="font-medium">Filter by Status:</label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
              className="p-2 rounded-md border border-border-default"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="quarantined">Quarantined</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </Card>

        {/* Numbers Table */}
        <Card>
          {isLoading ? (
            <Skeleton height={400} />
          ) : numbers.length === 0 ? (
            <EmptyState
              title="No numbers found"
              description="Buy or import numbers to get started"
            />
          ) : (
            <Table
              data={numbers}
              columns={numberColumns}
            />
          )}
        </Card>

        {/* Buy Modal */}
        {showBuyModal && (
          <Modal isOpen={showBuyModal} title="Buy Number" onClose={() => setShowBuyModal(false)}>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block mb-2 font-medium">
                  Number Class
                </label>
                <select
                  value={buyForm.class}
                  onChange={(e) => setBuyForm({ ...buyForm, class: e.target.value as any })}
                  className="p-2 rounded-md border border-border-default w-full"
                >
                  <option value="front_desk">Front Desk</option>
                  <option value="pool">Pool</option>
                  <option value="sitter">Sitter</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 font-medium">
                  Area Code (optional)
                </label>
                <Input
                  value={buyForm.areaCode}
                  onChange={(e) => setBuyForm({ ...buyForm, areaCode: e.target.value })}
                  placeholder="e.g., 415"
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">
                  Quantity
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={buyForm.quantity}
                  onChange={(e) => setBuyForm({ ...buyForm, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setShowBuyModal(false)} variant="secondary">Cancel</Button>
                <Button onClick={handleBuy} disabled={buyNumber.isPending} variant="primary">
                  {buyNumber.isPending ? 'Purchasing...' : 'Purchase'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <Modal isOpen={showImportModal} title="Import Number" onClose={() => setShowImportModal(false)}>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block mb-2 font-medium">
                  Number Class
                </label>
                <select
                  value={importForm.class}
                  onChange={(e) => setImportForm({ ...importForm, class: e.target.value as any })}
                  className="p-2 rounded-md border border-border-default w-full"
                >
                  <option value="front_desk">Front Desk</option>
                  <option value="pool">Pool</option>
                  <option value="sitter">Sitter</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 font-medium">
                  E.164 Number (e.g., +15551234567)
                </label>
                <Input
                  value={importForm.e164}
                  onChange={(e) => setImportForm({ ...importForm, e164: e.target.value })}
                  placeholder="+15551234567"
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">
                  OR Twilio Number SID
                </label>
                <Input
                  value={importForm.numberSid}
                  onChange={(e) => setImportForm({ ...importForm, numberSid: e.target.value })}
                  placeholder="PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setShowImportModal(false)} variant="secondary">Cancel</Button>
                <Button onClick={handleImport} disabled={importNumber.isPending} variant="primary">
                  {importNumber.isPending ? 'Importing...' : 'Import'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Quarantine Modal */}
        {showQuarantineModal && selectedNumber && (
          <Modal isOpen={!!showQuarantineModal} title="Quarantine Number" onClose={() => setShowQuarantineModal(null)}>
            <div className="flex flex-col gap-4">
              <p className="text-text-secondary">
                Quarantining: <strong>{selectedNumber.e164}</strong>
              </p>
              <div>
                <label className="block mb-2 font-medium">
                  Reason (required)
                </label>
                <Input
                  value={quarantineForm.reason}
                  onChange={(e) => setQuarantineForm({ ...quarantineForm, reason: e.target.value })}
                  placeholder="e.g., Spam complaints, delivery issues"
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">
                  Details (optional)
                </label>
                <Textarea
                  value={quarantineForm.reasonDetail}
                  onChange={(e) => setQuarantineForm({ ...quarantineForm, reasonDetail: e.target.value })}
                  placeholder="Additional details..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setShowQuarantineModal(null)} variant="secondary">Cancel</Button>
                <Button
                  onClick={handleQuarantine}
                  disabled={quarantineNumber.isPending || !quarantineForm.reason}
                  variant="danger"
                >
                  {quarantineNumber.isPending ? 'Quarantining...' : 'Quarantine'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Release Modal */}
        {showReleaseModal && selectedNumber && (
          <Modal isOpen={!!showReleaseModal} title="Release from Quarantine" onClose={() => setShowReleaseModal(null)}>
            <div className="flex flex-col gap-4">
              <p>Release <strong>{selectedNumber.e164}</strong> from quarantine?</p>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setShowReleaseModal(null)} variant="secondary">Cancel</Button>
                <Button onClick={() => handleRelease(false)} disabled={releaseNumber.isPending} variant="primary">
                  {releaseNumber.isPending ? 'Releasing...' : 'Release'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Assign Modal */}
        {showAssignModal && selectedNumber && (
          <Modal isOpen={!!showAssignModal} title="Assign to Sitter" onClose={() => setShowAssignModal(null)}>
            <div className="flex flex-col gap-4">
              <p className="text-text-secondary">
                Assigning: <strong>{selectedNumber.e164}</strong>
              </p>
              <div>
                <label className="block mb-2 font-medium">
                  Sitter
                </label>
                <select
                  value={assignForm.sitterId}
                  onChange={(e) => setAssignForm({ sitterId: e.target.value })}
                  className="p-2 rounded-md border border-border-default w-full"
                >
                  <option value="">Select sitter...</option>
                  {sitters.map(s => (
                    <option key={s.id} value={s.id}>{s.name || s.id}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setShowAssignModal(null)} variant="secondary">Cancel</Button>
                <Button onClick={handleAssign} disabled={assignToSitter.isPending || !assignForm.sitterId} variant="primary">
                  {assignToSitter.isPending ? 'Assigning...' : 'Assign'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Release to Pool Modal */}
        {showReleaseToPoolModal && selectedNumber && (
          <Modal isOpen={!!showReleaseToPoolModal} title="Release to Pool" onClose={() => setShowReleaseToPoolModal(null)}>
            <div className="flex flex-col gap-4">
              <p>Release <strong>{selectedNumber.e164}</strong> to pool?</p>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setShowReleaseToPoolModal(null)} variant="secondary">Cancel</Button>
                <Button onClick={handleReleaseToPool} disabled={releaseToPool.isPending} variant="primary">
                  {releaseToPool.isPending ? 'Releasing...' : 'Release to Pool'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Change Class Modal */}
        {showChangeClassModal && selectedNumber && (
          <Modal isOpen={!!showChangeClassModal} title="Change Number Class" onClose={() => setShowChangeClassModal(null)}>
            <div className="flex flex-col gap-4">
              <p className="text-text-secondary">
                Changing class for: <strong>{selectedNumber.e164}</strong>
              </p>
              <p className="text-warning text-sm">
                ⚠️ This will affect future routing only. Existing threads are not affected.
              </p>
              <div>
                <label className="block mb-2 font-medium">
                  New Class
                </label>
                <select
                  value={changeClassForm.class}
                  onChange={(e) => setChangeClassForm({ class: e.target.value as any })}
                  className="p-2 rounded-md border border-border-default w-full"
                >
                  <option value="front_desk">Front Desk</option>
                  <option value="pool">Pool</option>
                  <option value="sitter">Sitter</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setShowChangeClassModal(null)} variant="secondary">Cancel</Button>
                <Button onClick={handleChangeClass} disabled={changeNumberClass.isPending} variant="primary">
                  {changeNumberClass.isPending ? 'Changing...' : 'Change Class'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Deactivate Sitter Modal */}
        {showDeactivateSitterModal && selectedSitter && (
          <Modal isOpen={!!showDeactivateSitterModal} title="Deactivate Sitter" onClose={() => setShowDeactivateSitterModal(null)}>
            <div className="flex flex-col gap-4">
              <p className="text-text-secondary">
                Deactivating sitter: <strong>{selectedSitter.name}</strong>
              </p>
              <div className="bg-status-warning-bg p-3 rounded-md">
                <p className="font-bold mb-2">
                  This will:
                </p>
                <ul className="m-0 pl-4">
                  <li>Set sitter status to inactive</li>
                  <li>End all active assignment windows ({activeAssignments} active)</li>
                  <li>Release {sitterNumbers.length} number(s) to pool</li>
                  <li>Preserve all message threads</li>
                  <li>Route new inbound messages to owner</li>
                </ul>
              </div>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setShowDeactivateSitterModal(null)} variant="secondary">Cancel</Button>
                <Button onClick={handleDeactivateSitter} disabled={deactivateSitter.isPending} variant="danger">
                  {deactivateSitter.isPending ? 'Deactivating...' : 'Deactivate Sitter'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Number Details Drawer */}
        {showDetailsDrawer && numberDetail && (
          <Drawer
            isOpen={!!showDetailsDrawer}
            onClose={() => setShowDetailsDrawer(null)}
            title="Number Details"
            placement="right"
            width="480px"
          >
            <div className="flex flex-col gap-6">
              <Card>
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="text-xs text-text-secondary mb-1">
                      E.164 Number
                    </div>
                    <div className="text-lg font-semibold">
                      {numberDetail.e164}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-text-secondary mb-1">
                        Class
                      </div>
                      <Badge variant={numberDetail.class === 'front_desk' ? 'default' : numberDetail.class === 'sitter' ? 'info' : 'neutral'}>
                        {numberDetail.class === 'front_desk' ? 'Front Desk' : numberDetail.class === 'sitter' ? 'Sitter' : 'Pool'}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-text-secondary mb-1">
                        Status
                      </div>
                      <Badge variant={numberDetail.status === 'active' ? 'success' : numberDetail.status === 'quarantined' ? 'warning' : 'error'}>
                        {numberDetail.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary mb-1">
                      Active Threads
                    </div>
                    <div className="text-lg font-semibold">
                      {numberDetail.activeThreadCount || 0}
                    </div>
                  </div>
                  {numberDetail.assignedSitter && (
                    <div>
                      <div className="text-xs text-text-secondary mb-1">
                        Assigned To
                      </div>
                      <div className="text-base">
                        {numberDetail.assignedSitter.name}
                      </div>
                    </div>
                  )}
                  {numberDetail.health && (
                    <div>
                      <div className="text-xs text-text-secondary mb-1">
                        Health Status
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={numberDetail.health.status === 'healthy' ? 'success' : numberDetail.health.status === 'degraded' ? 'warning' : 'error'}>
                          {numberDetail.health.status}
                        </Badge>
                        {numberDetail.health.deliveryRate !== null && (
                          <span className="text-sm text-text-secondary">
                            {Math.round(numberDetail.health.deliveryRate * 100)}% delivery rate
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </Drawer>
        )}

        {/* Release from Twilio Confirmation Modal */}
        {showReleaseFromTwilioModal && selectedNumber && (
          <Modal isOpen={!!showReleaseFromTwilioModal} title="Release from Twilio" onClose={() => setShowReleaseFromTwilioModal(null)}>
            <div className="flex flex-col gap-4">
              <div className="bg-status-danger-bg p-4 rounded-md border border-error">
                <p className="font-bold text-error mb-2">
                  ⚠️ This action cannot be undone
                </p>
                <p className="text-text-primary">
                  Releasing <strong>{selectedNumber.e164}</strong> from Twilio will permanently remove it from your account. This number will no longer be available for messaging.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <Button onClick={() => setShowReleaseFromTwilioModal(null)} variant="secondary">Cancel</Button>
                <Button
                  onClick={async () => {
                    try {
                      await releaseFromTwilio.mutateAsync(showReleaseFromTwilioModal!);
                      setShowReleaseFromTwilioModal(null);
                    } catch (err: any) {
                      alert(err?.message || 'Failed to release number from Twilio');
                    }
                  }}
                  variant="danger"
                  disabled={releaseFromTwilio.isPending}
                >
                  {releaseFromTwilio.isPending ? 'Releasing...' : 'Release from Twilio'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Keep existing modals - Buy, Import, Quarantine, Release, Assign, Release to Pool */}
        {/* ... (existing modal code remains the same) ... */}
      </div>
    </OwnerAppShell>
  );
}
