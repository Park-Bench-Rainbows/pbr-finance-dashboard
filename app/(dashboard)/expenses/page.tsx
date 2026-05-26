'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { TableActionButton } from '@/components/ui/table-action-button';
import { MobileRowCard } from '@/components/ui/mobile-row-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type CurrencyCode, type ExpenseCategory, type RecurringExpense, type RecurringExpensePayload } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useIsMobile } from '@/components/hooks/use-mobile';
type MonthlySummary = { expensesByCategory: Record<string, number> };

const n = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const currencies: { value: CurrencyCode; label: string }[] = [
  { value: 'TTD', label: 'TTD' },
  { value: 'USD', label: 'USD' },
  { value: 'CAD', label: 'CAD' },
];

const formatCurrency = (amount: number, currency: CurrencyCode) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

const formatISODate = (value: string) => {
  const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
};

const COLORS = ['#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#FACC15', '#A16207'];

const expensesCategoryChartConfig = {
  housing: { label: 'Housing', color: 'var(--chart-1)' },
  utilities: { label: 'Utilities', color: 'var(--chart-2)' },
  subscriptions: { label: 'Subscriptions', color: 'var(--chart-3)' },
  insurance: { label: 'Insurance', color: 'var(--chart-4)' },
  transportation: { label: 'Transportation', color: 'var(--chart-5)' },
  other: { label: 'Other', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const categories = [
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'other', label: 'Other' },
];

const categoryBadgeVariant: Record<string, React.ComponentProps<typeof Badge>["variant"]> = {
  housing: "teal",
  utilities: "warning",
  subscriptions: "purple",
  insurance: "info",
  transportation: "info",
  other: "default",
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    frequency: 'monthly' as 'monthly' | 'annual',
    category: 'other',
    startDate: '',
    endDate: '',
  });
  const isMobile = useIsMobile();

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const expensesQuery = useQuery({ queryKey: queryKeys.recurringExpenses, queryFn: api.recurringExpenses });
  const summaryQuery = useQuery({ queryKey: queryKeys.summary(currentMonth()), queryFn: () => api.summary(currentMonth()) });
  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const expenses = expensesQuery.data ?? [];
  const summary: MonthlySummary = { expensesByCategory: summaryQuery.data?.expensesByCategory ?? {} };

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: RecurringExpensePayload }) =>
      id ? api.updateRecurringExpense(id, payload) : api.createRecurringExpense(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.recurringExpenses });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRecurringExpense(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.recurringExpenses });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveMutation.isPending) return;

    const payload: RecurringExpensePayload = {
      name: formData.name,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      frequency: formData.frequency,
      category: formData.category as ExpenseCategory,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
    };

    saveMutation.mutate({ id: editingExpense?.id, payload });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    deleteMutation.mutate(id);
  };

  const handleEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setFormData({
      name: expense.name,
      amount: expense.originalAmount.toString(),
      currency: expense.originalCurrency,
      frequency: expense.frequency,
      category: expense.category,
      startDate: expense.startDate.split('T')[0],
      endDate: expense.endDate ? expense.endDate.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingExpense(null);
    setFormData({
      name: '',
      amount: '',
      currency: baseCurrency,
      frequency: 'monthly',
      category: 'other',
      startDate: '',
      endDate: '',
    });
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    resetForm();
  };

  const columns = useMemo<ColumnDef<RecurringExpense>[]>(
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
        accessorFn: (row) => categories.find((category) => category.value === row.category)?.label ?? row.category,
        id: 'category',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
        cell: ({ row }) => (
          <Badge variant={categoryBadgeVariant[row.original.category] ?? 'default'}>
            {categories.find((category) => category.value === row.original.category)?.label ?? row.original.category}
          </Badge>
        ),
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
              disabled={deleteMutation.isPending}
            />
            <TableActionButton
              label={`Delete ${row.original.name}`}
              icon={<Trash2 className="h-4 w-4" />}
              destructive
              onClick={() => handleDelete(row.original.id)}
              isLoading={deleteMutation.isPending && deleteMutation.variables === row.original.id}
            />
          </div>
        ),
      },
    ],
    [baseCurrency, deleteMutation.isPending, deleteMutation.variables]
  );

  if (expensesQuery.isLoading) {
    return <PageLoading variant="table" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Recurring Expenses</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
              <DialogDescription>
                {editingExpense ? 'Update your recurring expense' : 'Add a new recurring expense'}
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
                    onValueChange={(value) => setFormData({ ...formData, currency: value as CurrencyCode })}
                  >
                    <SelectTrigger>
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
                    Base currency: {baseCurrency}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, frequency: value as 'monthly' | 'annual' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
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
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saveMutation.isPending} loadingText={editingExpense ? 'Updating…' : 'Adding…'}>
                  <Save className="h-4 w-4" />
                  {editingExpense ? 'Update' : 'Add'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(summary.expensesByCategory ?? {}).length > 0 ? (
                <ChartContainer
                  config={expensesCategoryChartConfig}
                  className="h-[240px] w-full sm:h-[260px] [&_.recharts-pie-label-text]:hidden sm:[&_.recharts-pie-label-text]:block"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(summary.expensesByCategory).map(([category, amount]) => ({
                          name: categories.find((c) => c.value === category)?.label ?? category,
                          value: n(amount),
                          fill: `var(--color-${category})`,
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={isMobile ? 76 : 90}
                        dataKey="value"
                        labelLine={false}
                        label={isMobile ? false : ({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {Object.entries(summary.expensesByCategory).map(([category]) => (
                          <Cell
                            key={`exp-cat-${category}`}
                            fill={`var(--color-${category})`}
                          />
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
                  No expenses to display
                </div>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(summary.expensesByCategory ?? {}).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(summary.expensesByCategory)
                    .map(([category, amount]) => ({
                      category,
                      label: categories.find((c) => c.value === category)?.label ?? category,
                      amount: n(amount),
                    }))
                    .sort((a, b) => b.amount - a.amount)
                    .map((row, idx) => (
                      <div key={row.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="font-medium">{row.label}</span>
                        </div>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(row.amount, baseCurrency)}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="flex h-[260px] items-center justify-center text-muted-foreground">
                  No expenses to display
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        searchPlaceholder="Search recurring expenses..."
        emptyMessage="No expenses yet. Add your first one!"
        mobileCard={(expense) => (
          <MobileRowCard
            title={expense.name}
            amountNode={formatCurrency(expense.amount, baseCurrency)}
            contextNode={
              <Badge variant={categoryBadgeVariant[expense.category] ?? 'default'}>
                {categories.find((category) => category.value === expense.category)?.label ?? expense.category}
              </Badge>
            }
            metaItems={[
              { label: 'Frequency', value: <span className="capitalize">{expense.frequency}</span> },
              { label: 'Start', value: formatISODate(expense.startDate) },
            ]}
            secondaryText={
              expense.originalCurrency !== baseCurrency
                ? `Entered ${formatCurrency(expense.originalAmount, expense.originalCurrency)}`
                : null
            }
            editIcon={Pencil}
            deleteIcon={Trash2}
            onEdit={() => handleEdit(expense)}
            onDelete={() => handleDelete(expense.id)}
            editDisabled={deleteMutation.isPending}
            deleteLoading={deleteMutation.isPending && deleteMutation.variables === expense.id}
          />
        )}
      />
    </div>
  );
}
