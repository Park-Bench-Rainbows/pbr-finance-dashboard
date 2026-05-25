'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/page-loading';

type Category = 'food' | 'gas' | 'coffee' | 'groceries' | 'dining' | 'transport' | 'other';

const categories: { value: Category; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'gas', label: 'Gas' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'dining', label: 'Dining' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

interface Budget {
  id: string;
  category: Category;
  monthlyLimit: number;
  effectiveMonth: string; // YYYY-MM
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Record<Category, number>>({
    food: 0, gas: 0, coffee: 0, groceries: 0, dining: 0, transport: 0, other: 0,
  });
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState<Category | null>(null);

  useEffect(() => {
    load();
  }, [month]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/budgets?month=${month}`);
      if (!res.ok) return;
      const rows: Budget[] = await res.json();
      const next = { ...budgets };
      for (const row of rows) next[row.category] = row.monthlyLimit;
      setBudgets(next);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const saveCategory = async (category: Category) => {
    if (savingCategory) return;
    setSavingCategory(category);
    try {
      await fetch('/api/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, category, monthlyLimit: budgets[category] }),
      });
    } finally {
      setSavingCategory(null);
    }
  };

  if (loading) {
    return <PageLoading variant="simple" />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Budgets</h1>
        <p className="text-sm text-muted-foreground">
          Set monthly budgets for daily spending categories.
        </p>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground p-6 space-y-4">
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="month">Month</Label>
          <Input id="month" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="YYYY-MM" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((cat) => (
            <div key={cat.value} className="rounded-lg border p-4 space-y-2">
              <div className="font-medium">{cat.label}</div>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`budget-${cat.value}`}>Monthly limit</Label>
                  <Input
                    id={`budget-${cat.value}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={budgets[cat.value]}
                    onChange={(e) => setBudgets({ ...budgets, [cat.value]: parseFloat(e.target.value || '0') })}
                  />
                </div>
                <Button
                  onClick={() => saveCategory(cat.value)}
                  isLoading={savingCategory === cat.value}
                  loadingText="Saving…"
                >
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

