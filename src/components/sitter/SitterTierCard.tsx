/**
 * Sitter Tier Card Component
 * 
 * Shows current tier badge and locked future benefits
 * Foundation only - tier logic not fully implemented
 */

'use client';

import { Card } from '@/components/ui';
import { tokens } from '@/lib/design-tokens';
import { SitterTierBadge } from './SitterTierBadge';

interface SitterTierCardProps {
  currentTier: {
    id: string;
    name: string;
    priorityLevel: number | null;
    badgeColor?: string | null;
    badgeStyle?: string | null;
  } | null;
}

export function SitterTierCard({ currentTier }: SitterTierCardProps) {
  // Tier progression (locked for now)
  const tierProgression = [
    { name: 'Starter', locked: false },
    { name: 'Pro', locked: currentTier?.name !== 'Pro' && currentTier?.name !== 'Elite' },
    { name: 'Elite', locked: currentTier?.name !== 'Elite' },
  ];

  return (
    <Card style={{ padding: tokens.spacing[4] }}>
      <h3 style={{ 
        fontSize: tokens.typography.fontSize.lg[0], 
        fontWeight: tokens.typography.fontWeight.semibold,
        marginBottom: tokens.spacing[4],
      }}>
        Your Tier
      </h3>

      {currentTier ? (
        <>
          <div style={{ marginBottom: tokens.spacing[4] }}>
            <SitterTierBadge 
              tier={currentTier ? {
                ...currentTier,
                priorityLevel: currentTier.priorityLevel ?? undefined,
              } : null} 
              size="lg" 
            />
          </div>

          <div style={{ 
            fontSize: tokens.typography.fontSize.sm[0],
            color: tokens.colors.text.secondary,
            marginBottom: tokens.spacing[3],
          }}>
            Current tier benefits and requirements
          </div>

          {/* Tier Progression */}
          <div style={{ 
            marginTop: tokens.spacing[4],
            paddingTop: tokens.spacing[4],
            borderTop: `1px solid ${tokens.colors.border.default}`,
          }}>
            <div style={{ 
              fontSize: tokens.typography.fontSize.sm[0],
              fontWeight: tokens.typography.fontWeight.medium,
              marginBottom: tokens.spacing[2],
            }}>
              Tier Progression
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2] }}>
              {tierProgression.map((tier) => (
                <div
                  key={tier.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    padding: tokens.spacing[2],
                    backgroundColor: tier.locked ? tokens.colors.neutral[50] : 'transparent',
                    borderRadius: tokens.borderRadius.md,
                    opacity: tier.locked ? 0.6 : 1,
                  }}
                >
                  <span style={{ 
                    fontSize: tokens.typography.fontSize.sm[0],
                    fontWeight: tier.locked ? tokens.typography.fontWeight.normal : tokens.typography.fontWeight.medium,
                  }}>
                    {tier.name}
                  </span>
                  {tier.locked && (
                    <span style={{ 
                      fontSize: tokens.typography.fontSize.xs[0],
                      color: tokens.colors.text.secondary,
                    }}>
                      🔒 Locked
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ 
          fontSize: tokens.typography.fontSize.sm[0],
          color: tokens.colors.text.secondary,
        }}>
          No tier assigned yet
        </div>
      )}
    </Card>
  );
}
