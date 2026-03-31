/**
 * Twilio Messaging Provider
 * 
 * Implementation of MessagingProvider for Twilio SMS.
 * 
 * NOTE: Requires twilio package to be installed:
 *   npm install twilio
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
import type { ProviderCredentials } from '../provider-credentials';
import { getTwilioClientFromCredentials } from '../provider-credentials';

// Twilio SDK is optional - type only imported when available
let twilioClient: any = null;

// Lazy load Twilio SDK
/**
 * Get Twilio client for an organization
 * 
 * Resolves credentials from database (encrypted) with env fallback.
 * 
 * @param orgId - Organization ID (optional, uses default if not provided)
 * @returns Twilio client instance
 */
async function getTwilioClient(orgId?: string): Promise<any> {
  // Use cached client if available and orgId matches
  if (twilioClient && !orgId) {
    return twilioClient;
  }

  try {
    // Resolve credentials from DB or env
    const { getProviderCredentials } = require('@/lib/messaging/provider-credentials');
    const { getOrgIdFromContext } = require('@/lib/messaging/org-helpers');
    
    const resolvedOrgId = orgId || await getOrgIdFromContext();
    const credentials = await getProviderCredentials(resolvedOrgId);
    
    if (!credentials) {
      throw new Error('Twilio credentials not configured. Please connect provider in /setup.');
    }
    
    const { accountSid, apiKeySid, apiKeySecret } = credentials;
    const useApiKey = !!(apiKeySid && apiKeySecret);
    const hasAuth = useApiKey || !!credentials.authToken;

    if (!accountSid || !hasAuth) {
      throw new Error('Twilio credentials not set: need Account SID and either Auth Token or API Key (apiKeySid + apiKeySecret)');
    }

    // Allow AC (account), TEST_, or SK (API Key SID) for account resolution
    if (accountSid.startsWith('TEST_') || accountSid.startsWith('AC') || (useApiKey && apiKeySid!.startsWith('SK'))) {
      const client = getTwilioClientFromCredentials(credentials);
      if (!orgId) {
        twilioClient = client;
      }
      return client;
    }
    throw new Error('TWILIO_ACCOUNT_SID must start with AC or TEST_');
  } catch (error) {
    throw new Error(`Twilio SDK not available: ${error instanceof Error ? error.message : String(error)}. Install with: npm install twilio`);
  }
}

async function getTwilioClientWithCredentials(credentials: ProviderCredentials): Promise<any> {
  try {
    const { accountSid, apiKeySid, apiKeySecret, authToken } = credentials;
    const useApiKey = !!(apiKeySid && apiKeySecret);
    const hasAuth = useApiKey || !!authToken;
    if (!accountSid || !hasAuth) {
      throw new Error('Twilio credentials not set: need Account SID and either Auth Token or API Key');
    }
    return getTwilioClientFromCredentials(credentials);
  } catch (error) {
    throw new Error(`Twilio SDK not available: ${error instanceof Error ? error.message : String(error)}. Install with: npm install twilio`);
  }
}

export class TwilioProvider implements MessagingProvider {
  private webhookAuthToken: string;
  private orgId?: string;
  private credentials?: ProviderCredentials;

  constructor(webhookAuthToken?: string, orgId?: string, credentials?: ProviderCredentials) {
    // Use provided token or fall back to env var
    this.webhookAuthToken = webhookAuthToken || process.env.TWILIO_WEBHOOK_AUTH_TOKEN || '';
    this.orgId = orgId;
    this.credentials = credentials;
  }

