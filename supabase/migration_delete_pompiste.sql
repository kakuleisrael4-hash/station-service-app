-- =====================================================================
--  STATION KKC OIL — Migration : suppression sécurisée d'un pompiste
--  Rend reports.pompiste_id nullable + ON DELETE SET NULL, pour conserver
--  l'historique des ventes / capital quand un pompiste est supprimé.
--  À exécuter UNE FOIS dans le SQL Editor (projet déjà en place).
-- =====================================================================

alter table public.reports alter column pompiste_id drop not null;

alter table public.reports drop constraint if exists reports_pompiste_id_fkey;
alter table public.reports
  add constraint reports_pompiste_id_fkey
  foreign key (pompiste_id) references public.pompiste_profiles (id) on delete set null;

-- (Rappel : public.users.id référence auth.users ON DELETE CASCADE, et
--  pompiste_profiles.user_id référence public.users ON DELETE SET NULL —
--  déjà en place via schema.sql, aucune action requise pour ces deux-là.)
