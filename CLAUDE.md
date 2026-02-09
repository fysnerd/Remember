# Ankora - Project Context

## Description
**Ankora** (anciennement Remember) est une plateforme d'apprentissage actif qui transforme le contenu consommé sur les réseaux sociaux (YouTube, Spotify, TikTok, Instagram) en connaissances durables via des quiz générés par IA et la répétition espacée (algorithme SM-2).

---

## Accès & Credentials

### VPS (Hetzner CPX32)
```
IP: 116.203.17.203
SSH: ssh root@116.203.17.203
Password: UIOloy012%
Backend path: /root/Remember/backend/
Caddy config: /etc/caddy/Caddyfile
PM2 process: remember-api (cluster mode)
```

### Supabase (Base de données)
```
Project ID: iadzfswcpgjczjpkhpjv
DATABASE_URL: postgresql://postgres.iadzfswcpgjczjpkhpjv:K2WDnPUIN9glWoRQ@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
```
**RÈGLE:** TOUJOURS utiliser le MCP Supabase (`execute_sql`, project_id `iadzfswcpgjczjpkhpjv`) pour requêter la BDD. JAMAIS de psql/prisma/node via SSH.

### Apple / EAS
```
Bundle ID: com.fysnerd.ankora
EAS Project: @fysnerd/ankora (ID: 41df5660-1c97-4b52-8b43-e6181bd77c16)
App Store Connect Apple ID: 6758732600
Apple Team: HSR27437U4 (Antoine Patarin)
Apple ID: cobreadgang@gmail.com
```

### Compte de test
```
Email: test@remember.app
Password: testpassword123
```

---

## Production .env (VPS)

```env
PORT=3001
NODE_ENV=production

# Supabase PostgreSQL
DATABASE_URL="postgresql://postgres.iadzfswcpgjczjpkhpjv:K2WDnPUIN9glWoRQ@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
DIRECT_URL="postgresql://postgres.iadzfswcpgjczjpkhpjv:K2WDnPUIN9glWoRQ@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

# JWT (production secrets)
JWT_SECRET="4dd6850940c0d71b23bd03a70c38143434dd383660cc5b14dd55f6dd3427c370"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_SECRET="0b580bc0dcc6a0ca486e41a29daacd0377f21f850806b21b75205c164853864f"
JWT_REFRESH_EXPIRES_IN="30d"

# Mistral AI (quiz generation)
LLM_PROVIDER="mistral"
MISTRAL_API_KEY="NvsAQROsB66JQLPWKmpOZi8rTHSLoQgC"

# Groq Whisper (transcription)
GROQ_API_KEY="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"

# Podcast Index API
PODCAST_INDEX_API_KEY="B9CDRUVXWN6DPTPHZPFC"
PODCAST_INDEX_API_SECRET="tM^2uTZtM#Q^BmX7ScdmcwP5H5TwY$ruVcc9c58n"

# YouTube OAuth
YOUTUBE_CLIENT_ID="628216102691-rapig42ndt06hg1dab93pquvvvnp06r1.apps.googleusercontent.com"
YOUTUBE_CLIENT_SECRET="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"
YOUTUBE_CALLBACK_URL="https://api.ankora.study/api/oauth/youtube/callback"

# Spotify OAuth
SPOTIFY_CLIENT_ID="30cba06b0bc14fa086a6f4c47b25fccf"
SPOTIFY_CLIENT_SECRET="7ab0a73d72a04ea88789f49f1e244d90"
SPOTIFY_CALLBACK_URL="https://api.ankora.study/api/oauth/spotify/callback"

FRONTEND_URL="https://ankora.study"
```

---

## Production URLs

| Service | URL |
|---------|-----|
| API backend | `https://api.ankora.study` |
| VPS | Hetzner CPX32 - `116.203.17.203` |
| Deep link scheme | `ankora://` |
| Frontend (legacy) | `https://ankora.study` |

---

## Déployer après des modifications

### Modifs backend (le plus courant)
```bash
ssh root@116.203.17.203 "cd /root/Remember/backend && git pull && npm run build && pm2 restart remember-api"
```

