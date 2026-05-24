export type ThemeMode = 'light' | 'dark' | 'system';

function setDarkClass(enabled: boolean) {
  const root = document.documentElement;
  if (enabled) root.classList.add('dark');
  else root.classList.remove('dark');
}

export function applyTheme(mode: ThemeMode) {
  if (mode === 'light') {
    setDarkClass(false);
    return;
  }

  if (mode === 'dark') {
    setDarkClass(true);
    return;
  }

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  setDarkClass(mq.matches);
}

export function subscribeToSystemTheme(onChange: (isDark: boolean) => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => onChange(e.matches);

  mq.addEventListener?.('change', handler);
  return () => mq.removeEventListener?.('change', handler);
}

