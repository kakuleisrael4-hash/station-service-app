-- =====================================================================
--  STATION KKC OIL — Données de référence (à exécuter après rls.sql)
--  Crée les 3 citernes, 4 pompes, catégories de dépenses et pompistes.
-- =====================================================================

insert into public.cisterns (id, name, fuel, capacity_l, current_l, sale_price_fc) values
  ('cit-gasoil', 'Citerne Gasoil',  'gasoil', 30000, 18000, 2430),
  ('cit-super1', 'Citerne Super 1', 'super',  30000, 13500, 2440),
  ('cit-super2', 'Citerne Super 2', 'super',  30000, 21600, 2440)
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

insert into public.pompiste_profiles (display_name, base_salary, cumul_manquants_mois, phone) values
  ('Jean Mbayo',     450000, 0,    '+243 970 000 001'),
  ('Esther Kalala',  450000, 5000, '+243 970 000 002'),
  ('Patrick Ilunga', 420000, 0,    '+243 970 000 003')
on conflict do nothing;
