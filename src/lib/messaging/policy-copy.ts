export type MessagingPolicyRule = {
  key: string;
  scenario: string;
  userFacingBehavior: string;
  systemRule: string;
};

export const CLIENT_EXPIRED_SERVICE_LANE_REPLY =
  "Thanks for your message. Your visit window has ended, so our care team will continue from this same thread. If you'd like another visit, reply REBOOK and we will help right away.";

export const OWNER_LIFECYCLE_HELPERS = {
  companyLane:
    "Company lane keeps the conversation with your office team so the client always feels they are texting one professional business.",
  serviceLane:
    "Service lane is active only for confirmed visit work. It returns to company lane after service and grace.",
  approvals:
    "Service lane activates when required approvals are complete and a sitter + service window are set.",
  reroute:
    "When a service line expires, inbound client texts are rerouted to your office automatically.",
} as const;

export const SITTER_BOUNDARY_HELPER =
  "You can message clients during active service windows. Outside that window, office support takes over so boundaries stay clear and professional.";

export const MESSAGING_POLICY_RULES: MessagingPolicyRule[] = [
  {
    key: "lane_expiry",
    scenario: "Lane expiry",
    userFacingBehavior:
      "Client keeps texting the same thread and receives a natural handoff to office support.",
    systemRule:
      "After grace ends, inbound texts reroute to company lane; service numbers are released.",
  },
  {
    key: "rebook_same_sitter",
    scenario: "Rebooking with same sitter",
    userFacingBehavior:
      "Client experience remains continuous; no visible lane jargon or number switching language.",
    systemRule:
      "Conversation stays in company lane until approvals + service window confirm activation.",
  },
  {
    key: "rebook_different_sitter",
    scenario: "Rebooking with different sitter",
    userFacingBehavior:
      "Client stays in one thread with office-led coordination for reassignment.",
    systemRule:
      "Sitter swap resets to company/staffing state and clears prior service-lane assignment metadata.",
  },
  {
    key: "sitter_reassignment",
    scenario: "Sitter reassignment mid-flow",
    userFacingBehavior:
      "Office takes control cleanly while reassignment is finalized.",
    systemRule:
      "Service mapping is released and lifecycle returns to company lane until re-activation criteria are met.",
  },
  {
    key: "expired_lane_inbound",
    scenario: "Client texts expired service lane",
    userFacingBehavior:
      "Client gets immediate office acknowledgement with rebooking path.",
    systemRule:
      "Inbound event is marked rerouted and a one-time automation reply is sent from company context.",
  },
  {
    key: "meet_greet_partial_approval",
    scenario: "Meet-and-greet confirmed, one approval pending",
    userFacingBehavior:
      "Conversation remains coordinated by office; no premature sitter lane behavior.",
    systemRule:
      "Thread remains company/meet_and_greet until deterministic approval policy is satisfied.",
  },
];
