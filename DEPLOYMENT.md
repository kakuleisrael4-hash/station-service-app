# Déploiement — STATION KKC OIL

## 🌍 Démo en ligne (déjà déployée)

**https://kakuleisrael4-hash.github.io/station-service-app/**

- Hébergée sur **GitHub Pages**, build automatique via GitHub Actions à chaque `push` sur `main`.
- Tourne en **mode démo local** (données dans le navigateur, `localStorage`) — aucune base requise.
- Comptes : `admin@kkc.cd` · `jean@kkc.cd` · `audit@kkc.cd` — mot de passe `1234` (boutons de connexion rapide aussi).

### Comment ça redéploie

```bash
git add -A && git commit -m "..." && git push origin main
# -> le workflow .github/workflows/deploy.yml build + publie sur Pages
```

Le workflow règle `VITE_BASE=/station-service-app/` (sous-chemin Pages) et copie `index.html`
vers `404.html` pour le routage SPA (les liens profonds rechargés fonctionnent).

### Alternatives (root domain, env plus simple)

Le repo contient déjà les configs :

- **Vercel** : importer le repo → framework Vite détecté (`vercel.json`). Mettre les variables
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` dans le projet Vercel. Base = `/` (pas de `VITE_BASE`).
- **Netlify** : importer le repo (`netlify.toml`). Mêmes variables d'env. Redirect SPA déjà configuré.

---

## ☁️ Passer en PRODUCTION avec Supabase (temps réel + multi-utilisateurs)

L'app détecte Supabase automatiquement dès que les 2 variables d'env sont présentes au build.

### 1. Créer le projet et la base (≈ 3 min)

1. Créez un projet sur **https://supabase.com** (gratuit).
2. **SQL Editor → New query** : collez **tout** le fichier [`supabase/setup.sql`](supabase/setup.sql)
   (schéma + triggers + RLS + données de référence) et exécutez.

### 2. Créer les comptes & rôles

3. **Authentication → Users → Add user** : créez `admin@kkc.cd`, `jean@kkc.cd`, `audit@kkc.cd`
   (cochez « Auto Confirm »), avec le mot de passe de votre choix.
4. **SQL Editor** : exécutez [`supabase/auth_link.sql`](supabase/auth_link.sql) pour attribuer les
   rôles (admin/pompiste/viewer) et relier `jean@kkc.cd` à la fiche RH « Jean Mbayo ».

### 3. Récupérer les clés

5. **Project Settings → API** : copiez **Project URL** et la clé **anon public**.

### 4. Brancher le déploiement

**GitHub Pages** — ajoutez les secrets puis relancez le déploiement :

```bash
gh secret set VITE_SUPABASE_URL      --body "https://xxxx.supabase.co"      --repo kakuleisrael4-hash/station-service-app
gh secret set VITE_SUPABASE_ANON_KEY --body "eyJhbGciOi..."                 --repo kakuleisrael4-hash/station-service-app
gh workflow run "Deploy to GitHub Pages" --repo kakuleisrael4-hash/station-service-app
```

**Vercel / Netlify** — ajoutez les 2 variables d'env dans le dashboard et redéployez.

**En local** — copiez `.env.example` vers `.env`, renseignez les 2 valeurs, `npm run dev`.

> La logique critique (totaux, règle X==Y, décrément/incrément citernes, cumul RH, capital,
> conversion FC/USD) vit **dans les triggers SQL** : les données restent cohérentes côté serveur,
> et la sécurité par rôle est appliquée par **Row-Level Security** (le pompiste reste hermétique
> aux menus financiers).

### Images du CMS vitrine en production

En mode démo, les images sont stockées en data-URL. En production, créez un bucket public
**`landing`** dans Supabase Storage, téléversez-y les images, et stockez l'URL publique
(le schéma et l'UI sont déjà prêts — voir le commentaire en tête de `landing_page_content`).
