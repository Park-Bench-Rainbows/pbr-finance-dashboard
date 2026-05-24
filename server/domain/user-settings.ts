export type CurrencyCode = 'TTD' | 'USD' | 'CAD';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserSettings {
  userId: string;
  baseCurrency: CurrencyCode;
  theme: ThemeMode;
  createdAt: Date;
  updatedAt: Date;
}
