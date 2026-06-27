-- =====================================================================
--  STATION KKC OIL — Migration : prix d'achat/vente, marges & bénéfices
--  À exécuter UNE FOIS dans le SQL Editor (projet déjà en place).
--  Idempotent (add column if not exists, create or replace).
-- =====================================================================

-- 1) Prix d'achat fournisseur dans les paramètres ---------------------
alter table public.settings add column if not exists essence_buy_price numeric(10,2) not null default 2200;
alter table public.settings add column if not exists gasoil_buy_price  numeric(10,2) not null default 2200;

-- 2) Bénéfice stocké par rapport --------------------------------------
alter table public.reports add column if not exists benefice numeric(16,2) not null default 0;

-- 3) Le trigger de recalcul intègre désormais le bénéfice (marge) -----
create or replace function public.reports_recompute() returns trigger language plpgsql as $$
declare v_es numeric; v_gs numeric; v_eb numeric; v_gb numeric;
begin
  new.total_a_remettre := new.essence_montant + new.gasoil_montant - new.total_depenses - new.manquant;
  new.total_billetage_fc := public.billetage_sum_fc(new.billetage);
  new.total_usd_fc := new.total_usd * new.taux_journalier;
  new.total_encaisse := new.total_billetage_fc + new.total_usd_fc;
  new.ecart := new.total_encaisse - new.total_a_remettre;
  new.auto_score := case when new.manquant<=0 then 10 when new.manquant<5000 then 9 when new.manquant<10000 then 7 else 0 end;
  select essence_price, gasoil_price, essence_buy_price, gasoil_buy_price
    into v_es, v_gs, v_eb, v_gb from public.settings limit 1;
  new.benefice := new.essence_litrage * (coalesce(v_es,0) - coalesce(v_eb,0))
                + new.gasoil_litrage  * (coalesce(v_gs,0) - coalesce(v_gb,0));
  return new;
end $$;

-- 4) Recalcule le bénéfice des rapports déjà existants (prix actuels) --
update public.reports r set benefice =
    r.essence_litrage * (s.essence_price - s.essence_buy_price)
  + r.gasoil_litrage  * (s.gasoil_price  - s.gasoil_buy_price)
from public.settings s;
