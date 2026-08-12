-- =====================================================================
--  STATION KKC OIL — Migration : livraisons PARTIELLES des commandes
--  fournisseurs + registre des dépenses (aucune modif SQL requise côté
--  dépenses, l'export PDF est 100% client).
--
--  1) supplier_orders.status : enum -> text+check (ajoute 'partielle').
--  2) Nouvelles colonnes : delivered_volume_l, parent_order_id.
--  3) on_order_delivered() élargi à 'livre'+'partielle' (utilise le volume
--     RÉELLEMENT déchargé, pas le volume commandé).
--  4) snapshot_capital() : le décaissement caisse traite 'partielle' comme
--     'livre' (prix payé pro-raté au volume reçu).
--  5) Nouvelle RPC deliver_order(order_id, delivered_volume, keep_residual).
--
--  À exécuter UNE FOIS dans le SQL Editor (script entier, en une seule
--  fois — c'est justement pour éviter le piège transactionnel de
--  "ALTER TYPE ... ADD VALUE" que le statut passe en text+check). Idempotent.
-- =====================================================================

-- 1) Conversion de la colonne enum -> text+check (les valeurs existantes
--    'en_cours'/'livre' sont conservées telles quelles par le cast ::text).
alter table public.supplier_orders alter column status drop default;
alter table public.supplier_orders alter column status type text using status::text;
alter table public.supplier_orders alter column status set default 'en_cours';
alter table public.supplier_orders drop constraint if exists supplier_orders_status_check;
alter table public.supplier_orders add constraint supplier_orders_status_check
  check (status in ('en_cours','livre','partielle'));

-- 2) Nouvelles colonnes (no-op si déjà présentes)
alter table public.supplier_orders add column if not exists delivered_volume_l numeric(14,2) not null default 0;
alter table public.supplier_orders add column if not exists parent_order_id uuid references public.supplier_orders (id) on delete set null;

-- 3) Trigger élargi (remplace intégralement la fonction existante)
create or replace function public.on_order_delivered() returns trigger language plpgsql as $$
declare cur numeric; cap numeric; nom text; cfuel fuel_type;
begin
  if new.status in ('livre','partielle') and old.status = 'en_cours' then
    select current_l, capacity_l, name, fuel into cur, cap, nom, cfuel from public.cisterns where id=new.cistern_id;
    if cfuel <> new.fuel then
      raise exception 'Citerne % (%) incompatible avec le carburant de l''arrivage (%)', nom, cfuel, new.fuel;
    end if;
    if cur + new.volume_l > cap then
      raise exception 'Livraison impossible : dépasse la capacité de % (dispo: % L, déchargé: % L)', nom, (cap-cur), new.volume_l;
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

-- 4) snapshot_capital() : 'partielle' traitée comme 'livre' côté décaissement
create or replace function public.snapshot_capital() returns void language plpgsql as $$
declare v_taux numeric; v_fc numeric; v_usd numeric; v_caisse numeric; v_stock numeric; v_debts numeric; v_orders numeric;
begin
  select taux_journalier into v_taux from public.settings limit 1;
  v_taux := coalesce(v_taux, 0);
  v_fc := coalesce((select sum(total_billetage_fc) from public.reports where status='valide' and closed),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='FC'),0)
        + coalesce((select sum(amount) from public.cash_entries where currency='FC'),0)
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='FC'),0)
        - coalesce((select sum(montant_paye_fc) from public.salary_payments),0)
        - coalesce((select sum(case when status in ('livre','partielle') then purchase_price else deposit end) from public.supplier_orders),0);
  v_usd := coalesce((select sum(total_usd) from public.reports where status='valide' and closed),0)
        + coalesce((select sum(amount) from public.debt_payments where currency='USD'),0)
        + coalesce((select sum(amount) from public.cash_entries where currency='USD'),0)
        - coalesce((select sum(amount) from public.expenses where report_id is null and currency='USD'),0)
        - coalesce((select sum(montant_paye_usd) from public.salary_payments),0);
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

-- 5) Nouvelle RPC : livraison totale ou partielle
create or replace function public.deliver_order(
  p_order_id uuid, p_delivered_volume numeric, p_keep_residual boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare o record; v_unit_price numeric; v_delivered_price numeric; v_full boolean; v_status text;
begin
  if not public.is_admin() then raise exception 'Action réservée à l''administrateur.'; end if;
  select * into o from public.supplier_orders where id = p_order_id for update;
  if not found then raise exception 'Commande introuvable.'; end if;
  if o.status <> 'en_cours' then raise exception 'Cette commande a déjà été traitée.'; end if;
  if p_delivered_volume is null or p_delivered_volume <= 0 then raise exception 'Quantité livrée invalide.'; end if;
  if p_delivered_volume > o.volume_l then raise exception 'La quantité livrée (% L) ne peut pas dépasser la quantité commandée (% L).', p_delivered_volume, o.volume_l; end if;

  v_unit_price := case when o.volume_l > 0 then o.purchase_price / o.volume_l else 0 end;
  v_delivered_price := round((v_unit_price * p_delivered_volume)::numeric, 2);
  v_full := p_delivered_volume >= o.volume_l;
  v_status := case when v_full then 'livre' when p_keep_residual then 'partielle' else 'livre' end;

  update public.supplier_orders
    set volume_l = p_delivered_volume, purchase_price = v_delivered_price,
        delivered_volume_l = p_delivered_volume, status = v_status
    where id = p_order_id;

  if not v_full and p_keep_residual then
    insert into public.supplier_orders
      (supplier_name, fuel, cistern_id, volume_l, purchase_price, deposit, status, order_date, parent_order_id)
    values
      (o.supplier_name, o.fuel, o.cistern_id, o.volume_l - p_delivered_volume,
       o.purchase_price - v_delivered_price, 0, 'en_cours', current_date, o.id);
  end if;

  perform public.snapshot_capital();
end $$;
