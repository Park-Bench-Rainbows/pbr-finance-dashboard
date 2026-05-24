import { IncomeRepository, CreateIncomeDTO, UpdateIncomeDTO } from '../repositories/income-repository';
import { Income } from '../domain/income';

export class IncomeService {
  private repository: IncomeRepository;

  constructor() {
    this.repository = new IncomeRepository();
  }

  /**
   * Get all incomes for a user
   */
  async getAll(userId: string): Promise<Income[]> {
    return this.repository.findByUserId(userId);
  }

  /**
   * Create a new income
   */
  async create(userId: string, data: CreateIncomeDTO): Promise<Income> {
    return this.repository.create(userId, data);
  }

  /**
   * Update an existing income
   */
  async update(id: string, userId: string, data: UpdateIncomeDTO): Promise<Income> {
    return this.repository.update(id, userId, data);
  }

  /**
   * Delete an income
   */
  async delete(id: string, userId: string): Promise<void> {
    return this.repository.delete(id, userId);
  }

  /**
   * Calculate total monthly income for a user in a specific month
   * Converts biweekly income to monthly equivalent
   */
  async calculateMonthlyTotal(userId: string, month: string): Promise<number> {
    const activeIncomes = await this.repository.findActiveForMonth(userId, month);

    return activeIncomes.reduce((total, income) => {
      if (income.frequency === 'monthly') {
        return total + income.amount;
      } else if (income.frequency === 'biweekly') {
        // Biweekly: 26 pay periods per year, divide by 12 months
        return total + (income.amount * 26 / 12);
      }
      return total;
    }, 0);
  }
}
