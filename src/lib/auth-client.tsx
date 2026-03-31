/**
 * Client-side Auth Hook
 * 
 * Provides useAuth hook for client components using NextAuth session
 */

'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'owner' | 'sitter' | 'client';
  orgId?: string | null;
  sitterId?: string | null;
  clientId?: string | null;
}

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  isOwner: boolean;
  isSitter: boolean;
  isClient: boolean;
}

export function useAuth(): UseAuthReturn {
  const { data: session, status } = useSession();

  const user = useMemo<User | null>(() => {
    if (!session?.user) {
      return null;
    }

    const sessionUser = session.user as any;
    const hasSitterId = !!sessionUser.sitterId;
    const hasClientId = !!sessionUser.clientId;
    const sessionRole = sessionUser.role as string | undefined;
    const normalizedRole =
      sessionRole === 'client'
        ? 'client'
        : sessionRole === 'sitter'
          ? 'sitter'
          : sessionRole === 'owner'
            ? 'owner'
            : hasClientId
              ? 'client'
              : hasSitterId
                ? 'sitter'
                : 'owner';
    
    return {
      id: sessionUser.id || '',
      email: sessionUser.email || '',
      name: sessionUser.name || null,
      role: normalizedRole,
      orgId: sessionUser.orgId || null,
      sitterId: sessionUser.sitterId || null,
      clientId: sessionUser.clientId || null,
    };
  }, [session]);

  const loading = status === 'loading';
  const isOwner = user?.role === 'owner' || false;
  const isSitter = user?.role === 'sitter' || false;
  const isClient = user?.role === 'client' || false;

  return {
    user,
    loading,
    isOwner,
    isSitter,
    isClient,
  };
}
