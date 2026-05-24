-- 005_user_theme_setting

alter table public.user_settings
  add column if not exists theme text;

update public.user_settings
set theme = coalesce(theme, 'system')
where theme is null;

alter table public.user_settings
  alter column theme set default 'system';

alter table public.user_settings
  alter column theme set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_theme_check'
      and conrelid = 'public.user_settings'::regclass
  ) then
    alter table public.user_settings
      add constraint user_settings_theme_check check (theme in ('light','dark','system'));
  end if;
end $$;

