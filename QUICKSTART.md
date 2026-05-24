# Quick Start Guide

Get your Finance Dashboard running in 5 minutes!

## Prerequisites

- Node.js 20+ installed
- A Supabase account (free)

## Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Get your credentials from Settings → API
3. Get your database URL from Settings → Database

### 3. Configure Environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=your-database-connection-string
```

### 4. Set Up Database

```bash
npm run db:push
```

### 5. Start the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Create Account & Start Tracking

1. Click "Get Started"
2. Sign up with email/password
3. Confirm your email
4. Log in and start adding income and expenses!

## Need Help?

See [SETUP.md](SETUP.md) for detailed instructions.

## Verify Installation

```bash
npm test        # All tests should pass
npm run build   # Should build successfully
```

That's it! 🎉
