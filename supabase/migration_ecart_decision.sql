-- =====================================================================
--  STATION KKC OIL — Migration : écart de caisse & décision d'imputation
--  Ajoute la traçabilité de l'écart (surplus / déficit) et de la décision
--  prise par l'Admin (aucun / toléré / déduit sur salaire).
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

alter table public.reports add column if not exists montant_ecart numeric(16,2) not null default 0;
alter table public.reports add column if not exists decision_imputation text not null default 'aucun';

-- Garde-fou : seules les trois valeurs métier sont autorisées.
alter table public.reports drop constraint if exists reports_decision_chk;
alter table public.reports add constraint reports_decision_chk
  check (decision_imputation in ('aucun', 'tolere', 'debit_salaire'));

-- Rétro-compatibilité : les rapports déjà enregistrés gardent montant_ecart = ecart
-- (l'écart constaté) et la décision 'aucun' par défaut.
update public.reports set montant_ecart = ecart where montant_ecart = 0 and ecart <> 0;
