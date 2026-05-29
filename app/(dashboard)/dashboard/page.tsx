'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Eye, EyeOff, Plus } from 'lucide-react';
import { api, type CurrencyCode, type DailyExpensePayload } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  DailyExpenseDialog,
  dailyCategoryBadgeVariant,
  formatDailyExpenseDate,
  getDailyCategoryLabel,
  todayISO,
} from '@/components/daily-expenses/daily-expense-dialog';
import { useIsMobile } from '@/components/hooks/use-mobile';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { SensitiveValue } from '@/components/ui/sensitive-value';

const n = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatCurrency = (amount: number, currency: CurrencyCode) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

const formatCompactCurrency = (amount: number, currency: CurrencyCode) => {
  const absAmount = Math.abs(amount);
  
  // For values under 1000, show 2 decimal places
  if (absAmount < 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  
  // For 1K+, use compact notation with no decimals
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 0,
  }).format(amount);
};

const allocationColors = {
  expenses: '#ef4444',
  savings: '#3B82F6',
  disposable: '#22C55E',
};

const incomeExpenseChartConfig = {
  income: { label: 'Income', color: 'var(--chart-1)' },
  expenses: { label: 'Expenses', color: 'var(--chart-3)' },
  savings: { label: 'Savings', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const allocationChartConfig = {
  expenses: { label: 'Expenses', color: allocationColors.expenses },
  savings: { label: 'Savings', color: allocationColors.savings },
  disposable: { label: 'Disposable', color: allocationColors.disposable },
} satisfies ChartConfig;

const sumValues = (obj: Record<string, unknown> | undefined) =>
  Object.values(obj ?? {}).reduce<number>((sum, v) => sum + n(v), 0);

function endOfMonthISO(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  const d = new Date(year, m, 0); // local last day
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function PrivacyChartPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-[240px] w-full items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 px-6 text-center sm:h-[300px]">
      <div className="max-w-xs space-y-2">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [view, setView] = useState<'month' | 'ytd'>('month');
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [isSensitiveValuesVisible, setIsSensitiveValuesVisible] = useState(false);
  const isMobile = useIsMobile();
  const currentMonth = todayISO().slice(0, 7);
  const ytdEndDate = selectedMonth === currentMonth ? todayISO() : endOfMonthISO(selectedMonth);

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const summaryQuery = useQuery({
    queryKey: queryKeys.summary(selectedMonth),
    queryFn: () => api.summary(selectedMonth),
  });
  const latestTransactionsQuery = useQuery({
    queryKey: queryKeys.dailyExpenses.latest(10),
    queryFn: () => api.latestDailyExpenses(10),
  });
  const trendsQuery = useQuery({
    queryKey: queryKeys.trends(selectedMonth),
    queryFn: () => api.trends(selectedMonth, ytdEndDate),
    enabled: view === 'ytd',
  });
  const createTransactionMutation = useMutation({
    mutationFn: (payload: DailyExpensePayload) => api.createDailyExpense(payload),
    onSuccess: async (_created, payload) => {
      setTransactionDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dailyExpenses.latest(10) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.summary(selectedMonth) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dailyExpenses.date(payload.purchaseDate) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dailyExpenses.month(payload.purchaseDate.slice(0, 7)) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.trends(selectedMonth) }),
      ]);
    },
  });

  const summary = summaryQuery.data ?? null;
  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const latestTransactions = latestTransactionsQuery.data ?? [];
  const latestTransactionsLoading = latestTransactionsQuery.isLoading;
  const trends = trendsQuery.data?.points ?? [];
  const trendsLoading = trendsQuery.isFetching;

  // Generate month options (current month and previous 11 months)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
      const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });
      options.push({ value, label });
    }
    return options;
  };

  const incomeVsExpensesData = summary
    ? [
        { name: 'Income', amount: n(summary.totalIncome) },
        { name: 'Expenses', amount: n(summary.totalExpenses) },
        { name: 'Savings', amount: n(summary.totalSavings) },
      ]
    : [];

  const incomeAllocationData = summary
    ? [
        { name: 'Expenses', value: n(summary.totalExpenses), fill: allocationColors.expenses },
        { name: 'Savings', value: n(summary.totalSavings), fill: allocationColors.savings },
        { name: 'Disposable', value: Math.max(n(summary.disposableIncome), 0), fill: allocationColors.disposable },
      ]
    : [];

  const totalBudget = summary ? sumValues(summary.budgetsByCategory) : 0;
  const totalBudgetRemaining = summary ? sumValues(summary.budgetRemainingByCategory) : 0;
  const totalBudgetSpent = Math.max(totalBudget - totalBudgetRemaining, 0);
  const budgetProgress = totalBudget > 0 ? Math.min(totalBudgetSpent / totalBudget, 1) : 0;
  const isOverBudget = totalBudget > 0 && totalBudgetRemaining < 0;

  useEffect(() => {
    const hideSensitiveValues = () => {
      setIsSensitiveValuesVisible(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hideSensitiveValues();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', hideSensitiveValues);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', hideSensitiveValues);
    };
  }, []);

  if (summaryQuery.isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label={isSensitiveValuesVisible ? 'Hide sensitive values' : 'Show sensitive values'}
            aria-pressed={isSensitiveValuesVisible}
            onClick={() => setIsSensitiveValuesVisible((value) => !value)}
          >
            {isSensitiveValuesVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-auto">
            <Label className="mb-1 block text-xs text-muted-foreground">View</Label>
            <SegmentedToggle
              value={view}
              onValueChange={setView}
              ariaLabel="Dashboard view"
              options={[
                { value: 'month', label: 'Monthly' },
                { value: 'ytd', label: 'YTD' },
              ]}
            />
          </div>
          <div className="w-full">
            <Label className="mb-1 block text-xs text-muted-foreground">
              {view === 'ytd' ? 'Through' : 'Month'}
            </Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue placeholder={view === 'ytd' ? 'Through month' : 'Select month'} />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* {view === 'ytd' ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Shows year-to-date totals through the selected month.
              </div>
            ) : null} */}
          </div>
        </div>
      </div>

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Link
              href="/income"
              className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Go to Income"
            >
              <Card className="h-full flex flex-col border-0 bg-linear-to-br from-[#11998E] to-[#38EF7D] transition-all hover:shadow-lg hover:shadow-[#11998E]/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Total Income</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <SensitiveValue
                    className="text-2xl font-bold text-white tabular-nums truncate"
                    isRevealed={isSensitiveValuesVisible}
                    value={formatCompactCurrency(n(summary.totalIncome), baseCurrency)}
                    hiddenLabel="Total income"
                    title={formatCurrency(n(summary.totalIncome), baseCurrency)}
                  />
                </CardContent>
              </Card>
            </Link>

            <Link
              href="/expenses"
              className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Go to Expenses"
            >
              <Card className="h-full flex flex-col border-0 bg-linear-to-br from-[#F12711] to-[#F5AF19] transition-all hover:shadow-lg hover:shadow-[#F12711]/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Total Expenses</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <SensitiveValue
                    className="text-2xl font-bold text-white tabular-nums truncate"
                    isRevealed={isSensitiveValuesVisible}
                    value={formatCompactCurrency(n(summary.totalExpenses), baseCurrency)}
                    hiddenLabel="Total expenses"
                    title={formatCurrency(n(summary.totalExpenses), baseCurrency)}
                  />

                  <div className="rounded-md border border-white/30 bg-white/10 p-2 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-xs text-white/90">
                      <span>Budget status</span>
                      {totalBudget > 0 ? (
                        <span className={isOverBudget ? 'font-semibold text-white' : ''}>
                          <SensitiveValue
                            isRevealed={isSensitiveValuesVisible}
                            value={formatCompactCurrency(totalBudgetRemaining, baseCurrency)}
                            hiddenLabel="Budget remaining"
                            title={formatCurrency(totalBudgetRemaining, baseCurrency)}
                          />{' '}
                          left
                        </span>
                      ) : (
                        <span>Not set</span>
                      )}
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
                      <div
                        className={`h-full ${isOverBudget ? 'bg-white' : 'bg-white/80'}`}
                        style={{ width: `${Math.round(budgetProgress * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-white/70">
                      <span>
                        Spent{' '}
                        <SensitiveValue
                          isRevealed={isSensitiveValuesVisible}
                          value={formatCompactCurrency(totalBudgetSpent, baseCurrency)}
                          hiddenLabel="Budget spent"
                          title={formatCurrency(totalBudgetSpent, baseCurrency)}
                        />
                      </span>
                      <span>
                        Budget{' '}
                        <SensitiveValue
                          isRevealed={isSensitiveValuesVisible}
                          value={formatCompactCurrency(totalBudget, baseCurrency)}
                          hiddenLabel="Total budget"
                          title={formatCurrency(totalBudget, baseCurrency)}
                        />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              href="/savings"
              className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Go to Savings"
            >
              <Card className="h-full flex flex-col border-0 bg-linear-to-br from-[#1CB5E0] to-[#000851] transition-all hover:shadow-lg hover:shadow-[#1CB5E0]/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Total Savings</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <SensitiveValue
                    className="text-2xl font-bold text-white tabular-nums truncate"
                    isRevealed={isSensitiveValuesVisible}
                    value={formatCompactCurrency(n(summary.totalSavings), baseCurrency)}
                    hiddenLabel="Total savings"
                    title={formatCurrency(n(summary.totalSavings), baseCurrency)}
                  />
                </CardContent>
              </Card>
            </Link>

            <Link
              href="/daily-expenses"
              className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Go to Daily expenses"
            >
              <Card className="h-full flex flex-col border-0 bg-linear-to-br from-[#D4145A] to-[#FBB03B] transition-all hover:shadow-lg hover:shadow-[#D4145A]/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Daily Spending</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <SensitiveValue
                    className="text-2xl font-bold text-white tabular-nums truncate"
                    isRevealed={isSensitiveValuesVisible}
                    value={formatCompactCurrency(n(summary.totalDailySpend), baseCurrency)}
                    hiddenLabel="Daily spending"
                    title={formatCurrency(n(summary.totalDailySpend), baseCurrency)}
                  />
                </CardContent>
              </Card>
            </Link>

            <Link
              href="/dashboard"
              className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Remaining disposable details"
            >
              <Card className="h-full flex flex-col border-0 bg-linear-to-br from-[#654EA3] to-[#EAAFC8] transition-all hover:shadow-lg hover:shadow-[#654EA3]/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-white">Remaining Disposable</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <SensitiveValue
                    className="text-2xl font-bold tabular-nums truncate text-white"
                    isRevealed={isSensitiveValuesVisible}
                    value={formatCompactCurrency(n(summary.remainingDisposable), baseCurrency)}
                    hiddenLabel="Remaining disposable income"
                    title={formatCurrency(n(summary.remainingDisposable), baseCurrency)}
                  />
                  <div className="text-xs text-white/70 tabular-nums truncate">
                    Planned:{' '}
                    <SensitiveValue
                      isRevealed={isSensitiveValuesVisible}
                      value={formatCompactCurrency(n(summary.disposableIncome), baseCurrency)}
                      hiddenLabel="Planned disposable income"
                      title={formatCurrency(n(summary.disposableIncome), baseCurrency)}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Budget status is shown inline in the Expenses tile */}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Latest Transactions</CardTitle>
                <Button size="sm" className="w-full sm:w-auto" onClick={() => setTransactionDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add transaction
                </Button>
              </CardHeader>
              <CardContent>
                {latestTransactionsLoading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : latestTransactions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No daily transactions recorded yet.</div>
                ) : (
                  <>
                  <div className="hidden max-h-[320px] overflow-y-auto rounded-lg border sm:block">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-card">
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Category</th>
                          <th className="px-3 py-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {latestTransactions.map((row) => (
                          <tr key={row.id} className="hover:bg-muted/30">
                            <td className="max-w-[180px] px-3 py-2 font-medium">
                              <div className="truncate" title={row.description}>
                                {row.description}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                              {formatDailyExpenseDate(row.purchaseDate)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={dailyCategoryBadgeVariant[row.category]} className="capitalize">
                                {getDailyCategoryLabel(row.category)}
                              </Badge>
                            </td>
                            <td
                              className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums"
                            >
                              <SensitiveValue
                                isRevealed={isSensitiveValuesVisible}
                                value={formatCompactCurrency(n(row.amount), baseCurrency)}
                                hiddenLabel="Transaction amount"
                                title={formatCurrency(n(row.amount), baseCurrency)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="max-h-[320px] space-y-3 overflow-y-auto sm:hidden">
                    {latestTransactions.map((row) => (
                      <div key={row.id} className="rounded-lg border bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{row.description}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatDailyExpenseDate(row.purchaseDate)}
                            </div>
                          </div>
                          <div className="shrink-0 text-right font-semibold tabular-nums">
                            <SensitiveValue
                              isRevealed={isSensitiveValuesVisible}
                              value={formatCompactCurrency(n(row.amount), baseCurrency)}
                              hiddenLabel="Transaction amount"
                              title={formatCurrency(n(row.amount), baseCurrency)}
                            />
                          </div>
                        </div>
                        <Badge variant={dailyCategoryBadgeVariant[row.category]} className="mt-2 capitalize">
                          {getDailyCategoryLabel(row.category)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  </>
                )}
                <div className="mt-3">
                  <Link href="/daily-expenses" className="text-sm text-muted-foreground hover:text-foreground">
                    View all daily expenses
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Budget Snapshot</CardTitle>
                <Link href="/budgets" className="text-sm text-muted-foreground hover:text-foreground">
                  View budgets
                </Link>
              </CardHeader>
              <CardContent>
                {totalBudget > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(summary.budgetsByCategory ?? {})
                      .map(([category, budget]) => {
                        const budgetNum = n(budget);
                        const remaining = n(summary.budgetRemainingByCategory?.[category]);
                        const spent = budgetNum - remaining;
                        const progress = budgetNum > 0 ? Math.min(Math.max(spent / budgetNum, 0), 1) : 0;
                        return { category, budget: budgetNum, spent: Math.max(spent, 0), remaining, progress };
                      })
                      .filter((r) => r.budget > 0)
                      .sort((a, b) => a.remaining - b.remaining)
                      .slice(0, 5)
                          .map((row) => (
                          <div key={row.category} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="font-medium capitalize">{row.category}</div>
                              <div className="tabular-nums text-muted-foreground">
                                {row.remaining >= 0 ? 'Left ' : 'Over '}
                                <SensitiveValue
                                  isRevealed={isSensitiveValuesVisible}
                                  value={formatCompactCurrency(Math.abs(row.remaining), baseCurrency)}
                                  hiddenLabel="Budget remaining by category"
                                  title={formatCurrency(row.remaining, baseCurrency)}
                                />
                              </div>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className={row.remaining < 0 ? 'h-full bg-rose-500' : 'h-full bg-emerald-500'}
                                style={{ width: `${Math.round(row.progress * 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                              <span>
                                Spent{' '}
                                <SensitiveValue
                                  isRevealed={isSensitiveValuesVisible}
                                  value={formatCompactCurrency(row.spent, baseCurrency)}
                                  hiddenLabel="Budget spent"
                                  title={formatCurrency(row.spent, baseCurrency)}
                                />
                              </span>
                              <span>
                                Budget{' '}
                                <SensitiveValue
                                  isRevealed={isSensitiveValuesVisible}
                                  value={formatCompactCurrency(row.budget, baseCurrency)}
                                  hiddenLabel="Total budget"
                                  title={formatCurrency(row.budget, baseCurrency)}
                                />
                              </span>
                            </div>
                          </div>
                        ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No budgets set yet. Add budgets to track daily category spending.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <DailyExpenseDialog
            open={transactionDialogOpen}
            onOpenChange={setTransactionDialogOpen}
            baseCurrency={baseCurrency}
            defaultDate={todayISO()}
            isPending={createTransactionMutation.isPending}
            onSubmit={(payload) => createTransactionMutation.mutate(payload)}
          />

          <div className="grid gap-4 md:grid-cols-2">
            {view === 'month' ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Income vs Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isSensitiveValuesVisible ? (
                      <ChartContainer config={incomeExpenseChartConfig} className="h-[240px] w-full sm:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart accessibilityLayer data={incomeVsExpensesData} margin={{ left: isMobile ? 0 : 8, right: 8 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} />
                            <YAxis hide={isMobile} tickLine={false} axisLine={false} />
                            <ChartTooltip
                              content={
                                <ChartTooltipContent
                                  formatter={(value) => formatCurrency(value as number, baseCurrency)}
                                  indicator="dot"
                                  hideLabel
                                />
                              }
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Bar dataKey="amount" fill="var(--color-income)" radius={6} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <PrivacyChartPlaceholder
                        title="Sensitive chart hidden"
                        description="Reveal sensitive values to view income and expense totals."
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Income Allocation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isSensitiveValuesVisible ? (
                      incomeAllocationData.some((item) => item.value > 0) ? (
                        <ChartContainer
                          config={allocationChartConfig}
                          className="h-[240px] w-full sm:h-[300px] [&_.recharts-pie-label-text]:hidden sm:[&_.recharts-pie-label-text]:block"
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={incomeAllocationData.map((d) => ({ ...d, fill: `var(--color-${d.name.toLowerCase()})` }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={isMobile ? 48 : 70}
                                outerRadius={isMobile ? 78 : 100}
                                paddingAngle={3}
                                dataKey="value"
                                nameKey="name"
                                label={isMobile ? false : ({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                              >
                                {incomeAllocationData.map((entry) => (
                                  <Cell key={entry.name} fill={`var(--color-${entry.name.toLowerCase()})`} />
                                ))}
                              </Pie>
                              <ChartTooltip
                                content={
                                  <ChartTooltipContent
                                    formatter={(value) => formatCurrency(value as number, baseCurrency)}
                                    indicator="dot"
                                  />
                                }
                              />
                              <ChartLegend content={<ChartLegendContent />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                          No allocation data to display
                        </div>
                      )
                    ) : (
                      <PrivacyChartPlaceholder
                        title="Sensitive chart hidden"
                        description="Reveal sensitive values to view the allocation breakdown."
                      />
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>YTD Monthly Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {!isSensitiveValuesVisible ? (
                    <PrivacyChartPlaceholder
                      title="Sensitive chart hidden"
                      description="Reveal sensitive values to view the monthly trend."
                    />
                  ) : trendsLoading ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">Loading trends…</div>
                  ) : trends.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">No trend data yet</div>
                  ) : (
                    <ChartContainer config={incomeExpenseChartConfig} className="h-[260px] w-full sm:h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart accessibilityLayer data={trends} margin={{ left: isMobile ? 0 : 8, right: 8 }}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                          <YAxis hide={isMobile} tickLine={false} axisLine={false} />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) => formatCurrency(value as number, baseCurrency)}
                                indicator="dot"
                              />
                            }
                          />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Line type="monotone" dataKey="totalIncome" stroke="var(--color-income)" strokeWidth={2} dot={false} />
                          <Line
                            type="monotone"
                            dataKey="totalRecurringExpenses"
                            stroke="var(--color-expenses)"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line type="monotone" dataKey="totalDailySpend" stroke="var(--color-savings)" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Page-specific breakdown charts are shown on their respective pages */}
          </div>
        </>
      )}
    </div>
  );
}
