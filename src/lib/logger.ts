/**
 * Structured logger for consistent fields: requestId, orgId, userId, route, durationMs.
 * Use for booking events, messaging, calendar sync, automation jobs.
 */

type LogContext = {
  requestId?: string;
  orgId?: string;
  userId?: string;
  route?: string;
  durationMs?: number;
  jobName?: string;
  [key: string]: unknown;
};

function formatMessage(level: string, message: string, context?: LogContext): string {
  const ctx = context ? ` ${JSON.stringify(context)}` : "";
  return `[${level}] ${message}${ctx}`;
}

export const log = {
  info(message: string, context?: LogContext) {
    console.log(formatMessage("INFO", message, context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(formatMessage("WARN", message, context));
  },
  error(message: string, context?: LogContext) {
    console.error(formatMessage("ERROR", message, context));
  },
};
