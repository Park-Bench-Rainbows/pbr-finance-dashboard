'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

interface Expense {
  id: string;
  name: string;
  amount: number;
  baseCurrency: 'TTD' | 'USD' | 'CAD';
  originalAmount: number;
  originalCurrency: 'TTD' | 'USD' | 'CAD';
  frequency: 'monthly' | 'annual';
  category: string;
  startDate: string;
  endDate?: string;
}

type CurrencyCode = 'TTD' | 'USD' | 'CAD';
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
  housing: "info",
  utilities: "warning",
  subscriptions: "purple",
  insurance: "teal",
  transportation: "success",
  other: "default",
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');
  const [summary, setSummary] = useState<MonthlySummary>({ expensesByCategory: {} });
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    currency: 'TTD' as CurrencyCode,
    frequency: 'monthly' as 'monthly' | 'annual',
    category: 'other',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    await Promise.all([fetchSettings(), fetchExpenses(), fetchSummary()]);
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

  const fetchExpenses = async () => {
    try {
      const response = await fetch('/api/expenses');
      if (response.ok) {
        const data = await response.json();
        setExpenses(data);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const month = currentMonth();
      const response = await fetch(`/api/summary?month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setSummary({ expensesByCategory: data.expensesByCategory ?? {} });
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      frequency: formData.frequency,
      category: formData.category,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
    };

    try {
      const url = editingExpense ? `/api/expenses/${editingExpense.id}` : '/api/expenses';
      const method = editingExpense ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        fetchExpenses();
        setDialogOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchExpenses();
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const handleEdit = (expense: Expense) => {
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

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Recurring Expenses</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>Add Expense</Button>
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
                <Button type="submit">{editingExpense ? 'Update' : 'Add'}</Button>
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
                <ChartContainer config={expensesCategoryChartConfig} className="min-h-[260px] w-full">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={Object.entries(summary.expensesByCategory).map(([category, amount]) => ({
                          name: categories.find((c) => c.value === category)?.label ?? category,
                          value: n(amount),
                          fill: `var(--color-${category})`,
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
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

      {expenses.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No expenses yet. Add your first one!</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{formatCurrency(expense.amount, baseCurrency)}</span>
                      {expense.originalCurrency !== baseCurrency && (
                        <span className="text-xs text-muted-foreground">
                          Entered {formatCurrency(expense.originalAmount, expense.originalCurrency)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{expense.frequency}</TableCell>
                  <TableCell>
                    <Badge variant={categoryBadgeVariant[expense.category] ?? 'default'}>
                      {categories.find((c) => c.value === expense.category)?.label ?? expense.category}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatISODate(expense.startDate)}</TableCell>
                  <TableCell>
                    {expense.endDate ? formatISODate(expense.endDate) : 'Ongoing'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(expense)}
                      className="mr-2"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(expense.id)}
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
