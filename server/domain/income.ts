export type IncomeFrequency = 'monthly' | 'biweekly';
export type CurrencyCode = 'TTD' | 'USD' | 'CAD';

export interface Income {
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
  frequency: IncomeFrequency;
  startDate: Date;
  endDate?: Date; // null = ongoing
  createdAt: Date;
  updatedAt: Date;
}
