# Finance Dashboard - Phase 1

A personal finance tracking web application built to replace Excel spreadsheets. Track income, recurring expenses, and view monthly financial summaries with charts.

## Features

- **Income Tracking**: Add monthly and bi-weekly income sources
- **Expense Management**: Track recurring expenses by category (monthly/annual)
- **Monthly Summary**: View total income, expenses, and disposable income
- **Data Visualization**: Charts showing income vs expenses and expense breakdown
- **Authentication**: Secure email/password authentication via Supabase

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Next.js Route Handlers (REST API)
- **Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Charts**: Recharts
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js 20+ installed
- A Supabase account (free tier works)

### 1. Clone and Install

```bash
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned
3. Go to Project Settings > API
4. Copy your project URL and anon key
5. Go to Project Settings > Database
6. Copy your connection string (change password placeholder)

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=your-database-connection-string
```

### 4. Run Database Migrations

```bash
npm run db:push
```

This will create the necessary tables in your Supabase database.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Create an Account

1. Click "Get Started" or "Sign Up"
2. Enter your email and password
3. Check your email for confirmation (Supabase default flow)
4. Log in and start tracking your finances!

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests with Vitest
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio (database GUI)

## Project Structure

```
├── app/
│   ├── (auth)/              # Authentication pages (login, signup)
│   ├── (dashboard)/         # Protected dashboard pages
│   │   ├── dashboard/       # Main dashboard with charts
│   │   ├── income/          # Income management
│   │   └── expenses/        # Expense management
│   ├── api/                 # API routes
│   │   ├── income/          # Income endpoints
│   │   ├── expenses/        # Expense endpoints
│   │   └── summary/         # Summary endpoint
│   └── page.tsx             # Landing page
├── server/
│   ├── domain/              # Domain models (TypeScript interfaces)
│   ├── repositories/        # Data access layer (Drizzle ORM)
│   └── services/            # Business logic layer
├── lib/
│   ├── db/                  # Database configuration and schema
│   └── supabase/            # Supabase client configuration
├── components/ui/           # shadcn/ui components
└── middleware.ts            # Auth middleware
```

## Architecture Principles

- **Clean Architecture**: Clear separation between domain, services, repositories, and API
- **Money Precision**: All monetary values stored as integers (cents) in the database to avoid floating-point errors
- **Multi-User Ready**: Services and repositories always accept `userId` explicitly
- **Type Safety**: Full TypeScript coverage with strict mode
- **Tested Core Logic**: SummaryService has comprehensive unit tests

## Phase 1 Scope

This is Phase 1 of the project. The following features are **intentionally excluded**:

- Daily spending / transaction capture
- Receipt scanning
- Bank integrations
- AI features
- Mobile app
- Desktop app
- Multi-tenant architecture
- Notifications
- Email reports
- Export to CSV/PDF

## Database Schema

### `incomes` Table
- Stores user income sources
- Supports monthly and bi-weekly frequencies
- Amount stored as cents (integer)

### `recurring_expenses` Table
- Stores recurring expenses
- Supports monthly and annual frequencies
- Categorized (housing, utilities, subscriptions, insurance, transportation, other)
- Amount stored as cents (integer)

## Testing

Run tests:

```bash
npm test
```

Phase 1 includes unit tests for the SummaryService (core calculation logic). Repository and API tests are deferred to future phases.

## License

Private project - All rights reserved

## Support

For issues or questions, please contact the project maintainer.
