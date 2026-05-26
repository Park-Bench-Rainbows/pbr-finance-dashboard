'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { TableActionButton } from '@/components/ui/table-action-button';
import { MobileRowCard } from '@/components/ui/mobile-row-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type CurrencyCode, type Income, type IncomePayload } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

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

export default function IncomePage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    frequency: 'monthly' as 'monthly' | 'biweekly',
    startDate: '',
    endDate: '',
  });

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const incomesQuery = useQuery({ queryKey: queryKeys.incomes, queryFn: api.incomes });
  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const incomes = incomesQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: IncomePayload }) =>
      id ? api.updateIncome(id, payload) : api.createIncome(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.incomes });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteIncome(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.incomes });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveMutation.isPending) return;

    const payload: IncomePayload = {
      name: formData.name,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      frequency: formData.frequency,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
    };

    saveMutation.mutate({ id: editingIncome?.id, payload });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this income?')) return;
    deleteMutation.mutate(id);
  };

  const handleEdit = (income: Income) => {
    setEditingIncome(income);
    setFormData({
      name: income.name,
      amount: income.originalAmount.toString(),
      currency: income.originalCurrency,
      frequency: income.frequency,
      startDate: income.startDate.split('T')[0],
      endDate: income.endDate ? income.endDate.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingIncome(null);
    setFormData({
      name: '',
      amount: '',
      currency: baseCurrency,
      frequency: 'monthly',
      startDate: '',
      endDate: '',
    });
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    resetForm();
  };

  const columns = useMemo<ColumnDef<Income>[]>(
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

  if (incomesQuery.isLoading) {
    return <PageLoading variant="table" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Income Sources</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4" />
              Add Income
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingIncome ? 'Edit Income' : 'Add Income'}</DialogTitle>
              <DialogDescription>
                {editingIncome ? 'Update your income source' : 'Add a new income source'}
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
                      setFormData({ ...formData, frequency: value as 'monthly' | 'biweekly' })
                    }
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
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saveMutation.isPending} loadingText={editingIncome ? 'Updating…' : 'Adding…'}>
                  <Save className="h-4 w-4" />
                  {editingIncome ? 'Update' : 'Add'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={incomes}
        searchPlaceholder="Search income sources..."
        emptyMessage="No income sources yet. Add your first one!"
        mobileCard={(income) => (
          <MobileRowCard
            title={income.name}
            amountNode={formatCurrency(income.amount, baseCurrency)}
            contextNode={<span className="capitalize">{income.frequency}</span>}
            metaItems={[
              { label: 'Start', value: formatISODate(income.startDate) },
              { label: 'End', value: income.endDate ? formatISODate(income.endDate) : 'Ongoing' },
            ]}
            secondaryText={
              income.originalCurrency !== baseCurrency
                ? `Entered ${formatCurrency(income.originalAmount, income.originalCurrency)}`
                : null
            }
            editIcon={Pencil}
            deleteIcon={Trash2}
            onEdit={() => handleEdit(income)}
            onDelete={() => handleDelete(income.id)}
            editDisabled={deleteMutation.isPending}
            deleteLoading={deleteMutation.isPending && deleteMutation.variables === income.id}
          />
        )}
      />
    </div>
  );
}
