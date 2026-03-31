/**
 * Command Registry Tests
 * UI Constitution V1 - Phase 3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Command, CommandCategory } from '../types';
import {
  registerCommand,
  getCommand,
  getAllCommands,
  clearRegistry,
  getValidationErrors,
} from '../registry';
import { alwaysAllowed, defaultPermission } from '../permissions';

describe('Command Registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('should register a valid command', () => {
    const command: Command = {
      id: 'test.command',
      label: 'Test Command',
      description: 'Test description',
      category: CommandCategory.System,
      availability: alwaysAllowed,
      permission: alwaysAllowed,
      preview: () => (null as any),
      execute: async () => ({ status: 'success' }),
    };

    expect(() => registerCommand(command)).not.toThrow();
    expect(getCommand('test.command')).toBeDefined();
  });

  it('should reject duplicate command IDs', () => {
    const command: Command = {
      id: 'test.duplicate',
      label: 'Test',
      description: 'Test',
      category: CommandCategory.System,
      availability: alwaysAllowed,
      permission: alwaysAllowed,
      preview: () => (null as any),
      execute: async () => ({ status: 'success' }),
    };

    registerCommand(command);
    expect(() => registerCommand(command)).toThrow('Duplicate command ID');
  });

  it('should reject invalid commands', () => {
    const invalidCommand = {
      id: '',
      label: '',
      category: 'invalid',
      availability: null,
      permission: null,
      preview: null,
      execute: null,
    } as any;

    expect(() => registerCommand(invalidCommand)).toThrow();
  });

  it('should enforce unique IDs at runtime', () => {
    const command1: Command = {
      id: 'test.unique',
      label: 'Command 1',
      description: 'Description',
      category: CommandCategory.System,
      availability: alwaysAllowed,
      permission: alwaysAllowed,
      preview: () => (null as any),
      execute: async () => ({ status: 'success' }),
    };

    const command2: Command = {
      ...command1,
      label: 'Command 2',
    };

    registerCommand(command1);
    expect(() => registerCommand(command2)).toThrow();
  });
});
