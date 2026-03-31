'use client';

/**
 * Shared visit timer: in-progress shows live elapsed (HH:MM:SS) from checkedInAt;
 * completed shows started/ended times and duration. Source of truth is checkedInAt/checkedOutAt.
 */

export function formatElapsedTimer(fromIso: string, nowMs: number = Date.now()): string {
  const startMs = new Date(fromIso).getTime();
  const diff = Math.max(0, nowMs - startMs);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Duration for completed visit: "X min" or "Xh Ym" if >= 60 minutes.
 */
export function formatDuration(startIso: string, endIso: string): string {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const minutes = Math.max(0, Math.round((endMs - startMs) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export interface VisitTimerDisplayProps {
  status: string;
  checkedInAt: string | null | undefined;
  checkedOutAt: string | null | undefined;
  nowMs: number;
  className?: string;
}

/**
 * Renders visit state from checkedInAt/checkedOutAt:
 * - In progress: "Visit in progress", "Started at {time}", "Elapsed: HH:MM:SS"
 * - Completed: "Visit complete", "Started at {time}", "Ended at {time}", "Duration: X min"
 * Renders nothing if not in-progress and not completed with both times.
 */
export function VisitTimerDisplay({
  status,
  checkedInAt,
  checkedOutAt,
  nowMs,
  className = '',
}: VisitTimerDisplayProps) {
  const inProgress = status === 'in_progress' && checkedInAt;
  const completed = status === 'completed' && checkedInAt && checkedOutAt;

  if (!inProgress && !completed) return null;

  return (
    <div className={`space-y-0.5 text-xs text-text-secondary ${className}`}>
      {inProgress && (
        <>
          <p className="font-semibold text-text-secondary">Visit in progress</p>
          <p>Started at {formatTime(checkedInAt)}</p>
          <p className="tabular-nums font-medium text-text-primary">
            Elapsed: {formatElapsedTimer(checkedInAt, nowMs)}
          </p>
        </>
      )}
      {completed && (
        <>
          <p className="font-semibold text-status-success-text">Visit complete</p>
          <p>Started at {formatTime(checkedInAt)}</p>
          <p>Ended at {formatTime(checkedOutAt)}</p>
          <p className="tabular-nums font-medium text-text-primary">
            Duration: {formatDuration(checkedInAt, checkedOutAt)}
          </p>
        </>
      )}
    </div>
  );
}
