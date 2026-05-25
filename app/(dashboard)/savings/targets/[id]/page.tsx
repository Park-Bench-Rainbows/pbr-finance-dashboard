'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';

type CurrencyCode = 'TTD' | 'USD' | 'CAD';

interface SavingsTarget {
  id: string;
  name: string;
  baseCurrency: CurrencyCode;
  targetAmount: number;
  startDate: string;
  targetDate: string;
  factorInExistingPlans: boolean;
  plannedToDate?: number;
  plannedTotal?: number;
  percentPlannedToDate?: number;
  expectedToDate?: number;
  actualToDate?: number;
  percentActualToDate?: number;
  status?: 'on_track' | 'behind';
}

interface SavingsTargetMonthlyProgress {
  month: string;
  planned: number;
  actual: number;
  expected: number;
  plannedCum: number;
  actualCum: number;
  expectedCum: number;
}

interface SavingsTransaction {
  id: string;
  savingsTargetId?: string;
  description: string;
  transactionDate: string;
  amount: number; // base dollars
  baseCurrency: CurrencyCode;
}

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

  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(true);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');
  const [target, setTarget] = useState<SavingsTarget | null>(null);
  const [series, setSeries] = useState<SavingsTargetMonthlyProgress[]>([]);
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [quickAdding, setQuickAdding] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'preserve_contributions' | 'delete_contributions'>('preserve_contributions');
  const [deleting, setDeleting] = useState(false);

  const [contribOpen, setContribOpen] = useState(false);
  const [contribData, setContribData] = useState({
    description: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    transactionDate: new Date().toISOString().slice(0, 10),
  });

  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [whatIfData, setWhatIfData] = useState({
    targetAmount: '',
    currency: 'TTD' as CurrencyCode,
    startDate: '',
    targetDate: '',
    factorInExistingPlans: false,
  });
  const [whatIfPreview, setWhatIfPreview] = useState<{ month: string; plannedBaseAmount: number }[] | null>(null);

  const latestMonthRow = useMemo(() => {
    if (!series.length) return null;
    return series[series.length - 1];
  }, [series]);

  const plannedThisMonth = n(latestMonthRow?.planned);
  const actualThisMonth = n(latestMonthRow?.actual);
  const remainingThisMonth = Math.max(0, plannedThisMonth - actualThisMonth);

  const load = async () => {
    setLoading(true);
    try {
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setBaseCurrency(s.baseCurrency as CurrencyCode);
        setContribData((p) => ({ ...p, currency: s.baseCurrency as CurrencyCode }));
      }

      const targetsRes = await fetch(`/api/savings-targets?month=${month}`);
      if (targetsRes.ok) {
        const list = (await targetsRes.json()) as SavingsTarget[];
        setTarget(list.find((t) => t.id === targetId) ?? null);
      }

      const seriesRes = await fetch(`/api/savings-targets/${targetId}/progress?month=${month}`);
      if (seriesRes.ok) setSeries(await seriesRes.json());

      const txRes = await fetch(`/api/savings-transactions?month=${month}&savingsTargetId=${targetId}`);
      if (txRes.ok) setTransactions(await txRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, targetId]);

  const handleQuickAdd = async () => {
    setQuickAdding(true);
    try {
      const res = await fetch(`/api/savings-targets/${targetId}/quick-contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      if (res.ok) await load();
    } finally {
      setQuickAdding(false);
    }
  };

  const handleDeleteTarget = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/savings-targets/${targetId}?mode=${deleteMode}`, { method: 'DELETE' });
      if (res.ok) router.push('/savings');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  if (!target) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
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
              <Badge variant={target.status === 'on_track' ? 'default' : 'destructive'}>
                {target.status === 'on_track' ? 'On track' : 'Behind'}
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Target {formatCurrency(n(target.targetAmount), baseCurrency)} • {formatISODate(target.startDate)} → {formatISODate(target.targetDate)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-56">
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

      <div className="grid gap-4 md:grid-cols-4">
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
        <Button onClick={handleQuickAdd} disabled={quickAdding || remainingThisMonth <= 0}>
          {quickAdding ? 'Adding…' : 'Quick add'}
        </Button>

        <Dialog open={contribOpen} onOpenChange={setContribOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Add contribution</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add contribution</DialogTitle>
              <DialogDescription>Record an actual amount you moved into savings for this target.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await fetch('/api/savings-transactions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    description: contribData.description,
                    amount: parseFloat(contribData.amount),
                    currency: contribData.currency,
                    transactionDate: contribData.transactionDate,
                    savingsTargetId: targetId,
                  }),
                });
                setContribOpen(false);
                setContribData((p) => ({ ...p, description: '', amount: '' }));
                await load();
              }}
            >
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Input id="desc" value={contribData.description} onChange={(e) => setContribData({ ...contribData, description: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                <Button type="submit">Save</Button>
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
            <Button variant="outline">What-if</Button>
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
                setWhatIfLoading(true);
                try {
                  const res = await fetch('/api/savings/goals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      goalName: target.name,
                      targetAmount: parseFloat(whatIfData.targetAmount),
                      currency: whatIfData.currency,
                      startDate: whatIfData.startDate,
                      targetDate: whatIfData.targetDate,
                      factorInExistingPlans: whatIfData.factorInExistingPlans,
                      dryRun: true,
                    }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setWhatIfPreview(data.schedule ?? []);
                  }
                } finally {
                  setWhatIfLoading(false);
                }
              }}
            >
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
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
                <Button type="submit" disabled={whatIfLoading}>
                  {whatIfLoading ? 'Working…' : 'Preview'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">Delete goal</Button>
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
              <Button variant="destructive" onClick={handleDeleteTarget} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
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
          <ChartContainer config={targetSeriesChartConfig} className="min-h-[360px] w-full">
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={series} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tickLine={false} axisLine={false} />
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

          <div className="mt-4 rounded-lg border bg-card text-card-foreground">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">{r.month}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.planned, baseCurrency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.actual, baseCurrency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.expected, baseCurrency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contributions ({month})</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No contributions recorded for this month.</div>
          ) : (
            <div className="rounded-lg border bg-card text-card-foreground">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatISODate(t.transactionDate)}</TableCell>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(t.amount, baseCurrency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
