export type PortalRole = 'owner' | 'sitter' | 'client';

type SessionLikeUser = {
  role?: string | null;
  sitterId?: string | null;
  clientId?: string | null;
};

export function normalizePortalRole(role: string | null | undefined): PortalRole | null {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'client') return 'client';
  if (normalized === 'sitter') return 'sitter';
  if (normalized === 'owner' || normalized === 'admin' || normalized === 'superadmin') return 'owner';
  return null;
}

export function getPortalRole(user: SessionLikeUser | null | undefined): PortalRole | null {
  if (!user) return null;
  const normalizedRole = normalizePortalRole(user.role);
  if (normalizedRole) return normalizedRole;
  if (user.clientId) return 'client';
  if (user.sitterId) return 'sitter';
  return 'owner';
}
