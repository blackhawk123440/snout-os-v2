/**
 * CommandList Component
 * UI Constitution V1 - Phase 3
 * 
 * List of commands with keyboard navigation support.
 */

'use client';

import { CommandSearchResult } from '@/commands/types';
import { tokens } from '@/lib/design-tokens';
import { categoryMetadata } from '@/commands/categories';
import { CommandCategory } from '@/commands/types';
import { cn } from '@/components/ui/utils';

export interface CommandListProps {
  commands: CommandSearchResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onExecute: (index: number) => void;
}

export function CommandList({
  commands,
  selectedIndex,
  onSelect,
  onExecute,
}: CommandListProps) {
  if (commands.length === 0) {
    return null;
  }

  // Group commands by category
  const grouped = commands.reduce(
    (acc, result) => {
      const category = result.command.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(result);
      return acc;
    },
    {} as Record<CommandCategory, CommandSearchResult[]>
  );

  let currentIndex = 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '400px',
        overflowY: 'auto',
      }}
    >
      {Object.entries(grouped).map(([category, categoryCommands]) => {
        const categoryMeta = categoryMetadata[category as CommandCategory];
        const startIndex = currentIndex;
        currentIndex += categoryCommands.length;

        return (
          <div key={category}>
            {/* Category Header */}
            <div
              style={{
                padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                fontSize: tokens.typography.fontSize.xs[0],
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.text.tertiary,
                textTransform: 'uppercase',
                letterSpacing: tokens.typography.letterSpacing.wide,
                backgroundColor: tokens.colors.surface.secondary,
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              {categoryMeta.label}
            </div>

            {/* Commands in Category */}
            {categoryCommands.map((result, idx) => {
              const globalIndex = startIndex + idx;
              const isSelected = globalIndex === selectedIndex;
              const command = result.command;

              return (
                <div
                  key={command.id}
                  onClick={() => {
                    onSelect(globalIndex);
                    onExecute(globalIndex);
                  }}
                  onMouseEnter={() => onSelect(globalIndex)}
                  style={{
                    padding: tokens.spacing[4],
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[3],
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? tokens.colors.accent.primary
                      : 'transparent',
                    borderLeft: isSelected
                      ? `3px solid ${tokens.colors.primary.DEFAULT}`
                      : '3px solid transparent',
                    transition: `all ${tokens.motion.duration.fast} ${tokens.motion.easing.standard}`,
                  }}
                  onFocus={(e) => {
                    onSelect(globalIndex);
                    e.currentTarget.style.outline = `2px solid ${tokens.colors.border.focus}`;
                    e.currentTarget.style.outlineOffset = '-2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none';
                  }}
                  tabIndex={0}
                  role="option"
                  aria-selected={isSelected}
                >
                  {command.icon && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        flexShrink: 0,
                        color: tokens.colors.text.secondary,
                      }}
                    >
                      {command.icon}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.base[0],
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.text.primary,
                        marginBottom: tokens.spacing[1],
                      }}
                    >
                      {command.label}
                    </div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm[0],
                        color: tokens.colors.text.secondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {command.description}
                    </div>
                  </div>
                  {command.shortcut && (
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.xs[0],
                        color: tokens.colors.text.tertiary,
                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        backgroundColor: tokens.colors.surface.tertiary,
                        borderRadius: tokens.radius.sm,
                        fontFamily: 'monospace',
                      }}
                    >
                      {command.shortcut}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
