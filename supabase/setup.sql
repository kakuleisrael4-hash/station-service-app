-- =====================================================================
--  STATION KKC OIL — SETUP COMPLET (Supabase > SQL Editor)
--  = schema.sql + rls.sql + seed.sql
-- =====================================================================

-- ############ 1/3 — SCHÉMA & LOGIQUE MÉTIER ############
-- =====================================================================
--  STATION KKC OIL — Schéma BD v2 (PostgreSQL / Supabase)
--  Architecture physique (3 citernes / 4 pompes) + finance avancée.
--  Exécuter dans le SQL Editor, puis rls.sql, puis seed.sql.
--  La logique métier vit dans des TRIGGERS (= src/lib/calc.ts + selectors.ts).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ----------------------------- ENUMS ---------------------------------
do $$ begin create type user_role     as enum ('admin','pompiste','viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type report_status as enum ('brouillon','valide');        exception when duplicate_object then null; end $$;
do $$ begin create type fuel_type     as enum ('super','gasoil');            exception when duplicate_object then null; end $$;
do $$ begin create type notif_type    as enum ('manquant','augmentation_salaire','rapport_valide','info'); exception when duplicate_object then null; end $$;
do $$ begin create type movement_kind as enum ('entree','sortie');          exception when duplicate_object then null; end $$;
do $$ begin create type movement_src  as enum ('livraison','rapport','ajustement'); exception when duplicate_object then null; end $$;
do $$ begin create type debt_status   as enum ('en_attente','soldee');      exception when duplicate_object then null; end $$;
do $$ begin create type order_status  as enum ('en_cours','livre');         exception when duplicate_object then null; end $$;
do $$ begin create type currency      as enum ('FC','USD');                 exception when duplicate_object then null; end $$;

-- ----------------------- UTILISATEURS / RH ---------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null, full_name text not null,
  role user_role not null default 'viewer', avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.pompiste_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users (id) on delete set null,
  display_name text not null, phone text, photo_url text,
  base_salary numeric(14,2) not null default 0,        -- part FC
  base_salary_usd numeric(14,2) not null default 0,    -- part USD
  cumul_manquants_mois numeric(14,2) not null default 0,  -- toujours en FC
  current_period text not null default to_char(now(),'YYYY-MM'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.salary_history (
  id uuid primary key default gen_random_uuid(),
  pompiste_id uuid not null references public.pompiste_profiles (id) on delete cascade,
  old_salary numeric(14,2) not null, new_salary numeric(14,2) not null,
  old_salary_usd numeric(14,2) not null default 0, new_salary_usd numeric(14,2) not null default 0,
  changed_by uuid references public.users (id), reason text,
  changed_at timestamptz not null default now()
);

-- ---------------- INFRASTRUCTURE : CITERNES & POMPES -----------------
create table if not exists public.cisterns (
  id text primary key,                          -- cit-gasoil / cit-super1 / cit-super2
  name text not null, fuel fuel_type not null,
  capacity_l numeric(14,2) not null,
  current_l numeric(14,2) not null,
  sale_price_fc numeric(10,2) not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.pumps (
  id text primary key,                          -- p1..p4
  label text not null, fuel fuel_type not null,
  cistern_id text not null references public.cisterns (id)
);

create table if not exists public.fuel_movements (
  id uuid primary key default gen_random_uuid(),
  cistern_id text not null references public.cisterns (id),
  kind movement_kind not null, volume_l numeric(14,2) not null,
  source movement_src not null, ref_id uuid, label text,
  created_at timestamptz not null default now()
);

-- ------------------------ DÉPENSES / CATÉGORIES ----------------------
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null, color text not null default '#10b981'
);

-- --------------------------- RAPPORTS --------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  -- nullable + ON DELETE SET NULL : si un pompiste est supprimé, ses rapports
  -- restent (historique des ventes / capital préservé), juste détachés.
  pompiste_id uuid references public.pompiste_profiles (id) on delete set null,
  author_id uuid references public.users (id),
  report_date date not null default current_date,
  manquant numeric(14,2) not null default 0,
  taux_journalier numeric(10,2) not null default 0,
  total_usd numeric(14,2) not null default 0,
  billetage jsonb not null default '{}'::jsonb,
  auto_score smallint, final_stars smallint check (final_stars between 1 and 5),
  admin_comment text,
  -- agrégats dérivés (maintenus par triggers ; "essence" == Super)
  essence_litrage numeric(14,2) not null default 0,
  essence_montant numeric(16,2) not null default 0,
  gasoil_litrage  numeric(14,2) not null default 0,
  gasoil_montant  numeric(16,2) not null default 0,
  total_depenses  numeric(14,2) not null default 0,
  total_a_remettre numeric(16,2) not null default 0,
  total_billetage_fc numeric(16,2) not null default 0,
  total_usd_fc numeric(16,2) not null default 0,
  total_encaisse numeric(16,2) not null default 0,
  ecart numeric(16,2) not null default 0,
  benefice numeric(16,2) not null default 0,   -- marge nette du rapport (FC)
  status report_status not null default 'brouillon',
  validated_at timestamptz, created_at timestamptz not null default now(),
  constraint reports_balance_chk check (status <> 'valide' or ecart = 0),
  unique (pompiste_id, report_date)
);

-- Relevés d'index par pompe (4 par rapport)
create table if not exists public.report_pump_readings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  pump_id text not null references public.pumps (id),
  cistern_id text references public.cisterns (id),
  fuel fuel_type,
  index_open numeric(14,2) not null default 0,
  index_close numeric(14,2) not null default 0,
  litrage numeric(14,2) not null default 0,
  unit_price numeric(10,2) not null default 0,
  montant numeric(16,2) not null default 0,
  constraint readings_chk check (index_close >= index_open),
  unique (report_id, pump_id)
);

