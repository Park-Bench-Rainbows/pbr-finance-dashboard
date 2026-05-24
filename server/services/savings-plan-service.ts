import { SavingsPlan } from '../domain/savings-plan';
import { CreateSavingsPlanDTO, SavingsPlanRepository, UpdateSavingsPlanDTO } from '../repositories/savings-plan-repository';

export class SavingsPlanService {
  private repository: SavingsPlanRepository;

  constructor(repo?: SavingsPlanRepository) {
    this.repository = repo ?? new SavingsPlanRepository();
  }

  async getAll(userId: string): Promise<SavingsPlan[]> {
    return this.repository.findByUserId(userId);
  }

  async create(userId: string, data: CreateSavingsPlanDTO): Promise<SavingsPlan> {
    return this.repository.create(userId, data);
  }

  async update(id: string, userId: string, data: UpdateSavingsPlanDTO): Promise<SavingsPlan> {
    return this.repository.update(id, userId, data);
  }

  async delete(id: string, userId: string): Promise<void> {
    return this.repository.delete(id, userId);
  }

  async calculateMonthlyTotal(userId: string, month: string): Promise<number> {
    const activePlans = await this.repository.findActiveForMonth(userId, month);

    return activePlans.reduce((total, plan) => {
      if (plan.frequency === 'monthly') return total + plan.amount;
      if (plan.frequency === 'biweekly') return total + (plan.amount * 26 / 12);
      return total;
    }, 0);
  }
}

