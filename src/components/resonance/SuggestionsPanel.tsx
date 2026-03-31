/**
 * SuggestionsPanel Component
 * UI Constitution V1 - Phase 6
 * 
 * Panel displaying top suggestions.
 */

'use client';

import { CheckCircle2 } from 'lucide-react';
import { Suggestion } from '@/lib/resonance/types';
import { FrostedCard } from '@/components/ui/FrostedCard';
import { SuggestionCard } from './SuggestionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Flex } from '@/components/ui/Flex';
import { tokens } from '@/lib/design-tokens';

export interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  loading?: boolean;
  onExecute: (suggestion: Suggestion) => void;
  maxSuggestions?: number;
  title?: string;
}

export function SuggestionsPanel({
  suggestions,
  loading = false,
  onExecute,
  maxSuggestions = 5,
  title = 'Suggested Actions',
}: SuggestionsPanelProps) {
  const displaySuggestions = suggestions.slice(0, maxSuggestions);

  return (
    <FrostedCard>
      <div style={{ padding: tokens.spacing[4] }}>
        <div
          style={{
            fontSize: tokens.typography.fontSize.lg[0],
            fontWeight: tokens.typography.fontWeight.bold,
            marginBottom: tokens.spacing[4],
          }}
        >
          {title}
        </div>

        {loading ? (
          <Flex direction="column" gap={2}>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} height="100px" />
            ))}
          </Flex>
        ) : displaySuggestions.length === 0 ? (
          <EmptyState
            title="No suggestions"
            description="All bookings are up to date"
            icon={<CheckCircle2 className="w-8 h-8" />}
          />
        ) : (
          <Flex direction="column" gap={3}>
            {displaySuggestions.map(suggestion => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onExecute={onExecute}
              />
            ))}
          </Flex>
        )}
      </div>
    </FrostedCard>
  );
}
