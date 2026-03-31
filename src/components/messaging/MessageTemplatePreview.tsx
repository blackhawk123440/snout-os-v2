/**
 * MessageTemplatePreview Component
 * 
 * Shared primitive for displaying message template previews in automation cards.
 * Universal Law: Consistent message preview rendering across all automation surfaces.
 */

'use client';

import React from 'react';
import { tokens } from '@/lib/design-tokens';

export interface MessageTemplatePreviewProps {
  template: string;
  label?: string;
  placeholder?: string;
  maxHeight?: string;
}

export const MessageTemplatePreview: React.FC<MessageTemplatePreviewProps> = ({
  template,
  label,
  placeholder = 'No template set',
  maxHeight = '200px',
}) => {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: tokens.spacing[2],
            fontSize: tokens.typography.fontSize.sm[0],
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.text.primary,
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          padding: tokens.spacing[3],
          backgroundColor: tokens.colors.background.secondary,
          borderRadius: tokens.borderRadius.md,
          border: `1px solid ${tokens.colors.border.default}`,
          fontSize: tokens.typography.fontSize.sm[0],
          color: template ? tokens.colors.text.primary : tokens.colors.text.tertiary,
          lineHeight: tokens.typography.fontSize.base[1].lineHeight,
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          overflowY: 'auto',
          maxHeight,
          whiteSpace: 'pre-wrap',
          fontFamily: tokens.typography.fontFamily.mono.join(', '),
        }}
      >
        {template || placeholder}
      </div>
    </div>
  );
};

