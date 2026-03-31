import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

type Role = "owner" | "sitter" | "client";
type CaptureKind = "real" | "placeholder";
type CaptureItem = {
  scenario: string;
  file: string;
  role: Role;
  route: string | null;
  status: CaptureKind;
  reason?: string;
  replacementNeeded?: string;
};

const BASE_URL = process.env.BASE_URL || "https://snout-os-staging.onrender.com";
const E2E_AUTH_KEY = process.env.E2E_AUTH_KEY || "test-e2e-key-change-in-production";
const ROOT = path.resolve(process.cwd(), "docs/qa/scenario-screenshots");

const PRIORITY_SCENARIOS = new Set([
  "scenario-04-twilio-masked-messaging",
  "scenario-05-sitter-start-visit",
  "scenario-06-sitter-end-visit",
  "scenario-08-calendar-conflict-detection",
  "scenario-09-payment-processing",
  "scenario-10-loyalty-points-awarded",
  "scenario-12-busy-sitter-day",
  "scenario-15-emergency-booking",
]);

function parseSetCookie(raw: string): { name: string; value: string } | null {
  const first = raw.split(";")[0] ?? "";
  const idx = first.indexOf("=");
  if (idx <= 0) return null;
  return { name: first.slice(0, idx), value: first.slice(idx + 1) };
}

function getSetCookies(res: Response): string[] {
  const maybe = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof maybe.getSetCookie === "function") return maybe.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

async function e2eCookie(role: Role) {
  const res = await fetch(`${BASE_URL}/api/ops/e2e-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-e2e-key": E2E_AUTH_KEY,
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`e2e-login failed for ${role}: ${res.status} ${body}`);
  }
  const all = getSetCookies(res)
    .map(parseSetCookie)
    .filter((c): c is { name: string; value: string } => Boolean(c));
  if (all.length === 0) throw new Error(`e2e-login returned no cookies for ${role}`);
  return all;
}

function cookieHeader(cookies: Array<{ name: string; value: string }>) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function fetchJson(pathname: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${pathname}`, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json };
}

async function captureRoute(page: Page, outPath: string, route: string) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: outPath, fullPage: true });
}

async function placeholderShot(page: Page, outPath: string, title: string, reason: string, replacementNeeded: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(
    `<html><body style="margin:0;background:#0b1020;color:#e8ecff;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">
      <div style="padding:40px;max-width:1100px;">
        <h1 style="font-size:28px;margin:0 0 16px;">Placeholder: ${title}</h1>
        <p style="font-size:16px;opacity:0.9;">Reason: ${reason}</p>
        <p style="font-size:15px;opacity:0.8;">Needed to replace: ${replacementNeeded}</p>
      </div>
    </body></html>`,
    { waitUntil: "domcontentloaded" }
  );
  await page.screenshot({ path: outPath, fullPage: true });
}

async function getSessionSitterId(sitterCookieHeader: string): Promise<string> {
  const session = await fetchJson("/api/auth/session", { headers: { Cookie: sitterCookieHeader } });
  const sitterId = session.json?.user?.sitterId as string | undefined;
  if (!sitterId) throw new Error(`Sitter session missing sitterId: ${session.text}`);
  return sitterId;
}

async function createBooking(clientCookieHeader: string, suffix: string, minutesFromNow = 30) {
  const now = new Date();
  const startAt = new Date(now.getTime() + minutesFromNow * 60_000);
  const endAt = new Date(startAt.getTime() + 30 * 60_000);
  const payload = {
    firstName: "Scenario",
    lastName: suffix,
    phone: process.env.SMOKE_TEST_PHONE || "+14155550101",
    email: `scenario-${suffix.toLowerCase()}@example.com`,
    address: "123 Scenario Lane, Atlanta, GA",
    service: "Dog Walking",
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    quantity: 1,
    pets: [{ name: "Milo", species: "Dog" }],
    notes: `Scenario setup ${suffix}`,
  };
  const created = await fetchJson("/api/client/bookings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Cookie: clientCookieHeader,
    },
    body: JSON.stringify(payload),
  });
  const bookingId = created.json?.booking?.id as string | undefined;
  if (!created.res.ok || !bookingId) {
    throw new Error(`createBooking failed: status=${created.res.status} body=${created.text}`);
  }
  return bookingId;
}

