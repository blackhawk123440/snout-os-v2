export type QuickTemplate = 'On my way' | 'Arrived' | 'All done';

interface TriggerTemplateSendParams {
  template: QuickTemplate;
  selectedThreadId: string | null;
  isWindowActive: boolean;
  isOnline: boolean;
  orgId: string;
  sitterId: string;
  enqueueAction: (type: string, params: { orgId: string; sitterId: string; payload: unknown }) => Promise<string>;
  sendNow: (threadId: string, body: string) => Promise<void>;
  onQueued: () => void;
  onSuccess: () => void;
}

export async function triggerTemplateSend(params: TriggerTemplateSendParams): Promise<boolean> {
  if (!params.selectedThreadId || !params.isWindowActive) return false;
  const body = params.template;
  if (!params.isOnline) {
    await params.enqueueAction('message.send', {
      orgId: params.orgId,
      sitterId: params.sitterId,
      payload: { threadId: params.selectedThreadId, body },
    });
    params.onQueued();
    return true;
  }
  await params.sendNow(params.selectedThreadId, body);
  params.onSuccess();
  return true;
}
