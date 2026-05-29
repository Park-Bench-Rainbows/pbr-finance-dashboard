'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeDollarSign, CircleDollarSign, Repeat2, Save, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { MobileRowCard } from '@/components/ui/mobile-row-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type CurrencyCode, type DebtAdjustmentPayload, type DebtPaymentPayload, type DebtTransaction, type DebtPayoffPlanPayload, type RecurringExpense } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

const currencies: CurrencyCode[] = ['TTD', 'USD', 'CAD'];
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
  value.replaceAll('_', ' ').replace(/\b\w/g, (s) => s.toUpperCase());

const formatCurrency = (amount: number, currency: CurrencyCode) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatISODate = (value?: string) => {
  if (!value) return 'No date';
  const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
};

const statusLabel = (status: string) =>
  status.replaceAll('_', ' ').replace(/\b\w/g, (s) => s.toUpperCase());

const debtBurnDownChartConfig = {
  balance: { label: 'Balance', color: 'var(--chart-3)' },
  paid: { label: 'Paid', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export default function DebtDetailPage() {
  const params = useParams() as { id?: string | string[] };
  const debtId = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [payoffOpen, setPayoffOpen] = useState(false);
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
  const [payoffData, setPayoffData] = useState({
    targetPayoffDate: '',
    plannedMonthlyPayment: '',
    notes: '',
  });

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const debtQuery = useQuery({
    queryKey: queryKeys.debt(debtId),
    queryFn: () => api.debt(debtId),
    enabled: Boolean(debtId),
  });
  const expensesQuery = useQuery({ queryKey: queryKeys.recurringExpenses, queryFn: api.recurringExpenses });
  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const debt = debtQuery.data ?? null;
  const recurringExpenses = expensesQuery.data ?? [];
  const linkedRecurringExpense = debt?.linkedRecurringExpenseId
    ? recurringExpenses.find((expense) => expense.id === debt.linkedRecurringExpenseId) ?? null
    : null;
  const debtBurnDownData = useMemo(() => {
    if (!debt) return [];

    const transactions = [...(debt.transactions ?? [])].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );
    const paymentTotal = transactions
      .filter((tx) => tx.category === 'debt_payment')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const adjustmentNet = transactions
      .filter((tx) => tx.direction === 'adjustment')
      .reduce((sum, tx) => {
        if (tx.balanceEffect === 'increase') return sum + tx.amount;
        if (tx.balanceEffect === 'decrease') return sum - tx.amount;
        return sum;
      }, 0);

    const startingBalance = Math.max(debt.currentBalance + paymentTotal - adjustmentNet, 0);
    const points: { date: string; balance: number; paid: number }[] = [
      {
        date: debt.startDate,
        balance: startingBalance,
        paid: 0,
      },
    ];

    let balance = startingBalance;
    let paid = 0;
    for (const tx of transactions) {
      if (tx.category === 'debt_payment') {
        paid = Math.min(startingBalance, paid + tx.amount);
        balance = Math.max(0, balance - tx.amount);
      } else if (tx.balanceEffect === 'increase') {
        balance += tx.amount;
      } else if (tx.balanceEffect === 'decrease') {
        balance = Math.max(0, balance - tx.amount);
      }

      points.push({
        date: tx.transactionDate,
        balance,
        paid,
      });
    }

    return points;
  }, [debt]);

  const paymentMutation = useMutation({
    mutationFn: (payload: DebtPaymentPayload) => api.recordDebtPayment(debtId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.debt(debtId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.debts }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
      ]);
      setPaymentOpen(false);
      resetPaymentForm();
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: (payload: DebtAdjustmentPayload) => api.adjustDebtBalance(debtId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.debt(debtId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.debts }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
      ]);
      setAdjustmentOpen(false);
      resetAdjustmentForm();
    },
  });

  const payoffMutation = useMutation({
    mutationFn: (payload: DebtPayoffPlanPayload) => api.upsertDebtPayoffPlan(debtId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.debt(debtId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.debtPayoffPlan(debtId) }),
      ]);
      setPayoffOpen(false);
    },
  });

  const scheduledPaymentMutation = useMutation({
    mutationFn: () => api.applyScheduledDebtPayment(debtId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.debt(debtId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.debts }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
      ]);
    },
  });

  const resetPaymentForm = () => {
    setPaymentData({
      amount: debt?.currentBalance ? debt.currentBalance.toFixed(2) : '',
      currency: baseCurrency,
      paymentDate: new Date().toISOString().slice(0, 10),
      description: debt ? `Payment for ${debt.name}` : '',
      linkedRecurringExpenseId: debt?.linkedRecurringExpenseId ?? '__none__',
    });
  };

  const resetAdjustmentForm = () => {
    setAdjustmentData({
      amount: debt ? Math.max(0, debt.minimumPayment ?? debt.currentBalance * 0.05).toFixed(2) : '',
      currency: baseCurrency,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      category: 'interest_adjustment',
      effect: 'increase',
      description: debt ? `Balance adjustment for ${debt.name}` : '',
      linkedRecurringExpenseId: debt?.linkedRecurringExpenseId ?? '__none__',
    });
  };

  const resetPayoffForm = () => {
    setPayoffData({
      targetPayoffDate: debt?.targetPayoffDate ? debt.targetPayoffDate.split('T')[0] : '',
      plannedMonthlyPayment: debt?.payoffPlan?.plannedMonthlyPayment?.toString() ?? '',
      notes: debt?.payoffPlan?.notes ?? '',
    });
  };

  const openPayment = () => {
    resetPaymentForm();
    setPaymentOpen(true);
  };

  const openAdjustment = () => {
    resetAdjustmentForm();
    setAdjustmentOpen(true);
  };

  const openPayoff = () => {
    resetPayoffForm();
    setPayoffOpen(true);
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    paymentMutation.mutate({
      amount: parseFloat(paymentData.amount),
      currency: paymentData.currency,
      paymentDate: paymentData.paymentDate,
      description: paymentData.description || undefined,
      linkedRecurringExpenseId: paymentData.linkedRecurringExpenseId === '__none__' ? undefined : paymentData.linkedRecurringExpenseId,
    });
  };

  const handleAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    adjustmentMutation.mutate({
      amount: parseFloat(adjustmentData.amount),
      currency: adjustmentData.currency,
      adjustmentDate: adjustmentData.adjustmentDate,
      category: adjustmentData.category,
      effect: adjustmentData.effect,
      description: adjustmentData.description || undefined,
      linkedRecurringExpenseId: adjustmentData.linkedRecurringExpenseId === '__none__' ? undefined : adjustmentData.linkedRecurringExpenseId,
    });
  };

  const handlePayoff = (e: React.FormEvent) => {
    e.preventDefault();
    payoffMutation.mutate({
      targetPayoffDate: payoffData.targetPayoffDate,
      plannedMonthlyPayment: payoffData.plannedMonthlyPayment ? parseFloat(payoffData.plannedMonthlyPayment) : undefined,
      notes: payoffData.notes || undefined,
    });
  };

  const applyScheduledPayment = () => {
    scheduledPaymentMutation.mutate();
  };

  const columns = useMemo<ColumnDef<DebtTransaction>[]>(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
        cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
      },
      {
        accessorKey: 'transactionDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => formatISODate(row.original.transactionDate),
      },
      {
        accessorKey: 'category',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
        cell: ({ row }) => <Badge variant={row.original.category === 'debt_payment' ? 'teal' : 'warning'}>{row.original.category.replaceAll('_', ' ')}</Badge>,
      },
      {
        accessorKey: 'balanceEffect',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Effect" />,
        cell: ({ row }) => row.original.balanceEffect,
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
        cell: ({ row }) => <span className="font-semibold tabular-nums">{formatCurrency(row.original.amount, baseCurrency)}</span>,
      },
    ],
    [baseCurrency]
  );

  if (debtQuery.isLoading || expensesQuery.isLoading || settingsQuery.isLoading) {
    return <PageLoading variant="table" />;
  }

  if (!debt) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/debts">
            <ArrowLeft className="h-4 w-4" />
            Back to debts
          </Link>
        </Button>
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">Debt not found.</div>
      </div>
    );
  }

  const payoffBase = debt.originalAmount && debt.originalAmount > 0 ? debt.originalAmount : debt.currentBalance + debt.totalPaid;
  const progress = payoffBase > 0 ? Math.max(0, Math.min(1, (payoffBase - debt.currentBalance) / payoffBase)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="outline" asChild className="w-fit">
            <Link href="/debts">
              <ArrowLeft className="h-4 w-4" />
              Back to debts
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{debt.name}</h1>
            <p className="text-sm text-muted-foreground">{debt.lenderName} · {debtTypeLabel(debt.debtType)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openPayment} disabled={debt.currentBalance <= 0}>
            <CircleDollarSign className="h-4 w-4" />
            Record payment
          </Button>
          <Button variant="secondary" onClick={openAdjustment}>
            <SlidersHorizontal className="h-4 w-4" />
            Adjust balance
          </Button>
          {debt.linkedRecurringExpenseId ? (
            <Button variant="outline" onClick={applyScheduledPayment} isLoading={scheduledPaymentMutation.isPending} loadingText="Applying…">
              <Repeat2 className="h-4 w-4" />
              Apply scheduled payment
            </Button>
          ) : null}
          <Button variant="outline" onClick={openPayoff}>
            <BadgeDollarSign className="h-4 w-4" />
            Payoff target
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Original amount</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {debt.originalAmount !== undefined ? formatCurrency(debt.originalAmount, debt.originalCurrency ?? baseCurrency) : 'Not set'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current balance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{formatCurrency(debt.currentBalance, baseCurrency)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total paid</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{formatCurrency(debt.totalPaid, baseCurrency)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Badge variant={statusVariants[debt.status] ?? 'default'}>{statusLabel(debt.status)}</Badge>
            <div className="mt-2 text-sm text-muted-foreground">Start date: {formatISODate(debt.startDate)}</div>
            <div className="text-sm text-muted-foreground">Due date: {formatISODate(debt.paymentDueDate)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payoff progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{Math.round(progress * 100)}% complete</span>
            <span>{debt.targetPayoffDate ? `Target ${formatISODate(debt.targetPayoffDate)}` : 'No target set'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Minimum payment</div>
              <div className="font-medium">{debt.minimumPayment !== undefined ? formatCurrency(debt.minimumPayment, baseCurrency) : 'Not set'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Payment frequency</div>
              <div className="font-medium capitalize">{debt.paymentFrequency ?? 'Not set'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Linked recurring expense</div>
              <div className="font-medium">{linkedRecurringExpense ? `${linkedRecurringExpense.name} (${formatCurrency(linkedRecurringExpense.amount, linkedRecurringExpense.baseCurrency)})` : 'None'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Borrowed funds inflow</div>
              <div className="font-medium">{debt.createsCashInflow ? 'Created on debt opening' : 'Not created'}</div>
            </div>
          </div>
          {debt.payoffPlan ? (
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm font-medium">Payoff target</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Target date: {formatISODate(debt.payoffPlan.targetPayoffDate)}
              </div>
              <div className="text-sm text-muted-foreground">
                Planned monthly payment: {debt.payoffPlan.plannedMonthlyPayment !== undefined ? formatCurrency(debt.payoffPlan.plannedMonthlyPayment, baseCurrency) : 'Not set'}
              </div>
              {debt.payoffPlan.notes ? <div className="mt-2 text-sm text-muted-foreground">{debt.payoffPlan.notes}</div> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debt details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Lender</div>
            <div className="font-medium">{debt.lenderName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Debt type</div>
            <div className="font-medium">{debtTypeLabel(debt.debtType)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Original currency</div>
            <div className="font-medium">{debt.originalCurrency ?? 'Not provided'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Notes</div>
            <div className="font-medium">{debt.notes ?? 'None'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payoff burn-down</CardTitle>
        </CardHeader>
        <CardContent>
          {debtBurnDownData.length > 0 ? (
            <ChartContainer config={debtBurnDownChartConfig} className="h-[280px] w-full sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart accessibilityLayer data={debtBurnDownData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} tickFormatter={(value) => String(value).slice(5)} />
                  <YAxis hide={false} tickLine={false} axisLine={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(value as number, baseCurrency)}
                        indicator="dot"
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="paid" stroke="var(--color-paid)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground">No payoff history to display</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={debt.transactions ?? []}
            searchPlaceholder="Search transactions..."
            emptyMessage="No linked transactions yet."
            mobileCard={(tx) => (
              <MobileRowCard
                title={tx.description}
                amountNode={formatCurrency(tx.amount, baseCurrency)}
                contextNode={<Badge variant={tx.category === 'debt_payment' ? 'teal' : 'warning'}>{tx.category.replaceAll('_', ' ')}</Badge>}
                metaItems={[
                  { label: 'Date', value: formatISODate(tx.transactionDate) },
                  { label: 'Effect', value: tx.balanceEffect },
                ]}
                secondaryText={tx.linkedRecurringExpenseId ? 'Linked to recurring expense' : undefined}
              />
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>Record a payment for {debt.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayment}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Amount</Label>
                <Input id="paymentAmount" type="number" min="0" step="0.01" value={paymentData.amount} onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })} required />
                <p className="text-xs text-muted-foreground">Outstanding: {formatCurrency(debt.currentBalance, baseCurrency)}</p>
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
            <DialogDescription>Record a manual adjustment for {debt.name}.</DialogDescription>
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

      <Dialog open={payoffOpen} onOpenChange={setPayoffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payoff target</DialogTitle>
            <DialogDescription>Set or update a separate payoff plan for {debt.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePayoff}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="targetPayoffDate">Target payoff date</Label>
                <Input id="targetPayoffDate" type="date" value={payoffData.targetPayoffDate} onChange={(e) => setPayoffData({ ...payoffData, targetPayoffDate: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plannedMonthlyPayment">Planned monthly payment</Label>
                <Input id="plannedMonthlyPayment" type="number" min="0" step="0.01" value={payoffData.plannedMonthlyPayment} onChange={(e) => setPayoffData({ ...payoffData, plannedMonthlyPayment: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payoffNotes">Notes</Label>
                <Input id="payoffNotes" value={payoffData.notes} onChange={(e) => setPayoffData({ ...payoffData, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayoffOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={payoffMutation.isPending} loadingText="Saving…">
                <Save className="h-4 w-4" />
                Save payoff target
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
