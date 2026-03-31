/**
 * Messaging Provider Abstraction
 * 
 * Provider-agnostic interface for messaging operations.
 * All providers must implement this interface.
 */

export interface InboundMessage {
  from: string; // E.164 format phone number
  to: string; // E.164 format phone number
  body: string;
  messageSid: string; // Provider's message identifier
  mediaUrls?: string[]; // Optional media attachments
  timestamp: Date;
}

export interface StatusCallback {
  messageSid: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  errorMessage?: string;
}

export interface SendMessageOptions {
  to: string; // E.164 format
  body: string;
  mediaUrls?: string[];
  fromNumberSid?: string; // Optional: specific number SID to send from
  fromE164?: string; // Optional: explicit E164 to send from (takes precedence)
}

export interface SendMessageResult {
  success: boolean;
  messageSid?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface CreateSessionOptions {
  clientE164: string; // Client's real phone number
  maskedNumberE164?: string; // Optional: specific masked number to use
}

export interface CreateSessionResult {
  success: boolean;
  sessionSid?: string;
  maskedNumberE164?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface UpdateSessionParticipantsOptions {
  sessionSid: string;
  clientParticipantSid: string; // Client participant (preserved)
  sitterParticipantSids: string[]; // Sitter participants (replaced)
}

export interface CreateParticipantOptions {
  sessionSid: string;
  identifier: string; // Real phone number (E.164)
  friendlyName: string;
}

export interface CreateParticipantResult {
  success: boolean;
  participantSid?: string;
  proxyIdentifier?: string; // The masked number for this participant
  errorCode?: string;
  errorMessage?: string;
}

export interface SendViaProxyOptions {
  sessionSid: string;
  fromParticipantSid: string; // Participant sending the message
  body: string;
  mediaUrls?: string[];
}

export interface SendViaProxyResult {
  success: boolean;
  interactionSid?: string; // Message Interaction SID
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Provider adapter interface
 * All messaging providers must implement this interface
 */
export interface MessagingProvider {
  /**
   * Verify webhook signature
   * @param rawBody - Raw request body as string
   * @param signature - Signature from request headers
   * @param webhookUrl - Full webhook URL (for signature validation)
   * @returns true if signature is valid
   */
  verifyWebhook(rawBody: string, signature: string, webhookUrl: string): boolean;

  /**
   * Parse inbound webhook payload into normalized InboundMessage
   * @param payload - Raw webhook payload (parsed JSON or FormData)
   * @returns Normalized inbound message
   */
  parseInbound(payload: any): InboundMessage;

  /**
   * Parse status callback payload into normalized StatusCallback
   * @param payload - Raw status callback payload (parsed JSON or FormData)
   * @returns Normalized status callback
   */
  parseStatusCallback(payload: any): StatusCallback;

  /**
   * Send a message via the provider
   * @param options - Send message options
   * @returns Result with messageSid on success
   */
  sendMessage(options: SendMessageOptions): Promise<SendMessageResult>;

  /**
   * Create a masking session for client communication
   * @param options - Session creation options
   * @returns Session identifier and masked number
   */
  createSession(options: CreateSessionOptions): Promise<CreateSessionResult>;

  /**
   * Create a participant in a Proxy session
   * @param options - Participant creation options
   * @returns Participant identifier and proxy identifier (masked number)
   */
  createParticipant(options: CreateParticipantOptions): Promise<CreateParticipantResult>;

  /**
   * Send a message via Proxy using Message Interaction
   * @param options - Proxy send options
   * @returns Message Interaction SID on success
   */
  sendViaProxy(options: SendViaProxyOptions): Promise<SendViaProxyResult>;

  /**
   * Update session participants (for masking/routing)
   * @param options - Update options with session and participant identifiers
   * @returns Success status
   */
  updateSessionParticipants(options: UpdateSessionParticipantsOptions): Promise<{ success: boolean; error?: string }>;
}
