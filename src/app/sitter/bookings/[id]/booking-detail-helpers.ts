export type BookingPrimaryAction = 'start' | 'end' | 'write_report' | 'view_report';

export function getBookingPrimaryAction(status: string, hasReport: boolean): BookingPrimaryAction {
  if (status === 'in_progress') return 'end';
  if (status === 'completed') return hasReport ? 'view_report' : 'write_report';
  return 'start';
}

export function shouldRenderTel(phone?: string | null): boolean {
  return !!(phone && phone.trim());
}

export function shouldRenderMail(email?: string | null): boolean {
  return !!(email && email.trim());
}

export function shouldRenderCopyAddress(address?: string | null): boolean {
  return !!(address && address.trim());
}

export function getOptimisticStatus(currentStatus: string, action: 'start' | 'end'): string {
  if (action === 'start') return 'in_progress';
  if (action === 'end') return 'completed';
  return currentStatus;
}

export function formatElapsedTimer(fromIso: string, nowMs: number = Date.now()): string {
  const startMs = new Date(fromIso).getTime();
  const diff = Math.max(0, nowMs - startMs);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function formatDurationMinutes(startIso: string, endIso: string): string {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const minutes = Math.max(0, Math.round((endMs - startMs) / 60000));
  return `${minutes}m`;
}

export function getVisitTimerLabel(
  status: string,
  checkedInAt: string | null | undefined,
  checkedOutAt: string | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (status === 'in_progress' && checkedInAt) {
    return `In progress — ${formatElapsedTimer(checkedInAt, nowMs)}`;
  }
  if (status === 'completed' && checkedInAt && checkedOutAt) {
    return `Duration ${formatDurationMinutes(checkedInAt, checkedOutAt)}`;
  }
  return null;
}
