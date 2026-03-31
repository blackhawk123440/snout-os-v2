/**
 * CommandLauncher Component
 * UI Constitution V1 - Phase 3
 * 
 * Contextual command launcher embedded in Booking and Client surfaces.
 * Shows top suggested commands based on context.
 */

'use client';

import { useMemo } from 'react';
import { Command, CommandContext, CommandCategory } from '@/commands/types';
import { useCommands } from '@/hooks/useCommands';
import { Button } from '@/components/ui/Button';
import { Flex } from '@/components/ui/Flex';
import { tokens } from '@/lib/design-tokens';

export interface CommandLauncherProps {
  context: CommandContext;
  maxSuggestions?: number;
  onCommandSelect?: (command: Command) => void;
}

export function CommandLauncher({
  context,
  maxSuggestions = 3,
  onCommandSelect,
}: CommandLauncherProps) {
  const { availableCommands, commandsByCategory } = useCommands();

  // Get suggested commands based on context
  const suggestedCommands = useMemo(() => {
    // Priority: entity-specific commands first
    if (context.selectedEntity) {
      const entityType = context.selectedEntity.type as CommandCategory;
      const entityCommands = commandsByCategory[entityType] || [];
      if (entityCommands.length > 0) {
        return entityCommands.slice(0, maxSuggestions);
      }
    }

    // Fallback to category-based suggestions
    if (context.currentRoute.includes('/bookings')) {
      return commandsByCategory[CommandCategory.Booking]?.slice(0, maxSuggestions) || [];
    }
    if (context.currentRoute.includes('/clients')) {
      return commandsByCategory[CommandCategory.Client]?.slice(0, maxSuggestions) || [];
    }

    // Default to global commands
    return availableCommands
      .filter(cmd => cmd.category === 'global' || cmd.category === 'navigation')
      .slice(0, maxSuggestions);
  }, [context, commandsByCategory, availableCommands, maxSuggestions]);

  if (suggestedCommands.length === 0) {
    return null;
  }

  return (
    <Flex direction="column" gap={2}>
      <div
        style={{
          fontSize: tokens.typography.fontSize.sm[0],
          fontWeight: tokens.typography.fontWeight.medium,
          color: tokens.colors.text.secondary,
          marginBottom: tokens.spacing[2],
        }}
      >
        Quick Actions
      </div>
      <Flex gap={2} wrap>
        {suggestedCommands.map((command: Command) => (
          <Button
            key={command.id}
            variant="secondary"
            size="sm"
            leftIcon={command.icon}
            onClick={() => onCommandSelect?.(command)}
          >
            {command.label}
          </Button>
        ))}
      </Flex>
    </Flex>
  );
}
