/**
 * BookingRowActions Component
 *
 * Shared primitive for sitter assignment actions on booking rows.
 * Works on both mobile and desktop.
 */

'use client';

import React, { useState } from 'react';

function SuggestSittersSection({
  bookingId,
  sitters,
  selectedSitterId,
  onSelect,
}: {
  bookingId: string;
  sitters: Array<{ id: string; firstName: string; lastName: string }>;
  selectedSitterId: string;
  onSelect: (id: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<Array<{ sitterId: string; firstName: string; lastName: string; score: number; reasons: string[] }> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSuggest = async () => {
    setLoading(true);
    setSuggestions(null);
    try {
      const res = await fetch(`/api/ops/bookings/${bookingId}/sitter-suggestions`);
      const json = await res.json();
      if (res.ok && json.suggestions) setSuggestions(json.suggestions);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="tertiary"
        size="sm"
        onClick={handleSuggest}
        disabled={loading || sitters.length === 0}
        isLoading={loading}
      >
        {loading ? 'Loading...' : 'Suggest sitters'}
      </Button>
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-col gap-2 p-2 bg-surface-secondary rounded-md">
          <div className="text-sm font-semibold text-text-secondary">
            AI suggestions
          </div>
          {suggestions.map((s) => (
            <button
              key={s.sitterId}
              type="button"
              onClick={() => onSelect(s.sitterId)}
              className={`p-2 text-left rounded-sm cursor-pointer border ${
                selectedSitterId === s.sitterId
                  ? 'border-primary bg-[#fef2f8]'
                  : 'border-border-default bg-surface-primary'
              }`}
            >
              <div className="font-medium">
                {s.firstName} {s.lastName} (score: {s.score})
              </div>
              {s.reasons?.length > 0 && (
                <div className="text-xs text-text-secondary mt-1">
                  {s.reasons.join(' \u2022 ')}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Tabs, TabPanel } from '@/components/ui';
import { SitterAssignmentDisplay, SitterInfo } from '@/components/sitter/SitterAssignmentDisplay';
import { SitterTierBadge } from '@/components/sitter';
import { useMobile } from '@/lib/use-mobile';

export interface BookingRowActionsProps {
  bookingId: string;
  sitter: SitterInfo | null | undefined;
  sitters: Array<{ id: string; firstName: string; lastName: string; currentTier?: SitterInfo['currentTier'] }>;
  onAssign: (bookingId: string, sitterId: string) => Promise<void>;
  onUnassign: (bookingId: string) => Promise<void>;
  onSitterPoolChange?: (bookingId: string, sitterIds: string[]) => Promise<void>;
  currentPool?: SitterInfo[];
  showInMoreMenu?: boolean; // If true, show actions in More menu instead of direct buttons
  onMoreMenuOpen?: () => void; // Callback when More menu should open
}

export const BookingRowActions: React.FC<BookingRowActionsProps> = ({
  bookingId,
  sitter,
  sitters,
  onAssign,
  onUnassign,
  onSitterPoolChange,
  currentPool = [],
}) => {
  const isMobile = useMobile();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showUnassignModal, setShowUnassignModal] = useState(false);
  const [selectedSitterId, setSelectedSitterId] = useState<string>('');
  const [selectedPoolSitterIds, setSelectedPoolSitterIds] = useState<Set<string>>(
    new Set(currentPool.map(s => s.id))
  );
  const [assignMode, setAssignMode] = useState<'direct' | 'pool'>('direct');
  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [savingPool, setSavingPool] = useState(false);

  const handleAssign = async () => {
    if (!selectedSitterId) return;
    setAssigning(true);
    try {
      await onAssign(bookingId, selectedSitterId);
      setShowAssignModal(false);
      setSelectedSitterId('');
    } catch (error) {
      console.error('Failed to assign sitter:', error);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    setUnassigning(true);
    try {
      await onUnassign(bookingId);
      setShowUnassignModal(false);
    } catch (error) {
      console.error('Failed to unassign sitter:', error);
    } finally {
      setUnassigning(false);
    }
  };

  const handleTogglePoolSitter = (sitterId: string) => {
    setSelectedPoolSitterIds(prev => {
      const next = new Set(prev);
      if (next.has(sitterId)) {
        next.delete(sitterId);
      } else {
        next.add(sitterId);
      }
      return next;
    });
  };

  const handleSavePool = async () => {
    if (!onSitterPoolChange) return;
    setSavingPool(true);
    try {
      await onSitterPoolChange(bookingId, Array.from(selectedPoolSitterIds));
      setShowAssignModal(false);
      setSelectedPoolSitterIds(new Set(currentPool.map(s => s.id)));
    } catch (error) {
      console.error('Failed to update sitter pool:', error);
    } finally {
      setSavingPool(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <SitterAssignmentDisplay
          sitter={sitter}
          showUnassigned={true}
          compact={true}
          showTierBadge={true}
        />
        <div className="flex gap-2">
          {!sitter ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowAssignModal(true);
              }}
            >
              Assign
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAssignModal(true);
                }}
              >
                Change
              </Button>
              <Button
                variant="tertiary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUnassignModal(true);
                }}
              >
                Unassign
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Assign Modal with Tabs for Direct Assignment and Sitter Pool */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedSitterId('');
          setAssignMode('direct');
          setSelectedPoolSitterIds(new Set(currentPool.map(s => s.id)));
        }}
        title="Assign Sitter"
        size={isMobile ? 'full' : 'lg'}
      >
        <Tabs
          tabs={[
            { id: 'direct', label: 'Direct Assignment' },
            { id: 'pool', label: 'Sitter Pool' },
          ]}
          activeTab={assignMode}
          onTabChange={(tab) => setAssignMode(tab as 'direct' | 'pool')}
        >
          <TabPanel id="direct">
            <div className="flex flex-col gap-4">
              <SuggestSittersSection
                bookingId={bookingId}
                sitters={sitters}
                selectedSitterId={selectedSitterId}
                onSelect={(id) => setSelectedSitterId(id)}
              />
              <Select
                label="Select Sitter"
                value={selectedSitterId}
                onChange={(e) => setSelectedSitterId(e.target.value)}
                options={[
                  { value: '', label: 'Select a sitter...' },
                  ...sitters.map(s => ({
                    value: s.id,
                    label: `${s.firstName} ${s.lastName}${s.currentTier ? ` (${s.currentTier.name})` : ''}`,
                  })),
                ]}
              />
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedSitterId('');
                    setAssignMode('direct');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAssign}
                  disabled={!selectedSitterId || assigning}
                  isLoading={assigning}
                >
                  Assign
                </Button>
              </div>
            </div>
          </TabPanel>

          <TabPanel id="pool">
            <div className="flex flex-col gap-4">
              <div className="text-sm text-text-secondary mb-2">
                Select one or more sitters for the pool. Multiple sitters can be assigned to this booking.
              </div>
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                {sitters.map(sitterOption => {
                  const isSelected = selectedPoolSitterIds.has(sitterOption.id);
                  return (
                    <label
                      key={sitterOption.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer rounded-md border border-border-default ${
                        isSelected ? 'bg-surface-secondary' : 'bg-surface-primary'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleTogglePoolSitter(sitterOption.id)}
                        className="w-[18px] h-[18px] cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {sitterOption.firstName} {sitterOption.lastName}
                        </div>
                        {sitterOption.currentTier && (
                          <div className="mt-1">
                            <SitterTierBadge tier={sitterOption.currentTier} />
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssignMode('direct');
                    setSelectedPoolSitterIds(new Set(currentPool.map(s => s.id)));
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSavePool}
                  disabled={!onSitterPoolChange || savingPool}
                  isLoading={savingPool}
                >
                  Save Pool
                </Button>
              </div>
            </div>
          </TabPanel>
        </Tabs>
      </Modal>

      {/* Unassign Confirmation Modal */}
      <Modal
        isOpen={showUnassignModal}
        onClose={() => setShowUnassignModal(false)}
        title="Unassign Sitter"
        size={isMobile ? 'full' : 'md'}
      >
        <div className="flex flex-col gap-4">
          <p className="m-0 text-text-secondary">
            Are you sure you want to unassign {sitter ? `${sitter.firstName} ${sitter.lastName}` : 'this sitter'} from this booking?
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowUnassignModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleUnassign}
              disabled={unassigning}
            >
              {unassigning ? 'Unassigning...' : 'Unassign'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
