/**
 * Messaging Inbox Card Component
 * 
 * Shows unread message count and quick link to inbox
 */

'use client';

import { Card, Button, Badge } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import Link from 'next/link';

interface MessagingInboxCardProps {
  unreadCount: number;
}

export function MessagingInboxCard({ unreadCount }: MessagingInboxCardProps) {
  return (
    <Card style={{ padding: tokens.spacing[4] }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
      }}>
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: tokens.spacing[2],
            marginBottom: tokens.spacing[1],
          }}>
            <h3 style={{ 
              fontSize: tokens.typography.fontSize.lg[0], 
              fontWeight: tokens.typography.fontWeight.semibold,
            }}>
              Messages
            </h3>
            {unreadCount > 0 && (
              <Badge variant="default" style={{ fontSize: tokens.typography.fontSize.sm[0] }}>
                {unreadCount} {unreadCount === 1 ? 'unread' : 'unread'}
              </Badge>
            )}
          </div>
          <div style={{ 
            fontSize: tokens.typography.fontSize.sm[0],
            color: tokens.colors.text.secondary,
          }}>
            {unreadCount > 0 
              ? `${unreadCount} ${unreadCount === 1 ? 'client update' : 'client updates'} ready`
              : 'No pending client updates'}
          </div>
        </div>
        <Link href="/sitter/inbox">
          <Button variant="primary" size="md">
            Open Inbox
          </Button>
        </Link>
      </div>
    </Card>
  );
}
