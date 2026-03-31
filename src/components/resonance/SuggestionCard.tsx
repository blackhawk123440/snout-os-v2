/**
 * SuggestionCard Component
 * UI Constitution V1 - Phase 6
 * 
 * Individual suggestion card with action.
 */

'use client';

import { Suggestion } from '@/lib/resonance/types';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/lib/design-tokens';
import { Flex } from '@/components/ui/Flex';

export interface SuggestionCardProps {
  suggestion: Suggestion;
  onExecute: (suggestion: Suggestion) => void;
  disabled?: boolean;
}

export function SuggestionCard({ suggestion, onExecute, disabled = false }: SuggestionCardProps) {
  const priorityColor = suggestion.priorityScore >= 50 
    ? tokens.colors.error.DEFAULT 
    : suggestion.priorityScore >= 30 
    ? tokens.colors.warning.DEFAULT 
    : tokens.colors.primary.DEFAULT;

  return (
    <div
      style={{
        padding: tokens.spacing[3],
        border: `1px solid ${tokens.colors.border.default}`,
        borderRadius: tokens.radius.lg, // Phase 8: Larger radius
        backgroundColor: tokens.colors.surface.frosted.low, // Phase 8: Use frosted surface
        boxShadow: tokens.shadow.xs, // Phase 8: Subtle shadow
        transition: `all ${tokens.motion.duration.instant} ${tokens.motion.easing.standard}`, // Phase 8: Instant feedback
      }}
        onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = tokens.colors.accent.secondary;
          e.currentTarget.style.borderColor = priorityColor;
          e.currentTarget.style.boxShadow = tokens.shadow.sm; // Phase 8: Subtle lift
          e.currentTarget.style.transform = 'translateY(-1px)'; // Phase 8: Subtle lift
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = tokens.colors.surface.frosted.low;
        e.currentTarget.style.borderColor = tokens.colors.border.default;
        e.currentTarget.style.boxShadow = tokens.shadow.xs;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <Flex direction="column" gap={2}>
        <Flex justify="space-between" align="flex-start">
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize.base[0],
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.text.primary,
                marginBottom: tokens.spacing[1],
              }}
            >
              {suggestion.label}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm[0],
                color: tokens.colors.text.secondary,
              }}
            >
              {suggestion.reason}
            </div>
          </div>
          <div
            style={{
              width: '4px',
              height: '40px',
              backgroundColor: priorityColor,
              borderRadius: tokens.radius.sm,
              flexShrink: 0,
            }}
          />
        </Flex>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onExecute(suggestion)}
          disabled={disabled}
          style={{ alignSelf: 'flex-start' }}
        >
          Execute
        </Button>
      </Flex>
    </div>
  );
}
