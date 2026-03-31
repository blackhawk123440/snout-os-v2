# Render Deploy Discipline (Web + Worker)

To keep command-center behavior and background processing consistent:

- Always redeploy **web and worker together** from the same `main` commit.
- Prefer clear-cache deploys when recovering from stuck `update_in_progress`.
- Verify startup logs:
  - web commit via `/api/health.commitSha`
  - worker commit via `[Worker] commitSha: <sha>`

## Recommended command

```bash
CLEAR_CACHE=true pnpm tsx scripts/trigger-render-deploy.ts
```

This triggers redeploys for both staging web and worker services.
