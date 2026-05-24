# Setup Guide - Finance Dashboard

This guide will walk you through setting up the Finance Dashboard application from scratch.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 20+** installed ([Download](https://nodejs.org/))
- A **Supabase account** (free tier available at [supabase.com](https://supabase.com))
- A code editor (VS Code recommended)
- Git (optional, for version control)

## Step-by-Step Setup

### 1. Install Dependencies

Open your terminal in the project directory and run:

```bash
npm install
```

This will install all required packages including Next.js, React, Supabase, Drizzle ORM, and UI components.

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account)
2. Click "New Project"
3. Fill in the project details:
   - **Name**: finance-dashboard (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to you
   - **Pricing Plan**: Free tier is sufficient for Phase 1
4. Click "Create new project"
5. Wait 2-3 minutes for the database to be provisioned

### 3. Get Your Supabase Credentials

Once your project is ready:

#### Get API Credentials:
1. In your Supabase project dashboard, click on the **Settings** icon (gear) in the left sidebar
2. Navigate to **API** section
3. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

#### Get Database Connection String:
1. Still in Settings, navigate to **Database** section
2. Scroll down to "Connection string"
3. Select **URI** tab
4. Copy the connection string
5. **Important**: Replace `[YOUR-PASSWORD]` in the connection string with the database password you set in step 2

### 4. Configure Environment Variables

1. In the project root directory, create a file named `.env.local`
2. Add the following content (replace with your actual values):

```env
# Supabase API Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Database Connection (for Drizzle ORM)
DATABASE_URL=postgresql://postgres.your-project-id:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres.abcdefghijklmnop:MySecurePassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 5. Set Up the Database Schema

Run the following command to create the necessary database tables:

```bash
npm run db:push
```

This will create two tables in your Supabase database:
- `incomes` - stores income sources
- `recurring_expenses` - stores recurring expenses

You should see output confirming the tables were created successfully.

### 6. Verify the Setup

Check that everything is configured correctly:

```bash
npm run test
```

All 13 tests should pass. If they do, your setup is correct!

### 7. Start the Development Server

```bash
npm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000)

### 8. Create Your First Account

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Click "Get Started" or "Sign Up"
3. Enter your email and password (minimum 6 characters)
4. Click "Sign Up"
5. Check your email for a confirmation link from Supabase
6. Click the confirmation link
7. Return to the app and click "Sign In"
8. Log in with your credentials

### 9. Start Using the App

Once logged in, you'll see the dashboard. You can now:

1. **Add Income Sources**:
   - Click "Income" in the navigation
   - Click "Add Income"
   - Enter your income details (name, amount, frequency)
   - Save

2. **Add Recurring Expenses**:
   - Click "Expenses" in the navigation
   - Click "Add Expense"
   - Enter expense details (name, amount, frequency, category)
   - Save

3. **View Your Dashboard**:
   - Click "Dashboard" in the navigation
   - Select a month to view
   - See your total income, expenses, and disposable income
   - View charts showing your financial breakdown

## Troubleshooting

### "Failed to connect to database" Error

**Problem**: The app can't connect to Supabase.

**Solutions**:
1. Double-check your `.env.local` file has the correct values
2. Ensure you replaced `[YOUR-PASSWORD]` in the DATABASE_URL with your actual password
3. Verify your Supabase project is active (not paused)
4. Restart the development server (`Ctrl+C` then `npm run dev`)

### "Unauthorized" Error When Using the App

**Problem**: You're not properly authenticated.

**Solutions**:
1. Make sure you confirmed your email address
2. Try logging out and logging back in
3. Check that your Supabase project's auth settings allow email/password authentication

### Tables Not Created

**Problem**: `npm run db:push` fails or doesn't create tables.

**Solutions**:
1. Verify your DATABASE_URL is correct in `.env.local`
2. Check that your database password doesn't contain special characters that need URL encoding
3. Try running `npm run db:push` again
4. Check Supabase dashboard > Database > Tables to see if tables exist

### Port 3000 Already in Use

**Problem**: Another application is using port 3000.

**Solutions**:
1. Stop the other application using port 3000
2. Or, run Next.js on a different port: `npm run dev -- -p 3001`

### Email Confirmation Not Received

**Problem**: You didn't receive the Supabase confirmation email.

**Solutions**:
1. Check your spam/junk folder
2. In Supabase dashboard, go to Authentication > Settings
3. Temporarily disable "Enable email confirmations" for development
4. Try signing up again

## Optional: Database Management

### View Your Database

To explore your database with a GUI:

```bash
npm run db:studio
```

This opens Drizzle Studio in your browser, where you can view and edit data directly.

### Generate Migrations (Advanced)

If you modify the schema in `lib/db/schema.ts`, generate a migration:

```bash
npm run db:generate
npm run db:migrate
```

## Next Steps

- Explore the codebase structure (see README.md)
- Add your real income and expenses
- Try different months in the dashboard
- Customize the categories in `server/domain/recurring-expense.ts`

## Getting Help

If you encounter issues not covered here:

1. Check the main README.md for architecture details
2. Review the Supabase documentation: [supabase.com/docs](https://supabase.com/docs)
3. Check Next.js documentation: [nextjs.org/docs](https://nextjs.org/docs)

## Security Notes

- Never commit `.env.local` to version control (it's already in `.gitignore`)
- Keep your database password secure
- The anon key is safe to expose in client-side code (it's public by design)
- For production, use Supabase's Row Level Security (RLS) policies

---

**Congratulations!** You've successfully set up the Finance Dashboard. Start tracking your finances! 🎉
