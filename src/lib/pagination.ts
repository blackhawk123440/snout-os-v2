export function parsePage(value: string | null, defaultPage = 1): number {
  const parsed = Number.parseInt(value || "", 10);
  if (Number.isNaN(parsed) || parsed < 1) return defaultPage;
  return parsed;
}

export function parsePageSize(
  value: string | null,
  defaultPageSize: number,
  maxPageSize: number
): number {
  const parsed = Number.parseInt(value || "", 10);
  if (Number.isNaN(parsed) || parsed < 1) return defaultPageSize;
  return Math.min(parsed, maxPageSize);
}

export function parseCsv(value: string | null): string[] | null {
  if (!value) return null;
  const items = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

export function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
