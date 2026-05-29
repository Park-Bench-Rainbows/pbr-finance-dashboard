'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  BadgeDollarSign,
  LayoutDashboard,
  HandCoins,
  PiggyBank,
  PieChart,
  PanelLeft,
  Receipt,
  Settings,
  Wallet,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';

const COLLAPSE_KEY = 'pbr_sidebar_collapsed';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/income', label: 'Income', icon: Wallet },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/loans', label: 'Loans', icon: HandCoins },
  { href: '/debts', label: 'Debts', icon: BadgeDollarSign },
  { href: '/budgets', label: 'Budgets', icon: PieChart },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/daily-expenses', label: 'Daily', icon: CalendarDays },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function useDashboardNavLabel() {
  const pathname = usePathname();
  return useMemo(() => {
    const hit = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    return hit?.label ?? 'Finance Dashboard';
  }, [pathname]);
}

export function SidebarNav({
  className,
  collapsed: collapsedProp,
  onCollapsedChange,
  showHeader = true,
}: {
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  showHeader?: boolean;
}) {
  const pathname = usePathname();
  const [collapsedInternal, setCollapsedInternal] = useState(false);

  const collapsed = collapsedProp ?? collapsedInternal;
  const setCollapsed = (next: boolean) => {
    onCollapsedChange?.(next);
    setCollapsedInternal(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, String(next));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (collapsedProp !== undefined) return;
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw === 'true') setCollapsedInternal(true);
    } catch {
      // ignore
    }
  }, [collapsedProp]);

  return (
    <aside
      className={cn(
        'h-full w-[264px] shrink-0 border-r border-sidebar-border bg-white text-sidebar-foreground shadow-md shadow-black/5 dark:bg-sidebar dark:shadow-none',
        collapsed && 'w-[84px]',
        className
      )}
    >
      {showHeader && (
        <div className={cn('relative flex h-16 items-center gap-3 px-4', collapsed && 'justify-center px-3')}>
          <BrandMark className="h-5 w-5 shrink-0" />
          {/* {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                Finance Dashboard
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                Calm, structured tracking
              </div>
            </div>
          )} */}
          <div className={cn('ml-auto', collapsed && 'ml-0')}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn('rounded-lg', collapsed && 'absolute right-2 top-2')}
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <nav className={cn('px-2 pb-4', showHeader ? 'pt-2' : 'pt-2')}>
        <div className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                  'text-muted-foreground hover:bg-accent hover:text-foreground',
                  active && 'bg-accent text-foreground',
                  collapsed && 'justify-center px-2'
                )}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
