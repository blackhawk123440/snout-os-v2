'use client';

import dynamic from 'next/dynamic';

const ClientAtAGlanceSidebar = dynamic(
  () => import('./ClientAtAGlanceSidebar').then((m) => ({ default: m.ClientAtAGlanceSidebar })),
  {
    loading: () => (
      <aside className="w-full space-y-3 lg:w-72 lg:shrink-0 lg:space-y-3">
        <div className="h-16 animate-pulse rounded-xl bg-surface-tertiary lg:rounded-lg" />
        <div className="h-16 animate-pulse rounded-xl bg-surface-tertiary lg:rounded-lg" />
        <div className="h-16 animate-pulse rounded-xl bg-surface-tertiary lg:rounded-lg" />
      </aside>
    ),
    ssr: false,
  }
);

export function ClientAtAGlanceSidebarLazy() {
  return <ClientAtAGlanceSidebar />;
}
