/**
 * Section Component
 * UI Constitution V1 - Layout Primitive
 * 
 * Standard section with heading, subheading, actions slot, and optional divider.
 * Consistent spacing tokens throughout.
 * 
 * @example
 * ```tsx
 * <Section
 *   heading="Bookings"
 *   subheading="Manage your bookings"
 *   actions={<Button>Add Booking</Button>}
 *   divider
 * >
 *   <BookingList />
 * </Section>
 * ```
 */

'use client';

import { ReactNode } from 'react';
import { tokens } from '@/lib/design-tokens';
import { cn } from './utils';

export interface SectionProps {
  heading?: string;
  subheading?: string;
  actions?: ReactNode;
  children?: ReactNode;
  divider?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function Section({
  heading,
  subheading,
  actions,
  children,
  divider = false,
  className,
  'data-testid': testId,
}: SectionProps) {
  return (
    <section
      data-testid={testId || 'section'}
      className={cn('section', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacing[2], // Phase B5: Tighter header-to-content gap for density
        paddingBottom: divider ? tokens.spacing[4] : 0, // Phase B5: Reduced separation
        borderBottom: divider
          ? `1px solid ${tokens.colors.border.default}`
          : 'none',
        marginBottom: divider ? tokens.spacing[4] : tokens.spacing[3], // Phase B5: Tighter section spacing
      }}
    >
      {/* Header */}
      {(heading || subheading || actions) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[2],
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: tokens.spacing[4],
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[1],
                flex: 1,
                minWidth: 0,
              }}
            >
              {heading && (
                <h2
                  style={{
                    fontSize: '1.0625rem',
                    fontWeight: tokens.typography.fontWeight.bold, // Phase B6: Slightly stronger for hierarchy
                    color: tokens.colors.text.primary,
                    margin: 0,
                    letterSpacing: '-0.015em', // Phase B6: Tighter tracking for authority
                    lineHeight: '1.2', // Phase B6: Tighter line height
                  }}
                >
                  {heading}
                </h2>
              )}
              {subheading && (
                <p
                  style={{
                    fontSize: tokens.typography.fontSize.sm[0], // Phase B3: Reduced subtitle
                    color: tokens.colors.text.tertiary, // Phase B3: Less prominent
                    margin: 0,
                    lineHeight: '1.4',
                  }}
                >
                  {subheading}
                </p>
              )}
            </div>
            {actions && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                  flexShrink: 0,
                }}
              >
                {actions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {children && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[4],
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}
