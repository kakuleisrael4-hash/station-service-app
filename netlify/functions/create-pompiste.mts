// =====================================================================
//  Netlify Function : create-pompiste  (API Route sécurisée côté serveur)
//  Crée le compte Auth d'un pompiste via auth.admin.createUser (service_role)
//  + sa fiche RH, SANS déconnecter l'admin (jamais de signUp côté client).
//  Se déploie automatiquement avec le site (git push -> Netlify).
//
//  Variable d'environnement à définir dans Netlify (Site settings > Env vars) :
//    SUPABASE_SERVICE_ROLE_KEY = clé service_role (Supabase > Settings > API)
//  (SUPABASE_URL / SUPABASE_ANON_KEY ont des valeurs par défaut publiques.)
// =====================================================================
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || 'https://hdaylxyxvetngelvxzpr.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_9jF-u67t9mGDw43DuGWX3Q_g7FuWSkr';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  // Diagnostic SÛR : liste uniquement les NOMS des variables SUPABASE_* visibles
  // par la fonction (jamais les valeurs). À retirer une fois tout vérifié.
  if (req.method === 'GET') {
    return json({
      hasServiceKey: !!SERVICE,
      supabaseEnvKeys: Object.keys(process.env).filter((k) => /SUPABASE/i.test(k)).sort(),
    });
  }
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!SERVICE) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée sur Netlify.' }, 500);

  try {
    // 1) Vérifier que l'appelant est un admin (via son JWT).
    const caller = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get('authorization') || '' } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: 'Non authentifié.' }, 401);

    const admin = createClient(URL, SERVICE);
    const { data: prof } = await admin.from('users').select('role').eq('id', user.id).single();
    if (prof?.role !== 'admin') return json({ error: "Action réservée à l'administrateur." }, 403);

    // 2) Créer le compte Auth (email confirmé d'office).
    const { email, password, display_name, phone, base_salary, base_salary_usd } = await req.json();
    if (!email || !password) return json({ error: 'E-mail et mot de passe requis.' }, 400);
    if (String(password).length < 6) return json({ error: 'Mot de passe trop court (6 caractères min).' }, 400);

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: display_name },
    });
    if (cErr || !created?.user) return json({ error: cErr?.message ?? 'Création du compte échouée.' }, 400);
    const id = created.user.id;

    // 3) Rôle pompiste + fiche RH liée (rollback du compte si la fiche échoue).
    await admin.from('users').upsert({ id, email, full_name: display_name, role: 'pompiste' }, { onConflict: 'id' });
    const { error: pErr } = await admin.from('pompiste_profiles').insert({
      user_id: id, display_name, phone: phone ?? null, base_salary: base_salary ?? 0, base_salary_usd: base_salary_usd ?? 0,
    });
    if (pErr) { await admin.auth.admin.deleteUser(id); return json({ error: 'Fiche RH non créée : ' + pErr.message }, 400); }

    return json({ ok: true, user_id: id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
