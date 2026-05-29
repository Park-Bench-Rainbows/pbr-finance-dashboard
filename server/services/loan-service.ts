import { Loan } from '../domain/loan';
import { CreateLoanDTO, LoanRepository, UpdateLoanDTO } from '../repositories/loan-repository';

export class LoanService {
  private repo: LoanRepository;

  constructor(repo?: LoanRepository) {
    this.repo = repo ?? new LoanRepository();
  }

  async getAll(userId: string): Promise<Loan[]> {
    return this.repo.findByUserId(userId);
  }

  async getById(userId: string, id: string): Promise<Loan | null> {
    return this.repo.findById(userId, id);
  }

  async create(userId: string, data: CreateLoanDTO): Promise<Loan> {
    return this.repo.create(userId, data);
  }

  async update(id: string, userId: string, data: UpdateLoanDTO): Promise<Loan> {
    return this.repo.update(id, userId, data);
  }

  async recordRepayment(
    id: string,
    userId: string,
    data: {
      amount: number;
      currency: 'TTD' | 'USD' | 'CAD';
      baseCurrency: 'TTD' | 'USD' | 'CAD';
      baseAmount: number;
      fxRate: string;
      fxAsOf: Date;
      fxSource: string;
      repaymentDate: Date;
      description?: string;
    }
  ): Promise<Loan> {
    return this.repo.recordRepayment(id, userId, data);
  }

  async getTransactions(userId: string, loanId: string) {
    return this.repo.findTransactionsByLoanId(userId, loanId);
  }
}
