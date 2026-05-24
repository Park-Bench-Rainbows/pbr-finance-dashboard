export type ExpenseFrequency = 'monthly' | 'annual';
export type ExpenseCategory = 
  | 'housing' 
  | 'utilities' 
  | 'subscriptions' 
  | 'insurance' 
  | 'transportation' 
  | 'other';
export type CurrencyCode = 'TTD' | 'USD' | 'CAD';

export interface RecurringExpense {
  id: string;
  userId: string;
  name: string;
  amount: number; // base currency amount in dollars (DB stores as cents)
  baseCurrency: CurrencyCode;
  originalAmount: number; // original currency amount in dollars (DB stores as cents)
  originalCurrency: CurrencyCode;
  fxRate: string; // numeric(18,8) serialized
  fxAsOf: Date;
  fxSource: string;
  frequency: ExpenseFrequency;
  category: ExpenseCategory;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
