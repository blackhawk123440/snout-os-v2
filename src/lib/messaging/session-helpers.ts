/**
 * Session Helpers — DEAD SCAFFOLDING
 *
 * WARNING: This module is NOT used by any production code path.
 * `ensureThreadSession` is never called from webhook handlers or API routes.
 * The Thread model does not have `providerSessionSid` or `maskedNumberE164` fields,
 * and ThreadParticipant does not have `providerParticipantSid`.
 * Session persistence writes at lines 104-110 are empty no-ops.
 *
 * If Twilio Proxy masking is needed in the future, the schema must be extended first.
 */

import { prisma } from "@/lib/db";
import { MessagingProvider, CreateSessionOptions, CreateParticipantResult } from "./provider";

export interface EnsureParticipantResult {
  participantSid: string;
  proxyIdentifier: string; // The masked number for this participant
}

/**
 * Ensure thread has a provider session and client participant
 * 
 * If thread already has providerSessionSid, returns it.
 * Otherwise, creates a new session and persists it.
 * Also ensures client participant exists in the session.
 * 
 * @param threadId - Thread ID
 * @param provider - Provider adapter
 * @param clientE164 - Client's real phone number
 * @returns Session SID and client participant info
 */
export async function ensureThreadSession(
  threadId: string,
  provider: MessagingProvider,
  clientE164: string
): Promise<{ sessionSid: string; clientParticipant: EnsureParticipantResult }> {
  // Get thread with current session and participants
  // Note: Thread model doesn't have providerSessionSid or maskedNumberE164 fields
  // These would need to be stored elsewhere or this functionality moved to API
  const thread = await (prisma as any).thread.findUnique({
    where: { id: threadId },
    include: {
      participants: {
        where: {
          participantType: 'client', // ThreadParticipant uses participantType, not role
        },
        take: 1,
      },
    },
  });

  if (!thread) {
    throw new Error(`Thread ${threadId} not found`);
  }

  let sessionSid: string;
  let maskedNumberE164: string | null = null;

  // Note: Thread model doesn't have providerSessionSid or maskedNumberE164
  // Session management should be handled by the API service
  // For now, always create a new session
  const sessionResult = await provider.createSession({
    clientE164,
    maskedNumberE164: thread.messageNumber?.e164 || undefined,
  });

  if (!sessionResult.success || !sessionResult.sessionSid) {
    throw new Error(
      `Failed to create provider session: ${sessionResult.errorMessage || 'Unknown error'}`
    );
  }

  sessionSid = sessionResult.sessionSid;
  maskedNumberE164 = sessionResult.maskedNumberE164 || null;

  // Ensure client participant exists in Proxy session
  const clientParticipantRecord = thread.participants[0];
  let clientParticipantSid: string;
  let proxyIdentifier: string;

  if (clientParticipantRecord?.providerParticipantSid) {
    // Participant already exists in Proxy
    clientParticipantSid = clientParticipantRecord.providerParticipantSid;
    // Get proxy identifier from participant (we'll need to fetch it or store it)
    // For now, use masked number as proxy identifier
    proxyIdentifier = maskedNumberE164 || clientE164;
  } else {
    // Create client participant in Proxy session
    const participantResult = await provider.createParticipant({
      sessionSid,
      identifier: clientE164,
      friendlyName: 'Client',
    });

    if (!participantResult.success || !participantResult.participantSid) {
      throw new Error(
        `Failed to create client participant: ${participantResult.errorMessage || 'Unknown error'}`
      );
    }

    clientParticipantSid = participantResult.participantSid;
    proxyIdentifier = participantResult.proxyIdentifier || maskedNumberE164 || clientE164;

    // Update ThreadParticipant with providerParticipantSid
    // Note: ThreadParticipant model uses participantType, not role
    if (clientParticipantRecord) {
      await (prisma as any).threadParticipant.update({
        where: { id: clientParticipantRecord.id },
        data: {
          // Note: ThreadParticipant doesn't have providerParticipantSid field
          // This should be stored elsewhere or handled by API
        },
      });
    } else {
      // Create participant record if it doesn't exist
      await (prisma as any).threadParticipant.create({
        data: {
          threadId: thread.id,
          participantType: 'client', // ThreadParticipant uses participantType
          participantId: thread.clientId, // Use clientId as participantId
        },
      });
    }
  }

  return {
    sessionSid,
    clientParticipant: {
      participantSid: clientParticipantSid,
      proxyIdentifier,
    },
  };
}
