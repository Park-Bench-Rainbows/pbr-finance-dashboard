import { Debt, DebtPayoffPlan, DebtTransaction } from '../domain/debt';
import {
  AdjustDebtBalanceDTO,
  CreateDebtDTO,
  DebtRepository,
  RecordDebtPaymentDTO,
  UpdateDebtDTO,
  UpsertDebtPayoffPlanDTO,
} from '../repositories/debt-repository';

export class DebtService {
  private repo: DebtRepository;

  constructor(repo?: DebtRepository) {
    this.repo = repo ?? new DebtRepository();
  }

  async getAll(userId: string): Promise<Debt[]> {
    return this.repo.findByUserId(userId);
  }

  async getById(userId: string, id: string): Promise<Debt | null> {
    return this.repo.findById(userId, id);
  }

  async create(userId: string, data: CreateDebtDTO): Promise<Debt> {
    return this.repo.create(userId, data);
  }

  async update(id: string, userId: string, data: UpdateDebtDTO): Promise<Debt> {
    return this.repo.update(id, userId, data);
  }

  async delete(id: string, userId: string): Promise<void> {
    return this.repo.delete(id, userId);
  }

  async recordPayment(id: string, userId: string, data: RecordDebtPaymentDTO): Promise<Debt> {
    return this.repo.recordPayment(id, userId, data);
  }

  async adjustBalance(id: string, userId: string, data: AdjustDebtBalanceDTO): Promise<Debt> {
    return this.repo.adjustBalance(id, userId, data);
  }

  async upsertPayoffPlan(id: string, userId: string, data: UpsertDebtPayoffPlanDTO): Promise<DebtPayoffPlan> {
    return this.repo.upsertPayoffPlan(id, userId, data);
  }

  async deletePayoffPlan(id: string, userId: string): Promise<void> {
    return this.repo.deletePayoffPlan(id, userId);
  }

  async getTransactions(userId: string, debtId: string): Promise<DebtTransaction[]> {
    return this.repo.findTransactionsByDebtId(userId, debtId);
  }

  async getTransactionsForMonth(userId: string, month: string): Promise<DebtTransaction[]> {
    return this.repo.findTransactionsForMonth(userId, month);
  }

  async getPayoffPlan(userId: string, debtId: string): Promise<DebtPayoffPlan | null> {
    return this.repo.findPayoffPlanByDebtId(userId, debtId);
  }
}
