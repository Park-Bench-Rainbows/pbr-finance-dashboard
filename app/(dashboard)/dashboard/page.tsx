'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MonthlySummary {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  totalDailySpend: number;
  remainingDisposable: number;
  disposableIncome: number;
  expensesByCategory: Record<string, number>;
  dailySpendByCategory: Record<string, number>;
  dailySpendByDay: { date: string; amount: number }[];
}

type CurrencyCode = 'TTD' | 'USD' | 'CAD';

const n = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatCurrency = (amount: number, currency: CurrencyCode) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const categoryLabels: Record<string, string> = {
  housing: 'Housing',
  utilities: 'Utilities',
  subscriptions: 'Subscriptions',
  insurance: 'Insurance',
  transportation: 'Transportation',
  other: 'Other',
};

const dailyCategoryLabels: Record<string, string> = {
  food: 'Food',
  gas: 'Gas',
  coffee: 'Coffee',
  groceries: 'Groceries',
  dining: 'Dining',
  transport: 'Transport',
  other: 'Other',
};

const allocationColors = {
  expenses: '#ef4444',
  savings: '#3b82f6',
  disposable: '#22c55e',
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('TTD');

  useEffect(() => {
    // Set current month as default
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    load();
  }, [selectedMonth]);

  const load = async () => {
    await Promise.all([fetchSettings(), fetchSummary()]);
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setBaseCurrency(data.baseCurrency as CurrencyCode);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/summary?month=${selectedMonth}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate month options (current month and previous 11 months)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  };

  const incomeVsExpensesData = summary
    ? [
        { name: 'Income', amount: n(summary.totalIncome) },
        { name: 'Expenses', amount: n(summary.totalExpenses) },
        { name: 'Savings', amount: n(summary.totalSavings) },
      ]
    : [];

  const expensesByCategoryData = summary
    ? Object.entries(summary.expensesByCategory).map(([category, amount]) => ({
        name: categoryLabels[category] || category,
        value: amount,
      }))
    : [];

  const incomeAllocationData = summary
    ? [
        { name: 'Expenses', value: n(summary.totalExpenses), fill: allocationColors.expenses },
        { name: 'Savings', value: n(summary.totalSavings), fill: allocationColors.savings },
        { name: 'Disposable', value: Math.max(n(summary.disposableIncome), 0), fill: allocationColors.disposable },
      ]
    : [];

  const allocationPercentages = summary && n(summary.totalIncome) > 0
    ? [
        { name: 'Expenses', value: (n(summary.totalExpenses) / n(summary.totalIncome)) * 100 },
        { name: 'Savings', value: (n(summary.totalSavings) / n(summary.totalIncome)) * 100 },
        { name: 'Disposable', value: (Math.max(n(summary.disposableIncome), 0) / n(summary.totalIncome)) * 100 },
      ]
    : [];

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="w-64">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {summary && (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(n(summary.totalIncome), baseCurrency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(n(summary.totalExpenses), baseCurrency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(n(summary.totalSavings), baseCurrency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Daily Spending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {formatCurrency(n(summary.totalDailySpend), baseCurrency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Remaining Disposable</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    n(summary.remainingDisposable) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(n(summary.remainingDisposable), baseCurrency)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Planned: {formatCurrency(n(summary.disposableIncome), baseCurrency)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={incomeVsExpensesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number, baseCurrency)} />
                    <Legend />
                    <Bar dataKey="amount" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Income Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                {incomeAllocationData.some((item) => item.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={incomeAllocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {incomeAllocationData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number, baseCurrency)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No allocation data to display
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Allocation Percentages</CardTitle>
              </CardHeader>
              <CardContent>
                {allocationPercentages.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={allocationPercentages} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" width={90} />
                      <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                        {allocationPercentages.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === 'Expenses'
                                ? allocationColors.expenses
                                : entry.name === 'Savings'
                                  ? allocationColors.savings
                                  : allocationColors.disposable
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No allocation percentages to display
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {expensesByCategoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expensesByCategoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {expensesByCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number, baseCurrency)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No expenses to display
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Savings vs Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-4 overflow-hidden rounded-full bg-muted">
                    <div className="flex h-full w-full">
                      <div
                        className="h-full"
                        style={{
                          width: `${summary.totalExpenses + summary.totalSavings > 0 ? (summary.totalExpenses / (summary.totalExpenses + summary.totalSavings)) * 100 : 0}%`,
                          backgroundColor: allocationColors.expenses,
                        }}
                      />
                      <div
                        className="h-full"
                        style={{
                          width: `${n(summary.totalExpenses) + n(summary.totalSavings) > 0 ? (n(summary.totalSavings) / (n(summary.totalExpenses) + n(summary.totalSavings))) * 100 : 0}%`,
                          backgroundColor: allocationColors.savings,
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground">Expenses</div>
                      <div className="font-semibold">{formatCurrency(n(summary.totalExpenses), baseCurrency)}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground">Savings</div>
                      <div className="font-semibold">{formatCurrency(n(summary.totalSavings), baseCurrency)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(summary.dailySpendByCategory ?? {}).length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(summary.dailySpendByCategory).map(([cat, amt]) => ({
                          name: dailyCategoryLabels[cat] || cat,
                          value: n(amt),
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {Object.entries(summary.dailySpendByCategory).map((_, index) => (
                          <Cell key={`daily-cat-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number, baseCurrency)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
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
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={summary.dailySpendByDay.map((d) => ({ ...d, amount: n(d.amount) }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(8)} />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value as number, baseCurrency)} />
                      <Bar dataKey="amount" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No daily spending to display
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {expensesByCategoryData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {expensesByCategoryData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold">{formatCurrency(item.value, baseCurrency)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
