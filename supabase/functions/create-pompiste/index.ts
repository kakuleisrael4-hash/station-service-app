// =====================================================================
//  Edge Function : create-pompiste
//  Crée le compte Auth d'un pompiste (auth.admin.createUser) + sa fiche RH,
//  SANS déconnecter l'admin (contrairement à signUp côté client).
//  Sécurité : seul un utilisateur de rôle 'admin' peut l'appeler.
//
//  Déploiement (Dashboard Supabase > Edge Functions > Deploy new function,
//  nom « create-pompiste ») ou CLI : supabase functions deploy create-pompiste
//  Les variables SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
//  sont injectées automatiquement par Supabase.
// =====================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // 1) Identifier l'appelant via son JWT, et vérifier qu'il est admin.
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await caller.auth.getUser();
    if (uErr || !user) return json({ error: 'Non authentifié.' }, 401);

    const admin = createClient(url, service);
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
    const newId = created.user.id;

    // 3) Rôle 'pompiste' (le trigger handle_new_user a pu créer la ligne en 'viewer').
    await admin.from('users').upsert({ id: newId, email, full_name: display_name, role: 'pompiste' }, { onConflict: 'id' });

    // 4) Fiche RH liée au compte.
    const { error: pErr } = await admin.from('pompiste_profiles').insert({
      user_id: newId, display_name, phone: phone ?? null,
      base_salary: base_salary ?? 0, base_salary_usd: base_salary_usd ?? 0,
    });
    if (pErr) {
      // Rollback du compte Auth si la fiche échoue, pour rester cohérent.
      await admin.auth.admin.deleteUser(newId);
      return json({ error: 'Fiche RH non créée : ' + pErr.message }, 400);
    }

    return json({ ok: true, user_id: newId }, 200);
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
