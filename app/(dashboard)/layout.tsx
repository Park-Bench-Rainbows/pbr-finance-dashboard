'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ThemeManager } from '@/components/theme/theme-manager';
import { SidebarNav, useDashboardNavLabel } from '@/components/navigation/sidebar-nav';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Menu, PanelLeft, User as UserIcon, XIcon } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pageLabel = useDashboardNavLabel();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        setUserEmail(data?.user?.email ?? null);
      } catch {
        setUserEmail(null);
      }

      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const settings = await res.json();
        setTheme((settings?.theme ?? 'system') as 'light' | 'dark' | 'system');
      } catch {
        // ignore
      }
    };

    load();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pbr_sidebar_collapsed');
      setSidebarCollapsed(raw === 'true');
    } catch {
      // ignore
    }
  }, []);

  const initials = useMemo(() => {
    if (!userEmail) return null;
    const local = userEmail.split('@')[0] ?? '';
    const parts = local.split(/[._-]+/).filter(Boolean);
    const first = parts[0]?.[0]?.toUpperCase();
    const second = (parts[1]?.[0] ?? parts[0]?.[1])?.toUpperCase();
    const out = `${first ?? ''}${second ?? ''}`.trim();
    return out.length ? out : null;
  }, [userEmail]);

  const updateTheme = async (mode: 'light' | 'dark' | 'system') => {
    setTheme(mode);
    try {
      localStorage.setItem('pbr_theme', mode);
    } catch {
      // ignore
    }

    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: mode }),
      });
    } catch {
      // ignore - theme manager will keep local value
    }

    if (mode === 'dark') document.documentElement.classList.add('dark');
    else if (mode === 'light') document.documentElement.classList.remove('dark');
    else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeManager />

      <div className="flex min-h-screen">
        <div className="hidden lg:block">
          <SidebarNav collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        </div>

        <div className="min-w-0 flex-1">
          <nav className="sticky top-0 z-40 border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 sm:px-4 lg:px-6">
              <div className="lg:hidden">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Open navigation">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="fixed left-0 top-0 h-[100dvh] w-[320px] translate-x-0 translate-y-0 rounded-none border-r p-0 sm:max-w-none"
                    showCloseButton={false}
                  >
                    <div className="flex h-16 items-center justify-between border-b px-4">
                      <div className="flex items-center gap-3">
                        <BrandMark className="h-5 w-5" />
                        <div className="text-[13px] font-semibold tracking-tight text-foreground">
                          Finance Dashboard
                        </div>
                      </div>
                      <DialogClose asChild>
                        <Button variant="ghost" size="icon" aria-label="Close navigation">
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </DialogClose>
                    </div>
                    <SidebarNav collapsed={false} showHeader={false} className="w-full border-r-0 bg-background" />
                  </DialogContent>
                </Dialog>
              </div>

              <div className="hidden lg:block">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  onClick={() => {
                    setSidebarCollapsed((v) => {
                      const next = !v;
                      try {
                        localStorage.setItem('pbr_sidebar_collapsed', String(next));
                      } catch {
                        // ignore
                      }
                      return next;
                    });
                  }}
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {pageLabel}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {pathname === '/dashboard'
                    ? 'Monthly overview and allocation'
                    : 'Manage and review your data'}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background/70 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="User menu"
                    >
                      {initials ? <span className="select-none">{initials}</span> : <UserIcon className="h-4 w-4" />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{userEmail ?? 'Account'}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => router.push('/settings')}>Settings</DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => updateTheme(v as any)}>
                          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleLogout}>Logout</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </nav>

          <main className="mx-auto max-w-7xl px-3 py-8 sm:px-4 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
