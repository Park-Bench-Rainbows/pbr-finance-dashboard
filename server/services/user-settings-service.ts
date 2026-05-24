import { CurrencyCode, ThemeMode, UserSettings } from '../domain/user-settings';
import { UserSettingsRepository } from '../repositories/user-settings-repository';

export class UserSettingsService {
  private repo: UserSettingsRepository;

  constructor(repo?: UserSettingsRepository) {
    this.repo = repo ?? new UserSettingsRepository();
  }

  async getOrDefault(userId: string): Promise<UserSettings> {
    const existing = await this.repo.get(userId);
    if (existing) return existing;

    return this.repo.upsert(userId, { baseCurrency: 'TTD', theme: 'system' });
  }

  async setBaseCurrency(userId: string, baseCurrency: CurrencyCode): Promise<UserSettings> {
    return this.repo.upsertBaseCurrency(userId, baseCurrency);
  }

  async setTheme(userId: string, theme: ThemeMode): Promise<UserSettings> {
    return this.repo.upsertTheme(userId, theme);
  }

  async update(userId: string, data: { baseCurrency?: CurrencyCode; theme?: ThemeMode }): Promise<UserSettings> {
    return this.repo.upsert(userId, data);
  }
}
