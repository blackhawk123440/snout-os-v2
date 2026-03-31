/**
 * useCommands Hook
 * UI Constitution V1 - Phase 3
 * 
 * Hook for accessing commands and command operations.
 */

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {
  Command,
  CommandContext,
  CommandSearchResult,
} from '@/commands/types';
import {
  getAllCommands,
  getAvailableCommands,
  searchCommands,
  getCommandsByCategory,
} from '@/commands/registry';
import { CommandCategory } from '@/commands/types';

/**
 * Hook to access commands with current context
 */
export function useCommands() {
  const pathname = usePathname();

  const context: CommandContext = useMemo(
    () => ({
      currentRoute: pathname || '/',
      selectedEntity: null, // Could be enhanced with context provider
      user: {
        id: 'current-user', // Could be from auth context
      },
      permissions: ['*'], // Could be from auth context
      featureFlags: {},
    }),
    [pathname]
  );

  const allCommands = useMemo(() => getAllCommands(), []);
  const availableCommands = useMemo(
    () => getAvailableCommands(context),
    [context]
  );
  const commandsByCategory = useMemo(() => {
    const byCategory: Record<CommandCategory, Command[]> = {} as any;
    Object.values(CommandCategory).forEach(category => {
      byCategory[category] = getCommandsByCategory(category).filter(
        cmd => cmd.availability(context) && cmd.permission(context)
      );
    });
    return byCategory;
  }, [context]);

  const search = useMemo(
    () => (query: string) => searchCommands(query, context),
    [context]
  );

  return {
    context,
    allCommands,
    availableCommands,
    commandsByCategory,
    search,
  };
}
