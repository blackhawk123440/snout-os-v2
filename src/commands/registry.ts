/**
 * Command Registry
 * UI Constitution V1 - Phase 3
 * 
 * Single source of truth for all commands.
 * Enforces unique IDs at runtime.
 * Validates command schema at boot.
 */

import { Command, CommandCategory, CommandSearchResult } from './types';

/**
 * Command registry storage
 */
const commands = new Map<string, Command>();
const commandsByCategory = new Map<CommandCategory, Command[]>();
const commandsByShortcut = new Map<string, Command>();

/**
 * Registered command IDs for uniqueness checking
 */
const registeredIds = new Set<string>();

/**
 * Validation errors
 */
const validationErrors: string[] = [];

/**
 * Register a command
 * Throws if command is invalid or ID is duplicate
 */
export function registerCommand(command: Command): void {
  // Validate command schema
  const errors = validateCommand(command);
  if (errors.length > 0) {
    const errorMsg = `Invalid command "${command.id}": ${errors.join(', ')}`;
    validationErrors.push(errorMsg);
    throw new Error(errorMsg);
  }

  // Check for duplicate ID
  if (registeredIds.has(command.id)) {
    const errorMsg = `Duplicate command ID: "${command.id}"`;
    validationErrors.push(errorMsg);
    throw new Error(errorMsg);
  }

  // Register command
  commands.set(command.id, command);
  registeredIds.add(command.id);

  // Index by category
  if (!commandsByCategory.has(command.category)) {
    commandsByCategory.set(command.category, []);
  }
  commandsByCategory.get(command.category)!.push(command);

  // Index by shortcut
  if (command.shortcut) {
    if (commandsByShortcut.has(command.shortcut)) {
      console.warn(`Shortcut "${command.shortcut}" already registered by another command`);
    }
    commandsByShortcut.set(command.shortcut, command);
  }
}

/**
 * Validate command schema
 */
function validateCommand(command: Command): string[] {
  const errors: string[] = [];

  if (!command.id || typeof command.id !== 'string') {
    errors.push('id must be a non-empty string');
  }

  if (!command.label || typeof command.label !== 'string') {
    errors.push('label must be a non-empty string');
  }

  if (!command.description || typeof command.description !== 'string') {
    errors.push('description must be a non-empty string');
  }

  if (!Object.values(CommandCategory).includes(command.category)) {
    errors.push(`category must be one of: ${Object.values(CommandCategory).join(', ')}`);
  }

  if (typeof command.availability !== 'function') {
    errors.push('availability must be a function');
  }

  if (typeof command.permission !== 'function') {
    errors.push('permission must be a function');
  }

  if (typeof command.preview !== 'function') {
    errors.push('preview must be a function');
  }

  if (typeof command.execute !== 'function') {
    errors.push('execute must be a function');
  }

  return errors;
}

/**
 * Get command by ID
 */
export function getCommand(id: string): Command | undefined {
  return commands.get(id);
}

/**
 * Get all commands
 */
export function getAllCommands(): Command[] {
  return Array.from(commands.values());
}

/**
 * Get commands by category
 */
export function getCommandsByCategory(category: CommandCategory): Command[] {
  return commandsByCategory.get(category) || [];
}

/**
 * Get command by shortcut
 */
export function getCommandByShortcut(shortcut: string): Command | undefined {
  return commandsByShortcut.get(shortcut);
}

/**
 * Search commands by query (fuzzy matching)
 */
export function searchCommands(
  query: string,
  context: any
): CommandSearchResult[] {
  if (!query.trim()) {
    return getAllCommands()
      .filter(cmd => cmd.availability(context) && cmd.permission(context))
      .map(cmd => ({
        command: cmd,
        score: 1,
        matchedFields: [],
      }));
  }

  const lowerQuery = query.toLowerCase();
  const results: CommandSearchResult[] = [];

  for (const command of commands.values()) {
    // Skip if not available or no permission
    if (!command.availability(context) || !command.permission(context)) {
      continue;
    }

    const matchedFields: string[] = [];
    let score = 0;

    // Exact match in label (highest score)
    if (command.label.toLowerCase() === lowerQuery) {
      score += 100;
      matchedFields.push('label');
    } else if (command.label.toLowerCase().includes(lowerQuery)) {
      score += 50;
      matchedFields.push('label');
    } else if (command.label.toLowerCase().startsWith(lowerQuery)) {
      score += 75;
      matchedFields.push('label');
    }

    // Match in description
    if (command.description.toLowerCase().includes(lowerQuery)) {
      score += 25;
      matchedFields.push('description');
    }

    // Match in ID
    if (command.id.toLowerCase().includes(lowerQuery)) {
      score += 10;
      matchedFields.push('id');
    }

    // Match in category
    if (command.category.toLowerCase().includes(lowerQuery)) {
      score += 5;
      matchedFields.push('category');
    }

    if (score > 0) {
      results.push({
        command,
        score,
        matchedFields,
      });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Get available commands for context
 */
export function getAvailableCommands(context: any): Command[] {
  return getAllCommands().filter(
    cmd => cmd.availability(context) && cmd.permission(context)
  );
}

/**
 * Get validation errors from registration
 */
export function getValidationErrors(): string[] {
  return [...validationErrors];
}

/**
 * Clear all commands (for testing)
 */
export function clearRegistry(): void {
  commands.clear();
  commandsByCategory.clear();
  commandsByShortcut.clear();
  registeredIds.clear();
  validationErrors.length = 0;
}
