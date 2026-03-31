"use client";

import { useRouter } from "next/navigation";
import { OwnerAppShell, LayoutWrapper, PageHeader } from "@/components/layout";
import { Card, Button } from "@/components/ui";
import { tokens } from "@/lib/design-tokens";

/**
 * Calendar accounts / setup: honest surface.
 * Sync is per-sitter; sitters connect Google via OAuth. No placeholder API calls.
 */
export default function CalendarAccountsPage() {
  const router = useRouter();
  return (
    <OwnerAppShell>
      <LayoutWrapper variant="default">
        <PageHeader
          title="Calendar setup"
          subtitle="How calendar sync works"
          actions={
            <Button variant="secondary" onClick={() => router.push("/calendar")}>
              Back to Calendar
            </Button>
          }
        />

      <div style={{ padding: 0, maxWidth: 560 }}>
        <Card>
          <div style={{ padding: tokens.spacing[6] }}>
            <h2 style={{ fontSize: tokens.typography.fontSize.lg[0], fontWeight: tokens.typography.fontWeight.bold, marginBottom: tokens.spacing[3] }}>
              Per-sitter Google Calendar
            </h2>
            <p style={{ color: tokens.colors.text.secondary, marginBottom: tokens.spacing[4], lineHeight: 1.5 }}>
              Bookings are synced to each assigned sitter&apos;s Google Calendar. Sitters connect their Google account
              from their profile or settings. Once connected, assigned bookings appear on their calendar and stay in
              sync when you change times or reassign.
            </p>
            <p style={{ color: tokens.colors.text.secondary, marginBottom: tokens.spacing[4], lineHeight: 1.5 }}>
              As an owner, use the main Calendar to view all bookings. The worker service runs sync jobs when bookings
              are created, updated, or cancelled.
            </p>
            <div style={{ display: "flex", gap: tokens.spacing[3], flexWrap: "wrap" }}>
              <Button variant="primary" onClick={() => router.push("/calendar")}>
                Open Calendar
              </Button>
              <Button variant="secondary" onClick={() => router.push("/sitters")}>
                Sitters
              </Button>
            </div>
          </div>
        </Card>
      </div>
      </LayoutWrapper>
    </OwnerAppShell>
  );
}
