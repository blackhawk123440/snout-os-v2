import { createHash } from 'crypto';

export const RESET_TOKEN_EXPIRY_MINUTES = 30;

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
