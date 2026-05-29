'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, CircleDollarSign, Plus, Save, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { MobileRowCard } from '@/components/ui/mobile-row-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type CurrencyCode, type Debt, type DebtAdjustmentPayload, type DebtPayload, type DebtPaymentPayload, type RecurringExpense } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

const currencies: CurrencyCode[] = ['TTD', 'USD', 'CAD'];
const debtTypes = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'car_loan', label: 'Car loan' },
  { value: 'bank_loan', label: 'Bank loan' },
  { value: 'student_loan', label: 'Student loan' },
  { value: 'personal_loan', label: 'Personal loan' },
  { value: 'buy_now_pay_later', label: 'Buy now, pay later' },
  { value: 'other', label: 'Other' },
] as const;
const paymentFrequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'custom', label: 'Custom' },
] as const;
const adjustmentCategories = [
  { value: 'interest_adjustment', label: 'Interest' },
  { value: 'fee_adjustment', label: 'Fee' },
  { value: 'balance_correction', label: 'Correction' },
  { value: 'new_charge', label: 'New charge' },
] as const;

const statusVariants: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  active: 'info',
  partially_paid: 'warning',
  paid: 'teal',
  overdue: 'danger',
  written_off: 'purple',
  cancelled: 'default',
};

const debtTypeLabel = (value: string) =>
  debtTypes.find((type) => type.value === value)?.label ?? value.replaceAll('_', ' ');

const formatCurrency = (amount: number, currency: CurrencyCode) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatISODate = (value?: string) => {
  if (!value) return 'No date';
  const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
};

const statusLabel = (status: string) =>
  status.replaceAll('_', ' ').replace(/\b\w/g, (s) => s.toUpperCase());

const progressPercent = (debt: Debt) => {
  const base = debt.originalAmount && debt.originalAmount > 0 ? debt.originalAmount : debt.originalAmount === undefined ? debt.currentBalance + debt.totalPaid : debt.originalAmount;
  if (!base || base <= 0) return 0;
  return Math.max(0, Math.min(1, (base - debt.currentBalance) / base));
};

