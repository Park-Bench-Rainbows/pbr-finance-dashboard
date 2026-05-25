export type CurrencyCode = 'TTD' | 'USD' | 'CAD';

export interface SavingsTarget {
  id: string;
  userId: string;
  name: string;
  baseCurrency: CurrencyCode;
  targetAmount: number; // base currency dollars
  startDate: Date;
  targetDate: Date;
  factorInExistingPlans: boolean;
  createdAt: Date;
  updatedAt: Date;
}

