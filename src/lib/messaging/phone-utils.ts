/**
 * Normalize phone to canonical E.164 for DB lookups and storage.
 * Handles +12562039373, 2562039373, (256) 203-9373, etc.
 */
export function normalizeE164(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return value.trim().startsWith('+') ? value.trim() : `+${value.trim()}`;
}
