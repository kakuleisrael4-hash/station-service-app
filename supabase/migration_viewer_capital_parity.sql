-- =====================================================================
--  STATION KKC OIL — Migration : le Gérant/Auditeur (viewer) voit le
--  MÊME Capital que l'Admin.
--
--  Bug trouvé : l'onglet Capital (CapitalEvolution.tsx) est le MÊME
--  composant pour admin et viewer, mais 5 tables dont il a besoin
--  (debts, debt_payments, supplier_orders, cash_entries,
--  currency_exchanges) n'avaient QUE des policies "admin uniquement" —
--  même en lecture. Pour un viewer, ces tables remontaient donc VIDES
--  (RLS filtre silencieusement, pas d'erreur) et son Capital affiché
--  était différent (plus bas) de celui de l'Admin.
--
--  Fix : ajoute une policy SELECT pour is_staff() (admin + viewer) sur
--  ces 5 tables, sans toucher aux policies d'écriture (toujours
--  admin uniquement).
--
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

drop policy if exists debts_read on public.debts;
create policy debts_read on public.debts for select using (public.is_staff());

drop policy if exists dpay_read on public.debt_payments;
create policy dpay_read on public.debt_payments for select using (public.is_staff());

drop policy if exists orders_read on public.supplier_orders;
create policy orders_read on public.supplier_orders for select using (public.is_staff());

drop policy if exists cash_read on public.cash_entries;
create policy cash_read on public.cash_entries for select using (public.is_staff());

drop policy if exists exchange_read on public.currency_exchanges;
create policy exchange_read on public.currency_exchanges for select using (public.is_staff());
