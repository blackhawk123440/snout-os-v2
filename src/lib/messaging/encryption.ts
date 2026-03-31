/**
 * Encryption utilities for sensitive data (provider credentials)
 * 
 * Uses AES-GCM encryption with ENCRYPTION_KEY from environment.
 * Falls back to a dev key if not set (only in development).
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    if (process.env.NODE_ENV === 'development') {
      // Dev fallback - warn but allow
      console.warn('⚠️  ENCRYPTION_KEY not set, using dev key. DO NOT USE IN PRODUCTION.');
      // Use a deterministic dev key (32 bytes for AES-256)
      return crypto.scryptSync('dev-encryption-key-change-in-production', 'salt', 32);
    }
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // Key must be 32 bytes for AES-256
  // If provided as hex string, decode it; otherwise use scrypt to derive 32 bytes
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    // Hex-encoded 32-byte key
    return Buffer.from(key, 'hex');
  }
  
  // Derive 32-byte key from provided string
  return crypto.scryptSync(key, 'salt', 32);
}

/**
 * Encrypt sensitive data (e.g., provider credentials)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return: iv:authTag:encrypted (all hex-encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
