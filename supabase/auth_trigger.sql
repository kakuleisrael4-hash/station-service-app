-- =====================================================================
--  STATION KKC OIL — Auto-création du profil (rôle) à chaque inscription
--  À exécuter une fois dans le SQL Editor (inclus aussi dans setup.sql).
--  Chaque nouvel utilisateur Supabase Auth obtient automatiquement sa ligne
--  public.users en rôle « viewer » ; l'admin n'a plus qu'à la promouvoir
--  (menu Paramètres → Rôles & accès, ou UPDATE public.users SET role=...).
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
