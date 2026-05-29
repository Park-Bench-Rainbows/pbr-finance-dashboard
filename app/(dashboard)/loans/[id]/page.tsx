'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { MobileRowCard } from '@/components/ui/mobile-row-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type CurrencyCode, type LoanRepaymentPayload, type LoanTransaction } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

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

export default function LoanDetailPage() {
  const params = useParams() as { id?: string | string[] };
  const loanId = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  const queryClient = useQueryClient();
  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const [repaymentData, setRepaymentData] = useState({
    amount: '',
    currency: 'TTD' as CurrencyCode,
    repaymentDate: new Date().toISOString().slice(0, 10),
    description: '',
  });

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const loanQuery = useQuery({
    queryKey: queryKeys.loan(loanId),
    queryFn: () => api.loan(loanId),
    enabled: Boolean(loanId),
  });
  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const loan = loanQuery.data ?? null;
  const originationTransaction = loan?.transactions?.find((tx) => tx.direction === 'outflow') ?? null;

  const repaymentMutation = useMutation({
    mutationFn: (payload: LoanRepaymentPayload) => api.recordLoanRepayment(loanId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.loan(loanId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.loans }),
      ]);
      setRepaymentOpen(false);
      resetRepaymentForm();
    },
  });

  const resetRepaymentForm = () => {
    setRepaymentData({
      amount: loan?.outstandingAmount ? loan.outstandingAmount.toFixed(2) : '',
      currency: baseCurrency,
      repaymentDate: new Date().toISOString().slice(0, 10),
      description: loan ? `Repayment from ${loan.borrowerName}` : '',
    });
  };

  const openRepaymentDialog = () => {
    resetRepaymentForm();
    setRepaymentOpen(true);
  };

  const handleRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;
    repaymentMutation.mutate({
      amount: parseFloat(repaymentData.amount),
      currency: repaymentData.currency,
      repaymentDate: repaymentData.repaymentDate,
      description: repaymentData.description || undefined,
    });
  };

  const transactions = loan?.transactions ?? [];

  const columns = useMemo<ColumnDef<LoanTransaction>[]>(
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
        accessorKey: 'direction',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <Badge variant={row.original.direction === 'inflow' ? 'teal' : 'warning'}>
            {row.original.direction === 'inflow' ? 'Repayment' : 'Loan outflow'}
          </Badge>
        ),
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {formatCurrency(row.original.amount, baseCurrency)}
          </span>
        ),
      },
    ],
    [baseCurrency]
  );

  if (loanQuery.isLoading || settingsQuery.isLoading) {
    return <PageLoading variant="table" />;
  }

  if (!loan) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/loans">
            <ArrowLeft className="h-4 w-4" />
            Back to loans
          </Link>
        </Button>
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">Loan not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button variant="outline" asChild className="w-fit">
            <Link href="/loans">
              <ArrowLeft className="h-4 w-4" />
              Back to loans
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{loan.borrowerName}</h1>
            <p className="text-sm text-muted-foreground">{loan.description}</p>
          </div>
        </div>
        <Button onClick={openRepaymentDialog} disabled={loan.outstandingAmount <= 0}>
          <CircleDollarSign className="h-4 w-4" />
          Record repayment
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Original amount</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {formatCurrency(loan.basePrincipalAmount, baseCurrency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total repaid</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {formatCurrency(loan.amountRepaid, baseCurrency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {formatCurrency(loan.outstandingAmount, baseCurrency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Badge variant={statusVariants[loan.status] ?? 'default'}>{statusLabel(loan.status)}</Badge>
            <div className="mt-2 text-sm text-muted-foreground">Loan date: {formatISODate(loan.loanDate)}</div>
            <div className="text-sm text-muted-foreground">Due date: {formatISODate(loan.dueDate)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loan details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Borrower</div>
            <div className="font-medium">{loan.borrowerName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Original currency</div>
            <div className="font-medium">
              {formatCurrency(loan.principalAmount, loan.originalCurrency)} {loan.originalCurrency}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Base currency</div>
            <div className="font-medium">{loan.baseCurrency}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Notes</div>
            <div className="font-medium">{loan.notes ?? 'None'}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Origination transaction</div>
            {originationTransaction ? (
              <div className="space-y-1">
                <div className="font-medium">{originationTransaction.description}</div>
                <div className="text-xs text-muted-foreground">
                  {formatISODate(originationTransaction.transactionDate)} ·{' '}
                  {formatCurrency(originationTransaction.amount, baseCurrency)} ·{' '}
                  {originationTransaction.category === 'money_lent' ? 'Money lent' : originationTransaction.category}
                </div>
                <div className="text-xs text-muted-foreground">
                  Linked to this loan and included in cashflow, but excluded from core income/spending summaries.
                </div>
              </div>
            ) : (
              <div className="font-medium">Unavailable</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Repayment history</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={transactions}
            searchPlaceholder="Search transactions..."
            emptyMessage="No linked transactions yet."
            mobileCard={(tx) => (
              <MobileRowCard
                title={tx.description}
                amountNode={formatCurrency(tx.amount, baseCurrency)}
                contextNode={<span>{formatISODate(tx.transactionDate)}</span>}
                metaItems={[
                  { label: 'Type', value: tx.direction === 'inflow' ? 'Repayment' : 'Loan outflow' },
                  { label: 'Category', value: tx.category.replace('_', ' ') },
                ]}
                secondaryText={tx.originalCurrency !== baseCurrency ? `Entered ${formatCurrency(tx.originalAmount, tx.originalCurrency)}` : undefined}
              />
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={repaymentOpen} onOpenChange={setRepaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record repayment</DialogTitle>
            <DialogDescription>Record a repayment for {loan.borrowerName}.</DialogDescription>
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
                <p className="text-xs text-muted-foreground">
                  Outstanding: {formatCurrency(loan.outstandingAmount, baseCurrency)}
                </p>
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
                <Save className="h-4 w-4" />
                Record repayment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
