/**
 * Blocker 2 proof: create booking, fetch threads by bookingId, show linked thread exists.
 * Intended contract: POST /api/client/bookings calls syncConversationLifecycleWithBookingWorkflow
 * (best-effort); GET /api/messages/threads?bookingId=X should return at least one thread when sync succeeds.
 *
 * Usage:
 *   BASE_URL=https://snout-os-staging.onrender.com E2E_AUTH_KEY=your-key npx tsx scripts/run-booking-thread-proof.ts
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
  console.log("BASE_URL:", BASE_URL);

  const ownerCookie = await e2eLogin("owner");
  const schemaCheck = await fetchJson("/api/ops/schema-check", { cookie: ownerCookie });
  print("(schema) GET /api/ops/schema-check", schemaCheck);

  const clientCookie = await e2eLogin("client");

  const now = Date.now();
  const startAt = new Date(now + 60 * 60 * 1000).toISOString();
  const endAt = new Date(now + 90 * 60 * 1000).toISOString();
  const payload = {
    firstName: "Blocker2Proof",
    lastName: "Thread",
    phone: process.env.SMOKE_TEST_PHONE || "+14155550101",
    email: "blocker2-proof@example.com",
    address: "500 Proof Lane",
    service: "Dog Walking",
    startAt,
    endAt,
    quantity: 1,
    pets: [{ name: "Proof Dog", species: "Dog" }],
    notes: "Blocker 2 booking->thread proof",
  };

  const createRes = await fetchJson("/api/client/bookings", {
    method: "POST",
    cookie: clientCookie,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  print("1) POST /api/client/bookings (create booking)", createRes);

  const bookingId = createRes.json?.booking?.id as string | undefined;
  const orgId = createRes.json?.orgId as string | undefined;
  const lifecycleSyncError = createRes.json?.lifecycleSyncError as { code?: string; message: string } | undefined;
  if (!createRes.ok || !bookingId) {
    console.error("Booking creation failed; aborting.");
    process.exit(1);
  }

  const threadsRes = await fetchJson(
    `/api/messages/threads?limit=50&bookingId=${encodeURIComponent(bookingId)}`,
    { cookie: ownerCookie }
  );
  print("2) GET /api/messages/threads?bookingId=" + bookingId, threadsRes);

  const items = (threadsRes.json?.items || []) as any[];
  // GET ?bookingId=X returns only threads with that bookingId
  const hasLinked = threadsRes.ok && items.length >= 1;

  console.log("\n--- Blocker 2 summary ---");
  console.log("bookingId:", bookingId);
  console.log("orgId:", orgId ?? "(not in response)");
  if (lifecycleSyncError) {
    console.log("lifecycleSyncError.code:", lifecycleSyncError.code ?? "(none)");
    console.log("lifecycleSyncError.message:", lifecycleSyncError.message);
  }
  console.log("threads items count:", items.length);
  console.log("linked thread exists:", hasLinked ? "YES" : "NO");
  if (items.length) {
    console.log("first thread id:", items[0].id);
  }
  process.exit(hasLinked ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
