'use client';

import { useState } from 'react';
import { DoorOpen, Key, Car, Wifi, Eye, EyeOff, ChevronDown, ChevronUp, Shield } from 'lucide-react';

export interface EmergencyVetAuthInfo {
  authorizedUpToCents: number;
  vetName?: string | null;
  vetPhone?: string | null;
  expiresAt: string;
  additionalInstructions?: string | null;
}

export interface ClientAccessInfo {
  entryInstructions?: string | null;
  lockboxCode?: string | null;
  doorAlarmCode?: string | null;
  keyStatus?: string | null;
  keyLocation?: string | null;
  keyNotes?: string | null;
  parkingNotes?: string | null;
  wifiNetwork?: string | null;
  wifiPassword?: string | null;
  emergencyVetAuth?: EmergencyVetAuthInfo | null;
}

export interface AccessInfoCardProps {
  client: ClientAccessInfo;
  autoExpand?: boolean;
}

function MaskedField({ label, value }: { label: string; value: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="text-xs text-text-tertiary">{label}</span>
        <p className="text-sm font-mono text-text-primary">
          {revealed ? value : '••••••'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setRevealed(!revealed)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-tertiary hover:bg-surface-tertiary transition"
        aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AccessInfoCard({ client, autoExpand = true }: AccessInfoCardProps) {
  const [expanded, setExpanded] = useState(autoExpand);

  const hasEntry = client.entryInstructions || client.lockboxCode || client.doorAlarmCode;
  const hasKeys = client.keyStatus || client.keyLocation || client.keyNotes;
  const hasParking = client.parkingNotes;
  const hasWifi = client.wifiNetwork || client.wifiPassword;
  const hasVetAuth = client.emergencyVetAuth && new Date(client.emergencyVetAuth.expiresAt) > new Date();
  const hasAnyInfo = hasEntry || hasKeys || hasParking || hasWifi || hasVetAuth;

  if (!hasAnyInfo) return null;

  return (
    <div className="rounded-xl border border-accent-primary/30 bg-accent-primary/5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-accent-primary" />
          <span className="text-sm font-semibold text-text-primary">Home Access</span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-text-tertiary" />
          : <ChevronDown className="h-4 w-4 text-text-tertiary" />
        }
      </button>

      {expanded && (
        <div className="space-y-3 px-4 pb-4">
          {/* Entry section */}
          {hasEntry && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary uppercase tracking-wide">
                <DoorOpen className="h-3 w-3" /> Entry
              </div>
              {client.entryInstructions && (
                <p className="text-sm text-text-primary break-words">{client.entryInstructions}</p>
              )}
              {client.lockboxCode && (
                <MaskedField label="Lockbox code" value={client.lockboxCode} />
              )}
              {client.doorAlarmCode && (
                <MaskedField label="Alarm code" value={client.doorAlarmCode} />
              )}
            </div>
          )}

          {/* Keys section */}
          {hasKeys && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary uppercase tracking-wide">
                <Key className="h-3 w-3" /> Keys
              </div>
              {client.keyStatus && (
                <p className="text-sm text-text-primary">
                  <span className="text-text-tertiary">Status:</span> {client.keyStatus}
                </p>
              )}
              {client.keyLocation && (
                <p className="text-sm text-text-primary">
                  <span className="text-text-tertiary">Location:</span> {client.keyLocation}
                </p>
              )}
              {client.keyNotes && (
                <p className="text-sm text-text-secondary break-words">{client.keyNotes}</p>
              )}
            </div>
          )}

          {/* Parking section */}
          {hasParking && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary uppercase tracking-wide">
                <Car className="h-3 w-3" /> Parking
              </div>
              <p className="text-sm text-text-primary break-words">{client.parkingNotes}</p>
            </div>
          )}

          {/* WiFi section */}
          {hasWifi && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary uppercase tracking-wide">
                <Wifi className="h-3 w-3" /> WiFi
              </div>
              {client.wifiNetwork && (
                <p className="text-sm text-text-primary">
                  <span className="text-text-tertiary">Network:</span> {client.wifiNetwork}
                </p>
              )}
              {client.wifiPassword && (
                <MaskedField label="Password" value={client.wifiPassword} />
              )}
            </div>
          )}

          {/* Emergency Vet Authorization */}
          {hasVetAuth && client.emergencyVetAuth && (
            <div className="rounded-lg border border-status-success-border bg-status-success-bg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-status-success-text uppercase tracking-wide">
                <Shield className="h-3 w-3" /> Emergency Vet Care
              </div>
              <p className="text-sm font-medium text-status-success-text">
                Up to ${(client.emergencyVetAuth.authorizedUpToCents / 100).toFixed(0)} authorized
              </p>
              {client.emergencyVetAuth.vetName && (
                <p className="text-sm text-status-success-text-secondary">
                  Vet: {client.emergencyVetAuth.vetName}
                  {client.emergencyVetAuth.vetPhone ? ` · ${client.emergencyVetAuth.vetPhone}` : ''}
                </p>
              )}
              {client.emergencyVetAuth.additionalInstructions && (
                <p className="text-xs text-status-success-text-secondary break-words">
                  {client.emergencyVetAuth.additionalInstructions}
                </p>
              )}
              <p className="text-[10px] text-status-success-text-secondary">
                Valid until {new Date(client.emergencyVetAuth.expiresAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
