/**
 * SSE (Server-Sent Events) helper for streaming updates.
 */

const HEARTBEAT_INTERVAL_MS = 25000;

export interface SSEOptions {
  /** Optional initial data to send immediately */
  initial?: unknown;
  /** Custom heartbeat interval (default 25s) */
  heartbeatIntervalMs?: number;
  /** Called when stream starts with controller for sending events. Return cleanup fn (or Promise of one). */
  onConnect?: (
    controller: ReadableStreamDefaultController<Uint8Array>
  ) => void | (() => void) | Promise<() => void>;
}

/**
 * Create an SSE Response with proper headers and heartbeat.
 * Pass onConnect to receive the controller when a client connects; return a cleanup fn to run on disconnect.
 */
export function createSSEResponse(options: SSEOptions = {}): Response {
  const heartbeatMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
  let heartbeatId: ReturnType<typeof setInterval> | null = null;
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      if (options.initial != null) {
        ctrl.enqueue(encodeSSE({ data: JSON.stringify(options.initial) }));
      }
      heartbeatId = setInterval(() => {
        try {
          ctrl.enqueue(encodeSSE({ comment: 'heartbeat' }));
        } catch {
          heartbeatId && clearInterval(heartbeatId);
        }
      }, heartbeatMs);
      const result = await options.onConnect?.(ctrl);
      cleanup = typeof result === 'function' ? result : undefined;
    },
    cancel() {
      heartbeatId && clearInterval(heartbeatId);
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Encode a value as SSE format.
 */
export function encodeSSE(msg: { data?: string; event?: string; comment?: string }): Uint8Array {
  let out = '';
  if (msg.event) out += `event: ${msg.event}\n`;
  if (msg.data) out += `data: ${msg.data}\n`;
  if (msg.comment) out += `: ${msg.comment}\n`;
  out += '\n';
  return new TextEncoder().encode(out);
}

/**
 * Send an SSE event to the controller.
 */
export function sendSSEEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  payload: unknown,
  eventType = 'message'
): void {
  controller.enqueue(
    encodeSSE({
      event: eventType,
      data: JSON.stringify(payload),
    })
  );
}
