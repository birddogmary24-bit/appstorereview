'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UpdateButton } from '@/components/update-button';
import { LayoutDashboard, List, Lightbulb } from 'lucide-react';

interface AppNavbarProps {
  appId: string;
  appName: string;
  appColor: string;
}

export function AppNavbar({ appId, appName, appColor }: AppNavbarProps) {
  const pathname = usePathname();

  const tabs = [
    { href: `/${appId}`, label: '대시보드', icon: LayoutDashboard, exact: true },
    { href: `/${appId}/reviews`, label: '전체 리뷰', icon: List, exact: false },
    { href: `/${appId}/insights`, label: '인사이트', icon: Lightbulb, exact: false },
  ];

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: appColor }} />
          <span className="font-bold text-lg">{appName}</span>
        </div>
        <nav className="flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = isActive(tab.href, tab.exact);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <UpdateButton appId={appId} appName={appName} />
    </div>
  );
}
