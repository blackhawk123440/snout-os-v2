/**
 * Sitter Profile Tab
 *
 * Static identity information only - no operational content
 * Scope: Identity, contact, status, commission
 */

'use client';

import { Card, Button, Badge, SectionHeader } from '@/components/ui';
import { Mail } from 'lucide-react';
import { SitterTierBadge } from './SitterTierBadge';

interface Sitter {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  isActive: boolean;
  commissionPercentage: number;
  maskedNumber?: string;
  currentTier?: {
    id: string;
    name: string;
    priorityLevel: number;
  } | null;
}

interface SitterProfileTabProps {
  sitter: Sitter;
  isMobile: boolean;
}

export function SitterProfileTab({ sitter, isMobile }: SitterProfileTabProps) {
  const safePhone = sitter.maskedNumber || 'Messaging handled through masked inbox';

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4">
        {/* Identity Information */}
        <Card>
          <SectionHeader title="Identity" />
          <div className="p-4 flex flex-col gap-4">
            <div>
              <div className="text-sm text-text-secondary mb-1">
                Name
              </div>
              <div className="font-semibold text-base">
                {sitter.firstName} {sitter.lastName}
              </div>
            </div>
            {sitter.currentTier && (
              <div>
                <div className="text-sm text-text-secondary mb-1">
                  Tier
                </div>
                <SitterTierBadge tier={sitter.currentTier} />
              </div>
            )}
            <div>
              <div className="text-sm text-text-secondary mb-1">
                Status
              </div>
              <Badge variant={sitter.isActive ? "success" : "error"}>
                {sitter.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Contact Information */}
        <Card>
          <SectionHeader title="Contact" />
          <div className="p-4 flex flex-col gap-4">
            <div>
              <div className="text-sm text-text-secondary mb-1">
                Email
              </div>
              <a href={`mailto:${sitter.email}`} className="text-accent-primary no-underline">
                {sitter.email}
              </a>
            </div>
            <div>
              <div className="text-sm text-text-secondary mb-1">
                Phone
              </div>
              <div className="text-text-primary">
                {safePhone}
              </div>
            </div>
          </div>
        </Card>

        {/* Commission */}
        <Card>
          <SectionHeader title="Commission" />
          <div className="p-4">
            <div>
              <div className="text-sm text-text-secondary mb-1">
                Commission Rate
              </div>
              <div className="font-semibold text-base">
                {sitter.commissionPercentage || 80}%
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Desktop layout - single column, consistent card widths, aligned to baseline grid
  return (
    <div className="flex flex-col gap-4 max-w-[800px]">
      {/* Identity Information */}
      <Card>
        <SectionHeader title="Identity" />
        <div className="p-4 flex flex-col gap-4">
          <div>
            <div className="text-sm text-text-secondary mb-1">
              Name
            </div>
            <div className="font-semibold text-base">
              {sitter.firstName} {sitter.lastName}
            </div>
          </div>
          {sitter.currentTier && (
            <div>
              <div className="text-sm text-text-secondary mb-1">
                Tier
              </div>
              <SitterTierBadge tier={sitter.currentTier} />
            </div>
          )}
          <div>
            <div className="text-sm text-text-secondary mb-1">
              Status
            </div>
            <Badge variant={sitter.isActive ? "success" : "error"}>
              {sitter.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Contact Information */}
      <Card>
        <SectionHeader title="Contact" />
        <div className="p-4 flex flex-col gap-4">
          <div>
            <div className="text-sm text-text-secondary mb-1">
              Email
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => window.location.href = `mailto:${sitter.email}`}
              leftIcon={<Mail className="w-4 h-4" />}
            >
              {sitter.email}
            </Button>
          </div>
          <div>
            <div className="text-sm text-text-secondary mb-1">
              Phone
            </div>
            <div className="text-text-primary">
              {safePhone}
            </div>
          </div>
        </div>
      </Card>

      {/* Commission */}
      <Card>
        <SectionHeader title="Commission" />
        <div className="p-4">
          <div>
            <div className="text-sm text-text-secondary mb-1">
              Commission Rate
            </div>
            <div className="font-semibold text-base">
              {sitter.commissionPercentage || 80}%
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
