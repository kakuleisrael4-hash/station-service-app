-- =====================================================================
--  STATION KKC OIL — Migration : Capital sans les dettes + Bureau de change
--
--  1) Nouvelle table currency_exchanges (transferts USD<->FC entre les
--     compartiments de la caisse) + RLS (Admin) + Realtime.
--  2) snapshot_capital() corrigée : Capital = Caisse + Stock + Commandes en
--     cours (les dettes clients ne sont PLUS incluses — ce sont des
--     créances, pas de l'argent réel ; `debts` reste calculé/stocké dans
--     capital_history pour historique, juste exclu de la somme `capital`).
--     La caisse (v_fc/v_usd) intègre aussi les transferts du bureau de change.
--
--  À exécuter UNE FOIS dans le SQL Editor (script entier). Idempotent.
-- =====================================================================

-- 1) Table + RLS + Realtime
create table if not exists public.currency_exchanges (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('usd_to_fc','fc_to_usd')),
  amount numeric(16,2) not null,
  amount_to numeric(16,2) not null,
  rate numeric(12,2) not null,
  motif text,
  date date not null default current_date,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

alter table public.currency_exchanges enable row level security;

drop policy if exists exchange_admin on public.currency_exchanges;
create policy exchange_admin on public.currency_exchanges for all using (public.is_admin()) with check (public.is_admin());

do $$ begin
  alter publication supabase_realtime add table public.currency_exchanges;
exception when others then null; end $$;

-- 2) snapshot_capital() : formule corrigée
create or replace function public.snapshot_capital() returns void language plpgsql as $$
declare v_taux numeric; v_fc numeric; v_usd numeric; v_caisse numeric; v_stock numeric; v_debts numeric; v_orders numeric;
        v_exch_fc numeric; v_exch_usd numeric;
begin
  select taux_journalier into v_taux from public.settings limit 1;
  v_taux := coalesce(v_taux, 0);
  v_exch_fc := coalesce((select sum(amount_to) from public.currency_exchanges where direction='usd_to_fc'),0)
             - coalesce((select sum(amount) from public.currency_exchanges where direction='fc_to_usd'),0);
  v_exch_usd := coalesce((select sum(amount_to) from public.currency_exchanges where direction='fc_to_usd'),0)
              - coalesce((select sum(amount) from public.currency_exchanges where direction='usd_to_fc'),0);
  v_fc := coalesce((select sum(total_billetage_fc) from public.reports where status='valide' and closed),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='FC'),0)
        + coalesce((select sum(amount) from public.cash_entries where currency='FC'),0)
        + v_exch_fc
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='FC'),0)
        - coalesce((select sum(montant_paye_fc) from public.salary_payments),0)
        - coalesce((select sum(case when status in ('livre','partielle') then purchase_price else deposit end) from public.supplier_orders),0);
  v_usd := coalesce((select sum(total_usd) from public.reports where status='valide' and closed),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='USD'),0)
        + coalesce((select sum(amount) from public.cash_entries where currency='USD'),0)
        + v_exch_usd
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='USD'),0)
        - coalesce((select sum(montant_paye_usd) from public.salary_payments),0);
  v_caisse := v_fc + v_usd * v_taux;
  v_stock := coalesce((select sum(current_l*sale_price_fc) from public.cisterns),0);
  v_debts := coalesce((select sum((total_amount - coalesce((select sum(amount) from public.debt_payments p where p.debt_id=d.id),0))
                       * (case when d.currency='USD' then v_taux else 1 end))
                       from public.debts d where d.status='en_attente'),0);
  v_orders := coalesce((select sum(purchase_price) from public.supplier_orders where status='en_cours'),0);
  insert into public.capital_history(date,caisse,stock_value,debts,orders_value,capital)
    values (current_date,v_caisse,v_stock,v_debts,v_orders,v_caisse+v_stock+v_orders)
    on conflict (date) do update set caisse=excluded.caisse, stock_value=excluded.stock_value,
      debts=excluded.debts, orders_value=excluded.orders_value, capital=excluded.capital;
end $$;

-- Trigger de recalcul automatique sur les échanges de devises
drop trigger if exists trg_cap_exchanges on public.currency_exchanges;
create trigger trg_cap_exchanges after insert or update or delete on public.currency_exchanges
  for each statement execute function public.trg_snapshot_capital();

-- Réapplique la formule corrigée aux jours déjà persistés (recalcule le
-- point du jour ; les jours passés gardent leur `capital` historique tel
-- quel — seul le jour courant est réévalué à l'exécution de ce script).
select public.snapshot_capital();
