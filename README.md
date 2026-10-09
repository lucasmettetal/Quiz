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
