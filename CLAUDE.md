# Remember - Project Context

## Description
**Remember** est une plateforme d'apprentissage actif qui transforme le contenu consommé sur les réseaux sociaux (YouTube, Spotify) en connaissances durables via des quiz générés par IA et la répétition espacée (algorithme SM-2).

## Stack Technique

### Backend
| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js v22 |
| Framework | Express.js |
| Langage | TypeScript |
| ORM | Prisma |
| Base de données | PostgreSQL (Supabase - cloud) |
| Auth | JWT (access + refresh tokens) |
| Scheduler | node-cron |

### Frontend
| Composant | Technologie |
|-----------|-------------|
| Framework | React 19 |
| Build | Vite 6 |
| Langage | TypeScript |
| State | Zustand |
| Data Fetching | TanStack React Query |
| Router | React Router v7 |
| CSS | Tailwind CSS |
| Icons | Lucide React |

### Intégrations OAuth
| Service | Scopes | Usage |
|---------|--------|-------|
| YouTube (Google) | `youtube.readonly` | Vidéos likées |
| Spotify | `user-read-recently-played`, `user-library-read` | Podcasts écoutés |

### APIs Externes
| Service | Usage |
|---------|-------|
| YouTube Data API v3 | Récupération des vidéos likées |
| Spotify Web API | Récupération des podcasts écoutés |
| Podcast Index API | Découverte RSS podcasts (4.4M+, primary) |
| Mistral AI | Génération de quiz |
| Groq (Whisper) | Transcription audio podcasts |

### Outils CLI
| Outil | Usage |
|-------|-------|
| yt-dlp | Récupération des sous-titres YouTube (auto-générés inclus) |
| curl_cffi | Impersonation navigateur pour éviter le rate limiting YouTube |

---

## Lancement du projet

### Prérequis
- Node.js v22+
- npm
- Cloudflared (pour les callbacks OAuth)
- Python 3.x avec `yt-dlp` et `curl_cffi` (pour la transcription YouTube)

```bash
# Installation des dépendances Python pour la transcription
pip install yt-dlp curl_cffi
```

### 1. Backend (Terminal 1)
```bash
cd C:\Users\vmsan\Desktop\FREE\PB\VIBE\Remember\backend
npm install  # première fois uniquement
npm run dev
```
Le backend tourne sur **http://localhost:3001**

### 2. Frontend (Terminal 2)
```bash
cd C:\Users\vmsan\Desktop\FREE\PB\VIBE\Remember\frontend
npm install  # première fois uniquement
npm run dev
```
Le frontend tourne sur **http://localhost:5173**

### 3. Tunnel Cloudflare (Terminal 3) - Requis pour OAuth
```bash
cloudflared tunnel --url http://localhost:3001
```
**IMPORTANT:** Après le lancement :
1. Copie la nouvelle URL du tunnel (ex: `https://xxx-xxx.trycloudflare.com`)
2. Mets à jour `backend/.env` :
   - `YOUTUBE_CALLBACK_URL`
   - `SPOTIFY_CALLBACK_URL`
3. Mets à jour Google Cloud Console (URI de redirection)
4. Redémarre le backend

---

## Structure du projet

```
Remember/
├── backend/
│   ├── src/
│   │   ├── config/          # env.ts, database.ts
│   │   ├── routes/          # auth, oauth, content, review, admin
│   │   ├── middleware/      # auth, errorHandler
│   │   ├── services/        # tokenRefresh, transcription, quizGeneration
│   │   └── workers/         # scheduler, spotifySync, youtubeSync
│   ├── prisma/
│   │   └── schema.prisma    # Schéma de la BDD
│   └── .env                 # Variables d'environnement
├── frontend/
│   ├── src/
│   │   ├── pages/           # LoginPage, LibraryPage, SettingsPage, ReviewPage
│   │   ├── components/      # UI components
│   │   ├── stores/          # Zustand stores (authStore)
│   │   └── lib/             # api.ts, utils
│   └── .env                 # Variables frontend (si nécessaire)
└── docs/                    # Documentation projet
```

---

## Workers (Cron Jobs automatiques)

| Job | Fréquence | Description |
|-----|-----------|-------------|
| YouTube Sync | 15 min | Importe les vidéos likées |
| Spotify Sync | 30 min | Importe les podcasts écoutés |
| Transcription YouTube | 5 min | Récupère les sous-titres via yt-dlp |
| Transcription Podcast | 10 min | Transcrit avec Whisper |
| Quiz Generation | 5 min | Génère les quiz avec Mistral |
| Auto-Tagging | 15 min | Tag automatique du contenu |

### Déclencher un sync manuellement
```bash
cd backend
npx tsx trigger-youtube-sync.ts  # YouTube
npx tsx manual-spotify-sync.ts   # Spotify
```

---

## Compte de test

```
Email: test@remember.app
Password: testpassword123
```

---

## Variables d'environnement (.env)

```env
# Serveur
PORT=3001
NODE_ENV=development

# Base de données Supabase
DATABASE_URL="postgresql://..."

# JWT
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."

# LLM (Mistral)
LLM_PROVIDER="mistral"
MISTRAL_API_KEY="..."

# Transcription (Groq Whisper)
GROQ_API_KEY="..."

# YouTube OAuth
YOUTUBE_CLIENT_ID="..."
YOUTUBE_CLIENT_SECRET="..."
YOUTUBE_CALLBACK_URL="https://[TUNNEL-URL]/api/oauth/youtube/callback"

# Spotify OAuth
SPOTIFY_CLIENT_ID="..."
SPOTIFY_CLIENT_SECRET="..."
SPOTIFY_CALLBACK_URL="https://[TUNNEL-URL]/api/oauth/spotify/callback"

# Frontend
FRONTEND_URL="http://localhost:5173"
```

