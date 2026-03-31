'use client';

import { useRouter } from 'next/navigation';
import { User, Phone, Mail, ChevronRight } from 'lucide-react';

export interface ClientCardData {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  lastBookingAt?: string | null;
  bookingCount?: number;
  lifetimeValue?: number;
}

export interface ClientCardProps {
  client: ClientCardData;
}

export function ClientCard({ client }: ClientCardProps) {
  const router = useRouter();
  const name = `${client.firstName} ${client.lastName}`.trim();
  const initials = `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-primary px-4 py-3 transition hover:bg-surface-secondary cursor-pointer"
      onClick={() => router.push(`/clients/${client.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/clients/${client.id}`)}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-tertiary text-sm font-semibold text-accent-primary">
        {initials || <User className="h-4 w-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{name}</p>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-text-tertiary">
          {client.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {client.phone}
            </span>
          )}
          {client.email && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3" /> {client.email}
            </span>
          )}
        </div>
        {(client.lastBookingAt || client.lifetimeValue != null) && (
          <div className="mt-1 flex items-center gap-3 text-xs text-text-tertiary">
            {client.lastBookingAt && (
              <span>Last visit: {new Date(client.lastBookingAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            )}
            {client.lifetimeValue != null && client.lifetimeValue > 0 && (
              <span className="tabular-nums">Lifetime: ${client.lifetimeValue.toFixed(0)}</span>
            )}
            {client.bookingCount != null && (
              <span>{client.bookingCount} booking{client.bookingCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-text-disabled shrink-0" />
    </div>
  );
}
