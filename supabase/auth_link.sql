-- =====================================================================
--  STATION KKC OIL — Liaison des comptes Auth aux rôles & pompistes
--  À exécuter APRÈS setup.sql ET après avoir créé les comptes dans
--  Supabase > Authentication > Users (ou via auto-inscription).
--  Remplacez les e-mails par les vôtres si besoin.
-- =====================================================================

-- 1) Crée / met à jour la ligne public.users (rôle) pour chaque compte auth.
insert into public.users (id, email, full_name, role)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)),
       case u.email
         when 'admin@kkc.cd' then 'admin'::user_role
         when 'jean@kkc.cd'  then 'pompiste'::user_role
         when 'audit@kkc.cd' then 'viewer'::user_role
         else 'viewer'::user_role
       end
from auth.users u
where u.email in ('admin@kkc.cd','jean@kkc.cd','audit@kkc.cd')
on conflict (id) do update set role = excluded.role, email = excluded.email;

-- 2) Relie le compte pompiste « jean@kkc.cd » à la fiche RH de départ « Pompiste 1 »
--    (renommez-la ensuite dans Paramètres → Fiches employés).
update public.pompiste_profiles p
set user_id = (select id from public.users where email = 'jean@kkc.cd')
where p.display_name = 'Pompiste 1' and p.user_id is null;

-- Vérification
select email, role from public.users order by role;
