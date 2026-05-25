import { SavingsTargetRepository } from '../repositories/savings-target-repository';

export class SavingsTargetService {
  private repo: SavingsTargetRepository;

  constructor(repo?: SavingsTargetRepository) {
    this.repo = repo ?? new SavingsTargetRepository();
  }

  async list(userId: string, cutoffDate?: string) {
    if (cutoffDate) return this.repo.listWithProgress(userId, cutoffDate);
    return this.repo.list(userId);
  }
}
