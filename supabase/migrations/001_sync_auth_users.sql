-- Migration: Sync auth.users to public.users
-- This trigger automatically creates a record in public.users whenever a new user signs up
-- This ensures foreign key constraints work correctly for incomes and expenses tables

-- Create the trigger function
-- SECURITY DEFINER allows this function to access the auth schema
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

-- Create the trigger on auth.users
-- This fires after every INSERT on auth.users (i.e., when a new user signs up)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users from auth.users to public.users
-- This ensures any users that signed up before this migration are also synced
INSERT INTO public.users (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Verify the sync worked
-- This comment shows how to check that users are synced:
-- SELECT COUNT(*) FROM auth.users;
-- SELECT COUNT(*) FROM public.users;
-- Both should return the same count
