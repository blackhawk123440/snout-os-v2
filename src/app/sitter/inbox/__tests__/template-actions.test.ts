import { describe, expect, it, vi } from 'vitest';
import { triggerTemplateSend } from '@/app/sitter/inbox/template-actions';

describe('triggerTemplateSend', () => {
  it('sends immediately when online', async () => {
    const enqueueAction = vi.fn().mockResolvedValue('id-1');
    const sendNow = vi.fn().mockResolvedValue(undefined);
    const onQueued = vi.fn();
    const onSuccess = vi.fn();

    const ok = await triggerTemplateSend({
      template: 'On my way',
      selectedThreadId: 't1',
      isWindowActive: true,
      isOnline: true,
      orgId: 'org-1',
      sitterId: 's1',
      enqueueAction,
      sendNow,
      onQueued,
      onSuccess,
    });

    expect(ok).toBe(true);
    expect(sendNow).toHaveBeenCalledWith('t1', 'On my way');
    expect(enqueueAction).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('queues message when offline', async () => {
    const enqueueAction = vi.fn().mockResolvedValue('id-2');
    const sendNow = vi.fn().mockResolvedValue(undefined);
    const onQueued = vi.fn();
    const onSuccess = vi.fn();

    const ok = await triggerTemplateSend({
      template: 'Arrived',
      selectedThreadId: 't2',
      isWindowActive: true,
      isOnline: false,
      orgId: 'org-1',
      sitterId: 's1',
      enqueueAction,
      sendNow,
      onQueued,
      onSuccess,
    });

    expect(ok).toBe(true);
    expect(enqueueAction).toHaveBeenCalledWith('message.send', {
      orgId: 'org-1',
      sitterId: 's1',
      payload: { threadId: 't2', body: 'Arrived' },
    });
    expect(sendNow).not.toHaveBeenCalled();
    expect(onQueued).toHaveBeenCalled();
  });
});
