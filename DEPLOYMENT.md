# Déploiement — STATION KKC OIL

## 🌍 En production

**https://kkcoil.com** — hébergé sur **Netlify**, domaine personnalisé + SSL Let's Encrypt
automatique (`www` → apex, `http` → `https`), **connecté à Supabase** (temps réel + multi-utilisateurs).
Auto-déploiement à chaque `push` sur `main`.

Connexion : comptes créés dans **Supabase → Authentication** (rôles attribués par `auth_link.sql`).

### Comment ça redéploie

```bash
git add -A && git commit -m "..." && git push origin main
# -> Netlify build (npm run build) + publie automatiquement sur kkcoil.com
```

`netlify.toml` règle Node 20, le dossier `dist` et la redirection SPA (`/* -> /index.html`),
pour que les liens profonds rechargés fonctionnent. Base = `/` (domaine racine).

### Variables d'environnement (Netlify → Site configuration → Environment variables)

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | URL du projet Supabase (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | clé **anon / publishable** du projet |

> Sans ces variables, l'app retombe en **mode démo local** (`localStorage`) — pratique pour une
> démo, mais aucune donnée n'est partagée.

### Alternative (Vercel)

Le repo contient `vercel.json` (framework Vite + redirection SPA). Importer le repo, ajouter les
2 mêmes variables d'env, déployer. Base = `/`.

### En local

Copiez `.env.example` vers `.env`, renseignez les 2 valeurs, `npm run dev` (sinon mode démo).

---

## ☁️ Mise en place Supabase (déjà effectuée — pour mémoire / réinstallation)

1. Projet sur **https://supabase.com** (gratuit).
2. **SQL Editor** → coller tout [`supabase/setup.sql`](supabase/setup.sql) (schéma + triggers + RLS + départ propre) → Run.
3. **Authentication → Users** → créer `admin@kkc.cd`, `jean@kkc.cd`, `audit@kkc.cd` (cocher « Auto Confirm »).
4. **SQL Editor** → coller [`supabase/auth_link.sql`](supabase/auth_link.sql) → Run (attribue les rôles + relie le pompiste).
5. **Project Settings → API** → copier **Project URL** + clé **anon / publishable** → variables d'env Netlify (ci-dessus).

> La logique critique (totaux, règle X==Y, décrément/incrément citernes, cumul RH, capital,
> conversion FC/USD) vit **dans les triggers SQL** : les données restent cohérentes côté serveur,
> et la sécurité par rôle est appliquée par **Row-Level Security** (le pompiste reste hermétique
> aux menus financiers).

### Création de comptes pompistes par l'admin (backend sécurisé)

Pour que l'admin crée le compte d'un pompiste (e-mail + mot de passe) **sans se
déconnecter**, l'app appelle une **fonction backend** qui utilise `auth.admin.createUser`
(clé `service_role`, jamais exposée au client).

**Voie utilisée (recommandée) — Netlify Function** : [`netlify/functions/create-pompiste.mts`](netlify/functions/create-pompiste.mts)
se **déploie automatiquement** avec le site. Il suffit d'**ajouter une variable d'env** :

- Supabase → **Settings → API** → copie la clé **`service_role`** (secrète).
- Netlify → **Site settings → Environment variables** → ajoute :
  `SUPABASE_SERVICE_ROLE_KEY = <clé service_role>` → **Trigger deploy**.

> Sans cette variable, le bouton « Créer le pompiste + son compte » renverra une erreur explicite.
> ⚠️ La clé `service_role` ne doit JAMAIS être mise dans le code client ni dans une variable `VITE_…`.

**Alternative — Supabase Edge Function** : le même code existe en
[`supabase/functions/create-pompiste/index.ts`](supabase/functions/create-pompiste/index.ts)
(déploiement via `supabase functions deploy create-pompiste`). Dans ce cas, remplacez l'appel
`fetch('/.netlify/functions/create-pompiste')` par `sb.functions.invoke('create-pompiste')`.

### Images du CMS vitrine en production

En mode démo, les images sont stockées en data-URL. En production, créez un bucket public
**`landing`** dans Supabase Storage, téléversez-y les images, et stockez l'URL publique
(le schéma et l'UI sont déjà prêts — voir le commentaire en tête de `landing_page_content`).
