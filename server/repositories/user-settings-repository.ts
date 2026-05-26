import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { UserSettings, CurrencyCode, ThemeMode } from '../domain/user-settings';

export class UserSettingsRepository {
  async get(userId: string): Promise<UserSettings | null> {
    const [row] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return row ? this.toDomain(row) : null;
  }

  async upsertBaseCurrency(userId: string, baseCurrency: CurrencyCode): Promise<UserSettings> {
    const [row] = await db
      .insert(userSettings)
      .values({ userId, baseCurrency })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { baseCurrency, updatedAt: new Date() },
      })
      .returning();

    return this.toDomain(row);
  }

  async upsertTheme(userId: string, theme: ThemeMode): Promise<UserSettings> {
    const [row] = await db
      .insert(userSettings)
      .values({ userId, baseCurrency: 'TTD', theme })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { theme, updatedAt: new Date() },
      })
      .returning();

    return this.toDomain(row);
  }

  async upsert(userId: string, data: { baseCurrency?: CurrencyCode; theme?: ThemeMode }): Promise<UserSettings> {
    const insertValues: any = {
      userId,
      baseCurrency: data.baseCurrency ?? 'TTD',
      theme: data.theme ?? 'system',
    };

    const setValues: any = { updatedAt: new Date() };
    if (data.baseCurrency) setValues.baseCurrency = data.baseCurrency;
    if (data.theme) setValues.theme = data.theme;

    const [row] = await db
      .insert(userSettings)
      .values(insertValues)
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: setValues,
      })
      .returning();

    return this.toDomain(row);
  }

  private toDomain(row: any): UserSettings {
    return {
      userId: row.userId,
      baseCurrency: row.baseCurrency,
      theme: row.theme ?? 'system',
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
