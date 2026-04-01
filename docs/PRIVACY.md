# Privacy & Data Retention

## Account Deletion (Soft Delete)

Snout OS supports account deletion for clients and sitters. Deletion is **soft delete** only: records are retained for historical and legal purposes but the user is immediately blocked from signing in and accessing the platform.

### Client Self-Delete

- **Endpoint**: `POST /api/client/delete-account`
- **Requires**: Authenticated session with `clientId`
- **Effect**: Sets `Client.deletedAt` and `User.deletedAt`
- **Immediate**: User is signed out and cannot sign in again

### Sitter Self-Delete

- **Endpoint**: `POST /api/sitter/delete-account`
- **Requires**: Authenticated session with `sitterId`
- **Effect**: Sets `Sitter.deletedAt` and `User.deletedAt`
- **Immediate**: User is signed out and cannot sign in again

### Owner/Admin Delete

- **Endpoint**: `POST /api/ops/users/[id]/delete`
- **Requires**: Owner or admin role
- **Effect**: Soft-deletes the user and linked sitter/client entity

## Data Export

- **Policy**: Clients must export their data **before** deleting their account.
- **Reason**: Once deleted, the user cannot authenticate; export requires an active session.
- **Endpoint**: `GET /api/client/export` (returns JSON bundle of profile, pets, bookings, reports, messages, payments)
- **Deleted clients**: Cannot call export (403). Export is not available during the retention period for deleted accounts.

## GDPR / Erase Workflow

- **Endpoint**: `POST /api/ops/users/[id]/erase`
- **Requires**: Owner or admin role
- **Scope**: Client and sitter accounts linked to a `User`
- **Effect**:
  - Replaces direct identifiers on `User`, `Client`, and `Sitter` records with tombstone values
  - Clears password hashes, reset tokens, saved payment identifiers, contact lists, emergency contacts, and connected calendar/payment tokens
  - Scrubs identifying booking and pet fields that are retained for operational history
- **Result**: Historical records stay structurally intact for finance and service integrity, but direct personal identifiers are removed from the active data model

## Retention

- Soft-deleted records remain in the database for historical integrity (bookings, reports, payments).
- Owners can still view deleted clients' and sitters' historical data (read-only) with a "Deleted" badge.
- GDPR-style erase is supported through the owner/admin anonymization workflow above.

## Background Jobs

- **Reminders**: Skip bookings where client or sitter has `deletedAt` set.
- **Payouts**: Skip payout for bookings assigned to deleted sitters.