async function assignBooking(ownerCookieHeader: string, bookingId: string, sitterId: string) {
  const assigned = await fetchJson(`/api/bookings/${bookingId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      Cookie: ownerCookieHeader,
    },
    body: JSON.stringify({ sitterId, status: "confirmed" }),
  });
  if (!assigned.res.ok) {
    throw new Error(`assignBooking failed: status=${assigned.res.status} body=${assigned.text}`);
  }
}

async function checkInOutAndReport(sitterCookieHeader: string, bookingId: string) {
  const checkIn = await fetchJson(`/api/bookings/${bookingId}/check-in`, {
    method: "POST",
    headers: { "content-type": "application/json", Cookie: sitterCookieHeader },
    body: JSON.stringify({ lat: 33.75, lng: -84.39 }),
  });
  if (!checkIn.res.ok) throw new Error(`check-in failed: ${checkIn.res.status} ${checkIn.text}`);
  const checkOut = await fetchJson(`/api/bookings/${bookingId}/check-out`, {
    method: "POST",
    headers: { "content-type": "application/json", Cookie: sitterCookieHeader },
    body: JSON.stringify({ lat: 33.75, lng: -84.39 }),
  });
  if (!checkOut.res.ok) throw new Error(`check-out failed: ${checkOut.res.status} ${checkOut.text}`);
  const report = await fetchJson(`/api/bookings/${bookingId}/daily-delight`, {
    method: "POST",
    headers: { "content-type": "application/json", Cookie: sitterCookieHeader },
    body: JSON.stringify({ report: `Scenario report ${new Date().toISOString()}` }),
  });
  if (!report.res.ok) throw new Error(`report failed: ${report.res.status} ${report.text}`);
}

async function getClientThreadId(clientCookieHeader: string, bookingId: string): Promise<string | null> {
  const threads = await fetchJson("/api/client/messages", { headers: { Cookie: clientCookieHeader } });
  if (!threads.res.ok || !Array.isArray(threads.json?.threads)) return null;
  const match = threads.json.threads.find((t: any) => t.booking?.id === bookingId);
  return (match?.id as string | undefined) ?? null;
}

async function sendThreadMessages(clientCookieHeader: string, sitterCookieHeader: string, threadId: string) {
  await fetchJson(`/api/client/messages/${threadId}`, {
    method: "POST",
    headers: { "content-type": "application/json", Cookie: clientCookieHeader },
    body: JSON.stringify({ body: `Client scenario ping ${new Date().toISOString()}` }),
  });
  await fetchJson(`/api/sitter/threads/${threadId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", Cookie: sitterCookieHeader },
    body: JSON.stringify({ body: `Sitter scenario reply ${new Date().toISOString()}` }),
  });
}