-- Dépenses : liées à un rapport (report_id) ou hors-rapport (null), catégorisées
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete cascade,
  category_id uuid references public.expense_categories (id),
  description text not null, amount numeric(14,2) not null default 0,
  currency currency not null default 'FC',
  amount_fc numeric(16,2) not null default 0,    -- converti (rempli par trigger)
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ----------------------------- DETTES --------------------------------
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  client_name text not null, phone text, fuel fuel_type not null,
  liters numeric(14,2) not null default 0, total_amount numeric(16,2) not null,
  currency currency not null default 'FC',          -- devise de suivi de la dette
  date date not null default current_date, status debt_status not null default 'en_attente',
  created_at timestamptz not null default now()
);
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts (id) on delete cascade,
  amount numeric(16,2) not null, currency currency not null default 'FC',
  date date not null default current_date
);

-- ----------------------- COMMANDES FOURNISSEURS ----------------------
create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null, fuel fuel_type not null default 'super',
  cistern_id text not null references public.cisterns (id),
  volume_l numeric(14,2) not null, purchase_price numeric(16,2) not null default 0,
  deposit numeric(16,2) not null default 0, status order_status not null default 'en_cours',
  order_date date not null default current_date, delivered_at timestamptz
);

-- ------------------------ HISTORIQUE CAPITAL -------------------------
create table if not exists public.capital_history (
  date date primary key,
  caisse numeric(18,2) not null, stock_value numeric(18,2) not null,
  debts numeric(18,2) not null, orders_value numeric(18,2) not null default 0,
  capital numeric(18,2) not null
);

-- --------------- DOUBLE SÉCURISATION DU STOCK (audit) ----------------
create table if not exists public.stock_logs (
  id uuid primary key default gen_random_uuid(),
  cistern_id text not null references public.cisterns (id),
  theoretical_l numeric(14,2) not null,
  physical_l numeric(14,2) not null,
  ecart numeric(14,2) not null,            -- physical - theoretical
  note text, created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- ------------------------- COMMUNIQUÉS -------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text not null,
  author_id uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- -------------------- PARAMÈTRES GLOBAUX (singleton) -----------------
create table if not exists public.settings (
  id boolean primary key default true,     -- une seule ligne (id = true)
  essence_price numeric(10,2) not null default 2440,        -- prix de vente Super
  gasoil_price  numeric(10,2) not null default 2430,        -- prix de vente Gasoil
  essence_buy_price numeric(10,2) not null default 2200,    -- prix d'achat Super
  gasoil_buy_price  numeric(10,2) not null default 2200,    -- prix d'achat Gasoil
  taux_journalier numeric(10,2) not null default 2850,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id)
);
insert into public.settings (id) values (true) on conflict (id) do nothing;

