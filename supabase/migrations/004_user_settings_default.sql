-- 004_user_settings_default
-- Default base currency TTD + backfill

insert into public.user_settings (user_id, base_currency)
select id, 'TTD'
from public.users
on conflict (user_id) do nothing;

create or replace function public.ensure_user_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_settings (user_id, base_currency)
  values (new.id, 'TTD')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_public_user_created on public.users;
create trigger on_public_user_created
  after insert on public.users
  for each row
  execute function public.ensure_user_settings();

