-- =====================================================================
--  STATION KKC OIL — Données de référence (à exécuter après rls.sql)
--  DÉPART PROPRE : infrastructure (3 citernes VIDES + 4 pompes) +
--  catégories de dépenses + 1 fiche pompiste de départ. Aucune donnée de démo.
--  L'admin saisit ensuite le stock réel, les pompistes, les rapports, etc.
-- =====================================================================

-- Citernes vides : niveau réel à enregistrer via relevé physique ou 1re livraison.
insert into public.cisterns (id, name, fuel, capacity_l, current_l, sale_price_fc) values
  ('cit-gasoil', 'Citerne Gasoil',  'gasoil', 30000, 0, 2430),
  ('cit-super1', 'Citerne Super 1', 'super',  30000, 0, 2440),
  ('cit-super2', 'Citerne Super 2', 'super',  30000, 0, 2440)
on conflict (id) do nothing;

insert into public.pumps (id, label, fuel, cistern_id) values
  ('p1', 'Pompe 1 — Gasoil', 'gasoil', 'cit-gasoil'),
  ('p2', 'Pompe 2 — Super',  'super',  'cit-super1'),
  ('p3', 'Pompe 3 — Super',  'super',  'cit-super1'),
  ('p4', 'Pompe 4 — Super',  'super',  'cit-super2')
on conflict (id) do nothing;

insert into public.expense_categories (name, color) values
  ('RH / Primes', '#10b981'),
  ('Maintenance Pompes', '#f59e0b'),
  ('Taxes & Impôts', '#fb7185'),
  ('Factures Électricité', '#38bdf8'),
  ('Divers', '#a78bfa')
on conflict do nothing;

-- Une fiche pompiste de départ (reliée plus tard au compte « jean@kkc.cd » via auth_link.sql).
-- L'admin ajoute/renomme les autres dans Paramètres → Fiches employés.
insert into public.pompiste_profiles (display_name, base_salary, cumul_manquants_mois, phone)
values ('Pompiste 1', 0, 0, '')
on conflict do nothing;
