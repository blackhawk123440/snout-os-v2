/**
 * Command Layer Types
 * UI Constitution V1 - Phase 3
 * 
 * Strict command interface and context types.
 */

import { ReactNode } from 'react';

/**
 * Command execution context
 * Provides all necessary context for command availability, permissions, and execution
 */
export interface CommandContext {
  currentRoute: string;
  selectedEntity?: {
    type: 'booking' | 'client' | 'sitter' | 'automation' | 'system';
    id: string;
    data?: any;
  } | null;
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
  permissions?: string[];
  featureFlags?: Record<string, boolean>;
  params?: Record<string, any>;
}

/**
 * Command execution result
 */
export interface CommandResult {
  status: 'success' | 'failed' | 'cancelled';
  message?: string;
  telemetry?: Record<string, any>;
  redirect?: string;
}

/**
 * Command category enum
 */
export enum CommandCategory {
  Global = 'global',
  Booking = 'booking',
  Client = 'client',
  Sitter = 'sitter',
  Automation = 'automation',
  System = 'system',
  Navigation = 'navigation',
}

/**
 * Command interface
 * All commands must implement this interface
 */
export interface Command {
  id: string; // Stable, namespaced identifier (e.g., "booking.send-confirmation")
  label: string; // Human-readable label
  description: string; // Description for search and preview
  category: CommandCategory;
  icon?: ReactNode; // Optional icon
  shortcut?: string; // Keyboard shortcut (e.g., "cmd+k")
  danger?: boolean; // Requires confirmation if true
  availability: (ctx: CommandContext) => boolean; // Whether command is available in context
  permission: (ctx: CommandContext) => boolean; // Whether user has permission
  preview: (ctx: CommandContext) => ReactNode; // Preview component before execution
  execute: (ctx: CommandContext) => Promise<CommandResult>; // Execute the command
  undo?: (ctx: CommandContext) => Promise<void>; // Optional undo operation
}

/**
 * Command search result with relevance score
 */
export interface CommandSearchResult {
  command: Command;
  score: number;
  matchedFields: string[];
}

/**
 * Command palette state
 */
export interface CommandPaletteState {
  isOpen: boolean;
  searchQuery: string;
  selectedIndex: number;
  filteredCommands: Command[];
}
