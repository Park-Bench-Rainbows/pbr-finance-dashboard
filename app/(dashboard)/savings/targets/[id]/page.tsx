'use client';

import { useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, Eye, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type CurrencyCode, type SavingsTargetMonthlyProgress, type SavingsTransaction } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useIsMobile } from '@/components/hooks/use-mobile';
import { MobileRowCard } from '@/components/ui/mobile-row-card';

const formatCurrency = (amount: number, currency: CurrencyCode) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatISODate = (value: string) => {
  const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
};

const n = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
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

const targetSeriesChartConfig = {
  actual: { label: 'Actual', color: 'var(--chart-2)' },
  expected: { label: 'Expected', color: 'var(--chart-1)' },
  planned: { label: 'Planned', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export default function SavingsTargetDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const targetId = params.id;
  const initialMonth = searchParams.get('month') ?? currentMonth();

  const queryClient = useQueryClient();
  const [month, setMonth] = useState(initialMonth);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'preserve_contributions' | 'delete_contributions'>('preserve_contributions');
  const isMobile = useIsMobile();

  const [contribOpen, setContribOpen] = useState(false);
  const [contribData, setContribData] = useState({
    description: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    transactionDate: new Date().toISOString().slice(0, 10),
  });

  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [whatIfData, setWhatIfData] = useState({
    targetAmount: '',
    currency: 'TTD' as CurrencyCode,
    startDate: '',
    targetDate: '',
    factorInExistingPlans: false,
  });
  const [whatIfPreview, setWhatIfPreview] = useState<{ month: string; plannedBaseAmount: number }[] | null>(null);

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const targetsQuery = useQuery({ queryKey: queryKeys.savingsTargets(month), queryFn: () => api.savingsTargets(month) });
  const seriesQuery = useQuery({
    queryKey: queryKeys.savingsTargetProgress(targetId, month),
    queryFn: () => api.savingsTargetProgress(targetId, month),
  });
  const transactionsQuery = useQuery({
    queryKey: queryKeys.savingsTransactions(month, targetId),
    queryFn: () => api.savingsTransactions(month, targetId),
  });

  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const target = useMemo(() => targetsQuery.data?.find((item) => item.id === targetId) ?? null, [targetId, targetsQuery.data]);
  const series = seriesQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];

  const latestMonthRow = useMemo(() => {
    if (!series.length) return null;
    return series[series.length - 1];
  }, [series]);

  const plannedThisMonth = n(latestMonthRow?.planned);
  const actualThisMonth = n(latestMonthRow?.actual);
  const remainingThisMonth = Math.max(0, plannedThisMonth - actualThisMonth);

  const refreshTargetData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsTargets(month) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsTargetProgress(targetId, month) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsTransactions(month, targetId) }),
    ]);
  };

  const quickAddMutation = useMutation({
    mutationFn: () => api.quickContributeSavingsTarget(targetId, month),
    onSuccess: refreshTargetData,
  });

  const contributionMutation = useMutation({
    mutationFn: () =>
      api.createSavingsTransaction({
        description: contribData.description,
        amount: parseFloat(contribData.amount),
        currency: contribData.currency,
        transactionDate: contribData.transactionDate,
        savingsTargetId: targetId,
      }),
    onSuccess: async () => {
      setContribOpen(false);
      setContribData((previous) => ({ ...previous, description: '', amount: '' }));
      await refreshTargetData();
    },
  });

  const deleteTargetMutation = useMutation({
    mutationFn: () => api.deleteSavingsTarget(targetId, deleteMode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans });
      await queryClient.invalidateQueries({ queryKey: ['savings-targets'] });
      setDeleteOpen(false);
      router.push('/savings');
    },
  });

  const whatIfMutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error('Target not found');
      return api.savingsGoal({
        goalName: target.name,
        targetAmount: parseFloat(whatIfData.targetAmount),
        currency: whatIfData.currency,
        startDate: whatIfData.startDate,
        targetDate: whatIfData.targetDate,
        factorInExistingPlans: whatIfData.factorInExistingPlans,
        dryRun: true,
      });
    },
    onSuccess: (data) => {
      setWhatIfPreview(data.schedule ?? []);
    },
  });

  const progressColumns = useMemo<ColumnDef<SavingsTargetMonthlyProgress>[]>(
    () => [
      {
        accessorKey: 'month',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Month" />,
        cell: ({ row }) => <span className="font-medium">{row.original.month}</span>,
      },
      {
        accessorKey: 'planned',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Planned" className="justify-end" />,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.original.planned, baseCurrency)}</div>,
      },
      {
        accessorKey: 'actual',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Actual" className="justify-end" />,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.original.actual, baseCurrency)}</div>,
      },
      {
        accessorKey: 'expected',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Expected" className="justify-end" />,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.original.expected, baseCurrency)}</div>,
      },
    ],
    [baseCurrency]
  );

  const transactionColumns = useMemo<ColumnDef<SavingsTransaction>[]>(
    () => [
      {
        accessorKey: 'transactionDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => formatISODate(row.original.transactionDate),
      },
      {
        accessorKey: 'description',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
        cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" className="justify-end" />,
        cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.original.amount, baseCurrency)}</div>,
      },
    ],
    [baseCurrency]
  );

  if (settingsQuery.isLoading || targetsQuery.isLoading || seriesQuery.isLoading || transactionsQuery.isLoading) {
    return <PageLoading variant="cards" />;
  }

  if (!target) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Target not found</h1>
          <Button variant="outline" onClick={() => router.push('/savings')}>
            Back
          </Button>
        </div>
        <p className="text-muted-foreground">We couldn’t find that savings target.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{target.name}</h1>
            {target.status && (
              <Badge variant={target.status === 'on_track' ? 'default' : 'danger'}>
                {target.status === 'on_track' ? 'On track' : 'Behind'}
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Target {formatCurrency(n(target.targetAmount), baseCurrency)} • {formatISODate(target.startDate)} → {formatISODate(target.targetDate)}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="w-full sm:w-56">
            <Select value={month} onValueChange={(v) => {
              setMonth(v);
              router.replace(`/savings/targets/${targetId}?month=${v}`);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => router.push('/savings')}>
            Back
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Remaining (this month)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(remainingThisMonth, baseCurrency)}</div>
            <div className="text-xs text-muted-foreground">
              Planned {formatCurrency(plannedThisMonth, baseCurrency)} • Contributed {formatCurrency(actualThisMonth, baseCurrency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Actual to date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(n(target.actualToDate), baseCurrency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expected to date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(n(target.expectedToDate), baseCurrency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Planned to date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(n(target.plannedToDate), baseCurrency)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => quickAddMutation.mutate()} disabled={quickAddMutation.isPending || remainingThisMonth <= 0}>
          <CircleDollarSign className="h-4 w-4" />
          {quickAddMutation.isPending ? 'Adding…' : 'Quick add'}
        </Button>

        <Dialog
          open={contribOpen}
          onOpenChange={(open) => {
            setContribOpen(open);
            if (open) setContribData((previous) => ({ ...previous, currency: baseCurrency }));
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus className="h-4 w-4" />
              Add contribution
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add contribution</DialogTitle>
              <DialogDescription>Record an actual amount you moved into savings for this target.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                contributionMutation.mutate();
              }}
            >
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Input id="desc" value={contribData.description} onChange={(e) => setContribData({ ...contribData, description: e.target.value })} required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="amt">Amount</Label>
                    <Input id="amt" type="number" step="0.01" min="0" value={contribData.amount} onChange={(e) => setContribData({ ...contribData, amount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cur">Currency</Label>
                    <Select value={contribData.currency} onValueChange={(v) => setContribData({ ...contribData, currency: v as CurrencyCode })}>
                      <SelectTrigger id="cur">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TTD">TTD</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="CAD">CAD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={contribData.transactionDate} onChange={(e) => setContribData({ ...contribData, transactionDate: e.target.value })} required />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setContribOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={contributionMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {contributionMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={whatIfOpen}
          onOpenChange={(open) => {
            setWhatIfOpen(open);
            if (open) {
              setWhatIfPreview(null);
              setWhatIfData({
                targetAmount: String(target.targetAmount),
                currency: baseCurrency,
                startDate: target.startDate.split('T')[0],
                targetDate: target.targetDate.split('T')[0],
                factorInExistingPlans: target.factorInExistingPlans,
              });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline">
              <Sparkles className="h-4 w-4" />
              What-if
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>What-if planner</DialogTitle>
              <DialogDescription>
                Preview the monthly schedule needed to hit this target without creating anything.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                whatIfMutation.mutate();
              }}
            >
              <div className="space-y-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wif-amount">Target amount</Label>
                    <Input
                      id="wif-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={whatIfData.targetAmount}
                      onChange={(e) => setWhatIfData({ ...whatIfData, targetAmount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wif-currency">Currency</Label>
                    <Select value={whatIfData.currency} onValueChange={(v) => setWhatIfData({ ...whatIfData, currency: v as CurrencyCode })}>
                      <SelectTrigger id="wif-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TTD">TTD</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="CAD">CAD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wif-start">Start date</Label>
                    <Input
                      id="wif-start"
                      type="date"
                      value={whatIfData.startDate}
                      onChange={(e) => setWhatIfData({ ...whatIfData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wif-target">Target date</Label>
                    <Input
                      id="wif-target"
                      type="date"
                      value={whatIfData.targetDate}
                      onChange={(e) => setWhatIfData({ ...whatIfData, targetDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="wif-factor"
                    type="checkbox"
                    checked={whatIfData.factorInExistingPlans}
                    onChange={(e) => setWhatIfData({ ...whatIfData, factorInExistingPlans: e.target.checked })}
                  />
                  <Label htmlFor="wif-factor">Factor in existing savings plans</Label>
                </div>

                {whatIfPreview && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="text-sm font-medium">Preview</div>
                    <div className="max-h-56 overflow-auto rounded border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                          <tr className="border-b">
                            <th className="h-9 px-3 text-left text-xs font-semibold uppercase tracking-wide">Month</th>
                            <th className="h-9 px-3 text-right text-xs font-semibold uppercase tracking-wide">Planned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {whatIfPreview.map((r) => (
                            <tr key={r.month} className="border-b last:border-0">
                              <td className="px-3 py-2.5">{r.month}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(r.plannedBaseAmount, baseCurrency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setWhatIfOpen(false)}>
                  Close
                </Button>
                <Button type="submit" disabled={whatIfMutation.isPending}>
                  <Eye className="h-4 w-4" />
                  {whatIfMutation.isPending ? 'Working…' : 'Preview'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="h-4 w-4" />
              Delete goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete goal</DialogTitle>
              <DialogDescription>
                Choose what happens to contributions already recorded for this goal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteMode === 'preserve_contributions'}
                  onChange={() => setDeleteMode('preserve_contributions')}
                />
                <span>
                  <span className="font-medium">Keep contributions</span>
                  <div className="text-muted-foreground">
                    Deletes the goal + its plans, but keeps your contribution history (it becomes “unassigned”).
                  </div>
                </span>
              </label>

              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteMode === 'delete_contributions'}
                  onChange={() => setDeleteMode('delete_contributions')}
                />
                <span>
                  <span className="font-medium">Delete contributions too</span>
                  <div className="text-muted-foreground">
                    Permanently deletes the goal, its plans, and all contributions linked to it.
                  </div>
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => deleteTargetMutation.mutate()} disabled={deleteTargetMutation.isPending}>
                <Trash2 className="h-4 w-4" />
                {deleteTargetMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={targetSeriesChartConfig} className="h-[260px] w-full sm:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: isMobile ? 0 : 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis hide={isMobile} tickLine={false} axisLine={false} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => formatCurrency(Number(value), baseCurrency)} indicator="line" />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area type="monotone" dataKey="expectedCum" name="expected" stroke="var(--color-expected)" fill="var(--color-expected)" fillOpacity={0.12} strokeWidth={2} />
                <Area type="monotone" dataKey="actualCum" name="actual" stroke="var(--color-actual)" fill="var(--color-actual)" fillOpacity={0.14} strokeWidth={2} />
                <Area type="monotone" dataKey="plannedCum" name="planned" stroke="var(--color-planned)" fill="var(--color-planned)" fillOpacity={0.10} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>

          <DataTable
            columns={progressColumns}
            data={series}
            hideSearch
            initialPageSize={12}
            className="mt-4"
            emptyMessage="No progress data available."
            mobileCard={(row) => (
              <div className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.month}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Monthly breakdown</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div>Planned</div>
                    <div className="mt-0.5 font-semibold text-foreground tabular-nums">
                      {formatCurrency(row.planned, baseCurrency)}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div>Actual</div>
                    <div className="mt-0.5 font-semibold text-foreground tabular-nums">
                      {formatCurrency(row.actual, baseCurrency)}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <div>Expected</div>
                    <div className="mt-0.5 font-semibold text-foreground tabular-nums">
                      {formatCurrency(row.expected, baseCurrency)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contributions ({month})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={transactionColumns}
            data={transactions}
            searchPlaceholder="Search contributions..."
            emptyMessage="No contributions recorded for this month."
            mobileCard={(transaction) => (
              <MobileRowCard
                title={transaction.description}
                amountNode={formatCurrency(transaction.amount, baseCurrency)}
                contextNode={<span>{formatISODate(transaction.transactionDate)}</span>}
              />
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
