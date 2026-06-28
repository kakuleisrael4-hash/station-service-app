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
alter table public.cash_entries        enable row level security;
alter table public.daily_closings      enable row level security;
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
create policy cash_admin on public.cash_entries for all using (public.is_admin()) with check (public.is_admin());
-- CLÔTURES : admin écrit, admin+viewer lisent
create policy closing_read on public.daily_closings for select using (public.is_staff());
create policy closing_admin on public.daily_closings for all using (public.is_admin()) with check (public.is_admin());

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
    public.announcements, public.stock_logs, public.settings, public.landing_page_content,
    public.cash_entries, public.daily_closings;
exception when others then null; end $$;
