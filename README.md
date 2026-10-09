# Tilt — le quiz qui fait tilt

Plateforme de quiz interactifs en temps réel : on crée un quiz, on le projette, toute la salle répond depuis son téléphone.

- **Créateurs** : comptes, dashboard, éditeur avec autosave, 4 types de question (extensible), publication, exploration, favoris, résultats et export CSV.
- **Présentateur** : PIN + QR code, salle d'attente live, questions synchronisées, chrono, correction, classement, podium.
- **Joueurs** : aucun compte, un PIN et un pseudo, interface mobile-first.

Stack : React 19 · TypeScript · Vite · Tailwind CSS v4 · Supabase (Postgres, Auth, Realtime, Storage) · Vitest.

## Démarrer

```bash
npm install
cp .env.example .env.local       # renseigner l'URL et la clé anon Supabase
```

### Base de données

Avec un projet Supabase hébergé :

```bash
npx supabase link --project-ref <ref>
npx supabase db push             # applique supabase/migrations
```

Puis, dans le dashboard Supabase : **Authentication → Providers → Anonymous sign-ins : activé** (indispensable pour que les joueurs rejoignent sans compte).

En local (Docker requis) : `npx supabase start && npx supabase db reset` — applique les migrations **et** `supabase/seed.sql` (données de démo, compte `demo@tilt.dev` / `tilt-demo-2026`, jamais à utiliser en production).

## Configuration email / SMTP

Les e-mails d'authentification (confirmation d'inscription, mot de passe oublié) sont **envoyés par Supabase Auth**, pas par l'application. En production, Supabase utilise un **SMTP externe** (par ex. Resend) : le serveur d'e-mails par défaut de Supabase est très limité (quelques e-mails par heure, et seulement vers les adresses de l'équipe du projet).

**Les secrets SMTP ne vont jamais dans le frontend** : ni dans le code, ni dans une variable `VITE_*` (tout ce qui commence par `VITE_` est public et lisible par n'importe quel visiteur), ni dans Vercel. Ils se saisissent uniquement dans le dashboard Supabase. Le frontend ne contient que `VITE_SUPABASE_URL` et la clé publique `VITE_SUPABASE_ANON_KEY` ; un test (`src/security.test.ts`) échoue si une clé secrète, une clé Resend, un identifiant SMTP ou une variable `VITE_*` non publique apparaît dans le code envoyé au navigateur.

### 1. Resend

1. Ajoute et vérifie ton domaine d'envoi (enregistrements DNS SPF/DKIM fournis par Resend).
2. Crée une clé API avec la permission « Sending access ».

### 2. Supabase → Authentication → Emails → SMTP Settings

| Champ | Valeur (Resend) |
|---|---|
| Enable custom SMTP | activé |
| Host | `smtp.resend.com` |
| Port | `465` (ou `587`) |
| Username | `resend` |
| Password | ta clé API Resend |
| Sender email | une adresse de ton domaine vérifié, ex. `no-reply@ton-domaine.fr` |
| Sender name | `Tilt` |

Puis **Authentication → Rate Limits** : ajuste « Rate limit for sending emails » (Supabase le relève une fois le SMTP externe activé).

Pour exiger la confirmation de l'adresse : **Authentication → Providers → Email → Confirm email** activé.

### 3. Supabase → Authentication → URL Configuration

- **Site URL** : l'URL principale, ex. `https://quiz-black-one-92.vercel.app` (puis ton domaine personnalisé).
- **Redirect URLs** (une ligne par environnement) :
  - `https://quiz-black-one-92.vercel.app/auth/callback`
  - `https://quiz-black-one-92.vercel.app/auth/reset`
  - `http://localhost:5173/auth/callback` et `http://localhost:5173/auth/reset` (développement)
  - plus tard : les mêmes chemins sur ton domaine personnalisé.

Les liens sont construits avec l'origine courante (`window.location.origin`) : localhost en dev, Vercel en production, futur domaine sans changer le code. Pour forcer un domaine précis, définis `VITE_PUBLIC_SITE_URL` (valeur publique, pas un secret).

| Route | Utilisée par |
|---|---|
| `/auth/callback?flow=signup` | lien de confirmation d'inscription (et renvoi de l'e-mail) |
| `/auth/callback?next=…` | retour OAuth Google |
| `/auth/reset` | lien « mot de passe oublié » |

Les templates d'e-mail par défaut de Supabase (`{{ .ConfirmationURL }}`) fonctionnent tels quels. Un template utilisant `{{ .TokenHash }}` est aussi géré (`?token_hash=…&type=recovery`).

### 4. Vercel

`vercel.json` renvoie toutes les routes vers `index.html` : `/auth/reset`, `/auth/callback`, `/app`, `/join/…` s'ouvrent directement, y compris depuis un e-mail. Seules les variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (et éventuellement `VITE_ENABLE_GOOGLE_AUTH`, `VITE_PUBLIC_SITE_URL`) sont à définir dans Vercel.

### 5. Tester

1. **Inscription** : crée un compte avec une vraie adresse → écran « vérifie ta boîte mail » → l'e-mail arrive (vérifie l'expéditeur et les spams) → le lien ouvre `/auth/callback` puis le tableau de bord.
2. **Renvoi** : sur l'écran de confirmation, ou en essayant de te connecter avant d'avoir confirmé, « Renvoyer l'e-mail de confirmation ».
3. **Mot de passe oublié** : `/auth/forgot` → e-mail → le lien ouvre `/auth/reset` → nouveau mot de passe (deux fois) → tableau de bord ; reconnecte-toi avec le nouveau mot de passe.
4. **Lien expiré ou déjà utilisé** : réutilise le même lien → message clair + « Demander un nouveau lien ».
5. **Autre appareil** : demande un reset sur l'ordinateur, ouvre le lien sur le téléphone → message expliquant d'ouvrir le lien dans le même navigateur.
6. **Changement de mot de passe connecté** : Paramètres → Compte.

