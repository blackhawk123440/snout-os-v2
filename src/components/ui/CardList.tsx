/**
 * CardList Component
 * UI Constitution V1 - Data Component
 * 
 * Mobile transformation for data tables.
 * Displays data as cards on mobile.
 * 
 * @example
 * ```tsx
 * <CardList
 *   items={items}
 *   renderCard={(item) => <Card>{item.name}</Card>}
 * />
 * ```
 */

'use client';

import { ReactNode } from 'react';
import { tokens } from '@/lib/design-tokens';
import { useMobile } from '@/lib/use-mobile';
import { cn } from './utils';

export interface CardListProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function CardList<T>({
  items,
  renderCard,
  emptyMessage = 'No items found',
  loading = false,
  className,
  'data-testid': testId,
}: CardListProps<T>) {
  const isMobile = useMobile();

  if (!isMobile) {
    return null; // Only render on mobile
  }

  if (loading) {
    return (
      <div
        data-testid={testId || 'card-list'}
        className={cn('card-list', className)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing[3],
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              backgroundColor: tokens.colors.surface.primary,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radius.md,
              padding: tokens.spacing[4],
              minHeight: '100px',
            }}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        data-testid={testId || 'card-list-empty'}
        style={{
          padding: tokens.spacing[6],
          textAlign: 'center',
          color: tokens.colors.text.secondary,
          fontSize: tokens.typography.fontSize.base[0],
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      data-testid={testId || 'card-list'}
      className={cn('card-list', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing[3],
      }}
    >
      {items.map((item, index) => (
        <div key={index}>{renderCard(item, index)}</div>
      ))}
    </div>
  );
}
