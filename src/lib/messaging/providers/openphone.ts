/**
 * OpenPhone Messaging Provider
 *
 * Implementation of MessagingProvider for OpenPhone SMS.
 * OpenPhone does not support Proxy/masking — sitters use real numbers.
 */

import type {
  MessagingProvider,
  InboundMessage,
  StatusCallback,
  SendMessageOptions,
  SendMessageResult,
  CreateSessionOptions,
  CreateSessionResult,
  CreateParticipantOptions,
  CreateParticipantResult,
  SendViaProxyOptions,
  SendViaProxyResult,
  UpdateSessionParticipantsOptions,
} from '../provider';
import { verifyOpenPhoneSignature } from '@/lib/openphone-verify';

export class OpenPhoneProvider implements MessagingProvider {
  constructor(
    private apiKey: string,
    private defaultPhoneNumberId: string,
    private webhookSecret?: string,
  ) {}

  verifyWebhook(rawBody: string, signature: string, _webhookUrl: string): boolean {
    const secret = this.webhookSecret || process.env.OPENPHONE_WEBHOOK_SECRET;
    if (!secret) return false;
    return verifyOpenPhoneSignature(rawBody, signature, secret);
  }

  parseInbound(payload: any): InboundMessage {
    const data = payload.data || payload;
    return {
      from: data.from?.phoneNumber || '',
      to: data.to?.[0]?.phoneNumber || '',
      body: data.body || data.content || '',
      messageSid: data.id || '',
      mediaUrls: Array.isArray(data.media) ? data.media.map((m: any) => m.url).filter(Boolean) : undefined,
      timestamp: data.createdAt ? new Date(data.createdAt) : new Date(),
    };
  }

  parseStatusCallback(payload: any): StatusCallback {
    const data = payload.data || payload;
    const statusMap: Record<string, StatusCallback['status']> = {
      delivered: 'delivered',
      failed: 'failed',
      sent: 'sent',
      queued: 'queued',
    };
    return {
      messageSid: data.id || '',
      status: statusMap[data.status] || 'queued',
      errorCode: data.errorCode || undefined,
      errorMessage: data.errorMessage || undefined,
    };
  }

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    if (!this.apiKey) {
      return { success: false, errorMessage: 'OpenPhone API key not configured' };
    }

    try {
      const response = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // OpenPhone 'from' must be an OpenPhone phoneNumberId (PNxxx), never an E.164.
          // Always use the configured defaultPhoneNumberId; ignore thread-level fromE164
          // which may be a Twilio number from the MessageNumber table.
          from: this.defaultPhoneNumberId,
          to: [options.to],
          content: options.body,
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        let errorMessage = `OpenPhone API error: ${response.status}`;
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {}
        return { success: false, errorCode: String(response.status), errorMessage };
      }

      const result = JSON.parse(text);
      return { success: true, messageSid: result.data?.id || result.id };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown OpenPhone error',
      };
    }
  }

  async createSession(_options: CreateSessionOptions): Promise<CreateSessionResult> {
    throw new Error('OpenPhone does not support number masking. Use direct messaging with sitter real numbers.');
  }

  async createParticipant(_options: CreateParticipantOptions): Promise<CreateParticipantResult> {
    throw new Error('OpenPhone does not support number masking. Use direct messaging with sitter real numbers.');
  }

  async sendViaProxy(_options: SendViaProxyOptions): Promise<SendViaProxyResult> {
    throw new Error('OpenPhone does not support number masking. Use direct messaging with sitter real numbers.');
  }

  async updateSessionParticipants(_options: UpdateSessionParticipantsOptions): Promise<{ success: boolean; error?: string }> {
    throw new Error('OpenPhone does not support number masking. Use direct messaging with sitter real numbers.');
  }
}

export function createOpenPhoneProvider(config: {
  apiKey: string;
  phoneNumberId: string;
  webhookSecret?: string;
}): OpenPhoneProvider {
  return new OpenPhoneProvider(config.apiKey, config.phoneNumberId, config.webhookSecret);
}
