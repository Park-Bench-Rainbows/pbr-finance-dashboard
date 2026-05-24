'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ThemeManager } from '@/components/theme/theme-manager';
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
import { User as UserIcon } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/income', label: 'Income' },
    { href: '/expenses', label: 'Expenses' },
    { href: '/savings', label: 'Savings' },
    { href: '/daily-expenses', label: 'Daily' },
  ];

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
      <nav className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <span className="text-xl font-bold text-foreground">
                  Finance Dashboard
                </span>
              </div>
              <div className="ml-10 flex space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                      pathname === item.href
                        ? 'border-blue-500 text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="User menu"
                  >
                    {initials ? (
                      <span className="select-none">{initials}</span>
                    ) : (
                      <UserIcon className="h-4 w-4" />
                    )}
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
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
