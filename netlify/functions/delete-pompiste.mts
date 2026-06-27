// =====================================================================
//  Netlify Function : delete-pompiste  (API Route sécurisée côté serveur)
//  Supprime DÉFINITIVEMENT un pompiste : sa fiche RH (pompiste_profiles)
//  + son compte d'authentification (auth.users via auth.admin.deleteUser),
//  sans perturber la session de l'admin.
//  Les rapports passés sont conservés : la FK reports.pompiste_id est en
//  ON DELETE SET NULL (l'historique des ventes / capital n'est pas perdu).
//
//  Variable d'env Netlify requise : SUPABASE_SERVICE_ROLE_KEY
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
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
  if (!SERVICE) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée sur Netlify.' }, 500);

  try {
    const caller = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get('authorization') || '' } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: 'Non authentifié.' }, 401);

    const admin = createClient(URL, SERVICE);
    const { data: me } = await admin.from('users').select('role').eq('id', user.id).single();
    if (me?.role !== 'admin') return json({ error: "Action réservée à l'administrateur." }, 403);

    const { pompiste_id } = await req.json();
    if (!pompiste_id) return json({ error: 'pompiste_id requis.' }, 400);

    const { data: prof, error: fErr } = await admin.from('pompiste_profiles').select('user_id').eq('id', pompiste_id).single();
    if (fErr || !prof) return json({ error: 'Pompiste introuvable.' }, 404);
    if (prof.user_id && prof.user_id === user.id) return json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, 400);

    // 1) Supprimer la fiche RH (reports.pompiste_id -> NULL via FK ON DELETE SET NULL).
    const { error: dErr } = await admin.from('pompiste_profiles').delete().eq('id', pompiste_id);
    if (dErr) return json({ error: 'Suppression de la fiche échouée : ' + dErr.message }, 400);

    // 2) Supprimer le compte Auth lié (cascade -> public.users).
    if (prof.user_id) {
      const { error: aErr } = await admin.auth.admin.deleteUser(prof.user_id);
      if (aErr) return json({ error: 'Fiche supprimée, mais compte Auth non supprimé : ' + aErr.message }, 207);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
