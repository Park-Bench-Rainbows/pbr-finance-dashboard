'use client';

import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { TableActionButton } from '@/components/ui/table-action-button';
import { MobileRowCard } from '@/components/ui/mobile-row-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { aggregateDailyTotals, heatBucket, monthGrid } from '@/lib/calendar-heatmap';
import { PageLoading } from '@/components/ui/page-loading';
import { api, type CurrencyCode, type DailyExpense, type DailyExpensePayload } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  DailyExpenseDialog,
  dailyCategories as categories,
  dailyCategoryBadgeVariant as categoryBadgeVariant,
  formatDailyExpenseDate as formatISODate,
  todayISO,
} from '@/components/daily-expenses/daily-expense-dialog';
import { useIsMobile } from '@/components/hooks/use-mobile';

type MonthlySummary = {
  dailySpendByCategory: Record<string, number>;
  dailySpendByDay: { date: string; amount: number }[];
};

const n = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatCurrency = (amount: number, currency: CurrencyCode) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

const COLORS = ['#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#FACC15', '#A16207'];

const dailyCategoryChartConfig = {
  food: { label: 'Food', color: 'var(--chart-1)' },
  gas: { label: 'Gas', color: 'var(--chart-2)' },
  coffee: { label: 'Coffee', color: 'var(--chart-3)' },
  groceries: { label: 'Groceries', color: 'var(--chart-4)' },
  dining: { label: 'Dining', color: 'var(--chart-5)' },
  transport: { label: 'Transport', color: 'var(--chart-2)' },
  other: { label: 'Other', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const dailyByDayChartConfig = {
  amount: { label: 'Amount', color: 'var(--chart-3)' },
} satisfies ChartConfig;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', timeZone: 'UTC' });
    options.push({ value, label });
  }
  return options;
}

