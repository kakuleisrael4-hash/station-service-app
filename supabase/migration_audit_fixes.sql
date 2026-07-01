-- =====================================================================
--  STATION KKC OIL — Migration : correctifs d'audit (check-up complet)
--  1) Le trigger reports_recompute calculait encore la note automatique
--     (/10 selon le manquant) alors qu'elle a été supprimée : l'évaluation
--     est 100 % à la discrétion de l'admin (étoiles 1-5).
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

create or replace function public.reports_recompute() returns trigger language plpgsql as $$
declare v_es numeric; v_gs numeric; v_eb numeric; v_gb numeric;
begin
  new.total_a_remettre := new.essence_montant + new.gasoil_montant - new.total_depenses - new.manquant;
  new.total_billetage_fc := public.billetage_sum_fc(new.billetage);
  new.total_usd_fc := new.total_usd * new.taux_journalier;
  new.total_encaisse := new.total_billetage_fc + new.total_usd_fc;
  new.ecart := new.total_encaisse - new.total_a_remettre;
  -- Notation automatique SUPPRIMÉE : plus de score /10 calculé.
  new.auto_score := null;
  select essence_price, gasoil_price, essence_buy_price, gasoil_buy_price
    into v_es, v_gs, v_eb, v_gb from public.settings limit 1;
  new.benefice := new.essence_litrage * (coalesce(v_es,0) - coalesce(v_eb,0))
                + new.gasoil_litrage  * (coalesce(v_gs,0) - coalesce(v_gb,0));
  return new;
end $$;
