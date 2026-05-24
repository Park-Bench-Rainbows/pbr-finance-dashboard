export type DailyExpenseCategory =
  | 'food'
  | 'gas'
  | 'coffee'
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'other';

export type CurrencyCode = 'TTD' | 'USD' | 'CAD';

export interface DailyExpense {
  id: string;
  userId: string;
  description: string;
  category: DailyExpenseCategory;
  purchaseDate: Date;

  amount: number; // base currency amount in dollars (DB stores as cents)
  baseCurrency: CurrencyCode;

  originalAmount: number; // original currency amount in dollars (DB stores as cents)
  originalCurrency: CurrencyCode;

  fxRate: string; // numeric(18,8) serialized
  fxAsOf: Date;
  fxSource: string;

  createdAt: Date;
  updatedAt: Date;
}