### Modifs UI/UX/JS (pas de changement natif)
```bash
cd ios
eas update --branch production --message "description du changement"
```
OTA instantané, pas de rebuild, pas de review Apple.

### Modifs natives (nouveau plugin, app.json, lib native)
```bash
cd ios
eas build --profile production --platform ios --auto-submit
```
Rebuild + soumission TestFlight automatique.

### Quand proposer quoi
- Changements `.tsx`, `.ts`, styles, logique, écrans → `eas update`
- Ajout plugin expo, changement app.json, lib native → `eas build --auto-submit`
- Changements backend → deploy VPS via SSH

---

## Stack Technique

### Backend (VPS - production)
| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js v22 |
| Framework | Express.js |
| Langage | TypeScript |
| ORM | Prisma |
| Base de données | PostgreSQL (Supabase) |
| Auth | JWT (access + refresh tokens) |
| Scheduler | node-cron |
| Process Manager | PM2 (cluster mode) |
| Reverse Proxy | Caddy (HTTPS auto) |

### iOS App (Expo)
| Composant | Technologie |
|-----------|-------------|
| Framework | Expo SDK 54 |
| Navigation | expo-router (file-based) |
| State | Zustand |
| Data Fetching | TanStack React Query |
| Storage | expo-secure-store (JWT) |
| HTTP | Axios |
| Auth OAuth | expo-web-browser + deep links |

### Intégrations
| Service | Usage |
|---------|-------|
| YouTube (Google OAuth) | Vidéos likées |
| Spotify (OAuth) | Podcasts écoutés |
| TikTok (cookies) | Vidéos likées |
| Instagram (cookies) | Reels sauvegardés |
| Mistral AI | Génération de quiz |
| Groq (Whisper) | Transcription audio |
| Podcast Index API | Découverte RSS (4.4M+) |
| yt-dlp | Sous-titres YouTube |

---

## Structure du projet

```
Remember/                    # ← Le dossier s'appelle encore Remember (pas renommé)
├── backend/                 # API Express.js (déployée sur VPS)
│   ├── src/
│   │   ├── config/          # env.ts, database.ts
│   │   ├── routes/          # auth, oauth, content, review, admin
│   │   ├── middleware/      # auth, errorHandler
│   │   ├── services/        # tokenRefresh, transcription, quizGeneration
│   │   └── workers/         # scheduler, spotifySync, youtubeSync, tiktokSync
│   ├── prisma/
│   │   └── schema.prisma    # Schéma BDD
│   └── .env                 # Variables d'environnement (gitignored)
├── ios/                     # iOS App (Expo + React Native)
│   ├── app/                 # Écrans (expo-router file-based)
│   ├── components/          # UI components
│   ├── hooks/               # React Query hooks
│   ├── stores/              # Zustand stores
│   ├── lib/                 # api.ts, constants.ts
│   ├── eas.json             # Config EAS Build
│   └── app.json             # Config Expo
├── Ankora/                  # Docs spécifiques Ankora v2
├── frontend/                # Web App React (legacy)
├── docs/                    # Documentation historique
└── experiments/             # Tests divers
```

---

## Workers (Cron Jobs - VPS)

Fichier : `backend/src/workers/scheduler.ts` — Protection anti-overlap via `runningJobs` Set.

### Sync (import contenu)

| Job | Cron | Fréquence | Description |
|-----|------|-----------|-------------|
| YouTube Sync | `*/15 * * * *` | 15 min | Vidéos likées (YouTube Data API, playlist LL) |
| Spotify Sync | `*/30 * * * *` | 30 min | Podcasts écoutés >80% (Spotify API) |
| TikTok Sync | `*/30 * * * *` | 30 min | Vidéos likées (Playwright + cookies) |
| Instagram Sync | `*/30 * * * *` | 30 min | Reels likés (Playwright + context.request, Barcelona UA) |

### Transcription

