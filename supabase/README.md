# Supabase Database Migrations

This directory contains SQL migrations for your Supabase database.

## Current Migrations

### 001_sync_auth_users.sql

**Purpose**: Automatically sync users from `auth.users` to `public.users`

**Why it's needed**: 
- Your app uses Supabase authentication (`auth.users`)
- Your database tables reference `public.users` for foreign keys
- Without syncing, foreign key constraints fail

**What it does**:
1. Creates a trigger function `public.handle_new_user()`
2. Attaches a trigger to `auth.users` that fires on INSERT
3. Backfills existing users from `auth.users` to `public.users`

**Status**: Ready to apply ✅

See [`APPLY_MIGRATION.md`](./APPLY_MIGRATION.md) for detailed instructions on how to apply this migration.

## Architecture

```
┌─────────────────┐
│  User Signs Up  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  auth.users     │◄─── Supabase manages this
│  (Supabase)     │
└────────┬────────┘
         │
         │ TRIGGER: on_auth_user_created
         │ FUNCTION: handle_new_user()
         │
         ▼
┌─────────────────┐
│  public.users   │◄─── Your app tables reference this
│  (Your Schema)  │
└────────┬────────┘
         │
         │ Foreign Key Constraints
         │
         ▼
┌─────────────────┐
│  incomes        │
│  expenses       │
│  (Your Tables)  │
└─────────────────┘
```

## Quick Start

To fix the foreign key constraint error:

1. **Apply the migration** (see [`APPLY_MIGRATION.md`](./APPLY_MIGRATION.md))
2. **Verify it worked**:
   ```sql
   SELECT COUNT(*) FROM auth.users;
   SELECT COUNT(*) FROM public.users;
   -- Should return the same count
   ```
3. **Test your app** - try creating an income or expense

## Future Migrations

When you need to add more user fields to `public.users` (like email, name, etc.), you can modify the trigger function:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, new.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Make sure to update your `public.users` table schema first to include those columns.
