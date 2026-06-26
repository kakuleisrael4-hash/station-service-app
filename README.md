# STATION KKC OIL — Gestion de station-service

**🌍 En ligne : https://kkcoil.com** (hébergé sur Netlify, SSL automatique).
Comptes de démo `admin@kkc.cd` / `jean@kkc.cd` / `audit@kkc.cd`, mot de passe `1234`.
Déploiement & passage en production Supabase : voir [DEPLOYMENT.md](DEPLOYMENT.md).

Application web complète (site vitrine + back-office multi-rôles temps réel) pour gérer
les rapports journaliers, la caisse, les cuves, la RH et les performances des pompistes.

## ✨ Ce qui est inclus

- **Site vitrine** moderne (hero, fonctionnalités, à propos) avec bouton **Espace Personnel** → modale d'authentification.
- **3 rôles** avec redirection automatique :
  - **Admin** — saisie des rapports, gestion des salaires, accès total.
  - **Pompiste** — lecture seule : ses volumes vendus (quantités uniquement), évaluation, suggestions, fiche de paie en direct, notifications.
  - **Gérant / Auditeur (Viewer)** — vision globale : ventes cumulées, parts par pompiste, jauges de cuves, RH global.
- **Formulaire « Nouveau Rapport »** avec calculs **temps réel** : litrages, montants (2 440 / 2 430 FC), dépenses dynamiques, manquant (en rouge), **TOTAL À REMETTRE**.
- **Grille de billetage** + USD → FC, avec **blocage du bouton tant que X ≠ Y** (le bouton ENREGISTRER ne devient vert/actif que si le comptage = total à remettre).
- **Impact RH automatique** : un manquant alimente le `Cumul_Manquants_Mois` du pompiste + notification.
- **Classement des Champions** (podium 🥇🥈🥉) mis à jour **en temps réel** à chaque rapport validé.

## 🧰 Stack

| Couche | Choix |
| --- | --- |
| Front | React 18 + TypeScript + Vite |
| UI | TailwindCSS, Framer Motion, lucide-react |
| Graphiques | Recharts |
| Données / Auth / Realtime | **Supabase** (Postgres + RLS + Realtime) |

### Pourquoi une couche de données à deux implémentations ?

L'UI ne dépend que de l'interface `StationDB` (`src/lib/db.ts`). Il existe **deux** implémentations :

1. **`mockDb`** (par défaut) — magasin local temps réel (localStorage + pub/sub), **pré-rempli** avec un mois d'activité de démo. Aucune configuration : on lance, on clique.
2. **`supabaseDb`** — Postgres + Realtime + RLS. Activé **automatiquement** dès que `.env` contient les clés Supabase.

## 🚀 Démarrer en local (zéro config)

```bash
npm install
npm run dev      # http://localhost:3001
```

Sous Windows, si la preview/MCP ne trouve pas `node`, utilisez le wrapper :

```bat
start-dev.cmd
```

### Comptes de démonstration (mode local)

| Rôle | E-mail | Mot de passe |
| --- | --- | --- |
| Admin | `admin@kkc.cd` | `1234` |
| Pompiste | `jean@kkc.cd` | `1234` |
| Gérant | `audit@kkc.cd` | `1234` |

Des boutons de connexion rapide sont aussi affichés dans la modale.

## ☁️ Passer en production (Supabase)

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez dans l'ordre :
   - `supabase/schema.sql` (tables + triggers métier)
   - `supabase/rls.sql` (sécurité par rôle + Realtime)
   - `supabase/seed.sql` (cuves + pompistes de démo, optionnel)
3. Copiez `.env.example` vers `.env` et renseignez :
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```
4. Créez les comptes via **Authentication**, puis dans la table `public.users` affectez le `role`
   (`admin` / `pompiste` / `viewer`) et reliez le pompiste (`pompiste_profiles.user_id`).
5. `npm run dev` — l'app bascule automatiquement sur Supabase.

> La logique métier critique (totaux, **règle X==Y**, décrément des cuves, cumul RH) est
> appliquée **côté serveur par des triggers SQL** : les données restent cohérentes même si
> un client est modifié. La règle `status='valide' ⇒ ecart=0` est une **contrainte CHECK**.

## 🗂️ Structure

```
supabase/        schema.sql · rls.sql · seed.sql
src/
  lib/           calc.ts (moteur temps réel) · selectors.ts · db.ts · mockDb.ts · supabaseDb.ts
  context/       AuthContext · DataContext
  components/    ui.tsx · DashboardShell · ChampionsPodium
  pages/         LandingPage · LoginModal
                 admin/ (AdminDashboard · NewReportForm · SalaryManagement)
                 pompiste/PompisteDashboard
                 viewer/ViewerDashboard
```