export default function DebtsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [adjustmentDebt, setAdjustmentDebt] = useState<Debt | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    lenderName: '',
    debtType: 'credit_card' as Debt['debtType'],
    amount: '',
    currency: 'TTD' as CurrencyCode,
    interestRate: '',
    minimumPayment: '',
    paymentFrequency: 'monthly' as NonNullable<Debt['paymentFrequency']>,
    paymentDueDay: '',
    paymentDueDate: '',
    startDate: new Date().toISOString().slice(0, 10),
    targetPayoffDate: '',
    notes: '',
    createsCashInflow: false,
    linkedRecurringExpenseId: '__none__',
  });
  const [paymentData, setPaymentData] = useState({
    amount: '',
    currency: 'TTD' as CurrencyCode,
    paymentDate: new Date().toISOString().slice(0, 10),
    description: '',
    linkedRecurringExpenseId: '__none__',
  });
  const [adjustmentData, setAdjustmentData] = useState({
    amount: '',
    currency: 'TTD' as CurrencyCode,
    adjustmentDate: new Date().toISOString().slice(0, 10),
    category: 'interest_adjustment' as DebtAdjustmentPayload['category'],
    effect: 'increase' as DebtAdjustmentPayload['effect'],
    description: '',
    linkedRecurringExpenseId: '__none__',
  });

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const debtsQuery = useQuery({ queryKey: queryKeys.debts, queryFn: api.debts });
  const expensesQuery = useQuery({ queryKey: queryKeys.recurringExpenses, queryFn: api.recurringExpenses });
  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const debts = debtsQuery.data ?? [];
  const recurringExpenses = expensesQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: DebtPayload) => api.createDebt(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.debts });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
      setDialogOpen(false);
      resetCreateForm();
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ debtId, payload }: { debtId: string; payload: DebtPaymentPayload }) =>
      api.recordDebtPayment(debtId, payload),
    onSuccess: async (_debt, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.debts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.debt(variables.debtId) }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
      ]);
      setPaymentOpen(false);
      setPaymentDebt(null);
      resetPaymentForm();
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: ({ debtId, payload }: { debtId: string; payload: DebtAdjustmentPayload }) =>
      api.adjustDebtBalance(debtId, payload),
    onSuccess: async (_debt, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.debts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.debt(variables.debtId) }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
      ]);
      setAdjustmentOpen(false);
      setAdjustmentDebt(null);
      resetAdjustmentForm();
    },
  });

  const resetCreateForm = () => {
    setFormData({
      name: '',
      lenderName: '',
      debtType: 'credit_card',
      amount: '',
      currency: baseCurrency,
      interestRate: '',
      minimumPayment: '',
      paymentFrequency: 'monthly',
      paymentDueDay: '',
      paymentDueDate: '',
      startDate: new Date().toISOString().slice(0, 10),
      targetPayoffDate: '',
      notes: '',
      createsCashInflow: false,
      linkedRecurringExpenseId: '__none__',
    });
  };

  const resetPaymentForm = () => {
    setPaymentData({
      amount: paymentDebt ? paymentDebt.currentBalance.toFixed(2) : '',
      currency: baseCurrency,
      paymentDate: new Date().toISOString().slice(0, 10),
      description: paymentDebt ? `Payment for ${paymentDebt.name}` : '',
      linkedRecurringExpenseId: paymentDebt?.linkedRecurringExpenseId ?? '__none__',
    });
  };

  const resetAdjustmentForm = () => {
    setAdjustmentData({
      amount: adjustmentDebt ? Math.max(0, adjustmentDebt.minimumPayment ?? adjustmentDebt.currentBalance * 0.05).toFixed(2) : '',
      currency: baseCurrency,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      category: 'interest_adjustment',
      effect: 'increase',
      description: adjustmentDebt ? `Balance adjustment for ${adjustmentDebt.name}` : '',
      linkedRecurringExpenseId: adjustmentDebt?.linkedRecurringExpenseId ?? '__none__',
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: formData.name,
      lenderName: formData.lenderName,
      debtType: formData.debtType,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      interestRate: formData.interestRate ? parseFloat(formData.interestRate) : undefined,
      minimumPayment: formData.minimumPayment ? parseFloat(formData.minimumPayment) : undefined,
      paymentFrequency: formData.paymentFrequency,
      paymentDueDay: formData.paymentDueDay ? parseInt(formData.paymentDueDay, 10) : undefined,
      paymentDueDate: formData.paymentDueDate || undefined,
      startDate: formData.startDate,
      targetPayoffDate: formData.targetPayoffDate || undefined,
      notes: formData.notes || undefined,
      createsCashInflow: formData.createsCashInflow,
      linkedRecurringExpenseId: formData.linkedRecurringExpenseId === '__none__' ? undefined : formData.linkedRecurringExpenseId,
    });
  };

  const openPayment = useCallback(
    (debt: Debt) => {
      setPaymentDebt(debt);
      setPaymentData({
        amount: debt.currentBalance.toFixed(2),
        currency: baseCurrency,
        paymentDate: new Date().toISOString().slice(0, 10),
        description: `Payment for ${debt.name}`,
        linkedRecurringExpenseId: debt.linkedRecurringExpenseId ?? '__none__',
      });
      setPaymentOpen(true);
    },
    [baseCurrency]
  );

  const openAdjustment = useCallback(
    (debt: Debt) => {
      setAdjustmentDebt(debt);
      setAdjustmentData({
        amount: Math.max(0, debt.minimumPayment ?? debt.currentBalance * 0.05).toFixed(2),
        currency: baseCurrency,
        adjustmentDate: new Date().toISOString().slice(0, 10),
        category: 'interest_adjustment',
        effect: 'increase',
        description: `Balance adjustment for ${debt.name}`,
        linkedRecurringExpenseId: debt.linkedRecurringExpenseId ?? '__none__',
      });
      setAdjustmentOpen(true);
    },
    [baseCurrency]
  );

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDebt) return;
    paymentMutation.mutate({
      debtId: paymentDebt.id,
      payload: {
        amount: parseFloat(paymentData.amount),
        currency: paymentData.currency,
        paymentDate: paymentData.paymentDate,
        description: paymentData.description || undefined,
        linkedRecurringExpenseId: paymentData.linkedRecurringExpenseId === '__none__' ? undefined : paymentData.linkedRecurringExpenseId,
      },
    });
  };

  const handleAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentDebt) return;
    adjustmentMutation.mutate({
      debtId: adjustmentDebt.id,
      payload: {
        amount: parseFloat(adjustmentData.amount),
        currency: adjustmentData.currency,
        adjustmentDate: adjustmentData.adjustmentDate,
        category: adjustmentData.category,
        effect: adjustmentData.effect,
        description: adjustmentData.description || undefined,
        linkedRecurringExpenseId: adjustmentData.linkedRecurringExpenseId === '__none__' ? undefined : adjustmentData.linkedRecurringExpenseId,
      },
    });
  };

  const columns = useMemo<ColumnDef<Debt>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Debt" />,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.lenderName}</span>
          </div>
        ),
      },
      {
        accessorKey: 'debtType',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => debtTypeLabel(row.original.debtType),
      },
      {
        accessorKey: 'currentBalance',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Current Balance" />,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold tabular-nums">{formatCurrency(row.original.currentBalance, baseCurrency)}</span>
            <span className="text-xs text-muted-foreground">
              Paid {formatCurrency(row.original.totalPaid, baseCurrency)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'minimumPayment',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Minimum Payment" />,
        cell: ({ row }) =>
          row.original.minimumPayment !== undefined
            ? formatCurrency(row.original.minimumPayment, baseCurrency)
            : 'Not set',
      },
      {
        accessorKey: 'paymentDueDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" />,
        cell: ({ row }) => formatISODate(row.original.paymentDueDate),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => <Badge variant={statusVariants[row.original.status] ?? 'default'}>{statusLabel(row.original.status)}</Badge>,
      },
      {
        accessorKey: 'progress',
        header: () => <span>Payoff Progress</span>,
        cell: ({ row }) => {
          const percent = progressPercent(row.original);
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(percent * 100)}%</span>
                <span className="tabular-nums">{formatCurrency(row.original.currentBalance, baseCurrency)} left</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent * 100}%` }} />
              </div>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/debts/${row.original.id}`}>View</Link>
            </Button>
            <Button type="button" size="sm" onClick={() => openPayment(row.original)} disabled={row.original.currentBalance <= 0}>
              <CircleDollarSign className="h-4 w-4" />
              Pay
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => openAdjustment(row.original)}>
              <SlidersHorizontal className="h-4 w-4" />
              Adjust
            </Button>
          </div>
        ),
      },
    ],
    [baseCurrency, openPayment, openAdjustment]
  );

  if (debtsQuery.isLoading || expensesQuery.isLoading) {
    return <PageLoading variant="table" />;
  }

  const totalOutstanding = debts.reduce((sum, debt) => sum + debt.currentBalance, 0);
  const totalPaid = debts.reduce((sum, debt) => sum + debt.totalPaid, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Debts</h1>
          <p className="text-sm text-muted-foreground">Track what you owe, record payments, and monitor payoff progress.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetCreateForm}>
              <Plus className="h-4 w-4" />
              Add Debt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Debt</DialogTitle>
              <DialogDescription>Create a debt record and optionally create a linked cash inflow transaction.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lenderName">Lender</Label>
                    <Input id="lenderName" value={formData.lenderName} onChange={(e) => setFormData({ ...formData, lenderName: e.target.value })} required />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="debtType">Type</Label>
                    <Select value={formData.debtType} onValueChange={(value) => setFormData({ ...formData, debtType: value as Debt['debtType'] })}>
                      <SelectTrigger id="debtType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {debtTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Current balance</Label>
                    <Input id="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value as CurrencyCode })}>
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start date</Label>
                    <Input id="startDate" type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} required />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="minimumPayment">Minimum payment</Label>
                    <Input id="minimumPayment" type="number" min="0" step="0.01" value={formData.minimumPayment} onChange={(e) => setFormData({ ...formData, minimumPayment: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interestRate">Interest rate %</Label>
                    <Input id="interestRate" type="number" min="0" step="0.01" value={formData.interestRate} onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="paymentFrequency">Payment frequency</Label>
                    <Select value={formData.paymentFrequency} onValueChange={(value) => setFormData({ ...formData, paymentFrequency: value as NonNullable<Debt['paymentFrequency']> })}>
                      <SelectTrigger id="paymentFrequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentFrequencies.map((frequency) => (
                          <SelectItem key={frequency.value} value={frequency.value}>
                            {frequency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentDueDate">Next due date</Label>
                    <Input id="paymentDueDate" type="date" value={formData.paymentDueDate} onChange={(e) => setFormData({ ...formData, paymentDueDate: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="paymentDueDay">Due day of month</Label>
                    <Input id="paymentDueDay" type="number" min="1" max="31" value={formData.paymentDueDay} onChange={(e) => setFormData({ ...formData, paymentDueDay: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetPayoffDate">Target payoff date</Label>
                    <Input id="targetPayoffDate" type="date" value={formData.targetPayoffDate} onChange={(e) => setFormData({ ...formData, targetPayoffDate: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedRecurringExpenseId">Linked recurring expense</Label>
                  <Select value={formData.linkedRecurringExpenseId} onValueChange={(value) => setFormData({ ...formData, linkedRecurringExpenseId: value })}>
                    <SelectTrigger id="linkedRecurringExpenseId">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {recurringExpenses.map((expense: RecurringExpense) => (
                        <SelectItem key={expense.id} value={expense.id}>
                          {expense.name} ({formatCurrency(expense.amount, expense.baseCurrency)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="createsCashInflow"
                    type="checkbox"
                    checked={formData.createsCashInflow}
                    onChange={(e) => setFormData({ ...formData, createsCashInflow: e.target.checked })}
                  />
                  <Label htmlFor="createsCashInflow">Create linked borrowed-funds inflow</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createMutation.isPending} loadingText="Saving…">
                  <Save className="h-4 w-4" />
                  Create debt
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{formatCurrency(totalOutstanding, baseCurrency)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total paid</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{formatCurrency(totalPaid, baseCurrency)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open debts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{debts.filter((debt) => debt.status !== 'paid').length}</CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={debts}
        searchPlaceholder="Search debts..."
        emptyMessage="No debts yet. Add your first debt to start tracking what you owe."
        mobileCard={(debt) => (
          <MobileRowCard
            title={debt.name}
            amountNode={formatCurrency(debt.currentBalance, baseCurrency)}
            contextNode={<Badge variant={statusVariants[debt.status] ?? 'default'}>{statusLabel(debt.status)}</Badge>}
            metaItems={[
              { label: 'Lender', value: debt.lenderName },
              { label: 'Type', value: debtTypeLabel(debt.debtType) },
            ]}
            secondaryText={debt.minimumPayment !== undefined ? `Minimum ${formatCurrency(debt.minimumPayment, baseCurrency)}` : 'No minimum payment set'}
            editIcon={CircleDollarSign}
            deleteIcon={BadgeDollarSign}
            onEdit={() => openPayment(debt)}
            onDelete={() => openAdjustment(debt)}
          />
        )}
      />

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>{paymentDebt ? `Record a payment for ${paymentDebt.name}.` : 'Record a debt payment.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayment}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Amount</Label>
                <Input id="paymentAmount" type="number" min="0" step="0.01" value={paymentData.amount} onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })} required />
                <p className="text-xs text-muted-foreground">
                  Current balance: {paymentDebt ? formatCurrency(paymentDebt.currentBalance, baseCurrency) : '0.00'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentCurrency">Currency</Label>
                <Select value={paymentData.currency} onValueChange={(value) => setPaymentData({ ...paymentData, currency: value as CurrencyCode })}>
                  <SelectTrigger id="paymentCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment date</Label>
                <Input id="paymentDate" type="date" value={paymentData.paymentDate} onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentRecurring">Recurring expense link</Label>
                <Select value={paymentData.linkedRecurringExpenseId} onValueChange={(value) => setPaymentData({ ...paymentData, linkedRecurringExpenseId: value })}>
                  <SelectTrigger id="paymentRecurring">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {recurringExpenses.map((expense: RecurringExpense) => (
                      <SelectItem key={expense.id} value={expense.id}>
                        {expense.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDescription">Description</Label>
                <Input id="paymentDescription" value={paymentData.description} onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={paymentMutation.isPending} loadingText="Recording…">
                <CircleDollarSign className="h-4 w-4" />
                Record payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust balance</DialogTitle>
            <DialogDescription>{adjustmentDebt ? `Adjust the balance for ${adjustmentDebt.name}.` : 'Adjust a debt balance.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjustment}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="adjustmentAmount">Amount</Label>
                <Input id="adjustmentAmount" type="number" min="0" step="0.01" value={adjustmentData.amount} onChange={(e) => setAdjustmentData({ ...adjustmentData, amount: e.target.value })} required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="adjustmentCurrency">Currency</Label>
                  <Select value={adjustmentData.currency} onValueChange={(value) => setAdjustmentData({ ...adjustmentData, currency: value as CurrencyCode })}>
                    <SelectTrigger id="adjustmentCurrency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adjustmentDate">Date</Label>
                  <Input id="adjustmentDate" type="date" value={adjustmentData.adjustmentDate} onChange={(e) => setAdjustmentData({ ...adjustmentData, adjustmentDate: e.target.value })} required />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="adjustmentCategory">Category</Label>
                  <Select value={adjustmentData.category} onValueChange={(value) => setAdjustmentData({ ...adjustmentData, category: value as DebtAdjustmentPayload['category'] })}>
                    <SelectTrigger id="adjustmentCategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {adjustmentCategories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adjustmentEffect">Effect</Label>
                  <Select value={adjustmentData.effect} onValueChange={(value) => setAdjustmentData({ ...adjustmentData, effect: value as DebtAdjustmentPayload['effect'] })}>
                    <SelectTrigger id="adjustmentEffect">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="increase">Increase balance</SelectItem>
                      <SelectItem value="decrease">Decrease balance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustmentRecurring">Recurring expense link</Label>
                <Select value={adjustmentData.linkedRecurringExpenseId} onValueChange={(value) => setAdjustmentData({ ...adjustmentData, linkedRecurringExpenseId: value })}>
                  <SelectTrigger id="adjustmentRecurring">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {recurringExpenses.map((expense: RecurringExpense) => (
                      <SelectItem key={expense.id} value={expense.id}>
                        {expense.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustmentDescription">Description</Label>
                <Input id="adjustmentDescription" value={adjustmentData.description} onChange={(e) => setAdjustmentData({ ...adjustmentData, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustmentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={adjustmentMutation.isPending} loadingText="Adjusting…">
                <SlidersHorizontal className="h-4 w-4" />
                Adjust balance
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
