import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { createClientContact, findClientContactByPhone } from "@/lib/messaging/client-contact-lookup";
import { normalizeE164 } from "@/lib/messaging/phone-utils";
import { resolveConversationRouting } from "@/lib/messaging/conversation-lifecycle";
import { logMessagingTimelineEvent } from "@/lib/messaging/timeline-events";

const DEFAULT_SERVICE_GRACE_HOURS = Number(process.env.SERVICE_LANE_GRACE_HOURS || "72");
const DEFAULT_POOL_LOW_WATERMARK = Number(process.env.MESSAGE_POOL_LOW_WATERMARK || "3");
const REQUIRE_BOTH_APPROVALS = process.env.SERVICE_LANE_REQUIRE_BOTH_APPROVALS !== "false";
export const SERVICE_LANE_APPROVAL_POLICY = REQUIRE_BOTH_APPROVALS ? "both_required" : "either_side";

async function ensureClientForPhone(params: {
  orgId: string;
  phone: string;
  fallbackFirstName?: string | null;
  fallbackLastName?: string | null;
}): Promise<string> {
  const normalizedPhone = normalizeE164(params.phone);
  if (!normalizedPhone) {
    throw new Error("Cannot create company lane without a valid phone number");
  }

  const existingContact = await findClientContactByPhone(params.orgId, normalizedPhone).catch(() => null);
  if (existingContact?.clientId) return existingContact.clientId;

  const existingClient = await prisma.client.findFirst({
    where: { orgId: params.orgId, phone: normalizedPhone },
    select: { id: true },
  });
  if (existingClient?.id) {
    await createClientContact({
      id: randomUUID(),
      orgId: params.orgId,
      clientId: existingClient.id,
      e164: normalizedPhone,
      label: "Mobile",
      verified: false,
    }).catch(() => {});
    return existingClient.id;
  }

  const created = await prisma.client.create({
    data: {
      orgId: params.orgId,
      firstName: (params.fallbackFirstName || "Guest").trim(),
      lastName: (params.fallbackLastName || normalizedPhone).trim(),
      phone: normalizedPhone,
    },
    select: { id: true },
  });
  await createClientContact({
    id: randomUUID(),
    orgId: params.orgId,
    clientId: created.id,
    e164: normalizedPhone,
    label: "Mobile",
    verified: false,
  }).catch(() => {});
  return created.id;
}

