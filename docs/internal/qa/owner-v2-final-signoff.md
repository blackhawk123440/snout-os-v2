# Owner V2 Final Sign-off

## Staging health JSON

```json
{"status":"ok","db":"ok","redis":"ok","version":"9658a67a9d9bc0dd90b1586ff5972bb5e1e26c88","commitSha":"9658a67","buildTime":"2026-03-05T17:38:51.060Z","envName":"staging","timestamp":"2026-03-05T17:38:51.060Z"}
```

## Verifier output (full)

```text
=== Command Center Verification Report ===
runId=verify-mmdr2g2a-sybz2u
health.commitSha=9658a67
health.envName=staging
health.redis=ok
seed.ok=true
seed.runId=verify-mmdr2g2a-sybz2u
seed.expectedItemKeys=10
attention.total=63
attention.byType={"payout_failure":1,"automation_failure":32,"calendar_repair":9,"coverage_gap":7,"unassigned":7,"overlap":7}
attention.bySeverity={"high":40,"medium":23}
attention.first10Ids=["payout_failure:105550d2-142c-4530-9fb2-a3d845eba1d0","automation_failure:e4ff5883-526a-4c01-adae-641ecc78824f","automation_failure:8a27e06e-3562-4733-b8ce-0d345f6a3f59","automation_failure:3464a949-6de0-4a13-b0ff-b5702fee50c3","automation_failure:906ed989-eca3-475d-a7d6-7d50c2b5738b","automation_failure:d78f8ee9-ee84-4428-bdeb-1e197708d83a","automation_failure:36bf5c93-8ed5-4c0a-8bac-eea53517ba66","automation_failure:309e8740-2093-42d5-90b0-57c93d4a553c","automation_failure:fb9e9a68-036e-464b-85f5-b44d79c69ef3","automation_failure:1c7ae3ed-0180-43eb-a084-210623058435"]
fix.automation={"itemId":"automation_failure:3464a949-6de0-4a13-b0ff-b5702fee50c3","actionEntityId":"4cbed987-ccc2-45ec-b2eb-4e1d6d692af4"}
fix.calendar={"itemId":"calendar_repair:46d16276-9ba6-4ec7-b10d-d2a9876bec73","eventLogId":"d6d957c2-9c06-4c09-bf13-d796fb12bb5b"}
fix.payout={"itemId":"payout_failure:105550d2-142c-4530-9fb2-a3d845eba1d0","eventLogId":"f1a63af7-562a-4422-88e1-37a43522f4bb"}
staffing.assign={"assignmentId":"staffing_assign:746543cb-1600-4884-aab8-73115afbeb3f","bookingId":"746543cb-1600-4884-aab8-73115afbeb3f","sitterId":"53a5ecb4-0b77-43a4-91d1-4235635b7228","notifySent":true}
staffing.rollback={"assignmentId":"staffing_assign:746543cb-1600-4884-aab8-73115afbeb3f","restored":true}
actions.removed=[automation_failure:e4ff5883-526a-4c01-adae-641ecc78824f,automation_failure:8a27e06e-3562-4733-b8ce-0d345f6a3f59]
sitter.apiStatus=403
sitter.pageStatus=307
client.apiStatus=403
client.pageStatus=307
RESULT: PASS
```

## Screenshot evidence

- `artifacts/command-center-closed-loop-desktop.png`
