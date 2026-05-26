'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, Eye, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { TableActionButton } from '@/components/ui/table-action-button';
import { MobileRowCard } from '@/components/ui/mobile-row-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type CurrencyCode, type SavingsPlan, type SavingsPlanPayload, type SavingsTarget } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

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

const clamp01 = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
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
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsPlan | null>(null);
  const [targetsMonth, setTargetsMonth] = useState(currentMonth());
  const [contribDialogOpen, setContribDialogOpen] = useState(false);
  const [contribData, setContribData] = useState({
    description: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    transactionDate: new Date().toISOString().slice(0, 10),
    savingsTargetId: '__none__' as string,
  });
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

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const plansQuery = useQuery({ queryKey: queryKeys.savingsPlans, queryFn: api.savingsPlans });
  const targetsQuery = useQuery({ queryKey: queryKeys.savingsTargets(targetsMonth), queryFn: () => api.savingsTargets(targetsMonth) });
  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const plans = plansQuery.data ?? [];
  const targets = targetsQuery.data ?? [];

  const focusedTargets = useMemo(() => {
    return [...targets]
      .sort((a, b) => {
        const aBehind = a.status === 'behind' ? 1 : 0;
        const bBehind = b.status === 'behind' ? 1 : 0;
        if (aBehind !== bBehind) return bBehind - aBehind;
        const aDue = new Date(a.targetDate).getTime();
        const bDue = new Date(b.targetDate).getTime();
        if (aDue !== bDue) return aDue - bDue;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 3);
  }, [targets]);

  const savePlanMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Partial<SavingsPlanPayload> }) =>
      id ? api.updateSavingsPlan(id, payload) : api.createSavingsPlan(payload as SavingsPlanPayload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => api.deleteSavingsPlan(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });

  const goalMutation = useMutation({
    mutationFn: ({ dryRun }: { dryRun: boolean }) =>
      api.savingsGoal({
        ...goalData,
        targetAmount: parseFloat(goalData.targetAmount),
        dryRun,
      }),
    onSuccess: async (data, variables) => {
      if (variables.dryRun) {
        setGoalPreview(data.schedule ?? []);
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans }),
        queryClient.invalidateQueries({ queryKey: queryKeys.savingsTargets(targetsMonth) }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
      ]);
      setGoalDialogOpen(false);
      resetGoal();
    },
  });

  const contributionMutation = useMutation({
    mutationFn: () =>
      api.createSavingsTransaction({
        description: contribData.description,
        amount: parseFloat(contribData.amount),
        currency: contribData.currency,
        transactionDate: contribData.transactionDate,
        savingsTargetId: contribData.savingsTargetId === '__none__' ? undefined : contribData.savingsTargetId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.savingsTargets(targetsMonth) }),
        queryClient.invalidateQueries({ queryKey: ['savings-transactions'] }),
      ]);
      setContribDialogOpen(false);
      setContribData({
        description: '',
        amount: '',
        currency: baseCurrency,
        transactionDate: new Date().toISOString().slice(0, 10),
        savingsTargetId: '__none__',
      });
    },
  });

  const quickAddTargetMutation = useMutation({
    mutationFn: (id: string) => api.quickContributeSavingsTarget(id, targetsMonth),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.savingsTargets(targetsMonth) }),
        queryClient.invalidateQueries({ queryKey: ['savings-transactions'] }),
      ]);
    },
  });

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
    deletePlanMutation.mutate(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNumber = parseFloat(formData.amount);
    const amountCents = Number.isFinite(amountNumber) ? Math.round(amountNumber * 100) : NaN;

    const payload: Partial<SavingsPlanPayload> = {};

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

    if (editing && Object.keys(payload).length === 0) {
      setDialogOpen(false);
      resetForm();
      return;
    }

    savePlanMutation.mutate({ id: editing?.id, payload });
  };

  const planColumns = useMemo<ColumnDef<SavingsPlan>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{formatCurrency(row.original.amount, baseCurrency)}</span>
            {row.original.originalCurrency !== baseCurrency && (
              <span className="text-xs text-muted-foreground">
                Entered {formatCurrency(row.original.originalAmount, row.original.originalCurrency)}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'frequency',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Frequency" />,
        cell: ({ row }) => <span className="capitalize">{row.original.frequency}</span>,
      },
      {
        accessorKey: 'startDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" />,
        cell: ({ row }) => formatISODate(row.original.startDate),
      },
      {
        accessorKey: 'endDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="End Date" />,
        cell: ({ row }) => (row.original.endDate ? formatISODate(row.original.endDate) : 'Ongoing'),
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <TableActionButton
              label={`Edit ${row.original.name}`}
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => handleEdit(row.original)}
            />
            <TableActionButton
              label={`Delete ${row.original.name}`}
              icon={<Trash2 className="h-4 w-4" />}
              destructive
              onClick={() => handleDelete(row.original.id)}
              isLoading={deletePlanMutation.isPending && deletePlanMutation.variables === row.original.id}
            />
          </div>
        ),
      },
    ],
    [baseCurrency, deletePlanMutation.isPending, deletePlanMutation.variables]
  );

  if (plansQuery.isLoading) {
    return <PageLoading variant="table" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Savings Plans</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={resetGoal}>
                <Plus className="h-4 w-4" />
                Create Goal
              </Button>
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
                  goalMutation.mutate({ dryRun: !goalPreview && goalData.factorInExistingPlans });
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
                  <Button type="submit" disabled={goalMutation.isPending}>
                    {goalData.factorInExistingPlans && !goalPreview ? <Eye className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {goalMutation.isPending ? 'Working...' : goalPreview && goalData.factorInExistingPlans ? 'Create Plans' : goalData.factorInExistingPlans ? 'Preview' : 'Create Plan'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4" />
                Add Savings Plan
              </Button>
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
                  <Button type="submit" disabled={savePlanMutation.isPending}>
                    <Save className="h-4 w-4" />
                    {savePlanMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Add'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {targets.length > 0 && (
        <div className="rounded-lg border bg-card text-card-foreground p-6 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-lg font-semibold">Savings Targets</div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
              <div className="w-full">
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
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setContribData((p) => ({ ...p, currency: baseCurrency, savingsTargetId: '__none__' }));
                    }}
                  >
                    <CircleDollarSign className="h-4 w-4" />
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
                      contributionMutation.mutate();
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
                      <div className="grid gap-3 sm:grid-cols-2">
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
                      <div className="grid gap-3 sm:grid-cols-2">
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
                      <Button type="submit" disabled={contributionMutation.isPending}>
                        <CircleDollarSign className="h-4 w-4" />
                        {contributionMutation.isPending ? 'Adding…' : 'Add'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => router.push(`/savings/targets?month=${targetsMonth}`)}
              >
                View all
              </Button>
            </div>
          </div>
          {/* <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => router.push(`/savings/targets?month=${targetsMonth}`)}
            >
              View all
            </Button>
          </div> */}

          {focusedTargets.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {focusedTargets.map((t) => {
                const percent = clamp01((t.percentActualToDate ?? 0) / 100);
                const statusLabel = t.status === 'behind' ? 'Behind' : t.status === 'on_track' ? 'On track' : null;
                return (
                  <div
                    key={t.id}
                    className="group relative cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md focus-within:shadow-md"
                    role="link"
                    tabIndex={0}
                    aria-label={`View details for ${t.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/savings/targets/${t.id}?month=${targetsMonth}`);
                      }
                    }}
                  >
                    <Link
                      href={`/savings/targets/${t.id}?month=${targetsMonth}`}
                      className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Open ${t.name}`}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{t.name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Due {formatISODate(t.targetDate)}</span>
                          {t.factorInExistingPlans ? <span className="rounded-md border bg-muted/30 px-1.5 py-0.5">Factors plans</span> : null}
                        </div>
                      </div>
                      {statusLabel ? (
                        <Badge variant={t.status === 'behind' ? 'warning' : 'info'}>
                          {statusLabel}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Actual to date</span>
                        <span className="tabular-nums">{Math.round(percent * 100)}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent * 100}%` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground">Actual</div>
                          <div className="mt-0.5 font-semibold tabular-nums">{formatCurrency(n(t.actualToDate), baseCurrency)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground">Expected</div>
                          <div className="mt-0.5 font-semibold tabular-nums">{formatCurrency(n(t.expectedToDate), baseCurrency)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 mt-4 flex items-center justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          quickAddTargetMutation.mutate(t.id);
                        }}
                        isLoading={quickAddTargetMutation.isPending && quickAddTargetMutation.variables === t.id}
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
          ) : (
            <div className="flex h-28 items-center justify-center rounded-lg border bg-card text-muted-foreground">
              No savings targets yet.
            </div>
          )}
        </div>
      )}

      <DataTable
        columns={planColumns}
        data={plans}
        searchPlaceholder="Search savings plans..."
        emptyMessage="No savings plans yet. Add your first one!"
        mobileCard={(plan) => (
          <MobileRowCard
            title={plan.name}
            amountNode={formatCurrency(plan.amount, baseCurrency)}
            contextNode={<span className="capitalize">{plan.frequency}</span>}
            metaItems={[
              { label: 'Start', value: formatISODate(plan.startDate) },
              { label: 'End', value: plan.endDate ? formatISODate(plan.endDate) : 'Ongoing' },
            ]}
            secondaryText={
              plan.originalCurrency !== baseCurrency
                ? `Entered ${formatCurrency(plan.originalAmount, plan.originalCurrency)}`
                : null
            }
            editIcon={Pencil}
            deleteIcon={Trash2}
            onEdit={() => handleEdit(plan)}
            onDelete={() => handleDelete(plan.id)}
            deleteLoading={deletePlanMutation.isPending && deletePlanMutation.variables === plan.id}
          />
        )}
      />
    </div>
  );
}
