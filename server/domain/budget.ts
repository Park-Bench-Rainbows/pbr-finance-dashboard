export type DailyExpenseCategory =
  | 'food'
  | 'gas'
  | 'coffee'
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'other';

export interface Budget {
  id: string;
  userId: string;
  category: DailyExpenseCategory;
  monthlyLimit: number; // base currency dollars
  effectiveMonth: string; // YYYY-MM
  createdAt: Date;
  updatedAt: Date;
}

