import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/brand/brand-mark';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <BrandMark className="h-5 w-5" />
            <div className="text-[15px] font-semibold tracking-tight text-foreground">
              Finance Dashboard
            </div>
          </div>
          <div className="flex space-x-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button variant="brand">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center bg-background px-3 py-16 sm:px-4 lg:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Take Control of Your Finances
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Track your income, manage recurring expenses, and visualize your monthly financial
            summary. Replace your spreadsheets with a simple, powerful dashboard.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/signup">
              <Button size="lg" variant="brand">Get Started</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-6 shadow-sm shadow-black/5 dark:shadow-black/20">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-background">
                <svg
                  className="h-6 w-6 text-[color:var(--pbr-blue)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">Track Income</h3>
              <p className="text-muted-foreground">
                Add monthly and bi-weekly income sources. See your total income at a glance.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm shadow-black/5 dark:shadow-black/20">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-background">
                <svg
                  className="h-6 w-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">Manage Expenses</h3>
              <p className="text-muted-foreground">
                Organize recurring expenses by category. Track monthly and annual bills.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-6 shadow-sm shadow-black/5 dark:shadow-black/20">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-background">
                <svg
                  className="h-6 w-6 text-[color:var(--pbr-purple)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">Visualize Data</h3>
              <p className="text-muted-foreground">
                See your financial summary with charts. Know your disposable income instantly.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t bg-background/60">
        <div className="mx-auto max-w-7xl px-3 py-8 text-center text-sm text-muted-foreground sm:px-4 lg:px-6">
          <p className="text-muted-foreground">© 2026 Finance Dashboard.</p>
        </div>
      </footer>
    </div>
  );
}
