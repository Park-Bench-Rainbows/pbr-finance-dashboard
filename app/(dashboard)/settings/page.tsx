'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CurrencyCode = 'TTD' | 'USD' | 'CAD';
type ThemeMode = 'light' | 'dark' | 'system';

interface UserSettings {
  userId: string;
  baseCurrency: CurrencyCode;
  theme: ThemeMode;
}

const currencies: { value: CurrencyCode; label: string }[] = [
  { value: 'TTD', label: 'TTD (Trinidad and Tobago Dollar)' },
  { value: 'USD', label: 'USD (US Dollar)' },
  { value: 'CAD', label: 'CAD (Canadian Dollar)' },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');
  const [theme, setTheme] = useState<ThemeMode>('system');

  const baseCurrencyLabel = useMemo(() => {
    return currencies.find((c) => c.value === baseCurrency)?.label ?? baseCurrency;
  }, [baseCurrency]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? 'Failed to load settings');
        }
        const data: UserSettings = await res.json();
        setSettings(data);
        setBaseCurrency(data.baseCurrency);
        setTheme(data.theme ?? 'system');
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseCurrency, theme }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to save settings');
      }
      const updated: UserSettings = await res.json();
      setSettings(updated);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Choose your base currency. All dashboard totals and summaries use your base currency.
        </p>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="baseCurrency">Base currency</Label>
          <Select value={baseCurrency} onValueChange={(v) => setBaseCurrency(v as CurrencyCode)}>
            <SelectTrigger id="baseCurrency" className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Current selection: {baseCurrencyLabel}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as ThemeMode)}>
            <SelectTrigger id="theme" className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            System uses your device preference.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving || !settings}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
