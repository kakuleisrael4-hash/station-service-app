-- =====================================================================
--  STATION KKC OIL — Migration : audit des dépenses par le VIEWER
--  Le Gérant/Auditeur (viewer) doit pouvoir LIRE les dépenses et leurs
--  catégories pour contrôler les sorties d'argent. L'écriture reste
--  réservée à l'Admin. Le POMPISTE n'a toujours AUCUN accès.
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

drop policy if exists exp_read on public.expenses;
create policy exp_read on public.expenses for select using (public.is_staff());

drop policy if exists cat_read on public.expense_categories;
create policy cat_read on public.expense_categories for select using (public.is_staff());