export async function ensureCompanyLaneConversationForBookingIntake(params: {
  orgId: string;
  bookingId: string;
  clientId?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<{ threadId: string; reused: boolean }> {
  let clientId = params.clientId ?? null;
  if (!clientId && params.phone) {
    clientId = await ensureClientForPhone({
      orgId: params.orgId,
      phone: params.phone,
      fallbackFirstName: params.firstName,
      fallbackLastName: params.lastName,
    });
  }
  if (!clientId) throw new Error("Booking intake requires clientId or phone");

  const existing = await prisma.messageThread.findFirst({
    where: {
      orgId: params.orgId,
      clientId,
      laneType: "company",
      status: { notIn: ["closed", "archived"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (existing) {
    await prisma.messageThread.update({
      where: { id: existing.id },
      data: {
        bookingId: params.bookingId,
        activationStage: "intake",
        lifecycleStatus: "active",
        assignedRole: "front_desk",
      },
    });
    await logMessagingTimelineEvent({
      orgId: params.orgId,
      threadId: existing.id,
      bookingId: params.bookingId,
      eventType: "messaging.company_lane.ensured",
      metadata: { reused: true },
    }).catch(() => {});
    return { threadId: existing.id, reused: true };
  }

  const frontDeskNumber = await prisma.messageNumber.findFirst({
    where: { orgId: params.orgId, status: "active", numberClass: "front_desk" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, e164: true },
  });
  if (!frontDeskNumber) {
    throw new Error("Front desk number not configured for company lane intake");
  }

  const created = await prisma.messageThread.create({
    data: {
      orgId: params.orgId,
      clientId,
      bookingId: params.bookingId,
      scope: "client_general",
      threadType: "front_desk",
      status: "open",
      laneType: "company",
      activationStage: "intake",
      lifecycleStatus: "active",
      assignedRole: "front_desk",
      numberClass: "front_desk",
      messageNumberId: frontDeskNumber.id,
      maskedNumberE164: frontDeskNumber.e164,
    },
    select: { id: true },
  });
  await logMessagingTimelineEvent({
    orgId: params.orgId,
    threadId: created.id,
    bookingId: params.bookingId,
    eventType: "messaging.company_lane.ensured",
    metadata: { reused: false },
  }).catch(() => {});
  return { threadId: created.id, reused: false };
}

export async function createSitterAvailabilityRequest(params: {
  orgId: string;
  threadId: string;
  sitterId: string;
  bookingId?: string | null;
  requestedByUserId?: string | null;
  requestMessageEventId?: string | null;
}): Promise<{ id: string }> {
  const request = await prisma.sitterAvailabilityRequest.create({
    data: {
      orgId: params.orgId,
      threadId: params.threadId,
      sitterId: params.sitterId,
      bookingId: params.bookingId ?? null,
      requestedByUserId: params.requestedByUserId ?? null,
      requestMessageEventId: params.requestMessageEventId ?? null,
      status: "pending",
    },
    select: { id: true },
  });
  await logMessagingTimelineEvent({
    orgId: params.orgId,
    threadId: params.threadId,
    bookingId: params.bookingId ?? null,
    eventType: "messaging.availability.requested",
    metadata: {
      availabilityRequestId: request.id,
      sitterId: params.sitterId,
    },
  }).catch(() => {});
  return request;
}

export async function captureAvailabilityResponseFromMessage(params: {
  orgId: string;
  threadId: string;
  sitterId: string;
  body: string;
  responseMessageEventId: string;
}): Promise<boolean> {
  const normalized = params.body.trim().toLowerCase();
  const status = normalized === "yes" ? "yes" : normalized === "no" ? "no" : null;
  if (!status) return false;

  const pending = await prisma.sitterAvailabilityRequest.findFirst({
    where: {
      orgId: params.orgId,
      threadId: params.threadId,
      sitterId: params.sitterId,
      status: "pending",
    },
    orderBy: { requestedAt: "desc" },
    select: { id: true, requestedAt: true },
  });
  if (!pending) return false;

  const respondedAt = new Date();
  const latencySec = Math.max(0, Math.floor((respondedAt.getTime() - pending.requestedAt.getTime()) / 1000));
  await prisma.sitterAvailabilityRequest.update({
    where: { id: pending.id },
    data: {
      status,
      respondedAt,
      responseText: params.body.trim(),
      responseLatencySec: latencySec,
      responseMessageEventId: params.responseMessageEventId,
    },
  });
  await logMessagingTimelineEvent({
    orgId: params.orgId,
    threadId: params.threadId,
    eventType: "messaging.availability.responded",
    metadata: {
      availabilityRequestId: pending.id,
      sitterId: params.sitterId,
      status,
      responseLatencySec: latencySec,
    },
  }).catch(() => {});
  return true;
}

async function assignServiceNumberFromPool(params: {
  orgId: string;
  threadId: string;
}): Promise<{ id: string; e164: string | null; numberClass: string }> {
  const current = await prisma.messageNumber.findFirst({
    where: {
      orgId: params.orgId,
      assignedThreadId: params.threadId,
      status: "active",
    },
    select: { id: true, e164: true, numberClass: true },
  });
  if (current) return current;

  const number = await prisma.messageNumber.findFirst({
    where: {
      orgId: params.orgId,
      status: "active",
      numberClass: { in: ["pool", "sitter"] },
      OR: [{ poolType: "service" }, { poolType: "company" }],
      assignedThreadId: null,
    },
    orderBy: [{ lastAssignedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, e164: true, numberClass: true },
  });
  if (!number) throw new Error("No service lane number available in pool");

  await prisma.messageNumber.update({
    where: { id: number.id },
    data: {
      assignedThreadId: params.threadId,
      assignedAt: new Date(),
      releasedAt: null,
      poolType: "service",
      lastAssignedAt: new Date(),
    },
  });
  return number;
}

async function releaseAssignedNumbersForThread(params: {
  orgId: string;
  threadId: string;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  await prisma.messageNumber.updateMany({
    where: {
      orgId: params.orgId,
      assignedThreadId: params.threadId,
    },
    data: {
      assignedThreadId: null,
      releasedAt: now,
      poolType: "company",
    },
  });
}

export function shouldActivateServiceLaneFromApprovals(params: {
  clientApprovedAt: Date | null;
  sitterApprovedAt: Date | null;
  assignedSitterId: string | null;
  serviceWindowStart: Date | null;
  serviceWindowEnd: Date | null;
}): boolean {
  const approvalsReady = REQUIRE_BOTH_APPROVALS
    ? Boolean(params.clientApprovedAt && params.sitterApprovedAt)
    : Boolean(params.clientApprovedAt || params.sitterApprovedAt);
  return Boolean(
    approvalsReady &&
      params.assignedSitterId &&
      params.serviceWindowStart &&
      params.serviceWindowEnd
  );
}

export async function activateServiceLaneForApprovedConversation(params: {
  orgId: string;
  threadId: string;
  assignedSitterId: string;
  serviceWindowStart: Date;
  serviceWindowEnd: Date;
  graceHours?: number;
}): Promise<void> {
  const graceHours = Math.max(1, params.graceHours ?? DEFAULT_SERVICE_GRACE_HOURS);
  const graceEndsAt = new Date(params.serviceWindowEnd.getTime() + graceHours * 60 * 60 * 1000);
  const thread = await prisma.messageThread.findUnique({
    where: { id: params.threadId },
    select: { bookingId: true },
  });
  const selected = await assignServiceNumberFromPool({
    orgId: params.orgId,
    threadId: params.threadId,
  });

  await prisma.messageThread.update({
    where: { id: params.threadId },
    data: {
      assignedSitterId: params.assignedSitterId,
      laneType: "service",
      activationStage: "service",
      lifecycleStatus: "active",
      assignedRole: "sitter",
      serviceApprovedAt: new Date(),
      serviceWindowStart: params.serviceWindowStart,
      serviceWindowEnd: params.serviceWindowEnd,
      graceEndsAt,
      messageNumberId: selected.id,
      numberClass: selected.numberClass,
      maskedNumberE164: selected.e164,
    },
  });
  await logMessagingTimelineEvent({
    orgId: params.orgId,
    threadId: params.threadId,
    bookingId: thread?.bookingId ?? null,
    eventType: "messaging.service_lane.activated",
    metadata: {
      assignedSitterId: params.assignedSitterId,
      serviceWindowStart: params.serviceWindowStart.toISOString(),
      serviceWindowEnd: params.serviceWindowEnd.toISOString(),
      graceEndsAt: graceEndsAt.toISOString(),
    },
  }).catch(() => {});
}

export async function syncConversationLifecycleWithBookingWorkflow(params: {
  orgId: string;
  bookingId: string;
  clientId?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  sitterId?: string | null;
  bookingStatus?: string | null;
  serviceWindowStart?: Date | null;
  serviceWindowEnd?: Date | null;
  meetAndGreetScheduledAt?: Date | null;
  meetAndGreetConfirmedAt?: Date | null;
  clientApprovedAt?: Date | null;
  sitterApprovedAt?: Date | null;
}): Promise<{ threadId: string }> {
  const ensured = await ensureCompanyLaneConversationForBookingIntake({
    orgId: params.orgId,
    bookingId: params.bookingId,
    clientId: params.clientId,
    phone: params.phone,
    firstName: params.firstName,
    lastName: params.lastName,
  });
  const thread = await prisma.messageThread.findUnique({
    where: { id: ensured.threadId },
    select: {
      id: true,
      assignedSitterId: true,
      laneType: true,
      clientApprovedAt: true,
      sitterApprovedAt: true,
      serviceWindowStart: true,
      serviceWindowEnd: true,
      meetAndGreetConfirmedAt: true,
    },
  });
  if (!thread) return { threadId: ensured.threadId };

  const nextSitterId = params.sitterId === undefined ? thread.assignedSitterId : params.sitterId;
  const sitterSwapped =
    params.sitterId !== undefined &&
    thread.assignedSitterId &&
    params.sitterId &&
    params.sitterId !== thread.assignedSitterId;

  if (sitterSwapped) {
    await releaseAssignedNumbersForThread({ orgId: params.orgId, threadId: thread.id });
    await logMessagingTimelineEvent({
      orgId: params.orgId,
      threadId: thread.id,
      bookingId: params.bookingId,
      eventType: "messaging.sitter.reassigned",
      metadata: {
        previousSitterId: thread.assignedSitterId,
        nextSitterId,
      },
    }).catch(() => {});
  }

  const lifecycleData: Record<string, unknown> = {
    bookingId: params.bookingId,
  };
  if (params.sitterId !== undefined) lifecycleData.assignedSitterId = params.sitterId;
  if (params.serviceWindowStart !== undefined) lifecycleData.serviceWindowStart = params.serviceWindowStart;
  if (params.serviceWindowEnd !== undefined) lifecycleData.serviceWindowEnd = params.serviceWindowEnd;
  if (params.meetAndGreetConfirmedAt !== undefined) {
    lifecycleData.meetAndGreetConfirmedAt = params.meetAndGreetConfirmedAt;
  }
  if (params.clientApprovedAt !== undefined) lifecycleData.clientApprovedAt = params.clientApprovedAt;
  if (params.sitterApprovedAt !== undefined) lifecycleData.sitterApprovedAt = params.sitterApprovedAt;

  if (sitterSwapped) {
    lifecycleData.laneType = "company";
    lifecycleData.activationStage = "staffing";
    lifecycleData.lifecycleStatus = "active";
    lifecycleData.assignedRole = "front_desk";
    lifecycleData.serviceApprovedAt = null;
    lifecycleData.clientApprovedAt = null;
    lifecycleData.sitterApprovedAt = null;
    lifecycleData.graceEndsAt = null;
    lifecycleData.messageNumberId = null;
    lifecycleData.numberClass = "front_desk";
  }

  if (params.bookingStatus === "cancelled") {
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: {
        ...lifecycleData,
        laneType: "company",
        activationStage: "follow_up",
        lifecycleStatus: "archived",
        assignedRole: "front_desk",
        serviceApprovedAt: null,
      },
    });
    await releaseAssignedNumbersForThread({ orgId: params.orgId, threadId: thread.id });
    return { threadId: thread.id };
  }

  const clientApprovedAt =
    params.clientApprovedAt === undefined ? thread.clientApprovedAt : params.clientApprovedAt;
  const sitterApprovedAt =
    params.sitterApprovedAt === undefined ? thread.sitterApprovedAt : params.sitterApprovedAt;
  const serviceWindowStart =
    params.serviceWindowStart === undefined ? thread.serviceWindowStart : params.serviceWindowStart;
  const serviceWindowEnd =
    params.serviceWindowEnd === undefined ? thread.serviceWindowEnd : params.serviceWindowEnd;
  const shouldActivateServiceLane = shouldActivateServiceLaneFromApprovals({
    clientApprovedAt,
    sitterApprovedAt,
    assignedSitterId: nextSitterId,
    serviceWindowStart,
    serviceWindowEnd,
  });

  if (params.meetAndGreetScheduledAt || params.meetAndGreetConfirmedAt || thread.meetAndGreetConfirmedAt) {
    lifecycleData.activationStage = "meet_and_greet";
  } else if (nextSitterId) {
    lifecycleData.activationStage = "staffing";
  } else {
    lifecycleData.activationStage = "intake";
  }
  lifecycleData.lifecycleStatus = "active";
  lifecycleData.assignedRole = shouldActivateServiceLane ? "sitter" : "front_desk";

  await prisma.messageThread.update({
    where: { id: thread.id },
    data: lifecycleData,
  });

  if (
    shouldActivateServiceLane &&
    nextSitterId &&
    serviceWindowStart &&
    serviceWindowEnd &&
    (thread.laneType !== "service" || sitterSwapped)
  ) {
    await activateServiceLaneForApprovedConversation({
      orgId: params.orgId,
      threadId: thread.id,
      assignedSitterId: nextSitterId,
      serviceWindowStart,
      serviceWindowEnd,
    });
  }

  if (params.bookingStatus === "in_progress") {
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: {
        activationStage: "service",
        lifecycleStatus: "active",
        assignedRole: "sitter",
        laneType: "service",
      },
    });
  }

  if (params.bookingStatus === "completed") {
    const referenceEnd = serviceWindowEnd ?? params.serviceWindowEnd ?? new Date();
    const graceEndsAt = new Date(referenceEnd.getTime() + DEFAULT_SERVICE_GRACE_HOURS * 60 * 60 * 1000);
    await prisma.messageThread.update({
      where: { id: thread.id },
      data: {
        activationStage: "follow_up",
        lifecycleStatus: "grace",
        assignedRole: "front_desk",
        graceEndsAt,
      },
    });
    await logMessagingTimelineEvent({
      orgId: params.orgId,
      threadId: thread.id,
      bookingId: params.bookingId,
      eventType: "messaging.grace.started",
      metadata: {
        graceEndsAt: graceEndsAt.toISOString(),
      },
    }).catch(() => {});
  }

  return { threadId: thread.id };
}

export async function reconcileConversationLifecycleForThread(params: {
  orgId: string;
  threadId: string;
  now?: Date;
}): Promise<{ rerouted: boolean; laneType: string; reason: string }> {
  const now = params.now ?? new Date();
  const thread = await prisma.messageThread.findUnique({
    where: { id: params.threadId },
    select: {
      id: true,
      bookingId: true,
      laneType: true,
      activationStage: true,
      lifecycleStatus: true,
      assignedRole: true,
      assignedSitterId: true,
      serviceWindowStart: true,
      serviceWindowEnd: true,
      graceEndsAt: true,
      orgId: true,
    },
  });
  if (!thread) {
    return { rerouted: false, laneType: "company", reason: "thread_not_found" };
  }

  const routing = resolveConversationRouting(thread, now);
  if (!routing.shouldRerouteToCompany) {
    return { rerouted: false, laneType: routing.laneType, reason: routing.reason };
  }

  await prisma.messageThread.update({
    where: { id: thread.id },
    data: {
      laneType: "company",
      activationStage: "follow_up",
      lifecycleStatus: "expired",
      assignedRole: "front_desk",
    }
  });

  await releaseAssignedNumbersForThread({ orgId: params.orgId, threadId: thread.id, now });

  await prisma.messageConversationFlag.create({
    data: {
      orgId: params.orgId,
      threadId: thread.id,
      type: "policy",
      severity: "low",
      metadataJson: JSON.stringify({
        reason: "service_lane_expired_reroute",
      }),
    },
  });
  await logMessagingTimelineEvent({
    orgId: params.orgId,
    threadId: thread.id,
    bookingId: thread.bookingId ?? null,
    eventType: "messaging.lane.rerouted",
    metadata: {
      reason: routing.reason,
    },
  }).catch(() => {});

  return { rerouted: true, laneType: "company", reason: routing.reason };
}

export async function getNumberPoolHealth(orgId: string): Promise<{
  availableCompany: number;
  availableService: number;
  assigned: number;
  exhausted: boolean;
  shouldProvision: boolean;
}> {
  const [availableCompany, availableService, assigned] = await Promise.all([
    prisma.messageNumber.count({
      where: { orgId, status: "active", poolType: "company", assignedThreadId: null },
    }),
    prisma.messageNumber.count({
      where: { orgId, status: "active", poolType: "service", assignedThreadId: null },
    }),
    prisma.messageNumber.count({
      where: { orgId, status: "active", assignedThreadId: { not: null } },
    }),
  ]);
  const availableTotal = availableCompany + availableService;
  const exhausted = availableTotal === 0;
  const shouldProvision = availableTotal < DEFAULT_POOL_LOW_WATERMARK;
  return {
    availableCompany,
    availableService,
    assigned,
    exhausted,
    shouldProvision,
  };
}

