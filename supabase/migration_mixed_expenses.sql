-- =====================================================================
--  STATION KKC OIL — Migration : dépenses mixtes (FC + USD simultanés)
--  Une dépense peut combiner une part FC et une part USD. Total consolidé :
--  amount_fc = amount (FC) + amount_usd (USD) × taux_du_jour.
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

-- 1) Nouvelle colonne : part payée en USD.
alter table public.expenses add column if not exists amount_usd numeric(14,2) not null default 0;

-- 2) Nouveau calcul du total consolidé (part FC + part USD × taux).
create or replace function public.expense_to_fc() returns trigger language plpgsql as $$
declare t numeric;
begin
  select taux_journalier into t from public.settings limit 1;
  new.amount_fc := coalesce(new.amount, 0) + coalesce(new.amount_usd, 0) * coalesce(t, 0);
  return new;
end $$;

-- 3) Migration des anciennes dépenses : une dépense 100 % USD devient une
--    part USD (amount_usd), avec amount (part FC) remis à 0. L'update déclenche
--    le trigger -> recalcule amount_fc avec la nouvelle formule.
update public.expenses set amount_usd = amount, amount = 0
  where currency = 'USD' and amount_usd = 0;
