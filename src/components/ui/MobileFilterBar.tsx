/**
 * MobileFilterBar Component
 *
 * Standardized horizontal scrolling filter bar for mobile-first filter UI.
 * Part C: Prevents smashed filter bars by using proper spacing and horizontal scroll.
 */

'use client';

import React from 'react';
import { cn } from './utils';
import { useMobile } from '@/lib/use-mobile';

export interface FilterOption {
  id: string;
  label: string;
  badge?: number;
  disabled?: boolean;
}

export interface MobileFilterBarProps {
  options: FilterOption[];
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
  sticky?: boolean;
}

export const MobileFilterBar: React.FC<MobileFilterBarProps> = ({
  options,
  activeFilter,
  onFilterChange,
  sticky = false,
}) => {
  const isMobile = useMobile();

  return (
    <div
      className={cn(
        'bg-white border-b border-border-default py-3 px-4 -mx-4 mb-4',
        sticky && 'sticky top-0 z-[1020]',
        !sticky && 'relative'
      )}
    >
      <div
        className="mobile-filter-bar flex gap-2 overflow-x-auto overflow-y-hidden pb-[2px]"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          ...(isMobile && {
            msOverflowStyle: '-ms-autohiding-scrollbar' as any,
          }),
        }}
      >
        {options.map((option) => {
          const isActive = activeFilter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={option.disabled}
              onClick={() => !option.disabled && onFilterChange(option.id)}
              className={cn(
                'flex items-center gap-2 shrink-0 min-h-[2.5rem] whitespace-nowrap',
                'text-sm rounded-full px-4 py-2 border transition-all duration-200',
                isActive && 'font-semibold',
                !isActive && 'font-medium',
                option.disabled && 'cursor-not-allowed opacity-50',
                !option.disabled && 'cursor-pointer'
              )}
              style={{
                backgroundColor: isActive
                  ? 'var(--color-primary, #432f21)'
                  : 'var(--color-surface-primary, #ffffff)',
                color: isActive
                  ? '#ffffff'
                  : option.disabled
                  ? 'var(--color-text-disabled, #a3a3a3)'
                  : 'var(--color-text-primary, #432f21)',
                borderColor: isActive
                  ? 'var(--color-primary, #432f21)'
                  : 'var(--color-border-default, #e5e5e5)',
              }}
              onMouseEnter={(e) => {
                if (!option.disabled && !isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary, #faf9f8)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = isActive
                    ? 'var(--color-primary, #432f21)'
                    : 'var(--color-surface-primary, #ffffff)';
                }
              }}
            >
              <span>{option.label}</span>
              {option.badge !== undefined && option.badge > 0 && (
                <span
                  className="rounded-full px-2 py-1 text-xs font-bold min-w-[1.25rem] text-center leading-none"
                  style={{
                    backgroundColor: isActive
                      ? '#ffffff'
                      : 'var(--color-primary, #432f21)',
                    color: isActive
                      ? 'var(--color-primary, #432f21)'
                      : '#ffffff',
                  }}
                >
                  {option.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <style jsx global>{`
        .mobile-filter-bar::-webkit-scrollbar {
          height: 4px;
        }
        .mobile-filter-bar::-webkit-scrollbar-track {
          background: var(--color-surface-secondary, #faf9f8);
        }
        .mobile-filter-bar::-webkit-scrollbar-thumb {
          background: var(--color-border-default, #e5e5e5);
          border-radius: var(--radius-full, 9999px);
        }
        .mobile-filter-bar::-webkit-scrollbar-thumb:hover {
          background: var(--color-text-secondary, #525252);
        }
      `}</style>
    </div>
  );
};
