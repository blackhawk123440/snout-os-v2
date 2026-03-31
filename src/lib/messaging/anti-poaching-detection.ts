/**
 * Anti-Poaching Detection Engine
 * 
 * Phase 3.1: Content Scanning
 * 
 * Detects and categorizes:
 * - Phone numbers
 * - Emails
 * - URLs
 * - Social handles and poaching phrases
 */

export interface AntiPoachingDetection {
  detected: boolean;
  reasons: string[];
  violations: Array<{
    type: 'phone_number' | 'email' | 'url' | 'social_media';
    content: string;
    reason: string;
  }>;
}

/**
 * Detect anti-poaching violations in message content
 * 
 * @param content - Message body text to scan
 * @returns Detection result with boolean flag and reasons
 */
export function detectAntiPoachingViolations(content: string): AntiPoachingDetection {
  const violations: AntiPoachingDetection['violations'] = [];
  const reasons: string[] = [];

  // Normalize content for scanning (case-insensitive)
  const normalizedContent = content.toLowerCase().trim();

  // 1. Detect phone numbers
  // Common patterns: (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890, 1234567890
  const phonePatterns = [
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // US format
    /\b\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b/g, // (123) 456-7890
    /\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g, // International +1 234 567 8900
    /\b\d{10,15}\b/g, // Raw digits (10-15 digits)
  ];

  const phoneMatches = new Set<string>();
  for (const pattern of phonePatterns) {
    const matches = normalizedContent.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Filter out dates, times, and other non-phone patterns
        const digitsOnly = match.replace(/\D/g, '');
        if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
          // Don't match common non-phone patterns
          if (!/^(19|20)\d{2}$/.test(digitsOnly) && // Not a year
              !/^\d{1,2}\d{2}$/.test(digitsOnly)) { // Not a time
            phoneMatches.add(match.trim());
          }
        }
      });
    }
  }

  phoneMatches.forEach(match => {
    violations.push({
      type: 'phone_number',
      content: match,
      reason: 'Phone number detected',
    });
    reasons.push(`Phone number: ${match}`);
  });

  // 2. Detect email addresses
  // Standard email pattern: user@domain.com
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emailMatches = normalizedContent.match(emailPattern);
  if (emailMatches) {
    emailMatches.forEach(match => {
      violations.push({
        type: 'email',
        content: match,
        reason: 'Email address detected',
      });
      reasons.push(`Email: ${match}`);
    });
  }

  // 3. Detect URLs
  // HTTP/HTTPS URLs, www., common TLDs
  const urlPatterns = [
    /\bhttps?:\/\/[^\s]+\b/g, // http:// or https://
    /\bwww\.[^\s]+\.[a-z]{2,}\b/g, // www.domain.com
    /\b[a-z0-9-]+\.[a-z]{2,}\/[^\s]*\b/g, // domain.com/path
  ];

  const urlMatches = new Set<string>();
  for (const pattern of urlPatterns) {
    const matches = normalizedContent.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Filter out common false positives
        if (!match.includes('@') && // Not an email
            !match.match(/^\d+\.\d+\.\d+\.\d+$/)) { // Not an IP address
          urlMatches.add(match.trim());
        }
      });
    }
  }

  urlMatches.forEach(match => {
    violations.push({
      type: 'url',
      content: match,
      reason: 'URL detected',
    });
    reasons.push(`URL: ${match}`);
  });

  // 4. Detect social handles and poaching phrases
  const socialKeywords = [
    'instagram', 'ig ', 'insta', '@instagram', '@insta',
    'snapchat', 'snap', '@snapchat',
    'whatsapp', 'whats app', 'what\'s app',
    'telegram', '@telegram',
    'facebook', 'fb', '@facebook',
    'twitter', '@twitter', 'x.com',
    'tiktok', '@tiktok',
    'dm me', 'd m me', 'direct message',
    'text me', 'txt me', 'call me',
    'contact me', 'reach out', 'hit me up',
    'my number', 'my phone', 'my email',
    'personal', 'private message', 'pm me',
  ];

  const socialMatches = new Set<string>();
  for (const keyword of socialKeywords) {
    // Use word boundaries to avoid false matches
    const keywordPattern = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    const matches = normalizedContent.match(keywordPattern);
    if (matches) {
      matches.forEach(match => {
        socialMatches.add(match.trim());
      });
    }
  }

  socialMatches.forEach(match => {
    violations.push({
      type: 'social_media',
      content: match,
      reason: 'Social media handle or poaching phrase detected',
    });
    reasons.push(`Social media/phrase: ${match}`);
  });

  return {
    detected: violations.length > 0,
    reasons,
    violations,
  };
}

/**
 * Redact detected content for owner notification
 * Partially masks sensitive information while preserving context
 * 
 * @param content - Original content
 * @param violations - Detected violations
 * @returns Redacted content string
 */
export function redactViolationsForOwner(
  content: string,
  violations: AntiPoachingDetection['violations']
): string {
  let redacted = content;

  // Redact phone numbers (show last 4 digits)
  violations
    .filter(v => v.type === 'phone_number')
    .forEach(violation => {
      const original = violation.content;
      const digits = original.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      const redactedPhone = `***-***-${last4}`;
      redacted = redacted.replace(new RegExp(escapeRegex(original), 'gi'), redactedPhone);
    });

  // Redact emails (show domain only)
  violations
    .filter(v => v.type === 'email')
    .forEach(violation => {
      const original = violation.content;
      const [user, domain] = original.split('@');
      const redactedEmail = `***@${domain}`;
      redacted = redacted.replace(new RegExp(escapeRegex(original), 'gi'), redactedEmail);
    });

  // Redact URLs (show domain only)
  violations
    .filter(v => v.type === 'url')
    .forEach(violation => {
      const original = violation.content;
      try {
        const url = new URL(original.startsWith('http') ? original : `https://${original}`);
        const redactedUrl = `***${url.hostname}`;
        redacted = redacted.replace(new RegExp(escapeRegex(original), 'gi'), redactedUrl);
      } catch {
        // Invalid URL, replace with generic
        redacted = redacted.replace(new RegExp(escapeRegex(original), 'gi'), '***[URL]');
      }
    });

  // Redact social handles/phrases (replace with [REDACTED])
  violations
    .filter(v => v.type === 'social_media')
    .forEach(violation => {
      const original = violation.content;
      redacted = redacted.replace(new RegExp(escapeRegex(original), 'gi'), '[REDACTED]');
    });

  return redacted;
}

/**
 * Generate friendly warning message for sender
 * 
 * @param violationTypes - Array of violation types detected
 * @returns Warning message text
 */
export function generateAntiPoachingWarning(
  violationTypes: Array<'phone_number' | 'email' | 'url' | 'social_media'>
): string {
  const types = new Set(violationTypes);

  let message = "Hi! For your safety and ours, we can't share personal contact information through this messaging system. ";

  if (types.has('phone_number')) {
    message += "Please don't include phone numbers. ";
  }
  if (types.has('email')) {
    message += "Please don't include email addresses. ";
  }
  if (types.has('url')) {
    message += "Please don't include external links. ";
  }
  if (types.has('social_media')) {
    message += "Please don't request contact outside our platform. ";
  }

  message += "If you need help, please contact our team directly through this number. Thank you!";

  return message;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
