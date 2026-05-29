export type CurrencyCode = 'TTD' | 'USD' | 'CAD';
export type LoanStatus = 'active' | 'partially_paid' | 'paid' | 'overdue' | 'written_off' | 'cancelled';

export interface LoanTransaction {
  id: string;
  userId: string;
  loanId: string;
  sourceType: 'loan';
  direction: 'outflow' | 'inflow';
  category: 'money_lent' | 'loan_repayment';
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

export interface Loan {
  id: string;
  userId: string;
  borrowerName: string;
  description: string;
  originalCurrency: CurrencyCode;
  principalAmount: number; // original currency dollars
  baseCurrency: CurrencyCode;
  basePrincipalAmount: number; // base currency dollars
  amountRepaid: number; // base currency dollars
  outstandingAmount: number; // base currency dollars
  fxRate: string;
  fxAsOf: Date;
  fxSource: string;
  loanDate: Date;
  dueDate?: Date;
  status: LoanStatus;
  notes?: string;
  createdExpenseTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
  transactions?: LoanTransaction[];
}
