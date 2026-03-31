/**
 * Manual mock for @/lib/env
 * 
 * This mock is used by vitest when testing modules that use require('@/lib/env')
 */

export const env = {
  TWILIO_WEBHOOK_AUTH_TOKEN: 'test-webhook-token',
  TWILIO_ACCOUNT_SID: 'test-account-sid',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
  TWILIO_PHONE_NUMBER: '+15551234567',
  TWILIO_PROXY_SERVICE_SID: 'KS1234567890',
  ENABLE_MESSAGING_V1: true,
  ENABLE_DEBUG_ENDPOINTS: false,
  NODE_ENV: 'test',
};
