'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoading } from '@/components/ui/page-loading';

type CurrencyCode = 'TTD' | 'USD' | 'CAD';

interface SavingsPlan {
  id: string;
  name: string;
  amount: number; // base currency dollars
  baseCurrency: CurrencyCode;
  originalAmount: number;
  originalCurrency: CurrencyCode;
  frequency: 'monthly' | 'biweekly';
  startDate: string;
  endDate?: string;
}

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

const currencies: CurrencyCode[] = ['TTD', 'USD', 'CAD'];

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

export default function SavingsPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<SavingsPlan[]>([]);
  const [targets, setTargets] = useState<SavingsTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsPlan | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');
  const [targetsMonth, setTargetsMonth] = useState(currentMonth());
  const [contribDialogOpen, setContribDialogOpen] = useState(false);
  const [contribData, setContribData] = useState({
    description: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    transactionDate: new Date().toISOString().slice(0, 10),
    savingsTargetId: '__none__' as string,
  });
  const [whatIfTarget, setWhatIfTarget] = useState<SavingsTarget | null>(null);
  const [whatIfDialogOpen, setWhatIfDialogOpen] = useState(false);
  const [whatIfData, setWhatIfData] = useState({
    targetAmount: '',
    currency: 'TTD' as CurrencyCode,
    startDate: '',
    targetDate: '',
    factorInExistingPlans: false,
  });
  const [whatIfPreview, setWhatIfPreview] = useState<{ month: string; plannedBaseAmount: number }[] | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    frequency: 'monthly' as 'monthly' | 'biweekly',
    startDate: '',
    endDate: '',
  });
  const [goalData, setGoalData] = useState({
    goalName: '',
    targetAmount: '',
    currency: 'TTD' as CurrencyCode,
    startDate: '',
    targetDate: '',
    factorInExistingPlans: false,
  });
  const [goalPreview, setGoalPreview] = useState<{ month: string; plannedBaseAmount: number }[] | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    await Promise.all([fetchSettings(), fetchPlans(), fetchTargets()]);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const settings = await res.json();
      setBaseCurrency(settings.baseCurrency as CurrencyCode);
      setFormData((p) => ({ ...p, currency: settings.baseCurrency as CurrencyCode }));
      setGoalData((p) => ({ ...p, currency: settings.baseCurrency as CurrencyCode }));
    } catch {
      // ignore
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/savings');
      if (res.ok) {
        setPlans(await res.json());
      }
    } catch (e) {
      console.error('Error fetching savings plans:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTargets = async () => {
    try {
      const res = await fetch(`/api/savings-targets?month=${targetsMonth}`);
      if (res.ok) {
        setTargets(await res.json());
      }
    } catch (e) {
      console.error('Error fetching savings targets:', e);
    }
  };

  useEffect(() => {
    fetchTargets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsMonth]);

  const resetForm = () => {
    setEditing(null);
    setFormData({
      name: '',
      amount: '',
      currency: baseCurrency,
      frequency: 'monthly',
      startDate: '',
      endDate: '',
    });
  };

  const resetGoal = () => {
    setGoalPreview(null);
    setGoalData({
      goalName: '',
      targetAmount: '',
      currency: baseCurrency,
      startDate: '',
      targetDate: '',
      factorInExistingPlans: false,
    });
  };

  const handleEdit = (plan: SavingsPlan) => {
    setEditing(plan);
    setFormData({
      name: plan.name,
      amount: plan.originalAmount.toString(),
      currency: plan.originalCurrency,
      frequency: plan.frequency,
      startDate: plan.startDate.split('T')[0],
      endDate: plan.endDate ? plan.endDate.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this savings plan?')) return;

    try {
      const res = await fetch(`/api/savings/${id}`, { method: 'DELETE' });
      if (res.ok) fetchPlans();
    } catch (e) {
      console.error('Error deleting savings plan:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNumber = parseFloat(formData.amount);
    const amountCents = Number.isFinite(amountNumber) ? Math.round(amountNumber * 100) : NaN;

    const payload: Record<string, unknown> = {};

    if (!editing) {
      payload.name = formData.name;
      payload.amount = amountNumber;
      payload.currency = formData.currency;
      payload.frequency = formData.frequency;
      payload.startDate = formData.startDate;
      payload.endDate = formData.endDate || undefined;
    } else {
      if (formData.name !== editing.name) payload.name = formData.name;
      if (formData.frequency !== editing.frequency) payload.frequency = formData.frequency;
      if (formData.startDate !== editing.startDate.split('T')[0]) payload.startDate = formData.startDate;

      const editingEnd = editing.endDate ? editing.endDate.split('T')[0] : '';
      if ((formData.endDate || '') !== editingEnd) payload.endDate = formData.endDate || undefined;

      const editingAmountCents = Math.round(editing.originalAmount * 100);
      const moneyChanged =
        formData.currency !== editing.originalCurrency ||
        (Number.isFinite(amountCents) && amountCents !== editingAmountCents);

      if (moneyChanged) {
        payload.amount = amountNumber;
        payload.currency = formData.currency;
      }
    }

    try {
      const url = editing ? `/api/savings/${editing.id}` : '/api/savings';
      const method = editing ? 'PATCH' : 'POST';

      if (editing && Object.keys(payload).length === 0) {
        setDialogOpen(false);
        resetForm();
        return;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchPlans();
        setDialogOpen(false);
        resetForm();
      }
    } catch (err) {
      console.error('Error saving savings plan:', err);
    }
  };

  if (loading) return <div>Loading...</div>;

  if (loading) {
    return <PageLoading variant="table" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Savings Plans</h1>
        <div className="flex gap-2">
          <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={resetGoal}>Create Goal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Savings Goal</DialogTitle>
                <DialogDescription>
                  Save a target amount by a date. We&apos;ll generate one or more savings plans automatically.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setGoalLoading(true);
                  try {
                    if (!goalPreview && goalData.factorInExistingPlans) {
                      const res = await fetch('/api/savings/goals', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          ...goalData,
                          targetAmount: parseFloat(goalData.targetAmount),
                          dryRun: true,
                        }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setGoalPreview(data.schedule ?? []);
                      }
                      return;
                    }

                    const res = await fetch('/api/savings/goals', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...goalData,
                        targetAmount: parseFloat(goalData.targetAmount),
                      }),
                    });
                    if (res.ok) {
                      await fetchPlans();
                      setGoalDialogOpen(false);
                      resetGoal();
                    }
                  } finally {
                    setGoalLoading(false);
                  }
                }}
              >
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="goalName">Goal name</Label>
                    <Input
                      id="goalName"
                      value={goalData.goalName}
                      onChange={(e) => setGoalData({ ...goalData, goalName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetAmount">Target amount</Label>
                    <Input
                      id="targetAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={goalData.targetAmount}
                      onChange={(e) => setGoalData({ ...goalData, targetAmount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goalCurrency">Currency</Label>
                    <Select
                      value={goalData.currency}
                      onValueChange={(v) => setGoalData({ ...goalData, currency: v as CurrencyCode })}
                    >
                      <SelectTrigger id="goalCurrency">
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
                    <Label htmlFor="goalStartDate">Start date</Label>
                    <Input
                      id="goalStartDate"
                      type="date"
                      value={goalData.startDate}
                      onChange={(e) => setGoalData({ ...goalData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goalTargetDate">Target date</Label>
                    <Input
                      id="goalTargetDate"
                      type="date"
                      value={goalData.targetDate}
                      onChange={(e) => setGoalData({ ...goalData, targetDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="factorInExistingPlans"
                      type="checkbox"
                      checked={goalData.factorInExistingPlans}
                      onChange={(e) => {
                        setGoalPreview(null);
                        setGoalData({ ...goalData, factorInExistingPlans: e.target.checked });
                      }}
                    />
                    <Label htmlFor="factorInExistingPlans">Factor in existing savings plans</Label>
                  </div>

                  {goalPreview && goalData.factorInExistingPlans && (
                    <div className="rounded-md border p-3">
                      <div className="text-sm font-medium mb-2">Preview</div>
                      <div className="space-y-1 text-sm">
                        {goalPreview.map((row) => (
                          <div key={row.month} className="flex items-center justify-between">
                            <span>{row.month}</span>
                            <span className="font-medium">{formatCurrency(row.plannedBaseAmount, baseCurrency)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setGoalDialogOpen(false); resetGoal(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={goalLoading}>
                    {goalLoading ? 'Working...' : goalPreview && goalData.factorInExistingPlans ? 'Create Plans' : goalData.factorInExistingPlans ? 'Preview' : 'Create Plan'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>Add Savings Plan</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Savings Plan' : 'Add Savings Plan'}</DialogTitle>
                <DialogDescription>
                  Plan how much you want to allocate to savings on a recurring schedule.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
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
                    <Select
                      value={formData.currency}
                      onValueChange={(v) => setFormData({ ...formData, currency: v as CurrencyCode })}
                    >
                      <SelectTrigger>
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
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(v) => setFormData({ ...formData, frequency: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date (optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">{editing ? 'Update' : 'Add'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {targets.length > 0 && (
        <div className="rounded-lg border bg-card text-card-foreground p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold">Savings Targets</div>
            <div className="flex items-center gap-2">
              <div className="w-56">
                <Select value={targetsMonth} onValueChange={setTargetsMonth}>
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
              <Dialog open={contribDialogOpen} onOpenChange={setContribDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => {
                    setContribData((p) => ({ ...p, currency: baseCurrency, savingsTargetId: '__none__' }));
                  }}>
                    Add contribution
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add savings contribution</DialogTitle>
                    <DialogDescription>
                      Record an actual amount you moved into savings. Assign it to a target to track progress.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await fetch('/api/savings-transactions', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            description: contribData.description,
                            amount: parseFloat(contribData.amount),
                            currency: contribData.currency,
                            transactionDate: contribData.transactionDate,
                            savingsTargetId: contribData.savingsTargetId === '__none__' ? undefined : contribData.savingsTargetId,
                          }),
                        });
                        await fetchTargets();
                        setContribDialogOpen(false);
                        setContribData({
                          description: '',
                          amount: '',
                          currency: baseCurrency,
                          transactionDate: new Date().toISOString().slice(0, 10),
                          savingsTargetId: '__none__',
                        });
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="contrib-desc">Description</Label>
                        <Input
                          id="contrib-desc"
                          value={contribData.description}
                          onChange={(e) => setContribData({ ...contribData, description: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="contrib-amount">Amount</Label>
                          <Input
                            id="contrib-amount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={contribData.amount}
                            onChange={(e) => setContribData({ ...contribData, amount: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contrib-currency">Currency</Label>
                          <Select value={contribData.currency} onValueChange={(v) => setContribData({ ...contribData, currency: v as CurrencyCode })}>
                            <SelectTrigger id="contrib-currency">
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
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="contrib-date">Date</Label>
                          <Input
                            id="contrib-date"
                            type="date"
                            value={contribData.transactionDate}
                            onChange={(e) => setContribData({ ...contribData, transactionDate: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contrib-target">Target (optional)</Label>
                          <Select value={contribData.savingsTargetId} onValueChange={(v) => setContribData({ ...contribData, savingsTargetId: v })}>
                            <SelectTrigger id="contrib-target">
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {targets.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setContribDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Add</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {targets.map((t) => (
              <div key={t.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">{t.name}</div>
                  {t.status ? (
                    <Badge variant={t.status === 'on_track' ? 'success' : 'warning'}>
                      {t.status === 'on_track' ? 'On track' : 'Behind'}
                    </Badge>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground">
                  Target: {formatCurrency(t.targetAmount, baseCurrency)} by {formatISODate(t.targetDate)}
                </div>

                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <div>Actual to date</div>
                      <div className="font-semibold text-foreground tabular-nums">
                        {formatCurrency(n(t.actualToDate), baseCurrency)}
                      </div>
                    </div>
                    <div>
                      <div>Expected to date</div>
                      <div className="font-semibold text-foreground tabular-nums">
                        {formatCurrency(n(t.expectedToDate), baseCurrency)}
                      </div>
                    </div>
                    <div>
                      <div>Planned to date</div>
                      <div className="font-semibold text-foreground tabular-nums">
                        {formatCurrency(n(t.plannedToDate), baseCurrency)}
                      </div>
                    </div>
                    <div>
                      <div>Planned total</div>
                      <div className="font-semibold text-foreground tabular-nums">
                        {formatCurrency(n(t.plannedTotal), baseCurrency)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Actual progress</span>
                      <span>{(n(t.percentActualToDate)).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-emerald-600"
                        style={{ width: `${Math.min(100, Math.max(0, n(t.percentActualToDate)))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Start: {formatISODate(t.startDate)} | Factor in existing: {t.factorInExistingPlans ? 'Yes' : 'No'}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/savings/targets/${t.id}?month=${targetsMonth}`)}
                  >
                    View details
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/savings-targets/${t.id}/quick-contribute`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ month: targetsMonth }),
                        });
                        if (res.ok) await fetchTargets();
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Quick add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setWhatIfTarget(t);
                      setWhatIfPreview(null);
                      setWhatIfData({
                        targetAmount: String(t.targetAmount),
                        currency: baseCurrency,
                        startDate: t.startDate.split('T')[0],
                        targetDate: t.targetDate.split('T')[0],
                        factorInExistingPlans: t.factorInExistingPlans,
                      });
                      setWhatIfDialogOpen(true);
                    }}
                  >
                    What-if
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={whatIfDialogOpen} onOpenChange={setWhatIfDialogOpen}>
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
              if (!whatIfTarget) return;
              setWhatIfLoading(true);
              try {
                const res = await fetch('/api/savings/goals', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    goalName: whatIfTarget.name,
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
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
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
              <Button type="button" variant="outline" onClick={() => setWhatIfDialogOpen(false)}>
                Close
              </Button>
              <Button type="submit" disabled={whatIfLoading}>
                {whatIfLoading ? 'Working…' : 'Preview'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {plans.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No savings plans yet. Add your first one!</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{formatCurrency(plan.amount, baseCurrency)}</span>
                      {plan.originalCurrency !== baseCurrency && (
                        <span className="text-xs text-muted-foreground">
                          Entered {formatCurrency(plan.originalAmount, plan.originalCurrency)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{plan.frequency}</TableCell>
                  <TableCell>{formatISODate(plan.startDate)}</TableCell>
                  <TableCell>{plan.endDate ? formatISODate(plan.endDate) : 'Ongoing'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="mr-2" onClick={() => handleEdit(plan)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(plan.id)}
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
