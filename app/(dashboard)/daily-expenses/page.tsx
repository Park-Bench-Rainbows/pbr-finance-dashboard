'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { aggregateDailyTotals, heatBucket, monthGrid } from '@/lib/calendar-heatmap';
import { PageLoading } from '@/components/ui/page-loading';

type CurrencyCode = 'TTD' | 'USD' | 'CAD';
type DailyCategory = 'food' | 'gas' | 'coffee' | 'groceries' | 'dining' | 'transport' | 'other';
type MonthlySummary = {
  dailySpendByCategory: Record<string, number>;
  dailySpendByDay: { date: string; amount: number }[];
};

const n = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

interface DailyExpense {
  id: string;
  description: string;
  category: DailyCategory;
  purchaseDate: string;
  amount: number; // base currency dollars
  baseCurrency: CurrencyCode;
  originalAmount: number;
  originalCurrency: CurrencyCode;
}

const currencies: CurrencyCode[] = ['TTD', 'USD', 'CAD'];
const categories: { value: DailyCategory; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'gas', label: 'Gas' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'dining', label: 'Dining' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

const categoryBadgeVariant: Record<DailyCategory, React.ComponentProps<typeof Badge>["variant"]> = {
  food: "success",
  groceries: "success",
  dining: "warning",
  coffee: "warning",
  gas: "danger",
  transport: "info",
  other: "default",
};

const formatCurrency = (amount: number, currency: CurrencyCode) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatISODate = (value: string) => {
  const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
};

const COLORS = ['#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#FACC15', '#A16207'];

const dailyCategoryChartConfig = {
  food: { label: 'Food', color: 'var(--chart-1)' },
  gas: { label: 'Gas', color: 'var(--chart-2)' },
  coffee: { label: 'Coffee', color: 'var(--chart-3)' },
  groceries: { label: 'Groceries', color: 'var(--chart-4)' },
  dining: { label: 'Dining', color: 'var(--chart-5)' },
  transport: { label: 'Transport', color: 'var(--chart-2)' },
  other: { label: 'Other', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const dailyByDayChartConfig = {
  amount: { label: 'Amount', color: 'var(--chart-3)' },
} satisfies ChartConfig;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

export default function DailyExpensesPage() {
  const [items, setItems] = useState<DailyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DailyExpense | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    category: 'other' as DailyCategory,
    purchaseDate: todayISO(),
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [dayItems, setDayItems] = useState<DailyExpense[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // When month changes, refresh month data (and summary charts).
    fetchItems(month);
    fetchSummary(month);
    setSelectedDate(null);
    setDayOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const load = async () => {
    await Promise.all([fetchSettings(), fetchItems(month), fetchSummary(month)]);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const settings = await res.json();
      setBaseCurrency(settings.baseCurrency as CurrencyCode);
      setFormData((p) => ({ ...p, currency: settings.baseCurrency as CurrencyCode }));
    } catch {
      // ignore
    }
  };

  const fetchItems = async (monthValue: string) => {
    try {
      const res = await fetch(`/api/daily-expenses?month=${monthValue}`);
      if (res.ok) setItems(await res.json());
    } catch (e) {
      console.error('Error fetching daily expenses:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDayItems = async (dateISO: string) => {
    setDayLoading(true);
    try {
      const res = await fetch(`/api/daily-expenses?date=${dateISO}`);
      if (res.ok) setDayItems(await res.json());
    } catch (e) {
      console.error('Error fetching daily expenses for date:', e);
    } finally {
      setDayLoading(false);
    }
  };

  const fetchSummary = async (monthValue: string) => {
    try {
      const res = await fetch(`/api/summary?month=${monthValue}`);
      if (!res.ok) return;
      const data = await res.json();
      setSummary({
        dailySpendByCategory: data.dailySpendByCategory ?? {},
        dailySpendByDay: data.dailySpendByDay ?? [],
      });
    } catch (e) {
      console.error('Error fetching summary:', e);
    }
  };

  const refreshAfterMutation = async (dateISO?: string) => {
    await Promise.all([fetchItems(month), fetchSummary(month)]);
    if (dateISO) await fetchDayItems(dateISO);
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      description: '',
      amount: '',
      currency: baseCurrency,
      category: 'other',
      purchaseDate: todayISO(),
    });
  };

  const openAddForDate = (dateISO: string) => {
    resetForm();
    setFormData((p) => ({ ...p, purchaseDate: dateISO }));
    setDialogOpen(true);
  };

  const handleEdit = (item: DailyExpense) => {
    setEditing(item);
    setFormData({
      description: item.description,
      amount: item.originalAmount.toString(),
      currency: item.originalCurrency,
      category: item.category,
      purchaseDate: item.purchaseDate.split('T')[0],
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    if (deletingId) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/daily-expenses/${id}`, { method: 'DELETE' });
      if (res.ok) await refreshAfterMutation(selectedDate ?? undefined);
    } catch (e) {
      console.error('Error deleting daily expense:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const payload = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      category: formData.category,
      purchaseDate: formData.purchaseDate,
    };

    setSaving(true);
    try {
      const url = editing ? `/api/daily-expenses/${editing.id}` : '/api/daily-expenses';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await refreshAfterMutation(selectedDate ?? undefined);
        setDialogOpen(false);
        resetForm();
      }
    } catch (err) {
      console.error('Error saving daily expense:', err);
    } finally {
      setSaving(false);
    }
  };

  const today = todayISO();
  const totalsByDate = aggregateDailyTotals(items);
  const maxTotal = Math.max(0, ...Object.values(totalsByDate));
  const grid = monthGrid(month);
  const dayTotal = dayItems.reduce((sum, i) => sum + n(i.amount), 0);

  const heatClasses: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: 'bg-muted/30 hover:bg-muted/50',
    1: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    2: 'bg-emerald-500/20 hover:bg-emerald-500/25',
    3: 'bg-emerald-500/30 hover:bg-emerald-500/35',
    4: 'bg-emerald-500/40 hover:bg-emerald-500/45',
  };

  if (loading) {
    return <PageLoading variant="table" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Daily Expenses</h1>
        <div className="flex items-center gap-2">
          <div className="w-56">
            <Select value={month} onValueChange={setMonth}>
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>Add Daily Expense</Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Daily Expense' : 'Add Daily Expense'}</DialogTitle>
              <DialogDescription>
                Track day-to-day spending. This reduces your remaining disposable income for the month.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">Purchase date</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">What was purchased?</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Cost</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v as CurrencyCode })}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Base currency: {baseCurrency}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as DailyCategory })}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saving} loadingText={editing ? 'Updating…' : 'Adding…'}>
                  {editing ? 'Update' : 'Add'}
                </Button>
              </DialogFooter>
            </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center font-medium">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-2">
            {grid.map((week, wi) => (
              <div key={`week-${wi}`} className="grid grid-cols-7 gap-2">
                {week.map((cell, di) => {
                  if (!cell) return <div key={`empty-${wi}-${di}`} className="h-10" />;

                  const total = totalsByDate[cell.dateISO] ?? 0;
                  const bucket = heatBucket(total, maxTotal);
                  const isToday = cell.dateISO === today;

                  return (
                    <button
                      key={cell.dateISO}
                      type="button"
                      className={[
                        'h-10 rounded-md border text-left px-2 py-1 text-sm transition-colors',
                        heatClasses[bucket],
                        isToday ? 'ring-2 ring-emerald-500/40' : '',
                      ].join(' ')}
                      title={`${cell.dateISO} • ${formatCurrency(total, baseCurrency)}`}
                      onClick={async () => {
                        setSelectedDate(cell.dateISO);
                        setDayOpen(true);
                        await fetchDayItems(cell.dateISO);
                      }}
                      aria-label={`${cell.dateISO} total ${formatCurrency(total, baseCurrency)}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-medium">{cell.day}</span>
                        {total > 0 ? (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatCurrency(total, baseCurrency)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Sheet open={dayOpen} onOpenChange={setDayOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selectedDate ?? 'Day'}</SheetTitle>
            <SheetDescription>
              {selectedDate ? `Total: ${formatCurrency(dayTotal, baseCurrency)}` : 'Select a day to view entries.'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                onClick={() => {
                  if (!selectedDate) return;
                  openAddForDate(selectedDate);
                }}
                disabled={!selectedDate}
              >
                Add expense
              </Button>
            </div>

            {dayLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : dayItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">No expenses recorded for this day.</div>
            ) : (
              <div className="rounded-lg border bg-card text-card-foreground">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>
                          <Badge variant={categoryBadgeVariant[item.category]} className="capitalize">
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(item.amount, baseCurrency)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="mr-2" onClick={() => handleEdit(item)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(item.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <SheetFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDayOpen(false);
                setSelectedDate(null);
                setDayItems([]);
              }}
            >
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {summary && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Daily Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(summary.dailySpendByCategory ?? {}).length > 0 ? (
                <ChartContainer config={dailyCategoryChartConfig} className="min-h-[260px] w-full">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={Object.entries(summary.dailySpendByCategory).map(([cat, amt]) => ({
                          name: categories.find((c) => c.value === cat)?.label ?? cat,
                          value: n(amt),
                          fill: `var(--color-${cat})`,
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {Object.entries(summary.dailySpendByCategory).map(([cat]) => (
                          <Cell key={`daily-cat-${cat}`} fill={`var(--color-${cat})`} />
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
                <div className="flex h-[260px] items-center justify-center text-muted-foreground">
                  No daily spending to display
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Spending by Day</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.dailySpendByDay?.length ? (
                <ChartContainer config={dailyByDayChartConfig} className="min-h-[260px] w-full">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart accessibilityLayer data={summary.dailySpendByDay.map((d) => ({ ...d, amount: n(d.amount) }))}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(8)} tickLine={false} axisLine={false} tickMargin={10} />
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
                      <Bar dataKey="amount" fill="var(--color-amount)" radius={6} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex h-[260px] items-center justify-center text-muted-foreground">
                  No daily spending to display
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No daily expenses yet. Add your first one!</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatISODate(item.purchaseDate)}</TableCell>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell>
                    <Badge variant={categoryBadgeVariant[item.category] ?? 'default'}>
                      {categories.find((c) => c.value === item.category)?.label ?? item.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{formatCurrency(item.amount, baseCurrency)}</span>
                      {item.originalCurrency !== baseCurrency && (
                        <span className="text-xs text-muted-foreground">
                          Entered {formatCurrency(item.originalAmount, item.originalCurrency)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mr-2"
                      onClick={() => handleEdit(item)}
                      disabled={Boolean(deletingId)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(item.id)}
                      isLoading={deletingId === item.id}
                      loadingText="Deleting…"
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