-- --------------- CMS : CONTENU DE LA VITRINE (singleton) -------------
-- Les images sont téléversées dans un bucket Supabase Storage public
-- (ex: « landing »), et SEULES LES URLS publiques sont stockées ici.
--   Création du bucket (Dashboard > Storage, ou) :
--   insert into storage.buckets (id, name, public) values ('landing','landing',true);
--   -- policy lecture publique + écriture admin sur storage.objects (bucket_id='landing').
create table if not exists public.landing_page_content (
  id boolean primary key default true,
  hero_title  text not null default 'Le carburant de qualité, la gestion moderne.',
  hero_slogan text,
  hero_bg_url text,
  logo_url    text,
  about_text  text,
  gallery     jsonb not null default '[]'::jsonb,   -- [{id,url,caption}]
  hours       text default '24h/24 — 7j/7',
  phones      text,
  address     text,
  social      jsonb not null default '{}'::jsonb,    -- {facebook,instagram,whatsapp,tiktok}
  updated_at  timestamptz not null default now(),
  constraint landing_singleton check (id)
);
insert into public.landing_page_content (id) values (true) on conflict (id) do nothing;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  type notif_type not null default 'info', title text not null, body text,
  meta jsonb not null default '{}'::jsonb, read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_pompiste on public.reports (pompiste_id, report_date desc);
create index if not exists idx_readings_report  on public.report_pump_readings (report_id);
create index if not exists idx_expenses_report  on public.expenses (report_id);
create index if not exists idx_movements_cistern on public.fuel_movements (cistern_id, created_at desc);

-- =====================================================================
--  TRIGGERS — LOGIQUE MÉTIER
-- =====================================================================
create or replace function public.billetage_sum_fc(b jsonb)
returns numeric language sql immutable as $$
  select coalesce(sum((key)::numeric*(value)::numeric),0) from jsonb_each_text(coalesce(b,'{}'::jsonb))
$$;

-- 1) Relevé pompe : déduit fuel/citerne/prix puis litrage & montant
create or replace function public.readings_recompute() returns trigger language plpgsql as $$
declare f fuel_type; cid text; price numeric;
begin
  select p.fuel, p.cistern_id, c.sale_price_fc into f, cid, price
    from public.pumps p join public.cisterns c on c.id = p.cistern_id where p.id = new.pump_id;
  new.fuel := f; new.cistern_id := cid; new.unit_price := coalesce(price,0);
  new.litrage := greatest(new.index_close - new.index_open, 0);
  new.montant := new.litrage * new.unit_price;
  return new;
end $$;
drop trigger if exists trg_readings_recompute on public.report_pump_readings;
create trigger trg_readings_recompute before insert or update on public.report_pump_readings
  for each row execute function public.readings_recompute();

-- 2) Synchronise les agrégats du rapport (somme par carburant)
create or replace function public.readings_sync() returns trigger language plpgsql as $$
declare rid uuid;
begin
  rid := coalesce(new.report_id, old.report_id);
  update public.reports r set
    essence_litrage = (select coalesce(sum(litrage),0) from public.report_pump_readings where report_id=rid and fuel='super'),
    essence_montant = (select coalesce(sum(montant),0) from public.report_pump_readings where report_id=rid and fuel='super'),
    gasoil_litrage  = (select coalesce(sum(litrage),0) from public.report_pump_readings where report_id=rid and fuel='gasoil'),
    gasoil_montant  = (select coalesce(sum(montant),0) from public.report_pump_readings where report_id=rid and fuel='gasoil')
  where r.id = rid;     -- déclenche reports_recompute
  return coalesce(new, old);
end $$;
drop trigger if exists trg_readings_sync on public.report_pump_readings;
create trigger trg_readings_sync after insert or update or delete on public.report_pump_readings
  for each row execute function public.readings_sync();

-- 3a) Conversion devise -> amount_fc (USD * taux du jour, sinon = amount)
create or replace function public.expense_to_fc() returns trigger language plpgsql as $$
declare t numeric;
begin
  if new.currency = 'USD' then
    select taux_journalier into t from public.settings limit 1;
    new.amount_fc := new.amount * coalesce(t, 0);
  else
    new.amount_fc := new.amount;
  end if;
  return new;
end $$;
drop trigger if exists trg_expense_fc on public.expenses;
create trigger trg_expense_fc before insert or update on public.expenses
  for each row execute function public.expense_to_fc();

