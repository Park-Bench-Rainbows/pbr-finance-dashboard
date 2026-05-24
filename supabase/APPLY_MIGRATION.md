# How to Apply the User Sync Migration

This guide explains how to apply the migration that fixes the foreign key constraint error.

## The Problem

You're getting this error:
```
Error [PostgresError]: insert or update on table "incomes" violates foreign key constraint "incomes_user_id_users_id_fk"
```

This happens because:
- Users authenticate via Supabase (`auth.users` table)
- Your app tables reference `public.users` table
- `public.users` table is empty (no sync mechanism)

## The Solution

The migration in `migrations/001_sync_auth_users.sql` creates:
1. A trigger function that automatically inserts into `public.users`
2. A trigger on `auth.users` that fires on new signups
3. A backfill to sync existing users

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (in the left sidebar)
3. Click **New Query**
4. Copy the contents of `migrations/001_sync_auth_users.sql`
5. Paste into the SQL editor
6. Click **Run** or press `Ctrl+Enter`
7. You should see: "Success. No rows returned"

### Option 2: Supabase CLI

If you have Supabase CLI set up locally:

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Push the migration
supabase db push
```

## Verify It Worked

After applying the migration, verify it worked:

1. **Check the sync**:
   ```sql
   SELECT COUNT(*) FROM auth.users;
   SELECT COUNT(*) FROM public.users;
   -- Both should return the same number
   ```

2. **Test with your existing user**:
   - Try creating an income entry in your app
   - The user ID `324bd74f-76b7-47d1-99a4-03a191235481` should now work

3. **Test with new signups**:
   - Create a new user account
   - Immediately try to create an income
   - Should work without errors

## What Happens Next

- **New signups**: Automatically synced to `public.users` via trigger
- **Existing users**: Already synced via the backfill statement
- **Your code**: No changes needed, everything works as-is

## Troubleshooting

### "Permission denied for schema auth"

If you get this error, make sure you're running the query as a Supabase admin (using the Supabase Dashboard SQL Editor, not your application connection).

### "Trigger already exists"

If the trigger already exists, you can drop it first:
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

Then run the migration again.

### Still getting FK errors

Check if the user exists in both tables:
```sql
SELECT id FROM auth.users WHERE id = '324bd74f-76b7-47d1-99a4-03a191235481';
SELECT id FROM public.users WHERE id = '324bd74f-76b7-47d1-99a4-03a191235481';
```

If the user exists in `auth.users` but not `public.users`, run the backfill manually:
```sql
INSERT INTO public.users (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;
```
