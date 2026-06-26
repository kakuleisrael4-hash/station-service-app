-- =====================================================================
--  STATION KKC OIL — Bucket Storage « landing » pour les images du CMS
--  À exécuter une fois dans le SQL Editor (inclus aussi dans setup.sql).
--  Le CMS vitrine téléverse logo / fond / galerie ici et ne stocke que
--  l'URL publique dans public.landing_page_content.
-- =====================================================================

-- Bucket public (lecture anonyme des images).
insert into storage.buckets (id, name, public)
values ('landing', 'landing', true)
on conflict (id) do nothing;

-- Lecture publique des objets du bucket « landing ».
drop policy if exists "landing public read" on storage.objects;
create policy "landing public read" on storage.objects
  for select using (bucket_id = 'landing');

-- Écriture (upload / remplacement / suppression) réservée à l'admin.
drop policy if exists "landing admin write" on storage.objects;
create policy "landing admin write" on storage.objects
  for all
  using (bucket_id = 'landing' and public.is_admin())
  with check (bucket_id = 'landing' and public.is_admin());
