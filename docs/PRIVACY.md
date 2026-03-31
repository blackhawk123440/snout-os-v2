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

## Retention

- Soft-deleted records remain in the database for historical integrity (bookings, reports, payments).
- Owners can still view deleted clients' and sitters' historical data (read-only) with a "Deleted" badge.
- No hard deletion or full GDPR erase workflow is implemented in this phase.

## Background Jobs

- **Reminders**: Skip bookings where client or sitter has `deletedAt` set.
- **Payouts**: Skip payout for bookings assigned to deleted sitters.
