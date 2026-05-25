import { SavingsTransaction } from '../domain/savings-transaction';
import { CreateSavingsTransactionDTO, SavingsTransactionRepository } from '../repositories/savings-transaction-repository';

export class SavingsTransactionService {
  private repo: SavingsTransactionRepository;

  constructor(repo?: SavingsTransactionRepository) {
    this.repo = repo ?? new SavingsTransactionRepository();
  }

  async getForMonth(userId: string, month: string): Promise<SavingsTransaction[]> {
    return this.repo.findForMonth(userId, month);
  }

  async create(userId: string, data: CreateSavingsTransactionDTO): Promise<SavingsTransaction> {
    return this.repo.create(userId, data);
  }
}

