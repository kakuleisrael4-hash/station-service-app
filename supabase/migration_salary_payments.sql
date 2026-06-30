-- =====================================================================
--  STATION KKC OIL — Migration : paiement des salaires (clôture RH)
--  Table salary_payments + RPC pay_salary (insert, reset cumul manquants,
--  notification pompiste, décaissement caisse via snapshot_capital).
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

-- 1) Table des paiements -----------------------------------------------
create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  pompiste_id uuid references public.pompiste_profiles (id) on delete set null,
  mois_concerne text not null,                 -- période "YYYY-MM"
  date_paiement date not null default current_date,
  temps_travail numeric(10,2) not null default 0,
  temps_unite text not null default 'jours' check (temps_unite in ('jours','heures')),
  montant_paye_fc numeric(16,2) not null default 0,
  montant_paye_usd numeric(16,2) not null default 0,
  valide_par uuid references public.users (id),
  created_at timestamptz not null default now()
);
alter table public.salary_payments enable row level security;
drop policy if exists salpay_read on public.salary_payments;
create policy salpay_read on public.salary_payments for select
  using (public.is_staff() or pompiste_id = public.my_pompiste_id());
drop policy if exists salpay_admin on public.salary_payments;
create policy salpay_admin on public.salary_payments for all
  using (public.is_admin()) with check (public.is_admin());
do $$ begin alter publication supabase_realtime add table public.salary_payments; exception when others then null; end $$;

-- 2) Capital : soustrait aussi les salaires versés (FC & USD) -----------
create or replace function public.snapshot_capital() returns void language plpgsql as $$
declare v_taux numeric; v_fc numeric; v_usd numeric; v_caisse numeric; v_stock numeric; v_debts numeric; v_orders numeric;
begin
  select taux_journalier into v_taux from public.settings limit 1;
  v_taux := coalesce(v_taux, 0);
  v_fc := coalesce((select sum(total_billetage_fc) from public.reports where status='valide' and closed),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='FC'),0)
        + coalesce((select sum(amount) from public.cash_entries where currency='FC'),0)
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='FC'),0)
        - coalesce((select sum(montant_paye_fc) from public.salary_payments),0)
        - coalesce((select sum(case when status='livre' then purchase_price else deposit end) from public.supplier_orders),0);
  v_usd := coalesce((select sum(total_usd) from public.reports where status='valide' and closed),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='USD'),0)
        + coalesce((select sum(amount) from public.cash_entries where currency='USD'),0)
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='USD'),0)
        - coalesce((select sum(montant_paye_usd) from public.salary_payments),0);
  v_caisse := v_fc + v_usd * v_taux;
  v_stock := coalesce((select sum(current_l*sale_price_fc) from public.cisterns),0);
  v_debts := coalesce((select sum((total_amount - coalesce((select sum(amount) from public.debt_payments p where p.debt_id=d.id),0))
                       * (case when d.currency='USD' then v_taux else 1 end))
                       from public.debts d where d.status='en_attente'),0);
  v_orders := coalesce((select sum(purchase_price) from public.supplier_orders where status='en_cours'),0);
  insert into public.capital_history(date,caisse,stock_value,debts,orders_value,capital)
    values (current_date,v_caisse,v_stock,v_debts,v_orders,v_caisse+v_stock+v_debts+v_orders)
    on conflict (date) do update set caisse=excluded.caisse, stock_value=excluded.stock_value,
      debts=excluded.debts, orders_value=excluded.orders_value, capital=excluded.capital;
end $$;

-- 3) RPC transactionnelle de paiement (réservée Admin) -----------------
create or replace function public.pay_salary(
  p_pompiste_id uuid, p_mois text, p_date date, p_temps numeric, p_unite text, p_fc numeric, p_usd numeric
) returns void language plpgsql security definer set search_path = public as $$
declare puser uuid;
begin
  if not public.is_admin() then raise exception 'Action réservée à l''administrateur.'; end if;
  insert into public.salary_payments(pompiste_id, mois_concerne, date_paiement, temps_travail, temps_unite, montant_paye_fc, montant_paye_usd, valide_par)
    values (p_pompiste_id, p_mois, coalesce(p_date, current_date), coalesce(p_temps, 0),
            coalesce(p_unite, 'jours'), coalesce(p_fc, 0), coalesce(p_usd, 0), auth.uid());
  -- Remise à zéro du cumul des manquants (nouveau cycle propre).
  update public.pompiste_profiles set cumul_manquants_mois = 0 where id = p_pompiste_id returning user_id into puser;
  if puser is not null then
    insert into public.notifications(user_id, type, title, body, meta)
    values (puser, 'info', '💰 Salaire versé',
      'Votre salaire pour le mois de ' || p_mois || ' a été versé le ' || coalesce(p_date, current_date)
        || '. Temps enregistré : ' || coalesce(p_temps, 0) || ' ' || coalesce(p_unite, 'jours') || '.',
      jsonb_build_object('fc', p_fc, 'usd', p_usd, 'mois', p_mois));
  end if;
  perform public.snapshot_capital(); -- décaissement -> caisse/capital à jour
end $$;