### Erreurs fréquentes

| Symptôme | Cause probable |
|---|---|
| « L'e-mail n'a pas pu être envoyé » | SMTP mal configuré (mot de passe/clé, port), domaine d'envoi non vérifié chez Resend, ou SMTP par défaut de Supabase qui refuse une adresse hors équipe. Voir Supabase → Logs → Auth. |
| « Trop de demandes ont été effectuées » | Rate limit Supabase (e-mails par heure, ou délai minimum entre deux demandes pour la même adresse). |
| Le lien mène à la page d'accueil au lieu de `/auth/reset` | L'URL n'est pas dans **Redirect URLs** : Supabase retombe sur la Site URL. |
| 404 Vercel sur `/auth/reset` | `vercel.json` absent du déploiement : redéploie. |
| « Ce lien doit être ouvert dans le navigateur où tu as fait la demande » | Flux PKCE : le lien est lié au navigateur qui a fait la demande. Ouvre-le au même endroit, ou redemande un lien. |
| « Ce lien a expiré » | Lien de plus d'une heure (durée configurable dans Supabase → Auth → Providers → Email) ou déjà consommé. |
| E-mails en spam | SPF/DKIM non publiés, ou expéditeur sur un domaine non vérifié. |

### Import Kahoot (optionnel)

```bash
npx supabase functions deploy import-kahoot
```

Sans cette fonction, l'import par fichier CSV/XLSX reste disponible.

### Lancer

```bash
npm run dev
```

## Qualité

```bash
npm run typecheck   # TypeScript strict
npm run lint
npm test            # tests unitaires + tests base de données (PGlite exécute les vraies migrations)
npm run build
```

Les tests `tests/db` exécutent les migrations dans Postgres compilé en WebAssembly : RLS, moteur de jeu, score et autosave sont vérifiés sans Docker.

## Architecture

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
