'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Income {
  id: string;
  name: string;
  amount: number;
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  originalAmount: number;
  originalCurrency: 'TTD' | 'USD' | 'CAD';
  frequency: 'monthly' | 'biweekly';
  startDate: string;
  endDate?: string;
}

type CurrencyCode = 'TTD' | 'USD' | 'CAD';

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
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    frequency: 'monthly' as 'monthly' | 'biweekly',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    await Promise.all([fetchSettings(), fetchIncomes()]);
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setBaseCurrency(data.baseCurrency as CurrencyCode);
        setFormData((prev) => ({ ...prev, currency: data.baseCurrency as CurrencyCode }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchIncomes = async () => {
    try {
      const response = await fetch('/api/income');
      if (response.ok) {
        const data = await response.json();
        setIncomes(data);
      }
    } catch (error) {
      console.error('Error fetching incomes:', error);
    } finally {
      setLoading(false);
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
      const url = editingIncome ? `/api/income/${editingIncome.id}` : '/api/income';
      const method = editingIncome ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        fetchIncomes();
        setDialogOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving income:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this income?')) return;

    try {
      const response = await fetch(`/api/income/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchIncomes();
      }
    } catch (error) {
      console.error('Error deleting income:', error);
    }
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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Income Sources</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>Add Income</Button>
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
                <Button type="submit">{editingIncome ? 'Update' : 'Add'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {incomes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No income sources yet. Add your first one!</p>
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
              {incomes.map((income) => (
                <TableRow key={income.id}>
                  <TableCell className="font-medium">{income.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{formatCurrency(income.amount, baseCurrency)}</span>
                      {income.originalCurrency !== baseCurrency && (
                        <span className="text-xs text-muted-foreground">
                          Entered {formatCurrency(income.originalAmount, income.originalCurrency)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{income.frequency}</TableCell>
                  <TableCell>{formatISODate(income.startDate)}</TableCell>
                  <TableCell>
                    {income.endDate ? formatISODate(income.endDate) : 'Ongoing'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(income)}
                      className="mr-2"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(income.id)}
                      className="text-red-600 hover:text-red-700"
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
