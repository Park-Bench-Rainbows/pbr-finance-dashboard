import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Create postgres connection
const connectionString = process.env.DATABASE_URL;

function missingDatabaseUrlError() {
  return new Error(
    'DATABASE_URL is not set. Configure it in your environment (and in Vercel Project Settings → Environment Variables for the Production environment).'
  );
}

function createDb() {
  if (!connectionString) {
    // Avoid crashing at import-time (e.g., unit tests that mock repositories).
    // Any actual DB usage should fail loudly with a clear error.
    return new Proxy(
      {},
      {
        get() {
          throw missingDatabaseUrlError();
        },
      }
    ) as any;
  }

  // Many managed Postgres providers require SSL from serverless environments (including Vercel).
  // If your DATABASE_URL already includes sslmode, postgres-js will respect it.
  const client = postgres(connectionString, {
    ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined,
  });

  return drizzle(client, { schema });
}

export const db = createDb();
