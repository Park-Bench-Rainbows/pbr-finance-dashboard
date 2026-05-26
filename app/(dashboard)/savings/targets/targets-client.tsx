'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/page-loading';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, type CurrencyCode, type SavingsTarget } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const formatCurrency = (amount: number, currency: CurrencyCode) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatISODate = (value: string) => {
  const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });
    options.push({ value, label });
  }
  return options;
}

type Filter = 'all' | 'behind' | 'on_track' | 'completed';

function isCompleted(target: SavingsTarget) {
  return typeof target.percentActualToDate === 'number' && Number.isFinite(target.percentActualToDate) && target.percentActualToDate >= 1;
}

function matchesFilter(target: SavingsTarget, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'behind') return target.status === 'behind';
  if (filter === 'on_track') return target.status === 'on_track';
  if (filter === 'completed') return isCompleted(target);
  return true;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function SavingsTargetsClient() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialMonth = searchParams.get('month') ?? currentMonth();

  const [month, setMonth] = useState(initialMonth);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const targetsQuery = useQuery({
    queryKey: queryKeys.savingsTargets(month),
    queryFn: () => api.savingsTargets(month),
  });

  const quickAddMutation = useMutation({
    mutationFn: ({ id, monthValue }: { id: string; monthValue: string }) => api.quickContributeSavingsTarget(id, monthValue),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.savingsTargets(month) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.savingsTransactions(month) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.summary(month) });
    },
  });

  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const targets = targetsQuery.data ?? [];

  const filteredTargets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return targets
      .filter((t) => matchesFilter(t, filter))
      .filter((t) => (q ? t.name.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const aBehind = a.status === 'behind' ? 1 : 0;
        const bBehind = b.status === 'behind' ? 1 : 0;
        if (aBehind !== bBehind) return bBehind - aBehind;
        const aDue = new Date(a.targetDate).getTime();
        const bDue = new Date(b.targetDate).getTime();
        if (aDue !== bDue) return aDue - bDue;
        return a.name.localeCompare(b.name);
      });
  }, [targets, filter, search]);

  if (targetsQuery.isLoading) return <PageLoading variant="simple" />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Savings Targets</h1>
        <p className="text-sm text-muted-foreground">Filter and focus on what needs attention.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Browse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="targets-month">Month</Label>
              <Select value={month} onValueChange={(v) => setMonth(v)}>
                <SelectTrigger id="targets-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions().map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Filter</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'all', label: 'All' },
                  { value: 'behind', label: 'Behind' },
                  { value: 'on_track', label: 'On track' },
                  { value: 'completed', label: 'Completed' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilter(opt.value)}
                    className={cn(
                      'inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors',
                      filter === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted'
                    )}
                    aria-pressed={filter === opt.value}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targets-search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="targets-search"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name…"
                />
              </div>
            </div>
          </div>

          {!filteredTargets.length ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">No targets match.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredTargets.map((t) => {
                const percent = clamp01(t.percentActualToDate ?? 0);
                const statusLabel = t.status === 'behind' ? 'Behind' : t.status === 'on_track' ? 'On track' : '—';
                return (
                  <div key={t.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{t.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Due {formatISODate(t.targetDate)} · {statusLabel}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                        {formatCurrency(t.targetAmount, baseCurrency)}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Actual to date</span>
                        <span className="tabular-nums">{Math.round(percent * 100)}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent * 100}%` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground">Actual</div>
                          <div className="mt-0.5 font-semibold tabular-nums">
                            {formatCurrency(t.actualToDate ?? 0, baseCurrency)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground">Expected</div>
                          <div className="mt-0.5 font-semibold tabular-nums">
                            {formatCurrency(t.expectedToDate ?? 0, baseCurrency)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/savings/targets/${t.id}?month=${month}`}
                        className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        View details
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => quickAddMutation.mutate({ id: t.id, monthValue: month })}
                        isLoading={quickAddMutation.isPending && quickAddMutation.variables?.id === t.id}
                        loadingText="Quick add"
                      >
                        <CircleDollarSign className="h-4 w-4" />
                        Quick add
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

