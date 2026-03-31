# Owner V2 Slice #3 Acceptance (Staging)

Accepted evidence snapshot:

- `health.commitSha=a8cb2d5`
- `health.envName=staging`
- `health.redis=ok`
- deterministic verifier `RESULT: PASS`
- staffing assign returns `notifySent=true`
- rollback flow returns `restored=true`
- sitter/client access controls enforced: API `403`, page blocked (`307`)

Verifier output:

```text
=== Command Center Verification Report ===
health.commitSha=a8cb2d5
health.envName=staging
health.redis=ok
seed.ok=true
seed.expectedItemKeys=9
attention.total=10
attention.byType={"automation_failure":4,"calendar_repair":1,"coverage_gap":2,"unassigned":2,"overlap":1}
attention.bySeverity={"high":6,"medium":4}
attention.first10Ids=["automation_failure:60dc03fc-981c-4438-8288-0eb7c296f755","automation_failure:23cacac0-c1c1-4e7e-90d4-f97f5e9fc400","automation_failure:e630f5bc-37a3-48ae-8cc0-590132ab0cb3","automation_failure:9da1809b-c1da-49c7-a3de-44ba593c365f","calendar_repair:895b9947-45ff-4ff7-ab37-2c7f463b284c","coverage_gap:67885127-769b-48f7-a148-cd0d6d938040","coverage_gap:f2835683-0ce0-4264-bd62-aab351d40e88","unassigned:67885127-769b-48f7-a148-cd0d6d938040","overlap:895b9947-45ff-4ff7-ab37-2c7f463b284c_3daa0a3a-d71f-4af2-85a6-83eb330722dc","unassigned:f2835683-0ce0-4264-bd62-aab351d40e88"]
staffing.assign={"assignmentId":"staffing_assign:67885127-769b-48f7-a148-cd0d6d938040","bookingId":"67885127-769b-48f7-a148-cd0d6d938040","sitterId":"53a5ecb4-0b77-43a4-91d1-4235635b7228","notifySent":true}
staffing.rollback={"assignmentId":"staffing_assign:67885127-769b-48f7-a148-cd0d6d938040","restored":true}
actions.removed=[automation_failure:60dc03fc-981c-4438-8288-0eb7c296f755,automation_failure:23cacac0-c1c1-4e7e-90d4-f97f5e9fc400]
sitter.apiStatus=403
sitter.pageStatus=307
client.apiStatus=403
client.pageStatus=307
RESULT: PASS
```
