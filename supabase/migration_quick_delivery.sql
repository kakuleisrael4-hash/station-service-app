-- =====================================================================
--  STATION KKC OIL — Migration : petite livraison express
--  Nouvelle RPC quick_delivery(cistern_id, volume, motif) réservée Admin.
--  Injecte directement du carburant dans une citerne (petits arrivages
--  hors process fournisseur/commande), avec garde-fou de capacité.
--  Aucun changement de schéma (réutilise fuel_movements.source='livraison').
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

create or replace function public.quick_delivery(
  p_cistern_id text, p_volume numeric, p_motif text default ''
) returns void language plpgsql security definer set search_path = public as $$
declare cit record; v_label text;
begin
  if not public.is_admin() then raise exception 'Action réservée à l''administrateur.'; end if;
  if p_volume is null or p_volume <= 0 then raise exception 'Volume invalide.'; end if;
  select * into cit from public.cisterns where id = p_cistern_id;
  if not found then raise exception 'Citerne introuvable.'; end if;
  if cit.current_l + p_volume > cit.capacity_l then
    raise exception 'Livraison impossible : dépasse la capacité de % (dispo: % L, livraison: % L)', cit.name, (cit.capacity_l - cit.current_l), p_volume;
  end if;

  update public.cisterns set current_l = current_l + p_volume, updated_at = now() where id = p_cistern_id;
  v_label := case when coalesce(trim(p_motif), '') <> '' then 'Livraison express — ' || trim(p_motif) else 'Livraison express' end;
  insert into public.fuel_movements(cistern_id, kind, volume_l, source, ref_id, label)
    values (p_cistern_id, 'entree', p_volume, 'livraison', null, v_label);

  perform public.snapshot_capital();
end $$;