-- 3b) Dépenses d'un rapport -> total_depenses (somme des montants CONVERTIS en FC)
create or replace function public.expenses_sync() returns trigger language plpgsql as $$
declare rid uuid;
begin
  rid := coalesce(new.report_id, old.report_id);
  if rid is not null then
    update public.reports r set total_depenses =
      (select coalesce(sum(amount_fc),0) from public.expenses where report_id=rid) where r.id=rid;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_expenses_sync on public.expenses;
create trigger trg_expenses_sync after insert or update or delete on public.expenses
  for each row execute function public.expenses_sync();

-- 4) Recalcul du rapport (Y, X, écart, note, bénéfice via marges)
create or replace function public.reports_recompute() returns trigger language plpgsql as $$
declare v_es numeric; v_gs numeric; v_eb numeric; v_gb numeric;
begin
  new.total_a_remettre := new.essence_montant + new.gasoil_montant - new.total_depenses - new.manquant;
  new.total_billetage_fc := public.billetage_sum_fc(new.billetage);
  new.total_usd_fc := new.total_usd * new.taux_journalier;
  new.total_encaisse := new.total_billetage_fc + new.total_usd_fc;
  new.ecart := new.total_encaisse - new.total_a_remettre;
  new.auto_score := case when new.manquant<=0 then 10 when new.manquant<5000 then 9 when new.manquant<10000 then 7 else 0 end;
  -- Bénéfice = litrage * (prix de vente - prix d'achat), par carburant.
  select essence_price, gasoil_price, essence_buy_price, gasoil_buy_price
    into v_es, v_gs, v_eb, v_gb from public.settings limit 1;
  new.benefice := new.essence_litrage * (coalesce(v_es,0) - coalesce(v_eb,0))
                + new.gasoil_litrage  * (coalesce(v_gs,0) - coalesce(v_gb,0));
  return new;
end $$;
drop trigger if exists trg_reports_recompute on public.reports;
create trigger trg_reports_recompute before insert or update on public.reports
  for each row execute function public.reports_recompute();

-- 5) Validation : décrément citernes (par pompe) + mouvements + RH (idempotent)
create or replace function public.on_report_validated() returns trigger language plpgsql as $$
declare rd record; puser uuid;
begin
  if new.status='valide' and (old.status is distinct from 'valide') then
    new.validated_at := now();
    for rd in select * from public.report_pump_readings where report_id=new.id and litrage>0 loop
      update public.cisterns set current_l=greatest(current_l-rd.litrage,0), updated_at=now() where id=rd.cistern_id;
      insert into public.fuel_movements(cistern_id,kind,volume_l,source,ref_id,label)
        values (rd.cistern_id,'sortie',rd.litrage,'rapport',new.id,'Ventes rapport '||new.report_date);
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
drop trigger if exists trg_report_validated on public.reports;
create trigger trg_report_validated before update on public.reports
  for each row execute function public.on_report_validated();

-- 6) Commande livrée -> incrémente la citerne + mouvement d'entrée
create or replace function public.on_order_delivered() returns trigger language plpgsql as $$
declare cur numeric; cap numeric; nom text; cfuel fuel_type;
begin
  if new.status='livre' and (old.status is distinct from 'livre') then
    select current_l, capacity_l, name, fuel into cur, cap, nom, cfuel from public.cisterns where id=new.cistern_id;
    -- La citerne de déchargement doit correspondre au type de carburant de l'arrivage.
    if cfuel <> new.fuel then
      raise exception 'Citerne % (%) incompatible avec le carburant de l''arrivage (%)', nom, cfuel, new.fuel;
    end if;
    -- Empêche une livraison qui dépasserait la capacité physique de la citerne.
    if cur + new.volume_l > cap then
      raise exception 'Livraison impossible : dépasse la capacité de % (dispo: % L, commande: % L)', nom, (cap-cur), new.volume_l;
    end if;
    new.delivered_at := now();
    update public.cisterns set current_l=current_l+new.volume_l, updated_at=now() where id=new.cistern_id;
    insert into public.fuel_movements(cistern_id,kind,volume_l,source,ref_id,label)
      values (new.cistern_id,'entree',new.volume_l,'livraison',new.id,'Livraison '||new.supplier_name);
  end if;
  return new;
end $$;
drop trigger if exists trg_order_delivered on public.supplier_orders;
create trigger trg_order_delivered before update on public.supplier_orders
  for each row execute function public.on_order_delivered();