  verifyWebhook(rawBody: string, signature: string, webhookUrl: string): boolean {
    if (!this.webhookAuthToken) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[TwilioProvider] TWILIO_WEBHOOK_AUTH_TOKEN not configured in production — rejecting webhook');
        return false;
      }
      console.warn('[TwilioProvider] TWILIO_WEBHOOK_AUTH_TOKEN not configured, skipping webhook verification (dev only)');
      return true;
    }

    if (!signature) {
      console.warn('[TwilioProvider] No signature provided in request headers');
      return false;
    }

    try {
      // eslint-disable-next-line no-restricted-syntax -- dynamic require for optional twilio
      const twilio = require('twilio');

      // Parse rawBody into params object for validateRequest
      const params: Record<string, string> = {};
      if (rawBody) {
        const searchParams = new URLSearchParams(rawBody);
        searchParams.forEach((value, key) => {
          params[key] = value;
        });
      }

      return twilio.validateRequest(
        this.webhookAuthToken,
        signature,
        webhookUrl,
        params
      );
    } catch (error) {
      console.error('[TwilioProvider] Webhook verification error:', error);
      return false;
    }
  }

  parseInbound(payload: any): InboundMessage {
    // Twilio webhook format:
    // From: "From" (E.164)
    // To: "To" (E.164)
    // Body: "Body"
    // MessageSid: "MessageSid"
    // NumMedia: number (count of media)
    // MediaUrl0, MediaUrl1, ... (media URLs)

    const from = payload.From || payload.from || '';
    const to = payload.To || payload.to || '';
    const body = payload.Body || payload.body || '';
    const messageSid = payload.MessageSid || payload.messageSid || '';
    
    // Parse media URLs if present
    const mediaUrls: string[] = [];
    const numMedia = parseInt(payload.NumMedia || payload.numMedia || '0', 10);
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = payload[`MediaUrl${i}`] || payload[`mediaUrl${i}`];
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
      }
    }

    return {
      from,
      to,
      body,
      messageSid,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      timestamp: new Date(),
    };
  }

  parseStatusCallback(payload: any): StatusCallback {
    // Twilio status callback format:
    // MessageSid: "MessageSid"
    // MessageStatus: "queued" | "sent" | "delivered" | "failed" | "undelivered"
    // ErrorCode: optional error code
    // ErrorMessage: optional error message

    const messageSid = payload.MessageSid || payload.messageSid || '';
    const statusStr = payload.MessageStatus || payload.messageStatus || '';
    
    // Map Twilio statuses to our normalized statuses
    const statusMap: Record<string, StatusCallback['status']> = {
      'queued': 'queued',
      'sent': 'sent',
      'delivered': 'delivered',
      'failed': 'failed',
      'undelivered': 'failed', // Map undelivered to failed
    };

    const status = statusMap[statusStr] || 'failed';

    return {
      messageSid,
      status,
      errorCode: payload.ErrorCode || payload.errorCode,
      errorMessage: payload.ErrorMessage || payload.errorMessage,
    };
  }

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    try {
      const client = this.credentials ? await getTwilioClientWithCredentials(this.credentials) : await getTwilioClient(this.orgId);
      
      // Determine from number - use explicit E164 if provided, otherwise fallback
      // CRITICAL: Use the actual E164 from the chosen masked number, not env vars
      let fromNumber: string;
      
      if (options.fromNumberSid) {
        // If number SID provided, we need to look up the E164
        // For now, prefer explicit from E164 if provided
        fromNumber = (options as any).fromE164 || options.fromNumberSid;
      } else if ((options as any).fromE164) {
        // Explicit E164 provided (from chooseFromNumber)
        fromNumber = (options as any).fromE164;
      } else {
        // Fallback to env vars (for backward compatibility)
        // eslint-disable-next-line no-restricted-syntax -- dynamic require for optional twilio
        const { env } = require('@/lib/env');
        fromNumber = env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_PHONE_NUMBER || '';
      }
      
      if (!fromNumber) {
        return {
          success: false,
          errorCode: 'NO_FROM_NUMBER',
          errorMessage: 'From number (E164 or SID) must be provided',
        };
      }

      // Log send attempt
      console.log('[TwilioProvider.sendMessage]', {
        orgId: this.orgId,
        to: options.to,
        from: fromNumber,
        bodyLength: options.body?.length || 0,
        timestamp: new Date().toISOString(),
      });

      // Send message via Twilio API (REAL API CALL)
      const message = await client.messages.create({
        body: options.body,
        from: fromNumber, // Use actual E164 or number SID
        to: options.to,
        // Status callback for delivery tracking
        statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL
          || (process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL.replace(/\/$/, '')}/api/messages/webhook/twilio` : undefined)
          || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/messages/webhook/twilio` : undefined),
      });

      // Log success
      console.log('[TwilioProvider.sendMessage] SUCCESS', {
        orgId: this.orgId,
        messageSid: message.sid,
        to: options.to,
        from: fromNumber,
        status: message.status,
      });

      return {
        success: true,
        messageSid: message.sid,
      };
    } catch (error: any) {
      console.error('[TwilioProvider.sendMessage] ERROR', {
        orgId: this.orgId,
        to: options.to,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error,
      });
      
      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message || String(error),
      };
    }
  }

  async createSession(options: CreateSessionOptions): Promise<CreateSessionResult> {
    try {
      // eslint-disable-next-line no-restricted-syntax -- dynamic require for optional twilio
      const { env } = require('@/lib/env');
      const client = await getTwilioClient(this.orgId);

      // For Twilio, we use Proxy API for masking
      // Create a Proxy Service Session
      const proxyServiceSid = env.TWILIO_PROXY_SERVICE_SID;
      
      if (!proxyServiceSid) {
        // Fallback: Use phone number directly (no masking yet)
        // In production, Proxy Service should be configured
        return {
          success: true,
          sessionSid: `session-${Date.now()}`, // Placeholder session ID
          maskedNumberE164: env.TWILIO_PHONE_NUMBER || undefined,
        };
      }

      // Create Proxy Session
      const session = await client.proxy.v1
        .services(proxyServiceSid)
        .sessions.create({
          uniqueName: `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });

      // Use the proxy service's phone number as the masked number
      const maskedNumber = env.TWILIO_PHONE_NUMBER || options.maskedNumberE164;

      return {
        success: true,
        sessionSid: session.sid,
        maskedNumberE164: maskedNumber,
      };
    } catch (error: any) {
      console.error('[TwilioProvider] Create session error:', error);
      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message || String(error),
      };
    }
  }

  async createParticipant(options: CreateParticipantOptions): Promise<CreateParticipantResult> {
    try {
      // eslint-disable-next-line no-restricted-syntax -- dynamic require for optional twilio
      const { env } = require('@/lib/env');
      const client = await getTwilioClient(this.orgId);
      const proxyServiceSid = env.TWILIO_PROXY_SERVICE_SID;

      if (!proxyServiceSid) {
        return {
          success: false,
          errorCode: 'NO_PROXY_SERVICE',
          errorMessage: 'TWILIO_PROXY_SERVICE_SID must be configured for masking',
        };
      }

      // Create participant in Proxy session
      const participant = await client.proxy.v1
        .services(proxyServiceSid)
        .sessions(options.sessionSid)
        .participants.create({
          identifier: options.identifier,
          friendlyName: options.friendlyName,
        });

      // Get proxy identifier (the masked number for this participant)
      // Twilio Proxy assigns a proxyIdentifier to each participant
      // Note: proxyIdentifier may not be available immediately, use phone number as fallback
      const proxyIdentifier = (participant as any).proxyIdentifier || env.TWILIO_PHONE_NUMBER;

      return {
        success: true,
        participantSid: participant.sid,
        proxyIdentifier,
      };
    } catch (error: any) {
      console.error('[TwilioProvider] Create participant error:', error);
      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message || String(error),
      };
    }
  }

  async sendViaProxy(options: SendViaProxyOptions): Promise<SendViaProxyResult> {
    try {
      // eslint-disable-next-line no-restricted-syntax -- dynamic require for optional twilio
      const { env } = require('@/lib/env');
      const client = await getTwilioClient(this.orgId);
      const proxyServiceSid = env.TWILIO_PROXY_SERVICE_SID;

      if (!proxyServiceSid) {
        return {
          success: false,
          errorCode: 'NO_PROXY_SERVICE',
          errorMessage: 'TWILIO_PROXY_SERVICE_SID must be configured for masking',
        };
      }

      // Create Message Interaction in Proxy session
      // This routes the message through Proxy, maintaining masking
      const interaction = await client.proxy.v1
        .services(proxyServiceSid)
        .sessions(options.sessionSid)
        .participants(options.fromParticipantSid)
        .messageInteractions.create({
          body: options.body,
        });

      return {
        success: true,
        interactionSid: interaction.sid,
      };
    } catch (error: any) {
      console.error('[TwilioProvider] Send via proxy error:', error);
      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message || String(error),
      };
    }
  }

  async updateSessionParticipants(options: UpdateSessionParticipantsOptions): Promise<{ success: boolean; error?: string }> {
    try {
      // eslint-disable-next-line no-restricted-syntax -- dynamic require for optional twilio
      const { env } = require('@/lib/env');
      const client = await getTwilioClient(this.orgId);
      const proxyServiceSid = env.TWILIO_PROXY_SERVICE_SID;

      if (!proxyServiceSid) {
        // No proxy service - session updates not supported
        // Return success for now (phone number routing without masking)
        console.warn('[TwilioProvider] No proxy service configured, skipping participant update');
        return { success: true };
      }

      // Get current participants in session
      const session = client.proxy.v1.services(proxyServiceSid).sessions(options.sessionSid);
      const participants = await session.participants.list();

      // Remove all sitter participants (keep client)
      for (const participant of participants) {
        if (participant.sid !== options.clientParticipantSid) {
          await participant.remove();
        }
      }

      // Add new sitter participants
      for (const sitterParticipantSid of options.sitterParticipantSids) {
        // Note: sitterParticipantSid should be a phone number for Twilio Proxy
        // In a real implementation, you'd need to map participant SIDs to phone numbers
        await session.participants.create({
          identifier: sitterParticipantSid, // Assuming this is E.164 format
          friendlyName: 'Sitter',
        });
      }

      return { success: true };
    } catch (error: any) {
      console.error('[TwilioProvider] Update session participants error:', error);
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }
}
