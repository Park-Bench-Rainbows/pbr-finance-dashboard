export type CurrencyCode = 'TTD' | 'USD' | 'CAD';

export interface SavingsTransaction {
  id: string;
  userId: string;
  savingsTargetId?: string;
  description: string;
  transactionDate: Date;

  amount: number; // base currency dollars
  baseCurrency: CurrencyCode;

  originalAmount: number; // original currency dollars
  originalCurrency: CurrencyCode;

  fxRate: string;
  fxAsOf: Date;
  fxSource: string;

  createdAt: Date;
  updatedAt: Date;
}

