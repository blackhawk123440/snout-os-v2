export type GateName =
  | "bookings_create_1000"
  | "messages_send_2000"
  | "bookings_reads_paginated"
  | "thread_reads"
  | "queue_backlog_drain"
  | "session_validation_burst"
  | "queue_retry_failure_storm";

export interface GateThreshold {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxErrorRate: number;
  maxDuplicateRate?: number;
  minThroughputRps?: number;
  minQueueDrainPerSec?: number;
  maxDeadLetterCount?: number;
  maxRetryCount?: number;
}

export const GATE_THRESHOLDS: Record<GateName, GateThreshold> = {
  bookings_create_1000: {
    p50Ms: 300,
    p95Ms: 1000,
    p99Ms: 2000,
    maxErrorRate: 0.02,
    maxDuplicateRate: 0,
    minThroughputRps: 120,
  },
  messages_send_2000: {
    p50Ms: 180,
    p95Ms: 700,
    p99Ms: 1400,
    maxErrorRate: 0.025,
    minThroughputRps: 300,
  },
  bookings_reads_paginated: {
    p50Ms: 120,
    p95Ms: 450,
    p99Ms: 900,
    maxErrorRate: 0.01,
    minThroughputRps: 400,
  },
  thread_reads: {
    p50Ms: 130,
    p95Ms: 500,
    p99Ms: 950,
    maxErrorRate: 0.01,
    minThroughputRps: 350,
  },
  queue_backlog_drain: {
    p50Ms: 20,
    p95Ms: 100,
    p99Ms: 250,
    maxErrorRate: 0.01,
    minQueueDrainPerSec: 800,
  },
  session_validation_burst: {
    p50Ms: 140,
    p95Ms: 600,
    p99Ms: 1200,
    maxErrorRate: 0.03,
    minThroughputRps: 300,
  },
  queue_retry_failure_storm: {
    p50Ms: 30,
    p95Ms: 180,
    p99Ms: 350,
    maxErrorRate: 0.25,
    minQueueDrainPerSec: 500,
    maxDeadLetterCount: 150,
    maxRetryCount: 4000,
  },
};

