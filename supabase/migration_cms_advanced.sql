-- =====================================================================
--  STATION KKC OIL — Migration : CMS avancé de la page d'accueil
--  Agencement des sections (ordre + visibilité), badge promo, statut
--  Ouvert/Fermé (auto + fermeture forcée), modes du Hero (image/vidéo/néon).
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

alter table public.landing_page_content add column if not exists sections jsonb not null default
  '[{"id":"hero","visible":true},{"id":"tarifs","visible":true},{"id":"features","visible":true},{"id":"apropos","visible":true},{"id":"infos","visible":true},{"id":"cta","visible":true}]'::jsonb;
alter table public.landing_page_content add column if not exists promo_text text not null default '';
alter table public.landing_page_content add column if not exists hero_mode text not null default 'image';
alter table public.landing_page_content add column if not exists hero_video_url text not null default '';
alter table public.landing_page_content add column if not exists open_mode text not null default 'auto';
alter table public.landing_page_content add column if not exists closed_reason text not null default '';
alter table public.landing_page_content add column if not exists open_from text not null default '';
alter table public.landing_page_content add column if not exists open_to text not null default '';

-- Garde-fous sur les valeurs métier.
alter table public.landing_page_content drop constraint if exists landing_hero_mode_chk;
alter table public.landing_page_content add constraint landing_hero_mode_chk
  check (hero_mode in ('image', 'video', 'neon'));
alter table public.landing_page_content drop constraint if exists landing_open_mode_chk;
alter table public.landing_page_content add constraint landing_open_mode_chk
  check (open_mode in ('auto', 'force_closed'));
