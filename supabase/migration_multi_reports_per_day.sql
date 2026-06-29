-- =====================================================================
--  STATION KKC OIL — Migration : plusieurs rapports / pompiste / jour
--  Lève la contrainte d'unicité (pompiste_id, report_date) qui bloquait
--  les shifts multiples d'un même pompiste dans la même journée.
--  À exécuter UNE FOIS dans le SQL Editor. Idempotent.
-- =====================================================================

-- 1) Supprime la contrainte bloquante (nom par défaut généré par Postgres).
alter table public.reports drop constraint if exists reports_pompiste_id_report_date_key;

-- 1bis) Lève la contrainte d'équilibre : la validation FORCÉE avec écart est
--       désormais une règle métier (un surplus X>Y garde un écart non nul). Le
--       manquant rééquilibre déjà les rapports en cas de manque ; l'écart reste
--       tracé sur la colonne reports.ecart.
alter table public.reports drop constraint if exists reports_balance_chk;

-- 2) Filet de sécurité : si la contrainte avait été (re)créée sous un autre nom,
--    on balaie toutes les contraintes UNIQUE de reports portant exactement sur
--    (pompiste_id, report_date) et on les supprime.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and rel.relname = 'reports' and con.contype = 'u'
      and (
        select array_agg(att.attname order by att.attname)
        from unnest(con.conkey) k
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
      ) = array['pompiste_id','report_date']
  loop
    execute format('alter table public.reports drop constraint %I', c.conname);
  end loop;
end $$;

-- NB : report_date reste de type DATE (logique métier journalière : regroupements
-- par jour, périodes mensuelles, courbes). La distinction matin/soir d'un même
-- jour est déjà assurée par la colonne created_at (timestamptz default now()),
-- qui sert au tri des shifts dans l'app. Pas besoin de TIMESTAMPTZ ici.
-- L'index idx_reports_pompiste (pompiste_id, report_date desc) reste NON unique : conservé.
