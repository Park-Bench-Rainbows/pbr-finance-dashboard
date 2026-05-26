'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { CurrencyCode, DailyCategory, DailyExpense, DailyExpensePayload } from '@/lib/api-client';

export const currencies: CurrencyCode[] = ['TTD', 'USD', 'CAD'];

export const dailyCategories: { value: DailyCategory; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'gas', label: 'Gas' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'dining', label: 'Dining' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

export const dailyCategoryBadgeVariant: Record<DailyCategory, React.ComponentProps<typeof Badge>['variant']> = {
  food: 'info',
  groceries: 'info',
  dining: 'warning',
  coffee: 'warning',
  gas: 'purple',
  transport: 'teal',
  other: 'default',
};

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDailyExpenseDate(value: string) {
  const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
}

export function getDailyCategoryLabel(category: DailyCategory) {
  return dailyCategories.find((item) => item.value === category)?.label ?? category;
}

type DailyExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseCurrency: CurrencyCode;
  defaultDate?: string;
  editing?: DailyExpense | null;
  trigger?: React.ReactNode;
  isPending?: boolean;
  onSubmit: (payload: DailyExpensePayload) => void;
};

export function DailyExpenseDialog({
  open,
  onOpenChange,
  baseCurrency,
  defaultDate,
  editing,
  trigger,
  isPending = false,
  onSubmit,
}: DailyExpenseDialogProps) {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: baseCurrency,
    category: 'other' as DailyCategory,
    purchaseDate: defaultDate ?? todayISO(),
  });

  useEffect(() => {
    if (!open) return;

    if (editing) {
      setFormData({
        description: editing.description,
        amount: editing.originalAmount.toString(),
        currency: editing.originalCurrency,
        category: editing.category,
        purchaseDate: editing.purchaseDate.split('T')[0],
      });
      return;
    }

    setFormData({
      description: '',
      amount: '',
      currency: baseCurrency,
      category: 'other',
      purchaseDate: defaultDate ?? todayISO(),
    });
  }, [baseCurrency, defaultDate, editing, open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;

    onSubmit({
      description: formData.description,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      category: formData.category,
      purchaseDate: formData.purchaseDate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
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
              <Label htmlFor="daily-expense-purchase-date">Purchase date</Label>
              <Input
                id="daily-expense-purchase-date"
                type="date"
                value={formData.purchaseDate}
                onChange={(event) => setFormData({ ...formData, purchaseDate: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-expense-description">What was purchased?</Label>
              <Input
                id="daily-expense-description"
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-expense-amount">Cost</Label>
              <Input
                id="daily-expense-amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-expense-currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value as CurrencyCode })}
              >
                <SelectTrigger id="daily-expense-currency">
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
              <p className="text-xs text-muted-foreground">Base currency: {baseCurrency}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-expense-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as DailyCategory })}
              >
                <SelectTrigger id="daily-expense-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dailyCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending} loadingText={editing ? 'Updating…' : 'Adding…'}>
              <Save className="h-4 w-4" />
              {editing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