async function main() {
  await fs.mkdir(ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const cookieDomain = new URL(BASE_URL).hostname;

  const contexts = {} as Record<Role, BrowserContext>;
  const pages = {} as Record<Role, Page>;
  const cookieByRole = {} as Record<Role, Array<{ name: string; value: string }>>;
  const captureReport: CaptureItem[] = [];

  let mainBookingId = "";
  let inProgressBookingId = "";
  let emergencyBookingId = "";
  let mainThreadId: string | null = null;
  let paidProofBookingId: string | null = null;
  let sitterId = "";

  try {
    for (const role of ["owner", "sitter", "client"] as const) {
      contexts[role] = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      cookieByRole[role] = await e2eCookie(role);
      await contexts[role].addCookies(
        cookieByRole[role].map((c) => ({
          name: c.name,
          value: c.value,
          domain: cookieDomain,
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax" as const,
        }))
      );
      pages[role] = await contexts[role].newPage();
    }

    const ownerCookieHeader = cookieHeader(cookieByRole.owner);
    const clientCookieHeader = cookieHeader(cookieByRole.client);
    const sitterCookieHeader = cookieHeader(cookieByRole.sitter);

    // Seed ops fixtures and build scenario state.
    await fetchJson("/api/ops/command-center/seed-fixtures", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-e2e-key": E2E_AUTH_KEY,
      },
      body: JSON.stringify({}),
    });

    sitterId = await getSessionSitterId(sitterCookieHeader);

    // Main booking for Twilio + assignment + messaging + completion.
    mainBookingId = await createBooking(clientCookieHeader, "twilio-main", 35);
    await assignBooking(ownerCookieHeader, mainBookingId, sitterId);
    mainThreadId = await getClientThreadId(clientCookieHeader, mainBookingId);
    if (mainThreadId) await sendThreadMessages(clientCookieHeader, sitterCookieHeader, mainThreadId);
    await checkInOutAndReport(sitterCookieHeader, mainBookingId);

    // In-progress booking for sitter timer scenario.
    inProgressBookingId = await createBooking(clientCookieHeader, "in-progress", 5);
    await assignBooking(ownerCookieHeader, inProgressBookingId, sitterId);
    await fetchJson(`/api/bookings/${inProgressBookingId}/check-in`, {
      method: "POST",
      headers: { "content-type": "application/json", Cookie: sitterCookieHeader },
      body: JSON.stringify({ lat: 33.75, lng: -84.39 }),
    });

    // Conflict setup (two overlaps with same sitter).
    const conflictA = await createBooking(clientCookieHeader, "conflict-a", 120);
    const conflictB = await createBooking(clientCookieHeader, "conflict-b", 125);
    await assignBooking(ownerCookieHeader, conflictA, sitterId);
    await assignBooking(ownerCookieHeader, conflictB, sitterId);
    await fetchJson("/api/bookings/conflicts", { headers: { Cookie: ownerCookieHeader } });

    // Emergency booking setup.
    emergencyBookingId = await createBooking(clientCookieHeader, "emergency", 20);
    await assignBooking(ownerCookieHeader, emergencyBookingId, sitterId);

    // Trigger automation test-message.
    await fetchJson("/api/automations/test-message", {
      method: "POST",
      headers: { "content-type": "application/json", Cookie: ownerCookieHeader },
      body: JSON.stringify({
        template: `Scenario automation ping ${new Date().toISOString()}`,
        phoneNumber: process.env.SMOKE_TEST_PHONE || "+14155550101",
      }),
    });

    // Prefer a real paid booking proof surface from webhook-confirmed billing data.
    const billingProof = await fetchJson("/api/client/billing", { headers: { Cookie: clientCookieHeader } });
    const paidProof = Array.isArray(billingProof.json?.paidCompletions)
      ? billingProof.json.paidCompletions.find((p: any) => typeof p?.bookingReference === "string")
      : null;
    paidProofBookingId = (paidProof?.bookingReference as string | undefined) ?? null;
    const paymentProofRoute = paidProofBookingId
      ? `/client/bookings/${paidProofBookingId}`
      : "/client/billing";

    const captures: Array<Omit<CaptureItem, "status"> & { status: CaptureKind }> = [
      { scenario: "scenario-01-client-first-booking", file: "client-upcoming-visits.png", role: "client", route: "/client/bookings", status: "real" },
      { scenario: "scenario-01-client-first-booking", file: "client-booking-confirmation.png", role: "client", route: `/client/bookings/${mainBookingId}`, status: "real" },

      { scenario: "scenario-02-recurring-bookings", file: "client-recurring-bookings-list.png", role: "client", route: "/client/bookings", status: "real" },

      { scenario: "scenario-03-owner-assigns-sitter", file: "owner-assign-sitter.png", role: "owner", route: `/bookings/${mainBookingId}`, status: "real" },
      { scenario: "scenario-03-owner-assigns-sitter", file: "owner-booking-notification.png", role: "owner", route: "/dashboard", status: "real" },

      { scenario: "scenario-04-twilio-masked-messaging", file: "client-booking-confirmation.png", role: "client", route: `/client/bookings/${mainBookingId}`, status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "masked-number-thread-client.png", role: "client", route: mainThreadId ? `/client/messages/${mainThreadId}` : "/client/messages", status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "owner-booking-notification.png", role: "owner", route: "/dashboard", status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "owner-assign-sitter.png", role: "owner", route: `/bookings/${mainBookingId}`, status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "sitter-assignment.png", role: "sitter", route: "/sitter/today", status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "masked-number-thread-sitter.png", role: "sitter", route: "/sitter/inbox", status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "message-thread-active.png", role: "owner", route: mainThreadId ? `/messages?tab=inbox&thread=${mainThreadId}` : "/messages?tab=inbox", status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "sitter-calendar.png", role: "sitter", route: "/sitter/calendar", status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "google-calendar-sync.png", role: "owner", route: `/bookings/${mainBookingId}`, status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "payment-success.png", role: "client", route: paymentProofRoute, status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "loyalty-points.png", role: "client", route: "/client/billing", status: "real" },
      { scenario: "scenario-04-twilio-masked-messaging", file: "owner-dashboard-updated.png", role: "owner", route: "/dashboard", status: "real" },

      { scenario: "scenario-05-sitter-start-visit", file: "sitter-start-visit-button.png", role: "sitter", route: `/sitter/bookings/${inProgressBookingId}`, status: "real" },
      { scenario: "scenario-05-sitter-start-visit", file: "sitter-visit-timer.png", role: "sitter", route: `/sitter/bookings/${inProgressBookingId}`, status: "real" },

      { scenario: "scenario-06-sitter-end-visit", file: "sitter-end-visit.png", role: "sitter", route: `/sitter/bookings/${mainBookingId}`, status: "real" },
      { scenario: "scenario-06-sitter-end-visit", file: "sitter-report-form.png", role: "sitter", route: `/sitter/reports/new?bookingId=${mainBookingId}`, status: "real" },

      { scenario: "scenario-07-client-report-received", file: "client-report-view.png", role: "client", route: "/client/reports", status: "real" },
      { scenario: "scenario-07-client-report-received", file: "client-message-report-notice.png", role: "client", route: "/client/messages", status: "real" },

      { scenario: "scenario-08-calendar-conflict-detection", file: "owner-calendar-conflict.png", role: "owner", route: "/calendar", status: "real" },
      { scenario: "scenario-08-calendar-conflict-detection", file: "owner-conflict-resolution.png", role: "owner", route: "/calendar", status: "real" },

      { scenario: "scenario-09-payment-processing", file: "payment-success.png", role: "client", route: paymentProofRoute, status: "real" },
      { scenario: "scenario-09-payment-processing", file: "owner-payment-status.png", role: "owner", route: "/payments", status: "real" },

      { scenario: "scenario-10-loyalty-points-awarded", file: "client-points-balance.png", role: "client", route: "/client/billing", status: "real" },
      { scenario: "scenario-10-loyalty-points-awarded", file: "owner-loyalty-ledger.png", role: "owner", route: "/dashboard", status: "real" },

      { scenario: "scenario-11-owner-revenue-dashboard", file: "owner-command-center.png", role: "owner", route: "/dashboard", status: "real" },
      { scenario: "scenario-11-owner-revenue-dashboard", file: "owner-revenue-dashboard.png", role: "owner", route: "/analytics", status: "real" },
      { scenario: "scenario-11-owner-revenue-dashboard", file: "owner-automation-log.png", role: "owner", route: "/automations", status: "real" },

      { scenario: "scenario-12-busy-sitter-day", file: "sitter-today-overview.png", role: "sitter", route: "/sitter/today", status: "real" },
      { scenario: "scenario-12-busy-sitter-day", file: "sitter-upcoming-visits.png", role: "sitter", route: "/sitter/bookings", status: "real" },
      { scenario: "scenario-12-busy-sitter-day", file: "sitter-visit-timer.png", role: "sitter", route: `/sitter/bookings/${inProgressBookingId}`, status: "real" },
      { scenario: "scenario-12-busy-sitter-day", file: "sitter-report-form.png", role: "sitter", route: `/sitter/reports/new?bookingId=${mainBookingId}`, status: "real" },

      { scenario: "scenario-13-client-reschedule", file: "client-reschedule-flow.png", role: "client", route: "/client/bookings", status: "real" },
      { scenario: "scenario-13-client-reschedule", file: "owner-reschedule-notification.png", role: "owner", route: "/dashboard", status: "real" },

      { scenario: "scenario-14-reminder-automation", file: "owner-automation-log.png", role: "owner", route: "/automations", status: "real" },
      { scenario: "scenario-14-reminder-automation", file: "client-reminder-message.png", role: "client", route: "/client/messages", status: "real" },

      { scenario: "scenario-15-emergency-booking", file: "owner-emergency-booking-card.png", role: "owner", route: `/bookings/${emergencyBookingId}`, status: "real" },
      { scenario: "scenario-15-emergency-booking", file: "sitter-emergency-assignment.png", role: "sitter", route: "/sitter/today", status: "real" },
      { scenario: "scenario-15-emergency-booking", file: "client-emergency-confirmation.png", role: "client", route: `/client/bookings/${emergencyBookingId}`, status: "real" },
    ];

    for (const item of captures) {
      const dir = path.join(ROOT, item.scenario);
      await fs.mkdir(dir, { recursive: true });
      const outPath = path.join(dir, item.file);
      try {
        if (item.status === "real" && item.route) {
          await captureRoute(pages[item.role], outPath, item.route);
          captureReport.push({ ...item });
        } else {
          await placeholderShot(
            pages[item.role],
            outPath,
            `${item.scenario}/${item.file}`,
            item.reason || "Manual state required",
            item.replacementNeeded || "Replay scenario and capture exact state manually."
          );
          captureReport.push({ ...item, status: "placeholder" });
        }
      } catch (error: any) {
        await placeholderShot(
          pages[item.role],
          outPath,
          `${item.scenario}/${item.file}`,
          `Auto-capture failed: ${error?.message || String(error)}`,
          "Open this route in role session, reach required state, recapture manually."
        );
        captureReport.push({
          scenario: item.scenario,
          file: item.file,
          role: item.role,
          route: item.route,
          status: "placeholder",
          reason: `Auto-capture failed: ${error?.message || String(error)}`,
          replacementNeeded: "Manual in-app replay and recapture.",
        });
      }
      console.log(`[scenario-test] ${captureReport[captureReport.length - 1].status} ${item.scenario}/${item.file}`);
    }

    const byScenario: Record<string, { real: number; placeholder: number; priority: boolean }> = {};
    for (const c of captureReport) {
      if (!byScenario[c.scenario]) {
        byScenario[c.scenario] = { real: 0, placeholder: 0, priority: PRIORITY_SCENARIOS.has(c.scenario) };
      }
      if (c.status === "real") byScenario[c.scenario].real += 1;
      else byScenario[c.scenario].placeholder += 1;
    }

    await fs.writeFile(
      path.join(ROOT, "report.json"),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          baseUrl: BASE_URL,
          setup: {
            mainBookingId,
            inProgressBookingId,
            emergencyBookingId,
            sitterId,
            threadId: mainThreadId,
            paidProofBookingId,
          },
          scenarios: Object.keys(byScenario).length,
          images: captureReport.length,
          summaryByScenario: byScenario,
          report: captureReport,
        },
        null,
        2
      )
    );
  } finally {
    for (const role of ["owner", "sitter", "client"] as const) {
      await contexts[role]?.close().catch(() => {});
    }
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[scenario-test] failed", error);
  process.exit(1);
});

