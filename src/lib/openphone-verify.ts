/**
 * OpenPhone webhook signature verification
 * Ensures webhooks are authentic and from OpenPhone
 */

import crypto from "node:crypto";

/**
 * Verify OpenPhone webhook signature
 * @param rawBody - Raw request body as string
 * @param signature - Signature from x-openphone-signature header
 * @param secret - Webhook secret from environment
 * @returns true if signature is valid
 */
export function verifyOpenPhoneSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!secret) {
    console.error("[verifyOpenPhoneSignature] No webhook secret configured");
    return false;
  }

  if (!signature) {
    console.error("[verifyOpenPhoneSignature] No signature provided");
    return false;
  }

  try {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(rawBody);
    const digest = `sha256=${hmac.digest("hex")}`;
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature)
    );
  } catch (error) {
    console.error("[verifyOpenPhoneSignature] Signature verification failed:", error);
    return false;
  }
}

/**
 * Verify OpenPhone webhook signature using environment variable
 */
export function verifyOpenPhoneSignatureFromEnv(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.OPENPHONE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[verifyOpenPhoneSignatureFromEnv] OPENPHONE_WEBHOOK_SECRET not set");
    return false;
  }
  return verifyOpenPhoneSignature(rawBody, signature, secret);
}