-- 7) Dette soldée automatiquement quand totalement payée
create or replace function public.on_debt_payment() returns trigger language plpgsql as $$
declare paid numeric; tot numeric;
begin
  select coalesce(sum(amount),0) into paid from public.debt_payments where debt_id=new.debt_id;
  select total_amount into tot from public.debts where id=new.debt_id;
  if paid >= tot then update public.debts set status='soldee' where id=new.debt_id; end if;
  return new;
end $$;
drop trigger if exists trg_debt_payment on public.debt_payments;
create trigger trg_debt_payment after insert on public.debt_payments
  for each row execute function public.on_debt_payment();

-- 8) Augmentation de salaire : historique + notif
create or replace function public.on_salary_change() returns trigger language plpgsql as $$
begin
  if new.base_salary is distinct from old.base_salary or new.base_salary_usd is distinct from old.base_salary_usd then
    insert into public.salary_history(pompiste_id,old_salary,new_salary,old_salary_usd,new_salary_usd,changed_by)
      values (new.id,old.base_salary,new.base_salary,old.base_salary_usd,new.base_salary_usd,auth.uid());
    if (new.base_salary>old.base_salary or new.base_salary_usd>old.base_salary_usd) and new.user_id is not null then
      insert into public.notifications(user_id,type,title,body,meta)
      values (new.user_id,'augmentation_salaire','🎉 Salaire augmenté !',
              'Votre salaire de base : '||new.base_salary||' FC + '||new.base_salary_usd||' USD.',
              jsonb_build_object('fc',new.base_salary,'usd',new.base_salary_usd));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_salary_change on public.pompiste_profiles;
create trigger trg_salary_change before update on public.pompiste_profiles
  for each row execute function public.on_salary_change();

-- 9) CAPITAL = Caisse + Valeur Stock + Dettes recouvrables (snapshot du jour)
create or replace function public.snapshot_capital() returns void language plpgsql as $$
declare v_taux numeric; v_fc numeric; v_usd numeric; v_caisse numeric; v_stock numeric; v_debts numeric; v_orders numeric;
begin
  select taux_journalier into v_taux from public.settings limit 1;
  v_taux := coalesce(v_taux, 0);
  -- Caisse à double compartiment (FC + USD physiques)
  v_fc := coalesce((select sum(total_billetage_fc) from public.reports where status='valide'),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='FC'),0)
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='FC'),0)
        - coalesce((select sum(case when status='livre' then purchase_price else deposit end) from public.supplier_orders),0);
  v_usd := coalesce((select sum(total_usd) from public.reports where status='valide'),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='USD'),0)
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='USD'),0);
  v_caisse := v_fc + v_usd * v_taux;
  v_stock := coalesce((select sum(current_l*sale_price_fc) from public.cisterns),0);
  -- Dettes recouvrables converties en FC (×taux si la dette est en USD)
  v_debts := coalesce((select sum((total_amount - coalesce((select sum(amount) from public.debt_payments p where p.debt_id=d.id),0))
                       * (case when d.currency='USD' then v_taux else 1 end))
                       from public.debts d where d.status='en_attente'),0);
  v_orders := coalesce((select sum(purchase_price) from public.supplier_orders where status='en_cours'),0);
  insert into public.capital_history(date,caisse,stock_value,debts,orders_value,capital)
    values (current_date,v_caisse,v_stock,v_debts,v_orders,v_caisse+v_stock+v_debts+v_orders)
    on conflict (date) do update set caisse=excluded.caisse, stock_value=excluded.stock_value,
      debts=excluded.debts, orders_value=excluded.orders_value, capital=excluded.capital;
end $$;

create or replace function public.trg_snapshot_capital() returns trigger language plpgsql as $$
begin perform public.snapshot_capital(); return null; end $$;
drop trigger if exists trg_cap_reports on public.reports;
create trigger trg_cap_reports after insert or update on public.reports for each statement execute function public.trg_snapshot_capital();
drop trigger if exists trg_cap_orders on public.supplier_orders;
create trigger trg_cap_orders after insert or update on public.supplier_orders for each statement execute function public.trg_snapshot_capital();
drop trigger if exists trg_cap_expenses on public.expenses;
create trigger trg_cap_expenses after insert or update or delete on public.expenses for each statement execute function public.trg_snapshot_capital();
drop trigger if exists trg_cap_payments on public.debt_payments;
create trigger trg_cap_payments after insert on public.debt_payments for each statement execute function public.trg_snapshot_capital();

