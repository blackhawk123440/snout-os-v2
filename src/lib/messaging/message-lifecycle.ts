export type MessageLifecycleStatus =
  | "accepted"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "expired"
  | "blocked"
  | "rerouted"
  | "received";

export function mapTwilioStatusToLifecycle(status: string): MessageLifecycleStatus {
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case "accepted":
      return "accepted";
    case "queued":
    case "sending":
      return "queued";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "failed":
    case "undelivered":
    case "canceled":
      return "failed";
    default:
      return "failed";
  }
}

