-- =====================================================================
--  STATION KKC OIL — Migration : suppression d'une commande fournisseur
--  RPC transactionnelle (réservée Admin). Si la commande était LIVRÉE :
--  rollback du stock (volume soustrait de la citerne, physique+théorique),
--  suppression du mouvement d'entrée, puis recalcul du Capital.
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

create or replace function public.delete_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if not public.is_admin() then raise exception 'Action réservée à l''administrateur.'; end if;
  select * into o from public.supplier_orders where id = p_order_id;
  if not found then return; end if;

  if o.status = 'livre' then
    -- Rollback : le volume injecté à la livraison est retiré de la citerne.
    update public.cisterns
      set current_l = greatest(0, current_l - o.volume_l), updated_at = now()
      where id = o.cistern_id;
    delete from public.fuel_movements where ref_id = p_order_id and source = 'livraison';
  end if;

  delete from public.supplier_orders where id = p_order_id;
  perform public.snapshot_capital(); -- retire acompte/prix du calcul du capital
end $$;
