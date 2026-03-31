/**
 * Command Audit Tests
 * UI Constitution V1 - Phase 3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Command, CommandContext, CommandResult } from '../types';
import { logCommandExecution, getAuditLog, getAuditLogForCommand, clearAuditLog } from '../audit';

describe('Command Audit', () => {
  const mockCommand: Command = {
    id: 'test.command',
    label: 'Test Command',
    description: 'Test',
    category: 'system' as any,
    availability: () => true,
    permission: () => true,
    preview: () => (null as any),
    execute: async () => ({ status: 'success' }),
  };

  const mockContext: CommandContext = {
    currentRoute: '/test',
    user: { id: 'user1' },
    selectedEntity: { type: 'booking', id: 'booking1' },
  };

  beforeEach(() => {
    // Clear audit log between tests
    clearAuditLog();
  });

  it('should log command execution', () => {
    const result: CommandResult = {
      status: 'success',
      message: 'Command executed',
    };

    logCommandExecution(mockCommand, mockContext, result);

    const log = getAuditLog();
    expect(log.length).toBe(1);
    expect(log[0].commandId).toBe('test.command');
    expect(log[0].result).toBe('success');
    expect(log[0].userId).toBe('user1');
  });

  it('should log entity information', () => {
    const result: CommandResult = { status: 'success' };
    logCommandExecution(mockCommand, mockContext, result);

    const log = getAuditLog();
    expect(log[0].entityType).toBe('booking');
    expect(log[0].entityId).toBe('booking1');
  });

  it('should filter audit log by command', () => {
    const result: CommandResult = { status: 'success' };
    logCommandExecution(mockCommand, mockContext, result);

    const log = getAuditLogForCommand('test.command');
    expect(log.length).toBe(1);
    expect(log[0].commandId).toBe('test.command');
  });

  it('should log failed executions', () => {
    const result: CommandResult = {
      status: 'failed',
      message: 'Execution failed',
    };

    logCommandExecution(mockCommand, mockContext, result);

    const log = getAuditLog();
    expect(log[0].result).toBe('failed');
    expect(log[0].message).toBe('Execution failed');
  });
});
