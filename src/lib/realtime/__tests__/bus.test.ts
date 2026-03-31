/**
 * Unit tests for realtime bus - in-memory publish/subscribe.
 */

import { describe, it, expect } from 'vitest';

// Force in-memory mode before importing bus
process.env.REDIS_URL = '';

import { publish, subscribe, channels } from '../bus';

describe('realtime bus', () => {
  it('publish and subscribe deliver payload in-memory', async () => {
    const received: unknown[] = [];
    const unsub = await subscribe('test-channel', (p) => received.push(p));

    await publish('test-channel', { type: 'test', id: 1 });
    await publish('test-channel', { type: 'test', id: 2 });

    expect(received).toHaveLength(2);
    expect(received[0]).toEqual({ type: 'test', id: 1 });
    expect(received[1]).toEqual({ type: 'test', id: 2 });

    unsub();
  });

  it('unsubscribe stops receiving', async () => {
    const received: unknown[] = [];
    const unsub = await subscribe('test-chan-2', (p) => received.push(p));

    await publish('test-chan-2', { x: 1 });
    unsub();
    await publish('test-chan-2', { x: 2 });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ x: 1 });
  });

  it('channel helpers return expected format', () => {
    expect(channels.messagesThread('org-1', 'thread-1')).toBe('org:org-1:messages:thread:thread-1');
    expect(channels.sitterToday('org-1', 'sitter-1')).toBe('org:org-1:sitter:sitter-1:today');
    expect(channels.opsFailures('org-1')).toBe('org:org-1:ops:failures');
  });
});
