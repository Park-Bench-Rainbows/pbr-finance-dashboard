'use client';

import { useEffect, useRef } from 'react';
import { applyTheme, subscribeToSystemTheme, ThemeMode } from '@/lib/theme/apply-theme';

const LOCAL_STORAGE_KEY = 'pbr_theme';

export function ThemeManager() {
  const unsubscribeRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    const cached = (localStorage.getItem(LOCAL_STORAGE_KEY) as ThemeMode | null) ?? null;
    if (cached) {
      applyTheme(cached);
    }

    const load = async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const settings = await res.json();
        const mode = (settings?.theme ?? 'system') as ThemeMode;

        localStorage.setItem(LOCAL_STORAGE_KEY, mode);
        applyTheme(mode);

        unsubscribeRef.current?.();
        unsubscribeRef.current = null;

        if (mode === 'system') {
          unsubscribeRef.current = subscribeToSystemTheme((isDark) => {
            const root = document.documentElement;
            if (isDark) root.classList.add('dark');
            else root.classList.remove('dark');
          });
        }
      } catch {
        // ignore - keep cached/default theme
      }
    };

    load();

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  return null;
}

