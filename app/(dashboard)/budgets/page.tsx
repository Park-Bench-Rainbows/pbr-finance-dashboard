'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type DailyCategory } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

type Category = DailyCategory;

const categories: { value: Category; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'gas', label: 'Gas' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'dining', label: 'Dining' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Record<Category, number>>({
    food: 0, gas: 0, coffee: 0, groceries: 0, dining: 0, transport: 0, other: 0,
  });
  const budgetsQuery = useQuery({ queryKey: queryKeys.budgets(month), queryFn: () => api.budgets(month) });
  const saveMutation = useMutation({
    mutationFn: (category: Category) => api.upsertBudget({ month, category, monthlyLimit: budgets[category] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.budgets(month) });
      await queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
  });

  useEffect(() => {
    const next: Record<Category, number> = {
      food: 0, gas: 0, coffee: 0, groceries: 0, dining: 0, transport: 0, other: 0,
    };
    for (const row of budgetsQuery.data ?? []) next[row.category] = row.monthlyLimit;
    setBudgets(next);
  }, [budgetsQuery.data]);

  const saveCategory = async (category: Category) => {
    if (saveMutation.isPending) return;
    saveMutation.mutate(category);
  };

  if (budgetsQuery.isLoading) {
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
        <div className="max-w-xs space-y-2">
          <Label htmlFor="month">Month</Label>
          <Input id="month" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="YYYY-MM" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((cat) => (
            <div key={cat.value} className="rounded-lg border p-4 space-y-2">
              <div className="font-medium">{cat.label}</div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
                  className="w-full sm:w-auto"
                  onClick={() => saveCategory(cat.value)}
                  isLoading={saveMutation.isPending && saveMutation.variables === cat.value}
                  loadingText="Saving…"
                >
                  <Save className="h-4 w-4" />
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

