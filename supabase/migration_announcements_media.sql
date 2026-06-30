-- =====================================================================
--  STATION KKC OIL — Migration : pièces jointes universelles (communiqués)
--  Ajoute un champ flexible `attachments` (jsonb) à announcements et crée
--  un bucket Storage dédié aux médias (images, vidéos, PDF, Word, Excel…).
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

-- 1) Champ flexible : liste d'objets { file_url, file_name, file_type }.
alter table public.announcements add column if not exists attachments jsonb not null default '[]'::jsonb;

-- 2) Bucket public dédié aux pièces jointes (backstop de taille : 50 Mo).
insert into storage.buckets (id, name, public, file_size_limit)
values ('station-media-attachments', 'station-media-attachments', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

-- 3) Lecture publique (tous les rôles consultent les communiqués) ; écriture admin.
drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'station-media-attachments');

drop policy if exists "media admin write" on storage.objects;
create policy "media admin write" on storage.objects
  for all
  using (bucket_id = 'station-media-attachments' and public.is_admin())
  with check (bucket_id = 'station-media-attachments' and public.is_admin());
