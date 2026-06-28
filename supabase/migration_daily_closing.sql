-- =====================================================================
--  STATION KKC OIL — Migration : clôture journalière + index libres
--  À exécuter UNE FOIS dans le SQL Editor (projet déjà en place). Idempotent.
--  IMPORTANT : marque les rapports EXISTANTS comme clôturés SANS re-déclencher
--  les impacts (ils étaient déjà reconnus sous l'ancien modèle).
-- =====================================================================

-- 1) Colonnes de clôture sur les rapports ----------------------------
alter table public.reports add column if not exists closed boolean not null default false;
alter table public.reports add column if not exists closed_at timestamptz;

-- 2) Table des clôtures journalières ---------------------------------
create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  report_ids jsonb not null default '[]'::jsonb,
  report_count int not null default 0,
  total_super_l numeric(16,2) not null default 0,
  total_gasoil_l numeric(16,2) not null default 0,
  total_volume_l numeric(16,2) not null default 0,
  total_encaisse numeric(18,2) not null default 0,
  total_benefice numeric(18,2) not null default 0,
  closed_by uuid references public.users (id),
  closed_at timestamptz not null default now()
);
alter table public.daily_closings enable row level security;
drop policy if exists closing_read on public.daily_closings;
create policy closing_read on public.daily_closings for select using (public.is_staff());
drop policy if exists closing_admin on public.daily_closings;
create policy closing_admin on public.daily_closings for all using (public.is_admin()) with check (public.is_admin());
do $$ begin alter publication supabase_realtime add table public.daily_closings; exception when others then null; end $$;

-- 3) La validation ne fait plus que dater (impacts déplacés vers la clôture)
create or replace function public.on_report_validated() returns trigger language plpgsql as $$
begin
  if new.status='valide' and (old.status is distinct from 'valide') then
    new.validated_at := now();
  end if;
  return new;
end $$;

-- 4) Nouveau trigger : clôture -> décrément citernes + mouvements + RH
create or replace function public.on_report_closed() returns trigger language plpgsql as $$
declare rd record; puser uuid;
begin
  if new.closed and (old.closed is distinct from true) then
    new.closed_at := now();
    for rd in select * from public.report_pump_readings where report_id=new.id and litrage>0 loop
      update public.cisterns set current_l=greatest(current_l-rd.litrage,0), updated_at=now() where id=rd.cistern_id;
      insert into public.fuel_movements(cistern_id,kind,volume_l,source,ref_id,label)
        values (rd.cistern_id,'sortie',rd.litrage,'rapport',new.id,'Clôture rapport '||new.report_date);
    end loop;
    if new.manquant>0 then
      update public.pompiste_profiles set cumul_manquants_mois=cumul_manquants_mois+new.manquant
        where id=new.pompiste_id returning user_id into puser;
      if puser is not null then
        insert into public.notifications(user_id,type,title,body,meta)
        values (puser,'manquant','Manquant imputé','Un manquant de '||new.manquant||' FC sur votre rapport du '||new.report_date||'.',
                jsonb_build_object('amount',new.manquant,'report_id',new.id));
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_report_closed on public.reports;
create trigger trg_report_closed before update on public.reports
  for each row execute function public.on_report_closed();

-- 5) Capital : ne compter QUE les rapports clôturés
create or replace function public.snapshot_capital() returns void language plpgsql as $$
declare v_taux numeric; v_fc numeric; v_usd numeric; v_caisse numeric; v_stock numeric; v_debts numeric; v_orders numeric;
begin
  select taux_journalier into v_taux from public.settings limit 1;
  v_taux := coalesce(v_taux, 0);
  v_fc := coalesce((select sum(total_billetage_fc) from public.reports where status='valide' and closed),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='FC'),0)
        + coalesce((select sum(amount) from public.cash_entries where currency='FC'),0)
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='FC'),0)
        - coalesce((select sum(case when status='livre' then purchase_price else deposit end) from public.supplier_orders),0);
  v_usd := coalesce((select sum(total_usd) from public.reports where status='valide' and closed),0)
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

-- 6) Rapports DÉJÀ existants : marqués clôturés SANS re-déclencher les impacts
--    (ils étaient déjà reconnus financièrement sous l'ancien modèle).
alter table public.reports disable trigger trg_report_closed;
update public.reports set closed = true, closed_at = coalesce(validated_at, now())
  where status = 'valide' and closed = false;
alter table public.reports enable trigger trg_report_closed;

-- 7) Recalcule le capital du jour avec le nouveau modèle
select public.snapshot_capital();
