-- =====================================================================
--  STATION KKC OIL — Migration : suppression rapport/clôture + rollback
--  Fonctions RPC transactionnelles (réservées Admin) qui ANNULENT les
--  impacts d'un rapport clôturé : ré-injection du stock, annulation du
--  manquant RH, détachement/recalcul des clôtures, recalcul du capital.
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

-- 1) SUPPRESSION D'UN RAPPORT (avec rollback en cascade) ---------------
create or replace function public.delete_report(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record; rd record; d record; ids uuid[];
begin
  if not public.is_admin() then raise exception 'Action réservée à l''administrateur.'; end if;
  select * into r from public.reports where id = p_report_id;
  if not found then return; end if;

  -- Si le rapport était clôturé : on annule ses impacts physiques/RH.
  if r.closed then
    for rd in select cistern_id, sum(litrage) as vol from public.report_pump_readings
              where report_id = p_report_id and litrage > 0 group by cistern_id loop
      update public.cisterns set current_l = least(capacity_l, current_l + rd.vol), updated_at = now()
        where id = rd.cistern_id;
    end loop;
    delete from public.fuel_movements where ref_id = p_report_id and source = 'rapport';
    if r.manquant > 0 then
      update public.pompiste_profiles
        set cumul_manquants_mois = greatest(0, cumul_manquants_mois - r.manquant)
        where id = r.pompiste_id;
    end if;
  end if;

  -- Détache le rapport des clôtures qui le contenaient (recalcule leurs totaux).
  for d in select * from public.daily_closings where report_ids ? p_report_id::text loop
    ids := array(select jsonb_array_elements_text(d.report_ids))::uuid[];
    ids := array_remove(ids, p_report_id);
    if coalesce(array_length(ids, 1), 0) = 0 then
      delete from public.daily_closings where id = d.id;
    else
      update public.daily_closings set
        report_ids    = to_jsonb(ids),
        report_count  = array_length(ids, 1),
        total_super_l = coalesce((select sum(essence_litrage) from public.reports where id = any(ids)), 0),
        total_gasoil_l= coalesce((select sum(gasoil_litrage)  from public.reports where id = any(ids)), 0),
        total_volume_l= coalesce((select sum(essence_litrage + gasoil_litrage) from public.reports where id = any(ids)), 0),
        total_encaisse= coalesce((select sum(total_encaisse)  from public.reports where id = any(ids)), 0),
        total_benefice= coalesce((select sum(benefice)        from public.reports where id = any(ids)), 0)
        where id = d.id;
    end if;
  end loop;

  -- Supprime le rapport (cascade : report_pump_readings + expenses liées).
  delete from public.reports where id = p_report_id;
  perform public.snapshot_capital();
end $$;

-- 2) SUPPRESSION D'UNE CLÔTURE (ré-ouvre ses rapports) ----------------
create or replace function public.delete_closing(p_closing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d record; rid uuid; r record; rd record;
begin
  if not public.is_admin() then raise exception 'Action réservée à l''administrateur.'; end if;
  select * into d from public.daily_closings where id = p_closing_id;
  if not found then return; end if;

  for rid in select (jsonb_array_elements_text(d.report_ids))::uuid loop
    select * into r from public.reports where id = rid and closed;
    if found then
      for rd in select cistern_id, sum(litrage) as vol from public.report_pump_readings
                where report_id = rid and litrage > 0 group by cistern_id loop
        update public.cisterns set current_l = least(capacity_l, current_l + rd.vol), updated_at = now()
          where id = rd.cistern_id;
      end loop;
      delete from public.fuel_movements where ref_id = rid and source = 'rapport';
      if r.manquant > 0 then
        update public.pompiste_profiles
          set cumul_manquants_mois = greatest(0, cumul_manquants_mois - r.manquant)
          where id = r.pompiste_id;
      end if;
      update public.reports set closed = false, closed_at = null where id = rid; -- repasse « en cours »
    end if;
  end loop;

  delete from public.daily_closings where id = p_closing_id;
  perform public.snapshot_capital();
end $$;
