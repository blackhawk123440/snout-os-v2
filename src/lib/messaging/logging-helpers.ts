/**
 * Logging Helpers
 * 
 * Phase 1.5: Logging Hygiene
 * 
 * Provides utilities for safe logging with PII redaction.
 */

/**
 * Redact or partially mask phone number in logs
 * 
 * Shows last 4 digits only: +1555****3456
 */
export function redactPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) {
    return '[REDACTED]';
  }

  // Remove any non-digit characters except +
  const digits = phoneNumber.replace(/[^\d+]/g, '');
  
  if (digits.length < 4) {
    return '[REDACTED]';
  }

  // Show country code and last 4 digits: +1555****3456
  const countryCode = digits.startsWith('+') ? digits.substring(0, 4) : digits.substring(0, 1);
  const last4 = digits.slice(-4);
  const masked = '*'.repeat(Math.max(4, digits.length - 8)); // Mask middle digits

  return `${countryCode}${masked}${last4}`;
}

/**
 * Create structured log entry for webhook events
 * 
 * Includes orgId, messageNumberId, threadId, numberClass, routing decision
 * with redacted phone numbers
 */
export interface WebhookLogContext {
  orgId: string;
  messageNumberId?: string | null;
  threadId?: string | null;
  numberClass?: string | null;
  routingDecision?: string;
  senderE164?: string | null;
  recipientE164?: string | null;
}

export function createWebhookLogEntry(
  event: string,
  context: WebhookLogContext
): string {
  const parts = [
    `[webhook/twilio] ${event}`,
    `orgId=${context.orgId}`,
  ];

  if (context.messageNumberId) {
    parts.push(`messageNumberId=${context.messageNumberId}`);
  }

  if (context.threadId) {
    parts.push(`threadId=${context.threadId}`);
  }

  if (context.numberClass) {
    parts.push(`numberClass=${context.numberClass}`);
  }

  if (context.routingDecision) {
    parts.push(`routing=${context.routingDecision}`);
  }

  if (context.senderE164) {
    parts.push(`sender=${redactPhoneNumber(context.senderE164)}`);
  }

  if (context.recipientE164) {
    parts.push(`recipient=${redactPhoneNumber(context.recipientE164)}`);
  }

  return parts.join(' ');
}

/**
 * Redact phone numbers from any string (for logging)
 * 
 * Replaces E.164 phone numbers with redacted versions
 */
export function redactPhoneNumbersInString(text: string): string {
  // Match E.164 format: + followed by 1-15 digits
  const phoneRegex = /\+1\d{10}|\+\d{1,14}\d/g;
  return text.replace(phoneRegex, (match) => redactPhoneNumber(match));
}

/**
 * Safe console.log wrapper that redacts phone numbers
 * 
 * Use this for any log that might contain phone numbers
 */
export function safeLog(level: 'log' | 'error' | 'warn', ...args: any[]): void {
  const redactedArgs = args.map((arg) => {
    if (typeof arg === 'string') {
      return redactPhoneNumbersInString(arg);
    }
    if (typeof arg === 'object' && arg !== null) {
      // Recursively redact phone numbers in object values
      const redacted: any = Array.isArray(arg) ? [] : {};
      for (const key in arg) {
        const value = arg[key];
        if (typeof value === 'string') {
          redacted[key] = redactPhoneNumbersInString(value);
        } else if (typeof value === 'object' && value !== null) {
          redacted[key] = safeLog('log', value); // Recursive, but we'll just stringify
          // Actually, let's just stringify and redact
          redacted[key] = JSON.parse(redactPhoneNumbersInString(JSON.stringify(value)));
        } else {
          redacted[key] = value;
        }
      }
      return redacted;
    }
    return arg;
  });
  
  console[level](...redactedArgs);
}
