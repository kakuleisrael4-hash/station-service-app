-- =====================================================================
--  STATION KKC OIL — Migration : apports de fonds (entrées hors rapport)
--  À exécuter UNE FOIS dans le SQL Editor (projet déjà en place). Idempotent.
-- =====================================================================

-- 1) Table des apports de fonds --------------------------------------
create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  currency currency not null default 'FC',
  amount numeric(16,2) not null,
  motif text not null,
  date date not null default current_date,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- 2) Sécurité : admin uniquement -------------------------------------
alter table public.cash_entries enable row level security;
drop policy if exists cash_admin on public.cash_entries;
create policy cash_admin on public.cash_entries for all
  using (public.is_admin()) with check (public.is_admin());

-- 3) Realtime + recalcul du capital ----------------------------------
do $$ begin alter publication supabase_realtime add table public.cash_entries; exception when others then null; end $$;
drop trigger if exists trg_cap_cash on public.cash_entries;
create trigger trg_cap_cash after insert or update or delete on public.cash_entries
  for each statement execute function public.trg_snapshot_capital();

-- 4) Intégrer les apports dans le calcul de caisse du capital --------
create or replace function public.snapshot_capital() returns void language plpgsql as $$
declare v_taux numeric; v_fc numeric; v_usd numeric; v_caisse numeric; v_stock numeric; v_debts numeric; v_orders numeric;
begin
  select taux_journalier into v_taux from public.settings limit 1;
  v_taux := coalesce(v_taux, 0);
  v_fc := coalesce((select sum(total_billetage_fc) from public.reports where status='valide'),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='FC'),0)
        + coalesce((select sum(amount) from public.cash_entries where currency='FC'),0)
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='FC'),0)
        - coalesce((select sum(case when status='livre' then purchase_price else deposit end) from public.supplier_orders),0);
  v_usd := coalesce((select sum(total_usd) from public.reports where status='valide'),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='USD'),0)
        + coalesce((select sum(amount) from public.cash_entries where currency='USD'),0)
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='USD'),0);
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
