-- =====================================================================
--  STATION KKC OIL — Migration : Dette + Transport auto + Retour Citerne
--  (RC) directement dans l'élaboration du rapport.
--
--  1) DETTE : une créance client saisie avec le rapport est maintenant
--     déduite de « Total à remettre » (Y) — comme une dépense, car le
--     carburant n'a pas été encaissé — ET crée une fiche dans le registre
--     des dettes clients (traçable jusqu'au rapport via report_id).
--  2) TRANSPORT : catégorie de dépense ajoutée si absente (le front-end
--     l'auto-remplit avec le nom du pompiste).
--  3) CONSOMMATION GROUPE : nouvelle catégorie de dépense ajoutée si absente.
--  4) RC (RETOUR CITERNE) : litres sortis à la pompe puis restitués (client
--     s'est désisté). Le litrage NET (brut − RC) est ce qui est facturé ET
--     décrémenté de la citerne à la clôture — le RC reste donc en stock.
--
--  Colonnes ajoutées en `default 0` / nullable : les rapports déjà
--  enregistrés ne sont PAS recalculés (RC=0 et dette=0 ne changent rien à
--  leurs totaux existants). Idempotent — à exécuter UNE FOIS.
-- =====================================================================

-- 1) Colonnes ---------------------------------------------------------
alter table public.report_pump_readings add column if not exists rc_liters numeric(14,2) not null default 0;
alter table public.reports add column if not exists total_dettes numeric(14,2) not null default 0;
alter table public.debts add column if not exists report_id uuid references public.reports (id) on delete cascade;

-- 2) Relevé pompe : litrage NET (brut − RC), plafonné à 0 -------------
create or replace function public.readings_recompute() returns trigger language plpgsql as $$
declare f fuel_type; cid text; price numeric;
begin
  select p.fuel, p.cistern_id, c.sale_price_fc into f, cid, price
    from public.pumps p join public.cisterns c on c.id = p.cistern_id where p.id = new.pump_id;
  new.fuel := f; new.cistern_id := cid; new.unit_price := coalesce(price,0);
  new.litrage := greatest(new.index_close - new.index_open - greatest(coalesce(new.rc_liters,0),0), 0);
  new.montant := new.litrage * new.unit_price;
  return new;
end $$;

-- 3) Créances (dettes) d'un rapport -> total_dettes (converties en FC
--    au taux DU RAPPORT, pas le taux courant des réglages) -----------
create or replace function public.debts_sync() returns trigger language plpgsql as $$
declare rid uuid; v_taux numeric;
begin
  rid := coalesce(new.report_id, old.report_id);
  if rid is not null then
    select taux_journalier into v_taux from public.reports where id = rid;
    update public.reports r set total_dettes =
      (select coalesce(sum(case when d.currency='USD' then d.total_amount*coalesce(v_taux,0) else d.total_amount end),0)
       from public.debts d where d.report_id = rid)
      where r.id = rid;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_debts_sync on public.debts;
create trigger trg_debts_sync after insert or update or delete on public.debts
  for each row execute function public.debts_sync();

-- 4) Recalcul du rapport : Y déduit aussi les créances ----------------
create or replace function public.reports_recompute() returns trigger language plpgsql as $$
declare v_es numeric; v_gs numeric; v_eb numeric; v_gb numeric;
begin
  new.total_a_remettre := new.essence_montant + new.gasoil_montant - new.total_depenses - new.total_dettes - new.manquant;
  new.total_billetage_fc := public.billetage_sum_fc(new.billetage);
  new.total_usd_fc := new.total_usd * new.taux_journalier;
  new.total_encaisse := new.total_billetage_fc + new.total_usd_fc;
  new.ecart := new.total_encaisse - new.total_a_remettre;
  new.auto_score := null;
  select essence_price, gasoil_price, essence_buy_price, gasoil_buy_price
    into v_es, v_gs, v_eb, v_gb from public.settings limit 1;
  new.benefice := new.essence_litrage * (coalesce(v_es,0) - coalesce(v_eb,0))
                + new.gasoil_litrage  * (coalesce(v_gs,0) - coalesce(v_gb,0));
  return new;
end $$;

-- 5) Catégories de dépense « Transport » et « Consommation Groupe »
--    (ajoutées seulement si absentes — comparaison insensible à la casse).
insert into public.expense_categories (name, color)
select 'Transport', '#22c55e'
where not exists (select 1 from public.expense_categories where lower(name) = 'transport');

insert into public.expense_categories (name, color)
select 'Consommation Groupe', '#14b8a6'
where not exists (select 1 from public.expense_categories where lower(name) = 'consommation groupe');
