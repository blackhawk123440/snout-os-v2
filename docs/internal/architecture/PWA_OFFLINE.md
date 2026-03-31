# PWA & Offline Sitter Workflows

## Overview

Snout OS sitter portal is a Progressive Web App (PWA) with offline-first support. Sitters can view Today's schedule and complete visits (check-in, check-out) even in poor-signal homes. Actions are queued when offline and sync automatically when connectivity returns.

## PWA Installability

- **Manifest:** `src/app/manifest.ts` — name, short_name, start_url (`/sitter/today`), display: standalone, icons (192, 512)
- **Service worker:** Serwist (Workbox) via `@serwist/next`
  - Precaches app shell and static assets
  - Network-first for API calls
  - Offline fallback page at `/offline`
- **Registration:** `SerwistProvider` in `src/components/providers.tsx` (disabled in dev)

## Offline Data Cache

- **IndexedDB** via `idb` — database `snout-offline`
- **Stores:**
  - `today-visits` — Today's bookings list keyed by date (YYYY-MM-DD)
  - `visit-details` — Individual visit payload keyed by bookingId
  - `action-queue` — Queued actions (check-in, check-out, etc.)
  - `pending-photos` — Photo blobs for report-media upload (reserved for future)

## Offline Action Queue

- **Actions:** `visit.checkin`, `visit.checkout`, `delight.create`, `report-media.upload`
- **Flow:** When offline, actions are written to IndexedDB. When online, `processQueue()` replays them against API endpoints.
- **Replay mapping:**
  - `visit.checkin` → `POST /api/bookings/[id]/check-in`
  - `visit.checkout` → `POST /api/bookings/[id]/check-out`
  - `delight.create` → `POST /api/bookings/[id]/daily-delight`
  - `report-media.upload` → `POST /api/upload/report-media`

## UX

- **SitterOfflineBanner:** Shows "You're offline" or "X actions queued" + "Sync now" button
- **Today page:** Loads from cache when offline; check-in/check-out enqueue when offline
- **Queued badge:** Visit cards show "Queued" when actions are pending

## Scope

- **Sitter only** — Owner/client portals are not offline-enabled
- **Last-write-wins** — No conflict resolution; timestamps used for ordering
