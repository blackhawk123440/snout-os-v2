#!/usr/bin/env bash
#
# Payroll completion proof on staging — run this sequence with staging env.
#
# Required env:
#   DATABASE_URL     staging Postgres URL
#   BASE_URL         staging app URL (e.g. https://snout-os-staging.onrender.com)
#   E2E_AUTH_KEY     same key used by /api/ops/e2e-login on staging
#
# Optional (for step 1):
#   RESOLVE_AI_GOVERNANCE=rolled-back   if the AI governance migration did NOT apply
#   RESOLVE_AI_GOVERNANCE=applied       if the AI governance migration DID apply / you fixed DB
#   If unset, step 1 is skipped (run resolve manually per docs/MIGRATION_REPAIR.md)
#
# Usage:
#   RESOLVE_AI_GOVERNANCE=applied DATABASE_URL="..." BASE_URL="..." E2E_AUTH_KEY="..." ./scripts/payroll-staging-proof.sh
#
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=== Payroll staging proof ==="
echo ""

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}FAIL: DATABASE_URL is required${NC}"
  exit 1
fi
if [ -z "$BASE_URL" ]; then
  echo -e "${RED}FAIL: BASE_URL is required (e.g. https://your-staging.onrender.com)${NC}"
  exit 1
fi
if [ -z "$E2E_AUTH_KEY" ]; then
  echo -e "${RED}FAIL: E2E_AUTH_KEY is required${NC}"
  exit 1
fi

# --- 1) Repair staging migration chain ---
echo "--- 1) Repair staging migration chain ---"
if [ "$RESOLVE_AI_GOVERNANCE" = "rolled-back" ]; then
  echo "Resolving 20260305000000_add_ai_governance as rolled-back..."
  pnpm prisma migrate resolve --rolled-back 20260305000000_add_ai_governance
elif [ "$RESOLVE_AI_GOVERNANCE" = "applied" ]; then
  echo "Resolving 20260305000000_add_ai_governance as applied..."
  pnpm prisma migrate resolve --applied 20260305000000_add_ai_governance
else
  echo "RESOLVE_AI_GOVERNANCE not set. If you have a failed migration, run one of:"
  echo "  RESOLVE_AI_GOVERNANCE=rolled-back $0"
  echo "  RESOLVE_AI_GOVERNANCE=applied $0"
  echo "Then re-run this script. Proceeding with migrate deploy..."
fi

echo "Running: pnpm prisma migrate deploy"
pnpm prisma migrate deploy
echo -e "${GREEN}Migrate deploy done.${NC}"
echo ""

# --- 2) Schema proof (verifier does this; we run verifier in step 4) ---
echo "--- 2) Schema proof (verified in step 4 by verify:payroll) ---"
echo "PayrollRun.orgId and PayrollLineItem.payoutTransferId will be confirmed when verifier runs."
echo ""

# --- 3) Capture /api/health proof ---
echo "--- 3) Staging /api/health proof ---"
HEALTH_URL="${BASE_URL%/}/api/health"
echo "GET $HEALTH_URL"
echo ""
HEALTH_RESP=$(curl -sS -w "\n%{http_code}" "$HEALTH_URL")
HEALTH_CODE=$(echo "$HEALTH_RESP" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESP" | sed '$d')
if [ "$HEALTH_CODE" != "200" ]; then
  echo -e "${RED}FAIL: /api/health returned $HEALTH_CODE${NC}"
  echo "$HEALTH_BODY"
  exit 1
fi
if command -v jq >/dev/null 2>&1; then
  echo "$HEALTH_BODY" | jq .
else
  echo "$HEALTH_BODY"
fi
echo ""
echo -e "${GREEN}Health JSON above. Save it as staging /api/health proof.${NC}"
echo ""

# --- 4) Run deterministic payroll verifier ---
echo "--- 4) Run verify:payroll (staging DB + staging API) ---"
echo "Command: DATABASE_URL=... BASE_URL=... E2E_AUTH_KEY=... pnpm run verify:payroll"
echo ""
DATABASE_URL="$DATABASE_URL" BASE_URL="$BASE_URL" E2E_AUTH_KEY="$E2E_AUTH_KEY" pnpm run verify:payroll
echo ""
echo -e "${GREEN}If you see RESULT: PASS above, payroll staging proof is complete.${NC}"
echo ""

# --- 5) Deliverables reminder ---
echo "--- 5) Deliverables before Payroll is marked COMPLETE ---"
echo "  [ ] Staging /api/health JSON (pasted above)"
echo "  [ ] Full verify:payroll PASS output (above)"
echo "  [ ] Short confirmation using docs/PAYROLL_COMPLETION_SUMMARY.md"
echo ""
echo "Only after all three are done, mark Payroll COMPLETE and then move to Reports/Analytics."
