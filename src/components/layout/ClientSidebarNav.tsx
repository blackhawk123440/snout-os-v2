'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CLIENT_NAV_GROUPS } from '@/lib/client-nav';
import { cn } from '@/components/ui/utils';
import { Icon } from '@/components/ui/Icon';
import { useQuery } from '@tanstack/react-query';
import { useBranding } from '@/lib/api/client-hooks';

function useDeployInfo() {
  return useQuery({
    queryKey: ['deploy-info'],
    queryFn: async () => {
      const r = await fetch('/api/health');
      const data = await r.json().catch(() => ({}));
      const sha = data.commitSha ?? data.version;
      const envName = data.envName ?? 'staging';
      const buildTime = data.buildTime ?? null;
      return {
        envName: String(envName),
        commitSha: sha && sha !== 'unknown' ? String(sha).slice(0, 7) : '',
        buildTime: buildTime ? String(buildTime) : null,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function ClientSidebarNav() {
  const pathname = usePathname();
  const { data: deployInfo } = useDeployInfo();
  const { data: branding } = useBranding();

  const isActive = (href: string) => {
    if (href === '/client/home') return pathname === '/client/home' || pathname === '/client';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="hidden shrink-0 border-r border-border-default bg-surface-primary lg:flex lg:w-60 lg:flex-col min-[1024px]:flex min-[1024px]:w-60 min-[1024px]:flex-col"
      aria-label="Client portal navigation"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Org header */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-2.5">
          {branding?.logoUrl && (
            <img
              src={branding.logoUrl}
              alt=""
              className="shrink-0 object-contain"
              style={{ height: 28 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">
              {branding?.businessName || 'Client'}
            </p>
            <p className="text-xs text-text-tertiary truncate">Client portal</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
          {CLIENT_NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p className={cn(
                'px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-text-disabled',
                groupIndex === 0 ? 'mt-0' : 'mt-6'
              )}>
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex h-11 min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-inset',
                      active
                        ? 'bg-accent-secondary text-accent-primary font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                    )}
                  >
                    <Icon name={item.icon} className="w-[18px] h-[18px] shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
      <div className="sticky bottom-0 mt-auto border-t border-border-default bg-surface-primary px-4 py-3">
        <p
          className="text-[11px] text-text-disabled tabular-nums"
          title={deployInfo?.buildTime ? `Built: ${deployInfo.buildTime}` : undefined}
        >
          {deployInfo?.envName ?? 'staging'}
          {deployInfo?.commitSha ? ` · ${deployInfo.commitSha}` : ''}
        </p>
      </div>
    </aside>
  );
}
