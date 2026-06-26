-- =====================================================================
--  STATION KKC OIL — Migration : salaire bi-devise + arrivage carburant
--  À exécuter UNE FOIS dans le SQL Editor (projet déjà en place).
--  Sans danger : idempotent (add column if not exists, create or replace).
-- =====================================================================

-- 1) Salaire bi-devise (part USD) -------------------------------------
alter table public.pompiste_profiles add column if not exists base_salary_usd numeric(14,2) not null default 0;
alter table public.salary_history    add column if not exists old_salary_usd  numeric(14,2) not null default 0;
alter table public.salary_history    add column if not exists new_salary_usd  numeric(14,2) not null default 0;

-- 2) Type de carburant sur l'arrivage ---------------------------------
alter table public.supplier_orders add column if not exists fuel fuel_type not null default 'super';
-- Aligne le carburant des commandes existantes sur celui de leur citerne.
update public.supplier_orders o set fuel = c.fuel
  from public.cisterns c where c.id = o.cistern_id and o.fuel is distinct from c.fuel;

-- 3) Trigger salaire : historise FC + USD, notifie sur hausse de l'un ou l'autre
create or replace function public.on_salary_change() returns trigger language plpgsql as $$
begin
  if new.base_salary is distinct from old.base_salary or new.base_salary_usd is distinct from old.base_salary_usd then
    insert into public.salary_history(pompiste_id,old_salary,new_salary,old_salary_usd,new_salary_usd,changed_by)
      values (new.id,old.base_salary,new.base_salary,old.base_salary_usd,new.base_salary_usd,auth.uid());
    if (new.base_salary>old.base_salary or new.base_salary_usd>old.base_salary_usd) and new.user_id is not null then
      insert into public.notifications(user_id,type,title,body,meta)
      values (new.user_id,'augmentation_salaire','🎉 Salaire augmenté !',
              'Votre salaire de base : '||new.base_salary||' FC + '||new.base_salary_usd||' USD.',
              jsonb_build_object('fc',new.base_salary,'usd',new.base_salary_usd));
    end if;
  end if;
  return new;
end $$;

-- 4) Trigger livraison : citerne doit correspondre au carburant + plafond capacité
create or replace function public.on_order_delivered() returns trigger language plpgsql as $$
declare cur numeric; cap numeric; nom text; cfuel fuel_type;
begin
  if new.status='livre' and (old.status is distinct from 'livre') then
    select current_l, capacity_l, name, fuel into cur, cap, nom, cfuel from public.cisterns where id=new.cistern_id;
    if cfuel <> new.fuel then
      raise exception 'Citerne % (%) incompatible avec le carburant de l''arrivage (%)', nom, cfuel, new.fuel;
    end if;
    if cur + new.volume_l > cap then
      raise exception 'Livraison impossible : dépasse la capacité de % (dispo: % L, commande: % L)', nom, (cap-cur), new.volume_l;
    end if;
    new.delivered_at := now();
    update public.cisterns set current_l=current_l+new.volume_l, updated_at=now() where id=new.cistern_id;
    insert into public.fuel_movements(cistern_id,kind,volume_l,source,ref_id,label)
      values (new.cistern_id,'entree',new.volume_l,'livraison',new.id,'Livraison '||new.supplier_name);
  end if;
  return new;
end $$;
