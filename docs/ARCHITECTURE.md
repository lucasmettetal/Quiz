# Tilt — architecture

> *Ça fait tilt.* Plateforme de quiz live : on crée, on lance, on joue depuis son téléphone.

## 1. Principes

| Principe | Conséquence |
|---|---|
| **La base de données est l'autorité du jeu** | Transitions, réponses, correction et score sont exécutés dans PostgreSQL (fonctions `security definer`). Le navigateur de l'hôte *demande* une transition, il ne la décide pas ; le navigateur du joueur n'apprend la bonne réponse qu'après la correction. |
| **État synchronisé = instantané + notifications** | Chaque écran lit un instantané complet (`get_player_view`, tables de l'hôte) et Supabase Realtime ne sert qu'à signaler « quelque chose a changé ». Refresh, reconnexion, onglet en veille et arrivée en retard deviennent le même cas : relire l'instantané. |
| **Logique métier hors des composants** | `features/*/engine`, `features/questions/types`, `features/results/stats` sont du TypeScript pur, testé sans React. |
| **Extensibilité des types de question** | Un type = une définition (schéma Zod, contenu par défaut, validation, évaluation) + des composants d'UI enregistrés à part. Ajouter « slider » ne touche ni l'éditeur ni le moteur. |
| **Peu de dépendances** | React, React Router, TanStack Query, Zustand (éditeur), Zod, Motion, dnd-kit, Lucide, supabase-js, uqr (QR code). Pas de Redux, pas de lib de graphiques, pas de lib i18n. |

## 2. Stack

- **Front** : React 19 + TypeScript + Vite, Tailwind CSS v4 (tokens CSS), Motion, Lucide.
- **Back** : Supabase — Postgres, Auth (email, Google optionnel, **connexion anonyme pour les joueurs**), Realtime (Postgres Changes + Presence), Storage.
- **Tests** : Vitest + Testing Library (unitaires/UI) et **PGlite** (Postgres WASM) qui exécute les vraies migrations pour tester RLS et RPC (`npm run test:db`).

## 3. Modèle de données

```
profiles ─┬─< quizzes ─┬─< questions          (content jsonb typé par `type`)
          │            ├─< quiz_tags
          │            └─< favorites >── profiles
          └─< game_sessions ─┬─< game_questions  (copie figée du quiz au lancement)
                             ├─< players         (joueurs anonymes : auth.users anonymes)
                             └─< player_answers  (unique (question, joueur))
```

- `questions.content` (jsonb) porte la charge propre au type :
  - `quiz` `{ options: [{id, text, correct}] }` — 2 à 6 options, ≥ 1 correcte
  - `true_false` `{ correct: boolean }`
  - `text` `{ accepted: string[], caseSensitive?: boolean }`
  - `poll` `{ options: [{id, text}] }`
- `game_questions` fige le quiz : modifier un quiz ne casse ni une partie en cours ni des résultats passés.
- `players.score / rank / previous_rank / last_points / streak` sont mis à jour **à la clôture** de chaque question (pas avant : sinon les joueurs déduiraient la bonne réponse).
- Contraintes : PIN unique parmi les parties non terminées (index partiel), une réponse par joueur et question, pseudo unique (insensible à la casse) par partie, public ⇒ publié, etc.

## 4. Sécurité (RLS)

- Tout est fermé par défaut (`revoke all`), puis ouvert table par table.
- Quiz : propriétaire = tout ; autres = lecture des quiz publiés `public`/`unlisted`.
- Colonnes protégées (`owner_id`, `play_count`, `version`, `question_count`) non modifiables par le client (grants par colonne).
- Parties : lecture réservée à l'hôte et aux joueurs ; `game_questions` et `player_answers` **hôte uniquement**. Aucune écriture directe : uniquement des RPC qui vérifient l'appelant.
- Le joueur est un utilisateur Supabase **anonyme** (aucun compte à créer), ce qui permet RLS + reconnexion sans secret maison.
- Aucune clé `service_role` côté front.

## 5. Moteur de jeu

```
LOBBY → QUESTION_INTRO → QUESTION_ACTIVE → QUESTION_RESULTS ─┬→ LEADERBOARD → QUESTION_INTRO …
                                                             └→ FINAL_RESULTS → FINISHED  (dernière question)
(n'importe quel état → FINISHED si l'hôte termine)
```

- Machine définie dans `src/features/game/engine/stateMachine.ts`, appliquée par `host_advance(session, from_state)` : **idempotent** (double clic, deux onglets, retry réseau = no-op).
- `submit_answer` : vérifie joueur, état, question courante, délai (+1,5 s de tolérance réseau), forme de la réponse ; calcule correction + score avec l'heure serveur ; contrainte unique contre la double réponse ; clôt la question quand tous les joueurs actifs ont répondu.
- Score : `points × (1 − 0,5 × temps/limite)`, 0 si faux — `calculateQuestionScore()` (TS) ≡ `compute_question_score()` (SQL), parité testée.
- Horloge : la vue renvoie `server_now` ; le client calcule son décalage pour afficher un chrono juste.

### Événements temps réel

`services/realtime.ts` transforme les changements Postgres en événements métier :
`player_joined`, `player_left`, `game_started`, `question_started`, `answer_submitted`, `question_ended`, `leaderboard_updated`, `game_finished` (dérivation pure, testée). La **Presence** du canal signale joueurs/hôte hors ligne (déconnexion temporaire ≠ départ).

| Cas | Traitement |
|---|---|
| Refresh / reconnexion | `join_session` renvoie le même joueur (même identité anonyme) ; la vue est relue. |
| Double réponse | Contrainte unique + `ALREADY_ANSWERED` traité comme un succès côté client. |
| Joueur en retard | Accepté (option de partie), rejoint l'état courant. |
| Hôte déconnecté | La partie se fige, les joueurs voient « en attente de l'hôte » (presence). |
| Latence | Tolérance serveur de 1,5 s, chrono basé sur l'heure serveur. |

## 6. Front

```
src/
  app/            providers, router
  components/ui   primitives du design system (Button, Dialog, Field…)
  components/layout
  features/
    auth/         contexte de session, garde de routes
    quizzes/      cartes, couvertures, actions (dupliquer, partager…)
    questions/    registre des types de question (logique + UI)
    editor/       store Zustand, autosave, panneaux
    game/         engine/ (machine, score, horloge), host/, player/
    results/      statistiques pures + écrans, export CSV
  pages/          un fichier par route, assemble les features
  services/       accès Supabase (seul endroit qui parle à la base)
  hooks/ stores/ lib/ i18n/ types/
```

### Routes

| Route | Écran | Public |
|---|---|---|
| `/` | Landing + champ PIN | ✔ |
| `/join`, `/join/:pin` | Rejoindre (PIN → pseudo) | ✔ |
| `/play/:sessionId` | Jeu joueur (mobile) | joueur anonyme |
| `/auth/login`, `/auth/signup`, `/auth/forgot`, `/auth/reset`, `/auth/callback` | Auth | ✔ |
| `/app` | Accueil dashboard | créateur |
| `/app/quizzes` | Mes quiz | créateur |
| `/app/explore` | Explorer | créateur |
| `/app/favorites` | Favoris | créateur |
| `/app/results`, `/app/results/:sessionId` | Historique, rapport | créateur |
| `/app/settings` | Profil, thème, langue | créateur |
| `/quiz/:quizId` | Fiche d'un quiz (aperçu, lancer, dupliquer) | selon visibilité |
| `/editor/:quizId` | Éditeur plein écran | propriétaire |
| `/host/:sessionId` | Présentateur plein écran | hôte |

## 7. Design system

- **Nom & idée** : *Tilt* — le déclic de la compréhension, et le flipper. Langage graphique : blocs **inclinés**, ombres **portées dures** (pas floues), **motifs** (rayures, points, grille, vagues, zigzag, damier).
- **Couleurs** : encre `#17142B`, papier `#FAF6EE`, primaire *vermillon* `#F2471F`. Six couleurs de réponse (vermillon, cobalt, citron vert, ambre, sarcelle, orchidée), **chacune liée à une lettre et à un motif** : jamais d'information portée par la couleur seule.
- **Typo** : *Bricolage Grotesque* (titres, chiffres de jeu) + *Figtree* (interface).
- **Deux registres** : administration sobre et dense ; jeu spectaculaire (typo géante, couleurs franches, animations de score/podium).
- **Mouvement** : 120–250 ms pour l'interface, animations expressives réservées aux moments de jeu, `prefers-reduced-motion` respecté.
- **Thèmes** : clair, sombre (palette dédiée encre/aubergine), système.

## 8. Phases

1. **Foundation** — config, design system, i18n, thèmes, Supabase, schéma + RLS, auth, layout.
2. **Dashboard** — accueil, mes quiz (recherche, filtres, tri), création, duplication, suppression, partage, favoris.
3. **Éditeur** — types de question, drag & drop, autosave avec conflits, paramètres, aperçu, médias, publication.
4. **Moteur de jeu** — création de partie, PIN, lobby, joueurs, machine à états.
5. **Live** — synchro hôte/joueur, chrono, réponses, correction, classement, podium.
6. **Résultats** — historique, rapport, statistiques par question, export CSV.
7. **Finition** — animations, responsive, accessibilité, performance.

## 9. Lancer le projet

```bash
npm install
cp .env.example .env.local      # URL + clé anon du projet Supabase
supabase db push                # ou: supabase start && supabase db reset (local, applique seed.sql)
npm run dev
```

Dans le dashboard Supabase : activer **Anonymous sign-ins** (Auth → Providers) — indispensable pour que les joueurs rejoignent sans compte. Google OAuth est optionnel.

Vérifications : `npm run typecheck && npm run lint && npm test && npm run build`.