export default function DailyExpensesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DailyExpense | null>(null);
  const [dialogDefaultDate, setDialogDefaultDate] = useState(todayISO());
  const [month, setMonth] = useState(currentMonth());

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const isMobile = useIsMobile();

  const settingsQuery = useQuery({ queryKey: queryKeys.settings, queryFn: api.settings });
  const itemsQuery = useQuery({
    queryKey: queryKeys.dailyExpenses.month(month),
    queryFn: () => api.dailyExpensesForMonth(month),
  });
  const summaryQuery = useQuery({
    queryKey: queryKeys.summary(month),
    queryFn: () => api.summary(month),
  });
  const dayItemsQuery = useQuery({
    queryKey: selectedDate ? queryKeys.dailyExpenses.date(selectedDate) : ['daily-expenses', 'date', 'none'],
    queryFn: () => api.dailyExpensesForDate(selectedDate as string),
    enabled: Boolean(selectedDate),
  });

  const baseCurrency = settingsQuery.data?.baseCurrency ?? 'TTD';
  const items = itemsQuery.data ?? [];
  const summary: MonthlySummary | null = summaryQuery.data
    ? {
        dailySpendByCategory: summaryQuery.data.dailySpendByCategory ?? {},
        dailySpendByDay: summaryQuery.data.dailySpendByDay ?? [],
      }
    : null;
  const dayItems = dayItemsQuery.data ?? [];

  const invalidateDailyData = async (dateISO?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyExpenses.month(month) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dailyExpenses.latest(10) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.summary(month) }),
      dateISO ? queryClient.invalidateQueries({ queryKey: queryKeys.dailyExpenses.date(dateISO) }) : Promise.resolve(),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: DailyExpensePayload }) =>
      id ? api.updateDailyExpense(id, payload) : api.createDailyExpense(payload),
    onSuccess: async () => {
      await invalidateDailyData(selectedDate ?? undefined);
      setDialogOpen(false);
      setEditing(null);
      setDialogDefaultDate(todayISO());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDailyExpense(id),
    onSuccess: async () => {
      await invalidateDailyData(selectedDate ?? undefined);
    },
  });

  const openAddForDate = (dateISO: string) => {
    setEditing(null);
    setDialogDefaultDate(dateISO);
    setDialogOpen(true);
  };

  const handleEdit = (item: DailyExpense) => {
    setEditing(item);
    setDialogDefaultDate(item.purchaseDate.split('T')[0]);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    deleteMutation.mutate(id);
  };

  const dayColumns = useMemo<ColumnDef<DailyExpense>[]>(
    () => [
      {
        accessorKey: 'description',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
        cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
      },
      {
        accessorFn: (row) => categories.find((category) => category.value === row.category)?.label ?? row.category,
        id: 'category',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
        cell: ({ row }) => (
          <Badge variant={categoryBadgeVariant[row.original.category]} className="capitalize">
            {categories.find((category) => category.value === row.original.category)?.label ?? row.original.category}
          </Badge>
        ),
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" className="justify-end" />,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{formatCurrency(row.original.amount, baseCurrency)}</div>
        ),
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <TableActionButton
              label={`Edit ${row.original.description}`}
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => handleEdit(row.original)}
            />
            <TableActionButton
              label={`Delete ${row.original.description}`}
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

  const itemColumns = useMemo<ColumnDef<DailyExpense>[]>(
    () => [
      {
        accessorKey: 'purchaseDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
        cell: ({ row }) => formatISODate(row.original.purchaseDate),
      },
      {
        accessorKey: 'description',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
        cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
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
        accessorKey: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Cost" />,
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
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <TableActionButton
              label={`Edit ${row.original.description}`}
              icon={<Pencil className="h-4 w-4" />}
              onClick={() => handleEdit(row.original)}
              disabled={deleteMutation.isPending}
            />
            <TableActionButton
              label={`Delete ${row.original.description}`}
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

  const today = todayISO();
  const totalsByDate = aggregateDailyTotals(items);
  const maxTotal = Math.max(0, ...Object.values(totalsByDate));
  const grid = monthGrid(month);
  const dayTotal = dayItems.reduce((sum, i) => sum + n(i.amount), 0);

  const heatClasses: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: 'bg-muted/30 hover:bg-muted/50',
    1: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    2: 'bg-emerald-500/20 hover:bg-emerald-500/25',
    3: 'bg-emerald-500/30 hover:bg-emerald-500/35',
    4: 'bg-emerald-500/40 hover:bg-emerald-500/45',
  };

  if (itemsQuery.isLoading) {
    return <PageLoading variant="table" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Daily Expenses</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full">
            <Select
              value={month}
              onValueChange={(value) => {
                setMonth(value);
                setSelectedDate(null);
                setDayOpen(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DailyExpenseDialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditing(null);
            }}
            baseCurrency={baseCurrency}
            defaultDate={dialogDefaultDate}
            editing={editing}
            isPending={saveMutation.isPending}
            onSubmit={(payload) => saveMutation.mutate({ id: editing?.id, payload })}
            trigger={
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogDefaultDate(todayISO());
                }}
              >
                <Plus className="h-4 w-4" />
                Add Daily Expense
              </Button>
            }
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center font-medium">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-1 sm:space-y-2">
            {grid.map((week, wi) => (
              <div key={`week-${wi}`} className="grid grid-cols-7 gap-1 sm:gap-2">
                {week.map((cell, di) => {
                  if (!cell) return <div key={`empty-${wi}-${di}`} className="h-11 sm:h-10" />;

                  const total = totalsByDate[cell.dateISO] ?? 0;
                  const bucket = heatBucket(total, maxTotal);
                  const isToday = cell.dateISO === today;

                  return (
                    <button
                      key={cell.dateISO}
                      type="button"
                      className={[
                        'rounded-md border text-left py-1 transition-colors',
                        'h-11 px-1 text-xs sm:h-10 sm:px-2 sm:text-sm',
                        heatClasses[bucket],
                        isToday ? 'ring-2 ring-emerald-500/40' : '',
                      ].join(' ')}
                      title={`${cell.dateISO} • ${formatCurrency(total, baseCurrency)}`}
                      onClick={() => {
                        setSelectedDate(cell.dateISO);
                        setDayOpen(true);
                      }}
                      aria-label={`${cell.dateISO} total ${formatCurrency(total, baseCurrency)}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-medium">{cell.day}</span>
                        {total > 0 ? (
                          <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                            {formatCurrency(total, baseCurrency)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Sheet open={dayOpen} onOpenChange={setDayOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selectedDate ?? 'Day'}</SheetTitle>
            <SheetDescription>
              {selectedDate ? `Total: ${formatCurrency(dayTotal, baseCurrency)}` : 'Select a day to view entries.'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                onClick={() => {
                  if (!selectedDate) return;
                  openAddForDate(selectedDate);
                }}
                disabled={!selectedDate}
              >
                <Plus className="h-4 w-4" />
                Add expense
              </Button>
            </div>

            {dayItemsQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <DataTable
                columns={dayColumns}
                data={dayItems}
                hideSearch
                initialPageSize={5}
                emptyMessage="No expenses recorded for this day."
                mobileCard={(item) => (
                  <MobileRowCard
                    title={item.description}
                    amountNode={formatCurrency(item.amount, baseCurrency)}
                    contextNode={
                      <Badge variant={categoryBadgeVariant[item.category]} className="capitalize">
                        {categories.find((category) => category.value === item.category)?.label ?? item.category}
                      </Badge>
                    }
                    editIcon={Pencil}
                    deleteIcon={Trash2}
                    onEdit={() => handleEdit(item)}
                    onDelete={() => handleDelete(item.id)}
                    deleteLoading={deleteMutation.isPending && deleteMutation.variables === item.id}
                  />
                )}
              />
            )}
          </div>

          <SheetFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDayOpen(false);
                setSelectedDate(null);
                queryClient.removeQueries({ queryKey: ['daily-expenses', 'date'] });
              }}
            >
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {summary && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Daily Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(summary.dailySpendByCategory ?? {}).length > 0 ? (
                <ChartContainer
                  config={dailyCategoryChartConfig}
                  className="h-[240px] w-full sm:h-[260px] [&_.recharts-pie-label-text]:hidden sm:[&_.recharts-pie-label-text]:block"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(summary.dailySpendByCategory).map(([cat, amt]) => ({
                          name: categories.find((c) => c.value === cat)?.label ?? cat,
                          value: n(amt),
                          fill: `var(--color-${cat})`,
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={isMobile ? 76 : 90}
                        dataKey="value"
                        labelLine={false}
                        label={isMobile ? false : ({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {Object.entries(summary.dailySpendByCategory).map(([cat]) => (
                          <Cell key={`daily-cat-${cat}`} fill={`var(--color-${cat})`} />
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
                  No daily spending to display
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Spending by Day</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.dailySpendByDay?.length ? (
                <ChartContainer config={dailyByDayChartConfig} className="h-[240px] w-full sm:h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart accessibilityLayer data={summary.dailySpendByDay.map((d) => ({ ...d, amount: n(d.amount) }))} margin={{ left: isMobile ? 0 : 8, right: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(8)} tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis hide={isMobile} tickLine={false} axisLine={false} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => formatCurrency(value as number, baseCurrency)}
                            indicator="dot"
                            hideLabel
                          />
                        }
                      />
                      <Bar dataKey="amount" fill="var(--color-amount)" radius={6} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex h-[260px] items-center justify-center text-muted-foreground">
                  No daily spending to display
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <DataTable
        columns={itemColumns}
        data={items}
        searchPlaceholder="Search daily expenses..."
        emptyMessage="No daily expenses yet. Add your first one!"
        mobileCard={(item) => (
          <MobileRowCard
            title={item.description}
            amountNode={formatCurrency(item.amount, baseCurrency)}
            contextNode={
              <div className="flex items-center gap-2">
                <Badge variant={categoryBadgeVariant[item.category] ?? 'default'}>
                  {categories.find((category) => category.value === item.category)?.label ?? item.category}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatISODate(item.purchaseDate)}</span>
              </div>
            }
            secondaryText={
              item.originalCurrency !== baseCurrency
                ? `Entered ${formatCurrency(item.originalAmount, item.originalCurrency)}`
                : null
            }
            editIcon={Pencil}
            deleteIcon={Trash2}
            onEdit={() => handleEdit(item)}
            onDelete={() => handleDelete(item.id)}
            editDisabled={deleteMutation.isPending}
            deleteLoading={deleteMutation.isPending && deleteMutation.variables === item.id}
          />
        )}
      />
    </div>
  );
}