| Job | Cron | Fréquence | Description |
|-----|------|-----------|-------------|
| YouTube Transcription | `*/2 * * * *` | 2 min | Sous-titres via yt-dlp (gratuit) |
| Podcast Transcription | `*/5 * * * *` | 5 min | Whisper via Groq (payant) |
| TikTok Transcription | `*/2 * * * *` | 2 min | yt-dlp + Whisper |
| Instagram Transcription | `*/2 * * * *` | 2 min | yt-dlp + Whisper |

### Traitement

| Job | Cron | Fréquence | Description |
|-----|------|-----------|-------------|
| Quiz Generation | `*/2 * * * *` | 2 min | Génère les quiz avec Mistral AI |
| Daily Reminder | `*/5 * * * *` | 5 min | Email reminder (fenêtre 5 min, respecte timezone) |
| Auto-Tagging | `*/15 * * * *` | 15 min | Tags auto via Mistral AI |

### Trigger manuel
`POST /api/admin/sync/all` — Valeurs possibles : `youtube`, `spotify`, `tiktok`, `instagram`, `transcription`, `podcast-transcription`, `tiktok-transcription`, `instagram-transcription`, `quiz-generation`, `reminder`, `auto-tagging`.

---

## Endpoints API principaux

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/signup` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/oauth/youtube/connect` | Initier OAuth YouTube |
| GET | `/api/oauth/spotify/connect` | Initier OAuth Spotify |
| POST | `/api/oauth/tiktok/connect` | Connecter TikTok (cookies) |
| POST | `/api/oauth/instagram/connect` | Connecter Instagram (cookies) |
| GET | `/api/oauth/status` | Statut des connexions OAuth |
| GET | `/api/content` | Liste du contenu |
| GET | `/api/content/inbox` | Contenu à trier |
| POST | `/api/content/triage/bulk` | Trier en masse |
| GET | `/api/reviews/due` | Quiz à réviser |
| POST | `/api/reviews` | Soumettre une réponse |
| POST | `/api/admin/sync/all` | Forcer sync toutes plateformes |

---

## Debugging VPS (commandes utiles)

```bash
# Logs PM2 en temps réel
ssh root@116.203.17.203 "pm2 logs remember-api --lines 50"

# Status PM2
ssh root@116.203.17.203 "pm2 status"

# Restart backend
ssh root@116.203.17.203 "pm2 restart remember-api"

# Voir config Caddy
ssh root@116.203.17.203 "cat /etc/caddy/Caddyfile"

# Disk space
ssh root@116.203.17.203 "df -h"
```

---

## Known Issues

- **Supabase timeouts**: Intermittent `P1001` on pooler (low priority)
- **TikTok transcription spam**: Some videos fail repeatedly (sensitive content requiring login) - needs max retry limit

## OAuth Status (validated 2026-02-09)
- YouTube: working end-to-end
- Spotify: working end-to-end
- TikTok: validated previously
- Instagram: working end-to-end (hybrid Playwright + context.request approach)

---

## Git

### Repo GitHub
**https://github.com/fysnerd/Remember** (privé)

### Conventions de branches
- `feature/xxx` - Nouvelle fonctionnalité
- `fix/xxx` - Correction de bug
- `refactor/xxx` - Refactoring
- `docs/xxx` - Documentation

---

## Suivi projet (Linear)

**Projet:** Ankora
**Issues:** REM-123 (Parallelisation workers), REM-124 (Observability), REM-125 (Optimisation prompts), REM-126 (Notifications), REM-128 (QA TikTok/Instagram)

---

## Règles Claude Code

1. **BDD**: TOUJOURS utiliser le MCP Supabase (`execute_sql`, project_id `iadzfswcpgjczjpkhpjv`) pour requêter la base de données. JAMAIS de psql/prisma/node via SSH.
2. **SSH VPS**: Réservé uniquement pour les logs PM2, déploiement (`git pull && npm run build && pm2 restart`), et commandes système.
3. **Deployer le backend** après chaque modif backend: `ssh root@116.203.17.203 "cd /root/Remember/backend && git pull && npm run build && pm2 restart remember-api"`
4. **Ne jamais modifier le .env de prod** sans confirmation explicite de l'utilisateur.

---

*Mis à jour: 2026-02-09 - Instagram sync fixed (hybrid Playwright + context.request)*
