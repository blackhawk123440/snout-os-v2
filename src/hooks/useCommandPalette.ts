/**
 * useCommandPalette Hook
 * UI Constitution V1 - Phase 3
 * 
 * Hook for managing command palette state and keyboard shortcuts.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Command,
  CommandContext,
  CommandSearchResult,
} from '@/commands/types';
import { useCommands } from './useCommands';
import { logCommandExecution } from '@/commands/audit';

export interface UseCommandPaletteReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  filteredCommands: CommandSearchResult[];
  selectCommand: (command: Command) => Promise<void>;
  selectCommandByIndex: (index: number) => Promise<void>;
}

/**
 * Hook for command palette state management
 */
export function useCommandPalette(
  context?: CommandContext
): UseCommandPaletteReturn {
  const { context: defaultContext, search } = useCommands();
  const effectiveContext = context || defaultContext;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Search commands based on query
  const filteredCommands = useMemo(() => {
    return search(searchQuery);
  }, [searchQuery, search]);

  // Reset selected index when filtered commands change
  useEffect(() => {
    if (filteredCommands.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredCommands.length]);

  // Keyboard shortcut: Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === 'k' && !e.shiftKey) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }

      // Escape closes palette
      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        setSelectedIndex(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle arrow keys and enter in palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          selectCommandByIndex(selectedIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectCommandByIndex in handler; adding causes stale closure
  }, [isOpen, selectedIndex, filteredCommands]);

  const selectCommand = useCallback(
    async (command: Command) => {
      try {
        // Telemetry: Command executed
        console.log('[Command Telemetry]', {
          event: 'command.executed',
          commandId: command.id,
          timestamp: new Date().toISOString(),
        });

        const result = await command.execute(effectiveContext);
        logCommandExecution(command, effectiveContext, result);

        // Telemetry: Command result
        console.log('[Command Telemetry]', {
          event: `command.${result.status}`,
          commandId: command.id,
          result: result.status,
          timestamp: new Date().toISOString(),
        });

        if (result.status === 'success') {
          setIsOpen(false);
          setSearchQuery('');
          setSelectedIndex(0);

          // Handle redirect if provided
          if (result.redirect) {
            window.location.href = result.redirect;
          }
        } else if (result.status === 'cancelled') {
          // Telemetry: Command cancelled
          console.log('[Command Telemetry]', {
            event: 'command.cancelled',
            commandId: command.id,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        const result = {
          status: 'failed' as const,
          message: error instanceof Error ? error.message : 'Command execution failed',
        };
        logCommandExecution(command, effectiveContext, result);
        
        // Telemetry: Command failed
        console.log('[Command Telemetry]', {
          event: 'command.failed',
          commandId: command.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    },
    [effectiveContext]
  );

  const selectCommandByIndex = useCallback(
    async (index: number) => {
      const commandResult = filteredCommands[index];
      if (commandResult) {
        await selectCommand(commandResult.command);
      }
    },
    [filteredCommands, selectCommand]
  );

  const open = useCallback(() => {
    setIsOpen(true);
    setSearchQuery('');
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setSelectedIndex(0);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
    searchQuery,
    setSearchQuery,
    selectedIndex,
    setSelectedIndex,
    filteredCommands,
    selectCommand,
    selectCommandByIndex,
  };
}