-- Vue paie : net = base - cumul manquants
create or replace view public.v_payroll as
  select id, display_name, base_salary, cumul_manquants_mois,
         (base_salary - cumul_manquants_mois) as net_a_payer
  from public.pompiste_profiles where active;

-- 10) Auto-création du profil (rôle viewer) à chaque inscription Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'viewer')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ############ 2/3 — SÉCURITÉ RLS + STORAGE ############
-- =====================================================================
--  STATION KKC OIL — Row-Level Security v2
--  Pompiste = HERMÉTIQUE aux menus financiers (ne voit que SES rapports).
--  À exécuter APRÈS schema.sql.
-- =====================================================================

create or replace function public.current_role() returns user_role
language sql stable security definer set search_path=public as $$ select role from public.users where id=auth.uid() $$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$ select coalesce((select role='admin' from public.users where id=auth.uid()),false) $$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path=public as $$ select coalesce((select role in ('admin','viewer') from public.users where id=auth.uid()),false) $$;
create or replace function public.my_pompiste_id() returns uuid
language sql stable security definer set search_path=public as $$ select id from public.pompiste_profiles where user_id=auth.uid() $$;

alter table public.users               enable row level security;
alter table public.pompiste_profiles   enable row level security;
alter table public.salary_history      enable row level security;
alter table public.cisterns            enable row level security;
alter table public.pumps               enable row level security;
alter table public.fuel_movements      enable row level security;
alter table public.expense_categories  enable row level security;
alter table public.reports             enable row level security;
alter table public.report_pump_readings enable row level security;
alter table public.expenses            enable row level security;
alter table public.debts               enable row level security;
alter table public.debt_payments       enable row level security;
alter table public.supplier_orders     enable row level security;
alter table public.capital_history     enable row level security;
alter table public.stock_logs          enable row level security;
alter table public.announcements       enable row level security;
alter table public.settings            enable row level security;
alter table public.landing_page_content enable row level security;
alter table public.notifications       enable row level security;

-- users / RH
create policy users_read on public.users for select using (id=auth.uid() or public.is_staff());
create policy users_admin on public.users for all using (public.is_admin()) with check (public.is_admin());
create policy pp_read on public.pompiste_profiles for select using (public.is_staff() or user_id=auth.uid());
create policy pp_admin on public.pompiste_profiles for all using (public.is_admin()) with check (public.is_admin());
create policy sh_read on public.salary_history for select using (public.is_staff() or pompiste_id=public.my_pompiste_id());
create policy sh_admin on public.salary_history for all using (public.is_admin()) with check (public.is_admin());

-- INFRASTRUCTURE : admin + viewer en lecture, admin en écriture (pompiste = AUCUN accès)
create policy cist_read on public.cisterns for select using (public.is_staff());
create policy cist_admin on public.cisterns for all using (public.is_admin()) with check (public.is_admin());
create policy pump_read on public.pumps for select using (public.is_staff());
create policy pump_admin on public.pumps for all using (public.is_admin()) with check (public.is_admin());
create policy mov_read on public.fuel_movements for select using (public.is_staff());
create policy mov_admin on public.fuel_movements for all using (public.is_admin()) with check (public.is_admin());

-- CAISSE & DÉPENSES : admin uniquement
create policy cat_admin on public.expense_categories for all using (public.is_admin()) with check (public.is_admin());
create policy exp_admin on public.expenses for all using (public.is_admin()) with check (public.is_admin());

-- RAPPORTS : admin (tout) · viewer (lecture) · pompiste (SES rapports validés)
create policy reports_read on public.reports for select
  using (public.is_staff() or (pompiste_id=public.my_pompiste_id() and status='valide'));
create policy reports_admin on public.reports for all using (public.is_admin()) with check (public.is_admin());
create policy readings_read on public.report_pump_readings for select
  using (exists (select 1 from public.reports r where r.id=report_id
                 and (public.is_staff() or (r.pompiste_id=public.my_pompiste_id() and r.status='valide'))));
create policy readings_admin on public.report_pump_readings for all using (public.is_admin()) with check (public.is_admin());

-- DETTES & COMMANDES : admin uniquement
create policy debts_admin on public.debts for all using (public.is_admin()) with check (public.is_admin());
create policy dpay_admin on public.debt_payments for all using (public.is_admin()) with check (public.is_admin());
create policy orders_admin on public.supplier_orders for all using (public.is_admin()) with check (public.is_admin());

