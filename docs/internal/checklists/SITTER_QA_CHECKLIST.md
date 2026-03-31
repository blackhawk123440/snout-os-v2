# Sitter Dashboard QA Checklist

Playful-warm, fail-soft, immaculate. Use this checklist before release.

## Routes to verify

| Route | States to test |
|-------|----------------|
| `/sitter/today` | Loading, empty, error, with 1+ bookings |
| `/sitter/calendar` | Loading, empty, error, with bookings, visit drawer open |
| `/sitter/inbox` | Loading, empty, error, with threads, message view |
| `/sitter/earnings` | Loading, error, with data, jobs list, breakdown drawer |
| `/sitter/profile` | Loading, error, with profile |
| `/sitter/pets` | Loading, empty, error, with pets |
| `/sitter/pets/[id]` | Pet detail, alert banners |
| `/sitter/reports` | Empty, composer modal |
| `/sitter/availability` | Loading, error, with blocks |
| `/sitter/performance` | Badges, ratings |
| `/sitter/training` | Checklist, complete state |
| `/sitter/jobs` | Loading, empty, error |
| `/sitter/bookings/[id]` | Loading, error, with booking, Daily Delight |

## State kit verification

- [ ] **SitterSkeletonList** – shows on loading (Today, Calendar, Earnings, etc.)
- [ ] **SitterEmptyState** – shows when no data (title, subtitle, CTA when applicable)
- [ ] **SitterErrorState** – shows on API failure, "Try again" triggers refetch
- [ ] **SitterOfflineBanner** – appears when `navigator.onLine` is false

## Card system consistency

- [ ] All cards use `rounded-2xl`, consistent padding, shadow
- [ ] **SitterCard** / **SitterCardHeader** / **SitterCardBody** / **SitterCardActions** used
- [ ] **SitterPageHeader** on all sitter pages (title, subtitle, optional action)

## Today cockpit

- [ ] Next Visit hero: countdown, pet avatars, Start/Finish Visit, Message, ✨ Daily Delight
- [ ] Visit cards: status pill, alert badges (when present), Details, Message, ✨ Delight
- [ ] Quick insights strip: earnings stub, visits remaining, warm line

## Daily Delight

- [ ] Modal: booking summary, media placeholder, tone selector, delight text
- [ ] Regenerate, Save draft (stub), Send
- [ ] Success toast: "Sent 💛"
- [ ] Failure: warm fallback text, still editable

## Calendar

- [ ] Week/List segmented control
- [ ] Visit slide-over drawer: pets, alerts, time, actions, route placeholder
- [ ] Route optimization card with FeatureStatusPill

## Inbox

- [ ] Thread row: pet avatar (or client initial), title "Name • Time", preview, status pill
- [ ] Thread header: quick actions (Details, ✨ Daily Delight)
- [ ] Suggested reply panel: static suggestions, tone switch, 🧪 Beta

## Earnings

- [ ] Hero card: Today/Week/Month toggle, big number, "after split"
- [ ] Breakdown rows: visits, tips, add-ons (stub), pending
- [ ] Completed jobs list, tap → breakdown drawer

## Profile + secondary pages

- [ ] Verification, Documents, Offline mode cards (Coming soon)
- [ ] Profile links grid: Jobs, Availability, Pets, Reports, Performance, Training
- [ ] Pets: photo/initials, breed, alert badge
- [ ] Pet detail: big alert banners, emergency vet placeholder
- [ ] Reports: history list, New report CTA
- [ ] Availability: toggle prominent, block-off picker clean
- [ ] Performance: badges grid, ratings summary
- [ ] Training: checklist with satisfying complete state

## Copy and tone

- [ ] Empty states: warm, short phrases
- [ ] Error states: "Oops! Something went wrong", "Give it another try"
- [ ] "Daily Delight" used consistently (not "Report" or "report card" in UI)
- [ ] "Report Cards" used for the reports page title

## Accessibility + touch

- [ ] Every tappable area min 44px
- [ ] Focus rings for keyboard
- [ ] WCAG contrast (especially pills)

## Screenshots checklist (optional)

- [ ] Today empty
- [ ] Today with 1 booking
- [ ] Daily Delight modal open
- [ ] Inbox list
- [ ] Earnings hero + jobs list
- [ ] Calendar drawer open

## How to run Playwright snapshots

```bash
cd snout-os
npx playwright test tests/e2e/sitter-snapshots.spec.ts --update-snapshots
```

Run without `--update-snapshots` to verify against existing snapshots.
