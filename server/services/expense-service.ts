import { ExpenseRepository, CreateExpenseDTO, UpdateExpenseDTO } from '../repositories/expense-repository';
import { RecurringExpense } from '../domain/recurring-expense';

export class ExpenseService {
  private repository: ExpenseRepository;

  constructor() {
    this.repository = new ExpenseRepository();
  }

  /**
   * Get all expenses for a user
   */
  async getAll(userId: string): Promise<RecurringExpense[]> {
    return this.repository.findByUserId(userId);
  }

  async getById(userId: string, id: string): Promise<RecurringExpense | null> {
    return this.repository.findById(userId, id);
  }

  /**
   * Create a new expense
   */
  async create(userId: string, data: CreateExpenseDTO): Promise<RecurringExpense> {
    return this.repository.create(userId, data);
  }

  /**
   * Update an existing expense
   */
  async update(id: string, userId: string, data: UpdateExpenseDTO): Promise<RecurringExpense> {
    return this.repository.update(id, userId, data);
  }

  /**
   * Delete an expense
   */
  async delete(id: string, userId: string): Promise<void> {
    return this.repository.delete(id, userId);
  }

  /**
   * Calculate total monthly expenses for a user in a specific month
   * Converts annual expenses to monthly equivalent
   */
  async calculateMonthlyTotal(userId: string, month: string): Promise<number> {
    const activeExpenses = await this.repository.findActiveForMonth(userId, month);

    return activeExpenses.reduce((total, expense) => {
      if (expense.frequency === 'monthly') {
        return total + expense.amount;
      } else if (expense.frequency === 'annual') {
        // Annual: divide by 12 months
        return total + (expense.amount / 12);
      }
      return total;
    }, 0);
  }
}
