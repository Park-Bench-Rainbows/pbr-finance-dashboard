import { db } from '@/lib/db';
import { fxRates } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export type CurrencyCode = 'TTD' | 'USD' | 'CAD';

export interface FxQuote {
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  rate: string; // quote_per_base numeric string
  asOf: Date;
  source: string;
}

/**
 * FxService
 *
 * Fetches FX rates from an external API and caches them in Postgres.
 *
 * Rate convention: quote_per_base
 * Example: base=USD, quote=TTD, rate=6.80 means 1 USD = 6.80 TTD.
 */
export class FxService {
  async getQuote(baseCurrency: CurrencyCode, quoteCurrency: CurrencyCode): Promise<FxQuote> {
    if (baseCurrency === quoteCurrency) {
      return {
        baseCurrency,
        quoteCurrency,
        rate: '1',
        asOf: new Date(),
        source: 'identity',
      };
    }

    const cached = await this.getCachedQuote(baseCurrency, quoteCurrency);
    if (cached) return cached;

    const fetched = await this.fetchFromExternal(baseCurrency, quoteCurrency);
    await this.cacheQuote(fetched);
    return fetched;
  }

  /**
   * Cache policy: reuse the most recently fetched rate in the last 12 hours.
   * (Good enough for v1; can be refined later.)
   */
  private async getCachedQuote(baseCurrency: CurrencyCode, quoteCurrency: CurrencyCode): Promise<FxQuote | null> {
    const [row] = await db
      .select()
      .from(fxRates)
      .where(and(eq(fxRates.baseCurrency, baseCurrency), eq(fxRates.quoteCurrency, quoteCurrency)))
      .orderBy(sql`${fxRates.asOf} desc`)
      .limit(1);

    if (!row) return null;

    const asOf = new Date(row.asOf);
    const twelveHoursMs = 12 * 60 * 60 * 1000;
    if (Date.now() - asOf.getTime() > twelveHoursMs) return null;

    return {
      baseCurrency: row.baseCurrency,
      quoteCurrency: row.quoteCurrency,
      rate: row.rate,
      asOf,
      source: row.source,
    };
  }

  private async cacheQuote(quote: FxQuote): Promise<void> {
    await db
      .insert(fxRates)
      .values({
        baseCurrency: quote.baseCurrency,
        quoteCurrency: quote.quoteCurrency,
        rate: quote.rate,
        asOf: quote.asOf,
        source: quote.source,
      })
      .onConflictDoNothing({
        target: [fxRates.baseCurrency, fxRates.quoteCurrency, fxRates.asOf],
      });
  }

  /**
   * External API: https://open.er-api.com/v6/latest/{BASE}
   * No API key required. Response contains a `rates` map and `time_last_update_unix`.
   */
  private async fetchFromExternal(baseCurrency: CurrencyCode, quoteCurrency: CurrencyCode): Promise<FxQuote> {
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(baseCurrency)}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`FX API failed (${res.status})`);
    }

    const body: any = await res.json();
    const rateValue = body?.rates?.[quoteCurrency];
    if (typeof rateValue !== 'number' || !Number.isFinite(rateValue) || rateValue <= 0) {
      throw new Error('FX API returned invalid rate');
    }

    const asOfUnix = body?.time_last_update_unix;
    const asOf = typeof asOfUnix === 'number' ? new Date(asOfUnix * 1000) : new Date();

    return {
      baseCurrency,
      quoteCurrency,
      rate: rateValue.toFixed(8),
      asOf,
      source: 'open.er-api.com',
    };
  }
}

