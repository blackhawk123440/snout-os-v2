/**
 * Blocker 1 proof: run provider/test, numbers/sync, webhooks/status and print raw outputs.
 * Optionally re-connect first if STAGING_TWILIO_* env vars are set.
 *
 * Usage:
 *   BASE_URL=https://snout-os-staging.onrender.com E2E_AUTH_KEY=your-key npx tsx scripts/run-twilio-blocker-checks.ts
 * To fix credentials first (then run checks):
 *   STAGING_TWILIO_ACCOUNT_SID=ACxxx STAGING_TWILIO_AUTH_TOKEN=xxx BASE_URL=... E2E_AUTH_KEY=... npx tsx scripts/run-twilio-blocker-checks.ts
 *   Or with API Key: STAGING_TWILIO_ACCOUNT_SID=ACxxx STAGING_TWILIO_API_KEY_SID=SKxxx STAGING_TWILIO_API_KEY_SECRET=xxx ...
 */

const BASE_URL = process.env.BASE_URL || "https://snout-os-staging.onrender.com";
const E2E_AUTH_KEY = process.env.E2E_AUTH_KEY || "test-e2e-key-change-in-production";

function getSetCookies(res: Response): string[] {
  const maybe = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof maybe.getSetCookie === "function") return maybe.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function parseSetCookie(raw: string): { name: string; value: string } | null {
  const first = raw.split(";")[0] ?? "";
  const idx = first.indexOf("=");
  if (idx <= 0) return null;
  return { name: first.slice(0, idx), value: first.slice(idx + 1) };
}

async function e2eLogin(role: "owner" | "client" | "sitter"): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/ops/e2e-login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-e2e-key": E2E_AUTH_KEY },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`e2e-login failed for ${role}: ${res.status} ${await res.text()}`);
  const cookies = getSetCookies(res)
    .map(parseSetCookie)
    .filter((c): c is { name: string; value: string } => Boolean(c));
  if (!cookies.length) throw new Error(`e2e-login returned no cookies for ${role}`);
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function fetchJson(
  pathname: string,
  init: RequestInit & { cookie?: string } = {}
): Promise<{ status: number; ok: boolean; json: any; text: string }> {
  const headers = new Headers(init.headers || {});
  if (init.cookie) headers.set("Cookie", init.cookie);
  const res = await fetch(`${BASE_URL}${pathname}`, { ...init, headers });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json, text };
}

function print(name: string, result: { status: number; ok: boolean; json: any; text: string }) {
  console.log(`\n=== ${name} ===`);
  console.log("status:", result.status);
  console.log("body:", JSON.stringify(result.json ?? result.text, null, 2));
}

async function main() {
  const accountSid = process.env.STAGING_TWILIO_ACCOUNT_SID;
  const authToken = process.env.STAGING_TWILIO_AUTH_TOKEN;
  const apiKeySid = process.env.STAGING_TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.STAGING_TWILIO_API_KEY_SECRET;
  const doConnect = accountSid && (authToken || (apiKeySid && apiKeySecret));

  console.log("BASE_URL:", BASE_URL);
  console.log("Re-connect before checks:", doConnect);

  const ownerCookie = await e2eLogin("owner");

  if (doConnect) {
    const body: Record<string, string> = { accountSid: accountSid!.trim() };
    if (apiKeySid && apiKeySecret) {
      body.apiKeySid = apiKeySid.trim();
      body.apiKeySecret = apiKeySecret.trim();
    } else {
      body.authToken = authToken!.trim();
    }
    const connectRes = await fetchJson("/api/setup/provider/connect", {
      method: "POST",
      cookie: ownerCookie,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    print("a) POST /api/setup/provider/connect", connectRes);
    if (!connectRes.ok) {
      console.error("Connect failed; aborting checks.");
      process.exit(1);
    }
  }

  const diagnostics = await fetchJson("/api/ops/twilio-setup-diagnostics", { cookie: ownerCookie });
  print("(diagnostics) GET /api/ops/twilio-setup-diagnostics", diagnostics);

  const providerTest = await fetchJson("/api/setup/provider/test", {
    method: "POST",
    cookie: ownerCookie,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  print("a) POST /api/setup/provider/test", providerTest);

  const numbersSync = await fetchJson("/api/setup/numbers/sync", {
    method: "POST",
    cookie: ownerCookie,
  });
  print("b) POST /api/setup/numbers/sync", numbersSync);

  const webhookStatus = await fetchJson("/api/setup/webhooks/status", { cookie: ownerCookie });
  print("c) GET /api/setup/webhooks/status", webhookStatus);

  const allOk = providerTest.ok && numbersSync.ok && webhookStatus.ok;
  console.log("\n--- Blocker 1 summary ---");
  console.log("provider/test:", providerTest.ok ? "PASS" : "FAIL");
  console.log("numbers/sync:", numbersSync.ok ? "PASS" : "FAIL");
  console.log("webhooks/status:", webhookStatus.ok ? "PASS" : "FAIL");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
