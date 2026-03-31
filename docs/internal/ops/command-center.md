# Command Center Deterministic Gates

Owner Command Center changes must pass this deterministic sequence end-to-end:

`seed -> attention -> staffing assign/rollback -> snooze/handled -> role blocks`

1. **Reset + seed fixtures**
   - Run reset first, then seed in the same verifier run.
   - Use a unique `runId` tag for seeded rows.
2. **Attention queue validation**
   - Fetch `/api/ops/command-center/attention`.
   - Assert counts, ordering, and deterministic first IDs.
3. **Staffing resolve validation**
   - Pick first `unassigned` item.
   - Run `assign_notify` and assert `notifySent=true`.
   - Verify assigned item disappears from attention queue.
   - Run rollback and verify assignment is restored and item reappears.
4. **Snooze + handled persistence**
   - Apply snooze and mark handled actions.
   - Re-fetch queue and verify both items remain hidden.
5. **Role enforcement**
   - Verify sitter/client are blocked from:
     - `/api/ops/command-center/attention` (expect `401`/`403`)
     - `/command-center` (expect non-`200`, e.g. `302`/`307`/`403`/`404`)

Primary verifier command:

`BASE_URL=... E2E_AUTH_KEY=... pnpm tsx scripts/verify-command-center.ts`
