# Quick Start: Fix Foreign Key Error

## The Error You're Getting

```
Error [PostgresError]: insert or update on table "incomes" violates foreign key constraint
detail: 'Key (user_id)=(324bd74f-76b7-47d1-99a4-03a191235481) is not present in table "users".'
```

## The Fix (3 Steps)

### Step 1: Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Migration

Copy and paste this SQL:

```sql
-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.users (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

Click **Run** (or press Ctrl+Enter).

### Step 3: Verify & Test

Run this query to verify:

```sql
SELECT COUNT(*) FROM auth.users;
SELECT COUNT(*) FROM public.users;
```

Both should return the same number.

## Done!

Now try creating an income in your app. It should work without errors.

## What Just Happened?

- ✅ Created a function that syncs new users to `public.users`
- ✅ Attached a trigger to `auth.users` that fires on signup
- ✅ Backfilled all existing users

From now on, when someone signs up, they're automatically added to `public.users`.

---

**Full documentation**: See [`APPLY_MIGRATION.md`](./APPLY_MIGRATION.md) for detailed troubleshooting and explanations.
