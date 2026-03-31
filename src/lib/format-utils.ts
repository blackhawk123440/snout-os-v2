/**
 * Shared formatting utilities for the entire Snout OS UI.
 * Import and use these everywhere — never display raw DB values.
 */

/** dog_walking → Dog Walking, drop_in_visit → Drop In Visit */
export function formatServiceName(service: string): string {
  if (!service) return '';
  return service
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** snake_case or camelCase → Title Case. front_desk → Front Desk */
export function formatLabel(label: string): string {
  if (!label) return '';
  return label
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Date + time, no seconds. "3/22/2026, 10:00 AM" */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

/** Date only. "Mar 22, 2026" */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Time only. "10:00 AM" */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

/** Duration between two dates. "1h" / "30m" / "1h 30m" */
export function formatDuration(startAt: string | Date, endAt: string | Date): string {
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}
