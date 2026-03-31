import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

type ExplainRow = Record<string, unknown>;

type PlanSummary = {
  name: string;
  planningTimeMs: number | null;
  executionTimeMs: number | null;
  totalCost: number | null;
  planRows: number | null;
};

const prisma = new PrismaClient();
const artifactsDir = path.resolve(process.cwd(), "scripts/load/artifacts");

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parsePlan(raw: ExplainRow[]): { summary: PlanSummary; raw: unknown } {
  const first = raw[0] ?? {};
  const planRoot = (first["QUERY PLAN"] as Array<Record<string, unknown>> | undefined)?.[0] ?? {};
  const plan = (planRoot.Plan as Record<string, unknown> | undefined) ?? {};
  const summary: PlanSummary = {
    name: String(planRoot["Query Identifier"] ?? plan["Node Type"] ?? "unknown"),
    planningTimeMs: num(planRoot["Planning Time"]),
    executionTimeMs: num(planRoot["Execution Time"]),
    totalCost: num(plan["Total Cost"]),
    planRows: num(plan["Plan Rows"]),
  };
  return { summary, raw: first };
}

async function explain(sql: string): Promise<{ summary: PlanSummary; raw: unknown }> {
  const rows = await prisma.$queryRawUnsafe<ExplainRow[]>(sql);
  return parsePlan(rows);
}

function q(text: string): string {
  return text.replaceAll("'", "''");
}

async function main() {
  const orgId = process.env.EXPLAIN_ORG_ID || "default";
  const status = process.env.EXPLAIN_BOOKING_STATUS || "pending";
  const threadIdFromEnv = process.env.EXPLAIN_THREAD_ID || "";

  const threadSeed = threadIdFromEnv
    ? { id: threadIdFromEnv, clientId: null as string | null }
    : await prisma.messageThread.findFirst({
        where: { orgId },
        select: { id: true, clientId: true },
        orderBy: { updatedAt: "desc" },
      });
  if (!threadSeed?.id) {
    throw new Error(`No message thread found for orgId=${orgId}. Set EXPLAIN_THREAD_ID explicitly.`);
  }

  const outputs = await Promise.all([
    explain(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT count(*)
       FROM "Booking"
       WHERE "orgId"='${q(orgId)}' AND "status"='${q(status)}'`
    ).then((result) => ({ key: "bookings_count", ...result })),
    explain(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT "id","status","paymentStatus","startAt","createdAt"
       FROM "Booking"
       WHERE "orgId"='${q(orgId)}' AND "status"='${q(status)}'
       ORDER BY "startAt" ASC, "id" ASC
       LIMIT 50 OFFSET 0`
    ).then((result) => ({ key: "bookings_page", ...result })),
    explain(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT "id","status","assignedSitterId","clientId","lastMessageAt"
       FROM "MessageThread"
       WHERE "orgId"='${q(orgId)}' AND "status"='open'
       ORDER BY "lastMessageAt" DESC, "id" DESC
       LIMIT 50`
    ).then((result) => ({ key: "threads_page", ...result })),
    explain(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT "id","direction","createdAt","deliveryStatus"
       FROM "MessageEvent"
       WHERE "orgId"='${q(orgId)}' AND "threadId"='${q(threadSeed.id)}'
       ORDER BY "createdAt" DESC
       LIMIT 50 OFFSET 0`
    ).then((result) => ({ key: "thread_messages_page", ...result })),
  ]);

  const generatedAt = new Date().toISOString();
  const artifactBase = `query-plans-${generatedAt.replaceAll(":", "").replaceAll(".", "")}`;
  await mkdir(artifactsDir, { recursive: true });

  const jsonPath = path.join(artifactsDir, `${artifactBase}.json`);
  const mdPath = path.join(artifactsDir, `${artifactBase}.md`);

  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        generatedAt,
        orgId,
        threadId: threadSeed.id,
        scenarios: outputs,
      },
      null,
      2
    ),
    "utf8"
  );

  const md = [
    `# Query Plan Snapshot`,
    ``,
    `- generatedAt: ${generatedAt}`,
    `- orgId: ${orgId}`,
    `- threadId: ${threadSeed.id}`,
    ``,
    `## Summaries`,
    ...outputs.map(
      (o) =>
        `- ${o.key}: planning=${o.summary.planningTimeMs ?? "n/a"}ms, execution=${o.summary.executionTimeMs ?? "n/a"}ms, cost=${o.summary.totalCost ?? "n/a"}, rows=${o.summary.planRows ?? "n/a"}`
    ),
    ``,
    `Raw JSON: ${jsonPath}`,
  ].join("\n");
  await writeFile(mdPath, md, "utf8");

  console.log(`Wrote query plan artifacts:\n- ${jsonPath}\n- ${mdPath}`);
}

main()
  .catch((error) => {
    console.error("[explain-query-plans] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
