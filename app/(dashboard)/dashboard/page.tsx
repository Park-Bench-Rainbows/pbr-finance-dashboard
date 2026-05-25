'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

interface MonthlySummary {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  totalDailySpend: number;
  remainingDisposable: number;
  disposableIncome: number;
  expensesByCategory: Record<string, number>;
  dailySpendByCategory: Record<string, number>;
  dailySpendByDay: { date: string; amount: number }[];
  budgetsByCategory: Record<string, number>;
  budgetRemainingByCategory: Record<string, number>;
}

type CurrencyCode = 'TTD' | 'USD' | 'CAD';
type DailyCategory = 'food' | 'gas' | 'coffee' | 'groceries' | 'dining' | 'transport' | 'other';

type DailyExpense = {
  id: string;
  description: string;
  category: DailyCategory;
  purchaseDate: string;
  amount: number; // base currency dollars
  baseCurrency: CurrencyCode;
  originalAmount: number;
  originalCurrency: CurrencyCode;
};

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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
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

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');
  const [todayExpenses, setTodayExpenses] = useState<DailyExpense[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);

  useEffect(() => {
    // Set current month as default
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    load();
  }, [selectedMonth]);

  const load = async () => {
    await Promise.all([fetchSettings(), fetchSummary(), fetchTodayExpenses()]);
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setBaseCurrency(data.baseCurrency as CurrencyCode);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/summary?month=${selectedMonth}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayExpenses = async () => {
    setTodayLoading(true);
    try {
      const res = await fetch(`/api/daily-expenses?date=${todayISO()}`);
      if (res.ok) setTodayExpenses(await res.json());
    } catch (error) {
      console.error('Error fetching today expenses:', error);
    } finally {
      setTodayLoading(false);
    }
  };

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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="w-64">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <Link
              href="/income"
              className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Go to Income"
            >
              <Card className="h-full flex flex-col border-white/10 dark:border-white/5 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent transition-colors hover:bg-emerald-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <div
                    className="text-2xl font-bold text-green-600 tabular-nums truncate"
                    title={formatCurrency(n(summary.totalIncome), baseCurrency)}
                  >
                    {formatCompactCurrency(n(summary.totalIncome), baseCurrency)}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              href="/expenses"
              className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Go to Expenses"
            >
              <Card className="h-full flex flex-col border-white/10 dark:border-white/5 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent transition-colors hover:bg-rose-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div
                    className="text-2xl font-bold text-red-600 tabular-nums truncate"
                    title={formatCurrency(n(summary.totalExpenses), baseCurrency)}
                  >
                    {formatCompactCurrency(n(summary.totalExpenses), baseCurrency)}
                  </div>

                  <div className="rounded-md border p-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Budget status</span>
                      {totalBudget > 0 ? (
                        <span className={isOverBudget ? 'text-red-600' : ''}>
                          {formatCompactCurrency(totalBudgetRemaining, baseCurrency)} left
                        </span>
                      ) : (
                        <span>Not set</span>
                      )}
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${isOverBudget ? 'bg-red-600' : 'bg-blue-600'}`}
                        style={{ width: `${Math.round(budgetProgress * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span title={formatCurrency(totalBudgetSpent, baseCurrency)}>
                        Spent {formatCompactCurrency(totalBudgetSpent, baseCurrency)}
                      </span>
                      <span title={formatCurrency(totalBudget, baseCurrency)}>
                        Budget {formatCompactCurrency(totalBudget, baseCurrency)}
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
              <Card className="h-full flex flex-col border-white/10 dark:border-white/5 bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent transition-colors hover:bg-blue-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <div
                    className="text-2xl font-bold text-blue-600 tabular-nums truncate"
                    title={formatCurrency(n(summary.totalSavings), baseCurrency)}
                  >
                    {formatCompactCurrency(n(summary.totalSavings), baseCurrency)}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              href="/daily-expenses"
              className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Go to Daily expenses"
            >
              <Card className="h-full flex flex-col border-white/10 dark:border-white/5 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent transition-colors hover:bg-amber-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Daily Spending</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <div
                    className="text-2xl font-bold text-amber-600 tabular-nums truncate"
                    title={formatCurrency(n(summary.totalDailySpend), baseCurrency)}
                  >
                    {formatCompactCurrency(n(summary.totalDailySpend), baseCurrency)}
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link
              href="/dashboard"
              className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Remaining disposable details"
            >
              <Card className="h-full flex flex-col border-white/10 dark:border-white/5 bg-gradient-to-br from-teal-500/15 via-teal-500/5 to-transparent transition-colors hover:bg-teal-500/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Remaining Disposable</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <div
                    className={`text-2xl font-bold tabular-nums truncate ${
                      n(summary.remainingDisposable) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                    title={formatCurrency(n(summary.remainingDisposable), baseCurrency)}
                  >
                    {formatCompactCurrency(n(summary.remainingDisposable), baseCurrency)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums truncate" title={formatCurrency(n(summary.disposableIncome), baseCurrency)}>
                    Planned: {formatCompactCurrency(n(summary.disposableIncome), baseCurrency)}
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Budget status is shown inline in the Expenses tile */}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Today</CardTitle>
                <Link href="/daily-expenses" className="text-sm text-muted-foreground hover:text-foreground">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {todayLoading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : todayExpenses.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No spending recorded today.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="font-semibold tabular-nums">
                        {formatCurrency(todayExpenses.reduce((s, r) => s + n(r.amount), 0), baseCurrency)}
                      </div>
                    </div>
                    <div className="divide-y rounded-lg border bg-background/40">
                      {todayExpenses.slice(0, 5).map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{row.description}</div>
                            <div className="mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground capitalize">
                              {row.category}
                            </div>
                          </div>
                          <div className="shrink-0 font-semibold tabular-nums" title={formatCurrency(n(row.amount), baseCurrency)}>
                            {formatCompactCurrency(n(row.amount), baseCurrency)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {todayExpenses.length > 5 && (
                      <div className="text-xs text-muted-foreground">And {todayExpenses.length - 5} more…</div>
                    )}
                  </div>
                )}
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
                            <div className="tabular-nums text-muted-foreground" title={formatCurrency(row.remaining, baseCurrency)}>
                              {row.remaining >= 0 ? 'Left ' : 'Over '}
                              {formatCompactCurrency(Math.abs(row.remaining), baseCurrency)}
                            </div>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={row.remaining < 0 ? 'h-full bg-rose-500' : 'h-full bg-emerald-500'}
                              style={{ width: `${Math.round(row.progress * 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                            <span title={formatCurrency(row.spent, baseCurrency)}>
                              Spent {formatCompactCurrency(row.spent, baseCurrency)}
                            </span>
                            <span title={formatCurrency(row.budget, baseCurrency)}>
                              Budget {formatCompactCurrency(row.budget, baseCurrency)}
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

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={incomeExpenseChartConfig} className="min-h-[300px] w-full">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart accessibilityLayer data={incomeVsExpensesData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis tickLine={false} axisLine={false} />
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Income Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                {incomeAllocationData.some((item) => item.value > 0) ? (
                  <ChartContainer config={allocationChartConfig} className="min-h-[300px] w-full">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={incomeAllocationData.map((d) => ({ ...d, fill: `var(--color-${d.name.toLowerCase()})` }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
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
                )}
              </CardContent>
            </Card>

            {/* Page-specific breakdown charts are shown on their respective pages */}
          </div>
        </>
      )}
    </div>
  );
}
