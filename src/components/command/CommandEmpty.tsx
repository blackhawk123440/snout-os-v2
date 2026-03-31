/**
 * CommandEmpty Component
 * UI Constitution V1 - Phase 3
 * 
 * Empty state when no commands match search.
 */

'use client';

import { Search } from 'lucide-react';
import { tokens } from '@/lib/design-tokens';
import { EmptyState } from '@/components/ui/EmptyState';

export interface CommandEmptyProps {
  searchQuery: string;
}

export function CommandEmpty({ searchQuery }: CommandEmptyProps) {
  return (
    <EmptyState
      icon={<Search className="w-12 h-12" />}
      title="No commands found"
      description={
        searchQuery
          ? `No commands match "${searchQuery}". Try a different search.`
          : 'Start typing to search for commands...'
      }
    />
  );
}
