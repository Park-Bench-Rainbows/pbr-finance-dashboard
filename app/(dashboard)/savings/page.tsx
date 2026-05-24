'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const currencies: CurrencyCode[] = ['TTD', 'USD', 'CAD'];

const formatCurrency = (amount: number, currency: CurrencyCode) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

export default function SavingsPage() {
  const [plans, setPlans] = useState<SavingsPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsPlan | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');
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
    await Promise.all([fetchSettings(), fetchPlans()]);
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

    const payload = {
      name: formData.name,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      frequency: formData.frequency,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
    };

    try {
      const url = editing ? `/api/savings/${editing.id}` : '/api/savings';
      const method = editing ? 'PATCH' : 'POST';

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
                  <TableCell>{new Date(plan.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>{plan.endDate ? new Date(plan.endDate).toLocaleDateString() : 'Ongoing'}</TableCell>
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
