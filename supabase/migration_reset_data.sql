-- =====================================================================
--  STATION KKC OIL — Migration : Réinitialisation des données (Admin)
--
--  Nouvelle fonction RPC `reset_station_data()` (bouton dans Paramètres) :
--  vide TOUT l'historique transactionnel et remet les citernes à 0L.
--
--  CONSERVE : comptes (users/pompiste_profiles — juste le cumul manquants
--  remis à 0), pompes/citernes (définitions), prix/réglages (settings),
--  catégories de dépenses, contenu du site vitrine (landing_page_content).
--
--  Réservé Admin (même garde `is_admin()` que delete_report/delete_order).
--  Action IRRÉVERSIBLE — confirmée côté UI avant l'appel (Paramètres).
--
--  NOTE : comme delete_report/delete_closing/delete_order/quick_delivery,
--  cette fonction vit uniquement ici (pas dans schema.sql) — gap connu du
--  schéma "fresh install", déjà signalé pour une passe de nettoyage future.
--
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent (create or replace).
-- =====================================================================

create or replace function public.reset_station_data() returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Action réservée à l''administrateur.'; end if;

  -- `where true` : ce projet Supabase impose une clause WHERE sur tout
  -- DELETE/UPDATE (garde anti-suppression-massive, active même dans une
  -- fonction) — where true ne filtre rien, juste satisfait la garde.
  delete from public.reports where true;          -- cascade : report_pump_readings, expenses(report_id), debts(report_id->debt_payments)
  delete from public.expenses where true;         -- dépenses hors-rapport restantes
  delete from public.debts where true;            -- dettes hors-rapport restantes (cascade debt_payments)
  delete from public.supplier_orders where true;
  delete from public.cash_entries where true;
  delete from public.currency_exchanges where true;
  delete from public.daily_closings where true;
  delete from public.capital_history where true;
  delete from public.stock_logs where true;
  delete from public.fuel_movements where true;
  delete from public.announcements where true;
  delete from public.notifications where true;
  delete from public.salary_payments where true;
  delete from public.salary_history where true;

  update public.cisterns set current_l = 0, updated_at = now() where true;
  update public.pompiste_profiles set cumul_manquants_mois = 0 where true;

  perform public.snapshot_capital();
end $$;
