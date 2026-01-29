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
| Mistral AI | Génération de quiz |
| Groq (Whisper) | Transcription audio |

---

## Lancement du projet

### Prérequis
- Node.js v22+
- npm
- Cloudflared (pour les callbacks OAuth)

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
| Transcription YouTube | 5 min | Récupère les sous-titres |
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

