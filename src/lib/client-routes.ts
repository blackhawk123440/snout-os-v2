/**
 * Client Routes
 * Defines which routes are accessible to authenticated clients.
 */

export function isClientRoute(pathname: string): boolean {
  if (pathname === '/client' || pathname.startsWith('/client/')) return true;
  return false;
}
