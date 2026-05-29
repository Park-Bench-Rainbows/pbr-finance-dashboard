'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { MobileRowCard } from '@/components/ui/mobile-row-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type CurrencyCode, type Loan, type LoanPayload, type LoanRepaymentPayload } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';

const currencies: { value: CurrencyCode; label: string }[] = [
  { value: 'TTD', label: 'TTD' },
  { value: 'USD', label: 'USD' },
  { value: 'CAD', label: 'CAD' },
];

const statusVariants: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  active: 'info',
  partially_paid: 'warning',
  paid: 'teal',
  overdue: 'danger',
  written_off: 'purple',
  cancelled: 'default',
};

const formatCurrency = (amount: number, currency: CurrencyCode) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const formatISODate = (value?: string) => {
  if (!value) return 'No date';
  const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
};

const statusLabel = (status: string) =>
  status.replaceAll('_', ' ').replace(/\b\w/g, (s) => s.toUpperCase());

const outstandingByBorrowerChartConfig = {
  outstanding: { label: 'Outstanding', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export default function LoansPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const [repayingLoan, setRepayingLoan] = useState<Loan | null>(null);
  const [formData, setFormData] = useState({
    borrowerName: '',
    description: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    loanDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    notes: '',
  });
  const [repaymentData, setRepaymentData] = useState({
    amount: '',
    currency: 'TTD' as CurrencyCode,
    repaymentDate: new Date().toISOString().slice(0, 10),
    description: '',
  });

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const loansQuery = useQuery({ queryKey: queryKeys.loans, queryFn: api.loans });
  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const loans = loansQuery.data ?? [];
  const outstandingByBorrowerData = useMemo(
    () =>
      [...loans]
        .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
        .slice(0, 6)
        .map((loan) => ({
          borrowerName: loan.borrowerName,
          outstanding: loan.outstandingAmount,
        })),
    [loans]
  );

  const createMutation = useMutation({
    mutationFn: (payload: LoanPayload) => api.createLoan(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.loans });
      setDialogOpen(false);
      resetCreateForm();
    },
  });

  const repaymentMutation = useMutation({
    mutationFn: ({ loanId, payload }: { loanId: string; payload: LoanRepaymentPayload }) =>
      api.recordLoanRepayment(loanId, payload),
    onSuccess: async (_loan, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.loans }),
        queryClient.invalidateQueries({ queryKey: queryKeys.loan(variables.loanId) }),
      ]);
      setRepaymentOpen(false);
      setRepayingLoan(null);
      resetRepaymentForm();
    },
  });

  const resetCreateForm = () => {
    setFormData({
      borrowerName: '',
      description: '',
      amount: '',
      currency: baseCurrency,
      loanDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      notes: '',
    });
  };

  const resetRepaymentForm = () => {
    setRepaymentData({
      amount: '',
      currency: baseCurrency,
      repaymentDate: new Date().toISOString().slice(0, 10),
      description: '',
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      borrowerName: formData.borrowerName,
      description: formData.description,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      loanDate: formData.loanDate,
      dueDate: formData.dueDate || undefined,
      notes: formData.notes || undefined,
    });
  };

  const handleOpenRepayment = (loan: Loan) => {
    setRepayingLoan(loan);
    setRepaymentData({
      amount: loan.outstandingAmount.toFixed(2),
      currency: baseCurrency,
      repaymentDate: new Date().toISOString().slice(0, 10),
      description: `Repayment from ${loan.borrowerName}`,
    });
    setRepaymentOpen(true);
  };

  const handleRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayingLoan) return;
    repaymentMutation.mutate({
      loanId: repayingLoan.id,
      payload: {
        amount: parseFloat(repaymentData.amount),
        currency: repaymentData.currency,
        repaymentDate: repaymentData.repaymentDate,
        description: repaymentData.description || undefined,
      },
    });
  };

  const columns = useMemo<ColumnDef<Loan>[]>(
    () => [
      {
        accessorKey: 'borrowerName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Borrower" />,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.borrowerName}</span>
            <span className="text-xs text-muted-foreground">{row.original.description}</span>
          </div>
        ),
      },
      {
        accessorKey: 'principalAmount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Original Amount" />,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{formatCurrency(row.original.basePrincipalAmount, baseCurrency)}</span>
            {row.original.originalCurrency !== baseCurrency ? (
              <span className="text-xs text-muted-foreground">
                Entered {formatCurrency(row.original.principalAmount, row.original.originalCurrency)}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'outstandingAmount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Outstanding" />,
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {formatCurrency(row.original.outstandingAmount, baseCurrency)}
          </span>
        ),
      },
      {
        accessorKey: 'dueDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" />,
        cell: ({ row }) => formatISODate(row.original.dueDate),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Badge variant={statusVariants[row.original.status] ?? 'default'}>{statusLabel(row.original.status)}</Badge>
        ),
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/loans/${row.original.id}`}>View</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenRepayment(row.original)}
              disabled={row.original.outstandingAmount <= 0}
            >
              <CircleDollarSign className="h-4 w-4" />
              Record repayment
            </Button>
          </div>
        ),
      },
    ],
    [baseCurrency]
  );

  if (loansQuery.isLoading) {
    return <PageLoading variant="table" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loans</h1>
          <p className="text-sm text-muted-foreground">Track money you lent out and repayments coming back in.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetCreateForm}>
              <Plus className="h-4 w-4" />
              Add Loan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Loan</DialogTitle>
              <DialogDescription>Create a personal loan and record the cash outflow automatically.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="borrowerName">Borrower name</Label>
                  <Input
                    id="borrowerName"
                    value={formData.borrowerName}
                    onChange={(e) => setFormData({ ...formData, borrowerName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description / reason</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value as CurrencyCode })}
                    >
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="loanDate">Loan date</Label>
                    <Input
                      id="loanDate"
                      type="date"
                      value={formData.loanDate}
                      onChange={(e) => setFormData({ ...formData, loanDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due date (optional)</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createMutation.isPending} loadingText="Saving…">
                  <Save className="h-4 w-4" />
                  Create loan
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total lent</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {formatCurrency(loans.reduce((sum, loan) => sum + loan.basePrincipalAmount, 0), baseCurrency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {formatCurrency(loans.reduce((sum, loan) => sum + loan.outstandingAmount, 0), baseCurrency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Paid loans</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {loans.filter((loan) => loan.status === 'paid').length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding by borrower</CardTitle>
        </CardHeader>
        <CardContent>
          {outstandingByBorrowerData.length > 0 ? (
            <ChartContainer config={outstandingByBorrowerChartConfig} className="h-[280px] w-full sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart accessibilityLayer data={outstandingByBorrowerData} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="borrowerName"
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(value as number, baseCurrency)}
                        indicator="dot"
                      />
                    }
                  />
                  <Bar dataKey="outstanding" fill="var(--color-outstanding)" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground">No loan balances to display</div>
          )}
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={loans}
        searchPlaceholder="Search loans..."
        emptyMessage="No loans yet. Add your first loan to start tracking repayments."
        mobileCard={(loan) => (
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{loan.borrowerName}</div>
                <div className="mt-1 text-xs text-muted-foreground">{loan.description}</div>
              </div>
              <div className="shrink-0 text-right font-semibold tabular-nums">
                {formatCurrency(loan.outstandingAmount, baseCurrency)}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <div>Original</div>
                <div className="font-medium text-foreground">{formatCurrency(loan.basePrincipalAmount, baseCurrency)}</div>
              </div>
              <div className="text-right">
                <div>Status</div>
                <Badge variant={statusVariants[loan.status] ?? 'default'}>{statusLabel(loan.status)}</Badge>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="outline" className="flex-1" asChild>
                <Link href={`/loans/${loan.id}`}>View</Link>
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => handleOpenRepayment(loan)}
                disabled={loan.outstandingAmount <= 0}
              >
                <CircleDollarSign className="h-4 w-4" />
                Repay
              </Button>
            </div>
          </div>
        )}
      />

      <Dialog open={repaymentOpen} onOpenChange={setRepaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record repayment</DialogTitle>
            <DialogDescription>
              {repayingLoan ? `Record a repayment for ${repayingLoan.borrowerName}.` : 'Record a repayment.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRepayment}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="repaymentAmount">Amount</Label>
                <Input
                  id="repaymentAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={repaymentData.amount}
                  onChange={(e) => setRepaymentData({ ...repaymentData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repaymentCurrency">Currency</Label>
                <Select
                  value={repaymentData.currency}
                  onValueChange={(value) => setRepaymentData({ ...repaymentData, currency: value as CurrencyCode })}
                >
                  <SelectTrigger id="repaymentCurrency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Outstanding: {repayingLoan ? formatCurrency(repayingLoan.outstandingAmount, baseCurrency) : '0.00'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="repaymentDate">Repayment date</Label>
                <Input
                  id="repaymentDate"
                  type="date"
                  value={repaymentData.repaymentDate}
                  onChange={(e) => setRepaymentData({ ...repaymentData, repaymentDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repaymentDescription">Description (optional)</Label>
                <Input
                  id="repaymentDescription"
                  value={repaymentData.description}
                  onChange={(e) => setRepaymentData({ ...repaymentData, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRepaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={repaymentMutation.isPending} loadingText="Recording…">
                <CircleDollarSign className="h-4 w-4" />
                Record repayment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
