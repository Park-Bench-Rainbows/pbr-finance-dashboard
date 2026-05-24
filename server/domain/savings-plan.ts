export type SavingsFrequency = 'monthly' | 'biweekly';
export type CurrencyCode = 'TTD' | 'USD' | 'CAD';

export interface SavingsPlan {
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

  frequency: SavingsFrequency;
  startDate: Date;
  endDate?: Date;

  createdAt: Date;
  updatedAt: Date;
}

