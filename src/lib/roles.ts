/**
 * Canonical role constants. Use these for role checks and normalization.
 * DB may store uppercase (e.g. seed uses "OWNER"); request-context normalizes to lowercase.
 */
export const ROLE_OWNER = 'owner' as const;
export const ROLE_ADMIN = 'admin' as const;
export const ROLE_SITTER = 'sitter' as const;
export const ROLE_CLIENT = 'client' as const;
export const ROLE_PUBLIC = 'public' as const;

export const ROLES = [ROLE_OWNER, ROLE_ADMIN, ROLE_SITTER, ROLE_CLIENT, ROLE_PUBLIC] as const;
export type CanonicalRole = (typeof ROLES)[number];

/** Normalize any role string to canonical lowercase. */
export function normalizeRole(role: unknown): CanonicalRole {
  const value = String(role || '').toLowerCase();
  if (value === ROLE_OWNER || value === ROLE_ADMIN || value === ROLE_SITTER || value === ROLE_CLIENT) {
    return value;
  }
  return ROLE_PUBLIC;
}
