'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandMark } from '@/components/brand/brand-mark';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type CurrencyCode } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

type ThemeMode = 'light' | 'dark' | 'system';

const currencies: { value: CurrencyCode; label: string }[] = [
  { value: 'TTD', label: 'TTD (Trinidad and Tobago Dollar)' },
  { value: 'USD', label: 'USD (US Dollar)' },
  { value: 'CAD', label: 'CAD (Canadian Dollar)' },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');
  const [theme, setTheme] = useState<ThemeMode>('system');
  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const updateMutation = useMutation({
    mutationFn: () => api.updateSettings({ baseCurrency, theme }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.settings, updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      setError(null);
    },
    onError: (e: any) => {
      setError(e?.message ?? 'Failed to save settings');
    },
  });

  const baseCurrencyLabel = useMemo(() => {
    return currencies.find((c) => c.value === baseCurrency)?.label ?? baseCurrency;
  }, [baseCurrency]);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setBaseCurrency(settingsQuery.data.baseCurrency);
    setTheme(settingsQuery.data.theme ?? 'system');
  }, [settingsQuery.data]);

  const handleSave = async () => {
    setError(null);
    updateMutation.mutate();
  };

  if (settingsQuery.isLoading) return <PageLoading variant="simple" />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Choose your base currency. All dashboard totals and summaries use your base currency.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="baseCurrency">Base currency</Label>
              <Select value={baseCurrency} onValueChange={(v) => setBaseCurrency(v as CurrencyCode)}>
                <SelectTrigger id="baseCurrency" className="w-full max-w-md">
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
                <SelectTrigger id="theme" className="w-full max-w-md">
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
              <div className="rounded-lg border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={!settingsQuery.data}
                variant="brand"
                className="w-full sm:w-auto"
                isLoading={updateMutation.isPending}
                loadingText="Saving…"
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <BrandMark className="h-6 w-6" />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">Park Bench Rainbows</div>
                <div className="text-xs text-muted-foreground">Built within the ecosystem</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              A calm, professional finance experience with a subtle creative identity.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
