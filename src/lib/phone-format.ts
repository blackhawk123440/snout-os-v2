/**
 * Unified phone number formatting utilities
 * Use this for all phone number formatting needs
 */

/**
 * Format phone number for API use (E.164 format: +12345678901)
 * Use this when sending SMS or storing in database
 */
export function formatPhoneForAPI(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If empty after cleaning, return empty string
  if (digits.length === 0) return "";
  
  // Add +1 if it's a 10-digit US number
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Add + if it's an 11-digit number starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If already has +, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // For other formats, return cleaned digits with +
  return `+${digits}`;
}

/**
 * Format phone number for display (human-readable format: (123) 456-7890)
 * Use this when displaying phone numbers in the UI
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If empty after cleaning, return empty string
  if (cleaned.length === 0) return "";
  
  // Format 10-digit US number as (123) 456-7890
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Format 11-digit number (with country code) as (123) 456-7890
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // For other formats, return as-is
  return phone;
}

/**
 * Validate phone number format
 * Returns true if phone number is valid (10 or 11 digits)
 */
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return false;
  
  const digits = phone.replace(/\D/g, '');
  
  // Valid if 10 digits (US) or 11 digits starting with 1 (US with country code)
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

/**
 * Clean phone number (remove all non-digits)
 */
export function cleanPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, '');
}


