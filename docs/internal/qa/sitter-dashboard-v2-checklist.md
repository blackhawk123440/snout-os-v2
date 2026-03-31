# Sitter Dashboard V2 QA Checklist

## 1) Report edit flow

- Submit report on `/sitter/reports/new` and verify `Sent to client` confirmation appears.
- Verify `Edit (15 min)` link opens `/sitter/reports/edit/[reportId]`.
- For a fresh report (`<15m`), verify edit page loads with editable textarea and Save works.
- For a stale report (`>15m`), verify edit page shows `Editing no longer available` and Save is disabled.
- Confirm API behavior:
  - `GET /api/sitter/reports/[id]` returns `canEdit: true` within 15 minutes.
  - `GET /api/sitter/reports/[id]` returns `canEdit: false` after 15 minutes.
  - `PATCH /api/sitter/reports/[id]` returns 400 when edit window is expired.
- Verify missing/unauthorized IDs:
  - missing id -> user is redirected to `/sitter/reports` with error toast.
  - unauthorized or not found id -> redirected to `/sitter/reports` with error toast.

## 2) Inbox

- Verify unread badge only appears when `ownerUnreadCount > 0`.
- Verify unread badge count caps at `99+`.
- Verify thread list order is newest first by `lastActivityAt`.

## 3) Calendar

- Tap booking card in `/sitter/calendar` and verify navigation to `/sitter/bookings/[id]`.
- Tap `Message` button on a card and verify it opens inbox thread without card navigation.

## 4) Booking detail

- Verify `Contact` section renders only when phone or email exists.
- Verify both `tel:` and `mailto:` links are clickable on mobile.
- Verify long phone/email values wrap and do not overflow layout.
