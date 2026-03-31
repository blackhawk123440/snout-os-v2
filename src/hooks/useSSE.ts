'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Subscribe to an SSE stream. Closes on unmount or when enabled becomes false.
 * @param url - SSE endpoint URL (null to disable)
 * @param onMessage - Called when an event arrives
 * @param enabled - Whether to connect (e.g. when page is visible)
 */
export function useSSE(
  url: string | null,
  onMessage: (data: unknown) => void,
  enabled = true
): { connected: boolean; error: boolean } {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!url || !enabled) {
      setConnected(false);
      setError(false);
      return;
    }

    let es: EventSource | null = null;
    setError(false);

    try {
      es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        setError(true);
      };

      es.addEventListener('update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data || '{}');
          onMessageRef.current(data);
        } catch {
          // ignore parse errors
        }
      });

      // Also handle default 'message' event for compatibility
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data || '{}');
          onMessageRef.current(data);
        } catch {
          // ignore
        }
      };
    } catch (err) {
      setError(true);
    }

    return () => {
      if (es) {
        es.close();
        eventSourceRef.current = null;
      }
      setConnected(false);
    };
  }, [url, enabled]);

  return { connected, error };
}