---

## Endpoints API principaux

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/signup` | Inscription |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/oauth/youtube/connect` | Initier OAuth YouTube |
| GET | `/api/oauth/spotify/connect` | Initier OAuth Spotify |
| GET | `/api/oauth/status` | Statut des connexions OAuth |
| GET | `/api/content` | Liste du contenu |
| GET | `/api/review/next` | Prochain quiz à réviser |
| POST | `/api/review/:quizId` | Soumettre une réponse |
| POST | `/api/admin/sync/youtube` | Forcer sync YouTube |
| POST | `/api/admin/sync/spotify` | Forcer sync Spotify |

---

## Documentation complémentaire

- `docs/remember-architecture.md` - Architecture technique détaillée
- `docs/remember-prd.md` - Product Requirements Document
- `docs/remember-ux-design.md` - Design UX
- `docs/remember-product-brief.md` - Brief produit

---

## Git & Branches (Multi-Claude Workflow)

### Repo GitHub
**https://github.com/fysnerd/Remember** (privé)

### Concept des branches
```
master (code stable, testé)
    │
    ├── feature/youtube-history   ← Claude 1 travaille ici
    │
    ├── feature/quiz-ui           ← Claude 2 travaille ici
    │
    └── fix/spotify-sync          ← Claude 3 travaille ici
```

Chaque instance de Claude travaille sur sa **branche isolée**. Quand c'est fini et testé, on **merge** dans `master`.

### Commandes essentielles

**Créer une nouvelle branche avant de donner une tâche à Claude :**
```bash
cd C:\Users\vmsan\Desktop\FREE\PB\VIBE\Remember
git checkout -b feature/nom-de-la-feature
```

**Quand Claude a fini, vérifier et merger :**
```bash
git checkout master                    # Retour sur master
git pull                               # Récupérer les derniers changements
git merge feature/nom-de-la-feature    # Fusionner la branche
git push                               # Envoyer sur GitHub
git branch -d feature/nom-de-la-feature  # Supprimer la branche locale
```

**Voir toutes les branches :**
```bash
git branch -a
```

**Changer de branche :**
```bash
git checkout nom-de-la-branche
```

### Conventions de nommage des branches
- `feature/xxx` - Nouvelle fonctionnalité
- `fix/xxx` - Correction de bug
- `refactor/xxx` - Refactoring de code
- `docs/xxx` - Documentation

### Exemple de workflow multi-Claude

| Terminal | Commande | Tâche |
|----------|----------|-------|
| Terminal 1 | `git checkout -b feature/quiz-ui` | "Améliore le design des quiz" |
| Terminal 2 | `git checkout -b feature/watch-history` | "Ajoute l'historique YouTube" |
| Terminal 3 | `git checkout -b fix/spotify-sync` | "Corrige le bug de sync Spotify" |

### Résoudre les conflits
Si deux branches modifient le même fichier, Git demandera de résoudre les conflits manuellement lors du merge. Dans ce cas :
1. Git marquera les conflits dans les fichiers
2. Édite les fichiers pour choisir quelle version garder
3. `git add .` puis `git commit` pour finaliser

---

## Suivi projet (Linear)

**IMPORTANT pour Claude Code:** Toujours documenter dans Linear (via MCP) :
- **Nouvelles features** : Créer une issue avec label `feature`
- **Bug fixes** : Créer une issue avec label `bug`
- **Améliorations** : Créer une issue avec label `improvement`
- **Tech debt** : Créer une issue avec label `tech-debt`

Format des issues Linear :
```
Titre: [Type] Description courte
Description:
- Ce qui a été fait
- Fichiers modifiés
- Tests effectués
- Prérequis/dépendances ajoutées
```

---

## Changelog récent

### 2026-01-30 - Podcast Index API (REM-39)
- **Type:** Feature
- **Description:** Ajout de Podcast Index comme source principale pour la découverte de podcasts RSS
- **Raison:** iTunes ne couvrait que ~500k podcasts, Podcast Index en a 4.4M+
- **Fichiers modifiés:**
  - `backend/src/services/podcastTranscription.ts` (nouvelle fonction `searchPodcastIndex()`)
  - `backend/src/config/env.ts` (ajout config Podcast Index)
- **Prérequis ajoutés:**
  - `npm install podcast-index-api`
  - Variables `.env`: `PODCAST_INDEX_API_KEY`, `PODCAST_INDEX_API_SECRET`
- **Flow:** Podcast Index (primary) → iTunes (fallback) → UNSUPPORTED
- **Testé:** "Reflets d'Acide" (introuvable sur iTunes) → transcrit et quiz générés ✅

### 2025-01-29 - Transcription YouTube via yt-dlp
- **Type:** Improvement
- **Description:** Remplacement de `youtube-transcript` par `yt-dlp` pour la récupération des sous-titres YouTube
- **Raison:** `youtube-transcript` ne gérait pas correctement les sous-titres auto-générés (ASR)
- **Fichiers modifiés:** `backend/src/services/transcription.ts`
- **Prérequis ajoutés:** `pip install yt-dlp curl_cffi`
- **Testé:** Flow complet YouTube → Transcription → Quiz Generation validé
