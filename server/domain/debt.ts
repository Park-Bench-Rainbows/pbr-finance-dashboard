import { CurrencyCode } from './loan';

export type DebtStatus = 'active' | 'partially_paid' | 'paid' | 'overdue' | 'written_off' | 'cancelled';
export type DebtType =
  | 'credit_card'
  | 'car_loan'
  | 'bank_loan'
  | 'student_loan'
  | 'personal_loan'
  | 'buy_now_pay_later'
  | 'other';
export type DebtPaymentFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | 'custom';
export type DebtTransactionDirection = 'inflow' | 'outflow' | 'adjustment';
export type DebtTransactionCategory =
  | 'borrowed_funds'
  | 'debt_payment'
  | 'interest_adjustment'
  | 'fee_adjustment'
  | 'balance_correction'
  | 'new_charge';
export type DebtTransactionBalanceEffect = 'none' | 'increase' | 'decrease';

export interface DebtPayoffPlan {
  id: string;
  userId: string;
  debtId: string;
  targetPayoffDate: Date;
  plannedMonthlyPayment?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DebtTransaction {
  id: string;
  userId: string;
  debtId: string;
  sourceType: 'debt';
  direction: DebtTransactionDirection;
  category: DebtTransactionCategory;
  balanceEffect: DebtTransactionBalanceEffect;
  description: string;
  transactionDate: Date;
  amount: number; // base currency dollars
  baseCurrency: CurrencyCode;
  originalAmount: number; // original currency dollars when available
  originalCurrency?: CurrencyCode;
  fxRate?: string;
  fxAsOf?: Date;
  fxSource?: string;
  linkedRecurringExpenseId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Debt {
  id: string;
  userId: string;
  name: string;
  lenderName: string;
  debtType: DebtType;
  originalAmount?: number;
  originalCurrency?: CurrencyCode;
  baseCurrency: CurrencyCode;
  currentBalance: number;
  totalPaid: number;
  interestRate?: number;
  minimumPayment?: number;
  paymentFrequency?: DebtPaymentFrequency;
  paymentDueDay?: number;
  paymentDueDate?: Date;
  startDate: Date;
  targetPayoffDate?: Date;
  status: DebtStatus;
  notes?: string;
  createsCashInflow: boolean;
  linkedRecurringExpenseId?: string;
  createdBorrowedFundsTransactionId?: string;
  payoffPlan?: DebtPayoffPlan;
  transactions?: DebtTransaction[];
  createdAt: Date;
  updatedAt: Date;
}
