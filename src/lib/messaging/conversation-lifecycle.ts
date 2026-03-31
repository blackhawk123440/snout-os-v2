export type ConversationLaneType = "company" | "service";
export type ConversationActivationStage = "intake" | "staffing" | "meet_and_greet" | "service" | "follow_up";
export type ConversationLifecycleStatus = "active" | "grace" | "expired" | "archived";
export type ConversationAssignedRole = "front_desk" | "sitter" | "owner" | "automation";

export interface ConversationLifecycleInput {
  laneType: string | null | undefined;
  activationStage: string | null | undefined;
  lifecycleStatus: string | null | undefined;
  assignedRole: string | null | undefined;
  assignedSitterId?: string | null;
  serviceWindowStart?: Date | null;
  serviceWindowEnd?: Date | null;
  graceEndsAt?: Date | null;
}

export interface ConversationRoutingDecision {
  laneType: ConversationLaneType;
  activationStage: ConversationActivationStage;
  lifecycleStatus: ConversationLifecycleStatus;
  assignedRole: ConversationAssignedRole;
  recipientRole: "front_desk" | "sitter" | "owner";
  shouldRerouteToCompany: boolean;
  reason: string;
}

const STAGES: ConversationActivationStage[] = [
  "intake",
  "staffing",
  "meet_and_greet",
  "service",
  "follow_up",
];

const preServiceStages = new Set<ConversationActivationStage>(["intake", "staffing", "meet_and_greet"]);

function normalizeStage(value: string | null | undefined): ConversationActivationStage {
  return STAGES.includes(value as ConversationActivationStage)
    ? (value as ConversationActivationStage)
    : "intake";
}

function normalizeLane(value: string | null | undefined): ConversationLaneType {
  return value === "service" ? "service" : "company";
}

function normalizeStatus(value: string | null | undefined): ConversationLifecycleStatus {
  if (value === "grace" || value === "expired" || value === "archived") return value;
  return "active";
}

function normalizeAssignedRole(value: string | null | undefined): ConversationAssignedRole {
  if (value === "sitter" || value === "owner" || value === "automation") return value;
  return "front_desk";
}

export function resolveConversationRouting(
  input: ConversationLifecycleInput,
  now: Date = new Date()
): ConversationRoutingDecision {
  const laneType = normalizeLane(input.laneType);
  const activationStage = normalizeStage(input.activationStage);
  const lifecycleStatus = normalizeStatus(input.lifecycleStatus);
  const assignedRole = normalizeAssignedRole(input.assignedRole);

  if (laneType === "company" || preServiceStages.has(activationStage)) {
    return {
      laneType: "company",
      activationStage,
      lifecycleStatus: lifecycleStatus === "archived" ? "archived" : "active",
      assignedRole: "front_desk",
      recipientRole: "front_desk",
      shouldRerouteToCompany: false,
      reason: "pre_service_company_lane",
    };
  }

  const hasServiceWindow =
    !!input.serviceWindowStart &&
    !!input.serviceWindowEnd &&
    now >= input.serviceWindowStart &&
    now <= input.serviceWindowEnd;

  if (hasServiceWindow && !!input.assignedSitterId) {
    return {
      laneType: "service",
      activationStage: "service",
      lifecycleStatus: "active",
      assignedRole: "sitter",
      recipientRole: "sitter",
      shouldRerouteToCompany: false,
      reason: "active_service_window",
    };
  }

  const inGrace = !!input.graceEndsAt && now <= input.graceEndsAt;
  if (inGrace && !!input.assignedSitterId) {
    return {
      laneType: "service",
      activationStage: "follow_up",
      lifecycleStatus: "grace",
      assignedRole: assignedRole === "owner" ? "owner" : "sitter",
      recipientRole: assignedRole === "owner" ? "owner" : "sitter",
      shouldRerouteToCompany: false,
      reason: "post_service_grace_window",
    };
  }

  return {
    laneType: "company",
    activationStage: "follow_up",
    lifecycleStatus: lifecycleStatus === "archived" ? "archived" : "expired",
    assignedRole: "front_desk",
    recipientRole: "front_desk",
    shouldRerouteToCompany: true,
    reason: "service_lane_expired_reroute",
  };
}

