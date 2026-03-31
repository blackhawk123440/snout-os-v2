export type TodayStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | string;

export interface TodayVisitLike {
  id: string;
  status: TodayStatus;
  startAt: string;
}

export interface TodaySections<T extends TodayVisitLike> {
  inProgress: T[];
  upNext: T[];
  laterToday: T[];
  completed: T[];
}

export interface NormalizedTodayBooking extends TodayVisitLike {
  id: string;
  endAt: string;
  service: string;
  address: string | null;
  clientName: string;
  pets: Array<{ id: string; name?: string | null; species?: string | null }>;
  threadId: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  clientPhone: string | null;
  hasReport: boolean;
  latestReportId: string | null;
  mapLink: { apple: string; google: string } | null;
}

function sortByStartAsc<T extends TodayVisitLike>(visits: T[]): T[] {
  return [...visits].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
}

export function groupTodayVisits<T extends TodayVisitLike>(
  visits: T[],
  showCancelled: boolean
): TodaySections<T> {
  const visible = showCancelled ? visits : visits.filter((v) => v.status !== 'cancelled');
  const sorted = sortByStartAsc(visible);

  const inProgress = sorted.filter((v) => v.status === 'in_progress');
  const completed = sorted.filter((v) => v.status === 'completed' || (showCancelled && v.status === 'cancelled'));
  const upcoming = sorted.filter(
    (v) => v.status !== 'in_progress' && v.status !== 'completed' && v.status !== 'cancelled'
  );

  return {
    inProgress,
    upNext: upcoming.slice(0, 3),
    laterToday: upcoming.slice(3),
    completed,
  };
}

export function pickNextUpVisit<T extends TodayVisitLike>(visits: T[], showCancelled: boolean): T | null {
  const sections = groupTodayVisits(visits, showCancelled);
  return sections.inProgress[0] ?? sections.upNext[0] ?? sections.laterToday[0] ?? null;
}

export function getShowCancelledFromQuery(value: string | null): boolean {
  return value === '1';
}

export function normalizeTodayBooking(raw: any): NormalizedTodayBooking {
  return {
    id: typeof raw?.id === 'string' ? raw.id : '',
    status: typeof raw?.status === 'string' ? raw.status : 'pending',
    startAt: typeof raw?.startAt === 'string' ? raw.startAt : new Date().toISOString(),
    endAt: typeof raw?.endAt === 'string' ? raw.endAt : new Date().toISOString(),
    service: typeof raw?.service === 'string' ? raw.service : 'Visit',
    address: typeof raw?.address === 'string' ? raw.address : null,
    clientName: typeof raw?.clientName === 'string' ? raw.clientName : 'Client',
    pets: Array.isArray(raw?.pets) ? raw.pets : [],
    threadId: typeof raw?.threadId === 'string' ? raw.threadId : null,
    checkedInAt: typeof raw?.checkedInAt === 'string' ? raw.checkedInAt : null,
    checkedOutAt: typeof raw?.checkedOutAt === 'string' ? raw.checkedOutAt : null,
    clientPhone: typeof raw?.clientPhone === 'string' ? raw.clientPhone : null,
    hasReport: Boolean(raw?.hasReport),
    latestReportId: typeof raw?.latestReportId === 'string' ? raw.latestReportId : null,
    mapLink:
      raw?.mapLink && typeof raw.mapLink.apple === 'string' && typeof raw.mapLink.google === 'string'
        ? { apple: raw.mapLink.apple, google: raw.mapLink.google }
        : null,
  };
}
