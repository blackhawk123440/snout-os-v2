/**
 * PageHeader Component
 * 
 * Standard page header with title, description, and actions.
 * Responsive layout for mobile.
 */

import React from 'react';
import { tokens } from '@/lib/design-tokens';
import { useMobile } from '@/lib/use-mobile';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  breadcrumbs,
}) => {
  const isMobile = useMobile();
  
  return (
    <div
      style={{
        marginBottom: isMobile ? tokens.spacing[3] : tokens.spacing[5], // Phase B4: Tighter
      }}
    >
      {breadcrumbs && (
        <div
          style={{
            marginBottom: tokens.spacing[2],
          }}
        >
          {breadcrumbs}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center', // Phase B4: Center align
          justifyContent: 'space-between',
          gap: isMobile ? tokens.spacing[3] : tokens.spacing[4],
        }}
      >
        <div
          style={{
            flex: '1 1 auto',
            minWidth: '0',
          }}
        >
          <h1
            style={{
              fontSize: isMobile
                ? tokens.typography.fontSize.xl[0]
                : tokens.typography.fontSize['2xl'][0], // Phase B4: Slightly smaller
              fontWeight: tokens.typography.fontWeight.bold,
              lineHeight: '1.2', // Phase B4: Tighter
              letterSpacing: '-0.02em', // Phase B4: Tight tracking
              color: tokens.colors.text.primary,
              margin: 0,
              marginBottom: description ? tokens.spacing[1] : 0, // Phase B4: Tighter
              wordBreak: 'break-word',
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm[0], // Phase B4: Smaller
                lineHeight: '1.4',
                color: tokens.colors.text.tertiary, // Phase B4: Less prominent
                margin: 0,
                wordBreak: 'break-word',
              }}
            >
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[2],
              flexWrap: 'wrap',
              width: isMobile ? '100%' : 'auto',
              ...(isMobile && {
                flexDirection: 'column',
                '& > *': {
                  width: '100%',
                },
              }),
            }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

