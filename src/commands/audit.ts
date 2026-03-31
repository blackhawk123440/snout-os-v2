/**
 * Command Audit Logging
 * UI Constitution V1 - Phase 3
 * 
 * Record every executed command for audit trail.
 * No PII in payload.
 */

import { Command, CommandContext, CommandResult } from './types';

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  commandId: string;
  commandLabel: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  result: 'success' | 'failed' | 'cancelled';
  message?: string;
  telemetry?: Record<string, any>;
  context: {
    route: string;
    userAgent?: string;
  };
}

/**
 * In-memory audit log (replace with persistent storage in production)
 */
const auditLog: AuditLogEntry[] = [];

/**
 * Log command execution to audit trail
 */
export function logCommandExecution(
  command: Command,
  ctx: CommandContext,
  result: CommandResult
): void {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    commandId: command.id,
    commandLabel: command.label,
    userId: ctx.user?.id,
    entityType: ctx.selectedEntity?.type,
    entityId: ctx.selectedEntity?.id,
    result: result.status,
    message: result.message,
    telemetry: result.telemetry,
    context: {
      route: ctx.currentRoute,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    },
  };

  auditLog.push(entry);

  // Console logging for development
  console.log('[Command Audit]', {
    id: entry.id,
    command: command.id,
    result: result.status,
    timestamp: entry.timestamp,
    entity: ctx.selectedEntity ? `${ctx.selectedEntity.type}:${ctx.selectedEntity.id}` : 'none',
  });

  // In production, send to analytics/audit service
  // Example: sendToAuditService(entry);
}

/**
 * Get audit log entries
 */
export function getAuditLog(limit?: number): AuditLogEntry[] {
  const entries = [...auditLog].reverse(); // Most recent first
  return limit ? entries.slice(0, limit) : entries;
}

/**
 * Get audit log for specific command
 */
export function getAuditLogForCommand(commandId: string, limit?: number): AuditLogEntry[] {
  const entries = auditLog
    .filter(entry => entry.commandId === commandId)
    .reverse();
  return limit ? entries.slice(0, limit) : entries;
}

/**
 * Get audit log for specific user
 */
export function getAuditLogForUser(userId: string, limit?: number): AuditLogEntry[] {
  const entries = auditLog
    .filter(entry => entry.userId === userId)
    .reverse();
  return limit ? entries.slice(0, limit) : entries;
}

/**
 * Get audit log for specific entity
 */
export function getAuditLogForEntity(
  entityType: string,
  entityId: string,
  limit?: number
): AuditLogEntry[] {
  const entries = auditLog
    .filter(
      entry => entry.entityType === entityType && entry.entityId === entityId
    )
    .reverse();
  return limit ? entries.slice(0, limit) : entries;
}

/**
 * Clear audit log (for testing)
 */
export function clearAuditLog(): void {
  auditLog.length = 0;
}