-- CAPITAL : admin + viewer en lecture, admin en écriture (via triggers)
create policy cap_read on public.capital_history for select using (public.is_staff());
create policy cap_admin on public.capital_history for all using (public.is_admin()) with check (public.is_admin());

-- DOUBLE SÉCURISATION STOCK : admin + viewer lecture, admin écriture
create policy stocklog_read on public.stock_logs for select using (public.is_staff());
create policy stocklog_admin on public.stock_logs for all using (public.is_admin()) with check (public.is_admin());

-- COMMUNIQUÉS : lecture TOUS les rôles connectés, écriture admin
create policy ann_read on public.announcements for select using (auth.uid() is not null);
create policy ann_admin on public.announcements for all using (public.is_admin()) with check (public.is_admin());

-- PARAMÈTRES : lecture tous connectés (prix), écriture admin
create policy set_read on public.settings for select using (auth.uid() is not null);
create policy set_admin on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- CMS VITRINE : lecture PUBLIQUE (visiteurs anonymes), écriture admin
create policy land_read on public.landing_page_content for select using (true);
create policy land_admin on public.landing_page_content for all using (public.is_admin()) with check (public.is_admin());

-- NOTIFICATIONS
create policy notif_read on public.notifications for select using (user_id=auth.uid() or public.is_admin());
create policy notif_update on public.notifications for update using (user_id=auth.uid());
create policy notif_insert on public.notifications for insert with check (public.is_admin() or user_id=auth.uid());

-- STORAGE : bucket « landing » (images du CMS vitrine)
insert into storage.buckets (id, name, public) values ('landing','landing',true)
  on conflict (id) do nothing;
drop policy if exists "landing public read" on storage.objects;
create policy "landing public read" on storage.objects for select using (bucket_id='landing');
drop policy if exists "landing admin write" on storage.objects;
create policy "landing admin write" on storage.objects for all
  using (bucket_id='landing' and public.is_admin())
  with check (bucket_id='landing' and public.is_admin());

-- REALTIME
do $$ begin
  alter publication supabase_realtime add table public.reports, public.cisterns,
    public.pompiste_profiles, public.debts, public.supplier_orders,
    public.capital_history, public.fuel_movements, public.notifications,
    public.announcements, public.stock_logs, public.settings, public.landing_page_content;
exception when others then null; end $$;

-- ############ 3/3 — DONNÉES DE RÉFÉRENCE / DÉPART PROPRE ############
-- =====================================================================
--  STATION KKC OIL — Données de référence (à exécuter après rls.sql)
--  DÉPART PROPRE : infrastructure (3 citernes VIDES + 4 pompes) +
--  catégories de dépenses + 1 fiche pompiste de départ. Aucune donnée de démo.
--  L'admin saisit ensuite le stock réel, les pompistes, les rapports, etc.
-- =====================================================================

-- Citernes vides : niveau réel à enregistrer via relevé physique ou 1re livraison.
insert into public.cisterns (id, name, fuel, capacity_l, current_l, sale_price_fc) values
  ('cit-gasoil', 'Citerne Gasoil',  'gasoil', 30000, 0, 2430),
  ('cit-super1', 'Citerne Super 1', 'super',  30000, 0, 2440),
  ('cit-super2', 'Citerne Super 2', 'super',  30000, 0, 2440)
on conflict (id) do nothing;

insert into public.pumps (id, label, fuel, cistern_id) values
  ('p1', 'Pompe 1 — Gasoil', 'gasoil', 'cit-gasoil'),
  ('p2', 'Pompe 2 — Super',  'super',  'cit-super1'),
  ('p3', 'Pompe 3 — Super',  'super',  'cit-super1'),
  ('p4', 'Pompe 4 — Super',  'super',  'cit-super2')
on conflict (id) do nothing;

insert into public.expense_categories (name, color) values
  ('RH / Primes', '#10b981'),
  ('Maintenance Pompes', '#f59e0b'),
  ('Taxes & Impôts', '#fb7185'),
  ('Factures Électricité', '#38bdf8'),
  ('Divers', '#a78bfa')
on conflict do nothing;

-- Une fiche pompiste de départ (reliée plus tard au compte « jean@kkc.cd » via auth_link.sql).
-- L'admin ajoute/renomme les autres dans Paramètres → Fiches employés.
insert into public.pompiste_profiles (display_name, base_salary, cumul_manquants_mois, phone)
values ('Pompiste 1', 0, 0, '')
on conflict do nothing;
