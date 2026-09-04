-- =====================================================================
--  STATION KKC OIL — Migration : Stock valorisé au prix d'ACHAT (Capital)
--
--  Bug corrigé : la valeur du stock carburant dans le Capital utilisait le
--  prix de VENTE (cisterns.sale_price_fc) au lieu du prix d'ACHAT. Cela
--  comptait la marge non réalisée sur du carburant pas encore vendu comme
--  si c'était déjà de l'argent réel — surestimant le Capital. Cohérent
--  maintenant avec les Commandes fournisseurs (déjà valorisées au prix
--  d'achat).
--
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

create or replace function public.snapshot_capital() returns void language plpgsql as $$
declare v_taux numeric; v_fc numeric; v_usd numeric; v_caisse numeric; v_stock numeric; v_debts numeric; v_orders numeric;
        v_exch_fc numeric; v_exch_usd numeric; v_essence_buy numeric; v_gasoil_buy numeric;
begin
  select taux_journalier, essence_buy_price, gasoil_buy_price into v_taux, v_essence_buy, v_gasoil_buy from public.settings limit 1;
  v_taux := coalesce(v_taux, 0);
  v_essence_buy := coalesce(v_essence_buy, 0);
  v_gasoil_buy := coalesce(v_gasoil_buy, 0);
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
  v_stock := coalesce((select sum(current_l * (case when fuel='gasoil' then v_gasoil_buy else v_essence_buy end)) from public.cisterns),0);
  v_debts := coalesce((select sum((total_amount - coalesce((select sum(amount) from public.debt_payments p where p.debt_id=d.id),0))
                       * (case when d.currency='USD' then v_taux else 1 end))
                       from public.debts d where d.status='en_attente'),0);
  v_orders := coalesce((select sum(purchase_price) from public.supplier_orders where status='en_cours'),0);
  insert into public.capital_history(date,caisse,stock_value,debts,orders_value,capital)
    values (current_date,v_caisse,v_stock,v_debts,v_orders,v_caisse+v_stock+v_orders)
    on conflict (date) do update set caisse=excluded.caisse, stock_value=excluded.stock_value,
      debts=excluded.debts, orders_value=excluded.orders_value, capital=excluded.capital;
end $$;

-- Réévalue immédiatement le point du jour avec la formule corrigée.
select public.snapshot_capital();
