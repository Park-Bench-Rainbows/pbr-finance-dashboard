'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CurrencyCode = 'TTD' | 'USD' | 'CAD';
type DailyCategory = 'food' | 'gas' | 'coffee' | 'groceries' | 'dining' | 'transport' | 'other';

interface DailyExpense {
  id: string;
  description: string;
  category: DailyCategory;
  purchaseDate: string;
  amount: number; // base currency dollars
  baseCurrency: CurrencyCode;
  originalAmount: number;
  originalCurrency: CurrencyCode;
}

const currencies: CurrencyCode[] = ['TTD', 'USD', 'CAD'];
const categories: { value: DailyCategory; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'gas', label: 'Gas' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'dining', label: 'Dining' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

const formatCurrency = (amount: number, currency: CurrencyCode) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DailyExpensesPage() {
  const [items, setItems] = useState<DailyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DailyExpense | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    category: 'other' as DailyCategory,
    purchaseDate: todayISO(),
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    await Promise.all([fetchSettings(), fetchItems()]);
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const settings = await res.json();
      setBaseCurrency(settings.baseCurrency as CurrencyCode);
      setFormData((p) => ({ ...p, currency: settings.baseCurrency as CurrencyCode }));
    } catch {
      // ignore
    }
  };

  const fetchItems = async () => {
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const res = await fetch(`/api/daily-expenses?month=${month}`);
      if (res.ok) setItems(await res.json());
    } catch (e) {
      console.error('Error fetching daily expenses:', e);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      description: '',
      amount: '',
      currency: baseCurrency,
      category: 'other',
      purchaseDate: todayISO(),
    });
  };

  const handleEdit = (item: DailyExpense) => {
    setEditing(item);
    setFormData({
      description: item.description,
      amount: item.originalAmount.toString(),
      currency: item.originalCurrency,
      category: item.category,
      purchaseDate: item.purchaseDate.split('T')[0],
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const res = await fetch(`/api/daily-expenses/${id}`, { method: 'DELETE' });
      if (res.ok) fetchItems();
    } catch (e) {
      console.error('Error deleting daily expense:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      category: formData.category,
      purchaseDate: formData.purchaseDate,
    };

    try {
      const url = editing ? `/api/daily-expenses/${editing.id}` : '/api/daily-expenses';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchItems();
        setDialogOpen(false);
        resetForm();
      }
    } catch (err) {
      console.error('Error saving daily expense:', err);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Daily Expenses</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>Add Daily Expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Daily Expense' : 'Add Daily Expense'}</DialogTitle>
              <DialogDescription>
                Track day-to-day spending. This reduces your remaining disposable income for the month.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">Purchase date</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">What was purchased?</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Cost</Label>
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
                  <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v as CurrencyCode })}>
                    <SelectTrigger id="currency">
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
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as DailyCategory })}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No daily expenses yet. Add your first one!</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{new Date(item.purchaseDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell className="capitalize">{item.category}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{formatCurrency(item.amount, baseCurrency)}</span>
                      {item.originalCurrency !== baseCurrency && (
                        <span className="text-xs text-muted-foreground">
                          Entered {formatCurrency(item.originalAmount, item.originalCurrency)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="mr-2" onClick={() => handleEdit(item)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(item.id)}
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

