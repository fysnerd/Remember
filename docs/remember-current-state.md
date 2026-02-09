# Remember - État Actuel de l'Implémentation

**Date:** 2026-02-06
**Version:** 1.1
**Basé sur:** Audit complet du codebase

> Ce document reflète l'état **RÉEL** de l'implémentation, pas ce qui était prévu dans le PRD/Architecture.

---

## 🎯 Résumé

Remember (rebrandé **Ankora**) est une plateforme d'apprentissage actif qui transforme le contenu des réseaux sociaux en connaissances durables via des quiz générés par IA et la répétition espacée (SM-2).

**Statut:** ✅ MVP Complet + TikTok/Instagram implémentés + VPS déployé

---

## 🏗️ Architecture Réelle

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 19)                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │ Login   │ │ Learn   │ │ Review  │ │ Stats   │ │Settings││
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────┘│
│                         │ REST API                          │
└─────────────────────────┼───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND (Node.js + Express)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                     ROUTES                            │   │
│  │  /auth  /oauth  /content  /reviews  /admin           │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              WORKERS (node-cron)                      │   │
│  │  YouTube  Spotify  TikTok  Instagram  Transcription  │   │
│  │  Quiz Generation  Auto-Tagging  Daily Reminders      │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  SERVICES                             │   │
│  │  Transcription  Quiz Gen  LLM Client  Token Refresh  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL (Supabase Cloud)                  │
│              Prisma ORM + Migrations                         │
└─────────────────────────────────────────────────────────────┘
```

**Note:** Architecture monolithique (pas de microservices), pas de Redis queue (cron direct).

---

## 🖥️ Infrastructure Production

### VPS (Hetzner CPX32)

| Composant | Détails |
|-----------|---------|
| **Provider** | Hetzner CPX32 (Nuremberg, DE) |
| **Specs** | 4 vCPU, 8GB RAM, 160GB NVMe |
| **IP** | `116.203.17.203` |
| **OS** | Ubuntu 24.04 |
| **Coût** | ~€13.19/mois |
| **Domaine** | `ankora.study` |
| **API URL** | `https://api.ankora.study` |
| **SSH** | `ssh root@116.203.17.203` |

### Services

| Service | Config | Status |
|---------|--------|--------|
| **Caddy** | Reverse proxy HTTPS (Let's Encrypt auto) | ✅ Active |
| **PM2** | Process manager, cluster mode, auto-restart | ✅ Active |
| **Node.js** | v22.22.0 | ✅ |
| **Playwright** | v1.58.1 + Chromium 145 | ✅ |
| **yt-dlp** | 2026.02.04 | ✅ |
| **Python** | 3.12.3 | ✅ |
| **Cron cleanup** | `/etc/cron.daily/cleanup-remember` (fichiers temp) | ✅ |

### URLs Production

| Usage | URL |
|-------|-----|
| Health check | `https://api.ankora.study/health` |
| YouTube OAuth callback | `https://api.ankora.study/api/oauth/youtube/callback` |
| Spotify OAuth callback | `https://api.ankora.study/api/oauth/spotify/callback` |
| Frontend (futur) | `https://ankora.study` |

### Bugs connus VPS

| Bug | Sévérité | Détail |
|-----|----------|--------|
| Instagram sync cassé | 🔴 HIGH | Sélecteurs Playwright outdated, `No grid items found` |
| Supabase timeouts | 🟡 LOW | `P1001` intermittent sur le pooler Supabase |

---

## 📱 Plateformes Supportées

| Plateforme | Auth | Contenu Synchro | Transcription | Statut |
|------------|------|-----------------|---------------|--------|
| **YouTube** | OAuth 2.0 | Vidéos likées | yt-dlp (gratuit) | ✅ STABLE |
| **Spotify** | OAuth 2.0 | Podcasts écoutés (>80%) | Whisper (payant) | ✅ STABLE |
| **TikTok** | Cookies (Playwright) | Vidéos likées | yt-dlp + Whisper | ✅ WORKING |
| **Instagram** | Cookies (Playwright) | Reels sauvegardés/likés | yt-dlp + Whisper | ✅ WORKING |

### Détails par plateforme

#### YouTube
- **Auth:** OAuth 2.0 standard (Google)
- **Scopes:** `youtube.readonly`
- **Sync:** Playlist "Liked" (LL), max 250 vidéos/sync
- **Transcription:** yt-dlp pour sous-titres auto-générés (ASR)
- **Coût:** GRATUIT (sous-titres natifs YouTube)

#### Spotify
- **Auth:** OAuth 2.0 standard
- **Scopes:** `user-read-recently-played`, `user-read-playback-position`, `user-library-read`
- **Sync:** Épisodes >80% écoutés OU fully played
- **Transcription:** Podcast Index API (RSS) → téléchargement MP3 → Whisper API
- **Coût:** ~$0.36/heure (Whisper)
- **Limitation:** Spotify Exclusives = UNSUPPORTED

#### TikTok
- **Auth:** Playwright browser automation + cookies
- **Sync:** Intercept API `/favorite/item_list` via Playwright
- **Transcription:** yt-dlp download → ffmpeg audio extraction → Whisper
- **Coût:** ~$0.36/heure (Whisper)
- **Risque:** Peut casser si TikTok change son API

#### Instagram
- **Auth:** Playwright browser automation + cookies
- **Sources configurable:** Saved & Liked / Saved only / Liked only
- **Sync:** Intercept API `/api/v1/feed/saved/` et `/api/v1/feed/liked/`
- **Transcription:** yt-dlp download → ffmpeg audio extraction → Whisper
- **Coût:** ~$0.36/heure (Whisper)
- **Risque:** Peut casser si Instagram change son API

---

## 🔄 Flow du Contenu

```
┌─────────┐
│  INBOX  │ ← Synchro automatique (initial)
└────┬────┘
     │
     ├─→ ARCHIVED (user skip)
     │
     └─→ SELECTED (user click "Learn")
         │
         ├─→ TRANSCRIBING (worker)
         │   ├─→ SELECTED (transcript OK)
         │   └─→ FAILED (erreur)
         │
         ├─→ UNSUPPORTED (Spotify Exclusive, etc.)
         │
         └─→ GENERATING (quiz generation)
             │
             └─→ READY (quiz prêts)
                 │
                 └─→ User review (SM-2)
```

---

## 📡 API Endpoints Réels

### Auth (`/api/auth`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/signup` | Inscription (email/password) |
| POST | `/auth/login` | Connexion + trigger sync |
| POST | `/auth/refresh` | Refresh JWT |
| GET | `/auth/me` | Profil user + plateformes connectées |
| POST | `/auth/logout` | Déconnexion |

### OAuth (`/api/oauth`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/oauth/status` | Statut toutes connexions |
| GET | `/oauth/youtube/connect` | Initier OAuth YouTube |
| GET | `/oauth/youtube/callback` | Callback YouTube |
| DELETE | `/oauth/youtube/disconnect` | Déconnecter YouTube |
| GET | `/oauth/spotify/connect` | Initier OAuth Spotify |
| GET | `/oauth/spotify/callback` | Callback Spotify |
| DELETE | `/oauth/spotify/disconnect` | Déconnecter Spotify |
| POST | `/oauth/tiktok/connect` | Envoyer cookies TikTok |
| POST | `/oauth/tiktok/cancel` | Annuler auth browser |
| DELETE | `/oauth/tiktok/disconnect` | Déconnecter TikTok |
| POST | `/oauth/tiktok/sync` | Trigger sync manuel |
| POST | `/oauth/instagram/connect` | Envoyer cookies Instagram |
| POST | `/oauth/instagram/cancel` | Annuler auth browser |
| DELETE | `/oauth/instagram/disconnect` | Déconnecter Instagram |

### Content (`/api/content`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/content` | Liste avec filtres & pagination |
| GET | `/content/inbox` | Contenu nouveau (INBOX) |
| GET | `/content/inbox/count` | Count pour badge |
| GET | `/content/tags` | Tags disponibles |
| GET | `/content/stats` | Stats par plateforme/status |
| GET | `/content/:id` | Détail + transcript + quiz |
| PATCH | `/content/:id` | Update status |
| DELETE | `/content/:id` | Supprimer contenu |
| POST | `/content/refresh` | Trigger sync toutes plateformes |
| POST | `/content/triage/bulk` | Triage multiple items |
| POST | `/content/batch/archive` | Archive multiple |
| POST | `/content/batch/delete` | Delete multiple |
| POST | `/content/:id/transcribe` | Trigger transcription manuelle |
| POST | `/content/:id/regenerate-quiz` | Regénérer quiz |

### Reviews (`/api/reviews`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/reviews/due` | Cartes à réviser + nouvelles |
| POST | `/reviews` | Soumettre réponse (rating) |
| GET | `/reviews/stats` | Streak, due count, etc. |
| GET | `/reviews/memos` | Liste des mémos IA |
| POST | `/reviews/session` | Créer session custom |
| GET | `/reviews/session/preview` | Preview count cards matching |
| GET | `/reviews/session/:id/cards` | Cards de la session |
| POST | `/reviews/session/:id/complete` | Terminer session |
| GET | `/reviews/session/:id/mistakes` | Erreurs de la session |
| POST | `/reviews/session/:id/memo` | Générer mémo IA |

### Admin (`/api/admin`)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/admin/sync/youtube` | Force sync YouTube (all users) |
| POST | `/admin/sync/spotify` | Force sync Spotify (all users) |
| POST | `/admin/sync/tiktok` | Force sync TikTok (all users) |
| GET | `/admin/users` | Liste users (paginated) |
| GET | `/admin/users/:id` | User details + stats |

---

## ⏰ Workers (Cron Jobs)

| Worker | Fréquence | Description |
|--------|-----------|-------------|
| YouTube Sync | 15 min | Fetch liked videos |
| Spotify Sync | 30 min | Fetch listened episodes |
| TikTok Sync | 30 min | Browser automation + API intercept |
| Instagram Sync | 30 min | Browser automation + API intercept |
| YouTube Transcription | 5 min | yt-dlp subtitles (5 items/run) |
| Podcast Transcription | 10 min | RSS + Whisper (5 items/run) |
| TikTok Transcription | 5 min | yt-dlp + Whisper (5 items/run) |
| Instagram Transcription | 5 min | yt-dlp + Whisper (5 items/run) |
| Quiz Generation | 5 min | LLM generation |
| Daily Reminders | 5 min | Email at user's configured time |
| Auto-Tagging | 15 min | LLM tag extraction |

**Protection:** Overlap prevention (skip si previous run en cours)

---

## 🧮 Algorithme SM-2

```javascript
IF rating >= 3 (GOOD or EASY):
  easeFactor = max(1.3, easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)))
  repetitions++
  IF repetitions == 1: interval = 1
  ELSE IF repetitions == 2: interval = 3
  ELSE: interval = interval * easeFactor

ELSE IF rating < 3 (AGAIN or HARD):
  easeFactor = max(1.3, easeFactor - 0.2)
  repetitions = 0
  interval = 1

nextReviewAt = now + (interval * days)
```

**Ratings:**
- 1 = AGAIN (reset)
- 2 = HARD (interval × 1.2)
- 3 = GOOD (interval × easeFactor)
- 4 = EASY (interval × easeFactor × 1.3)

---

## 🗄️ Modèles de Données (Prisma)

### User
```typescript
{
  id: string
  email: string
  passwordHash: string
  name?: string
  avatarUrl?: string
  emailVerified: boolean
  plan: 'FREE' | 'PRO' | 'LIFETIME'
  trialStartsAt?: Date
  trialEndsAt?: Date
}
```

### ConnectedPlatform
```typescript
{
  id: string
  userId: string
  platform: 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK' | 'INSTAGRAM'
  sourceType: string  // ex: YOUTUBE_LIKES, SPOTIFY_LIBRARY, INSTAGRAM_BOTH
  accessToken: string  // Encrypted, ou cookies JSON pour TikTok/IG
  refreshToken?: string
  expiresAt?: Date
  lastSyncAt?: Date
  lastSyncError?: string
}
```

### Content
```typescript
{
  id: string
  userId: string
  platform: 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK' | 'INSTAGRAM'
  externalId: string
  url: string
  title: string
  description?: string
  thumbnailUrl?: string
  duration?: number  // seconds
  showName?: string  // Spotify podcast name
  authorUsername?: string
  viewCount?: number
  likeCount?: number
  status: ContentStatus
  capturedAt: Date
}

enum ContentStatus {
  INBOX, ARCHIVED, PENDING, SELECTED,
  TRANSCRIBING, GENERATING, READY, FAILED, UNSUPPORTED
}
```

### Quiz
```typescript
{
  id: string
  contentId: string
  question: string
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FLASHCARD'
  options: string[]  // ["A) ...", "B) ...", "C) ...", "D) ..."]
  correctAnswer: string  // "A", "B", "C", "D"
  explanation?: string
}
```

### Card
```typescript
{
  id: string
  quizId: string
  userId: string
  easeFactor: number  // 1.3 - 2.5 (default 2.5)
  interval: number    // days
  repetitions: number
  nextReviewAt: Date
}
```

### Review
```typescript
{
  id: string
  cardId: string
  userId: string
  sessionId?: string
  rating: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'
  responseTime?: number  // ms
  createdAt: Date
}
```

### QuizSession
```typescript
{
  id: string
  userId: string
  questionLimit?: number
  platforms?: string[]
  tagIds?: string[]
  contentIds?: string[]
  completedAt?: Date
  aiMemo?: string
  memoGeneratedAt?: Date
}
```

### Streak
```typescript
{
  id: string
  userId: string
  currentStreak: number
  longestStreak: number
  lastReviewDate: Date
}
```

---

## 🔧 Stack Technique

### Backend
- **Runtime:** Node.js v22
- **Framework:** Express.js
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL (Supabase)
- **Auth:** JWT (access + refresh)
- **Scheduler:** node-cron
- **Browser Automation:** Playwright
- **Video/Audio:** yt-dlp, ffmpeg

### Frontend
- **Framework:** React 19
- **Build:** Vite 6
- **Language:** TypeScript
- **State:** Zustand
- **Data Fetching:** TanStack React Query
- **Router:** React Router v7
- **CSS:** Tailwind CSS
- **Icons:** Lucide React

### APIs Externes
- **YouTube Data API v3** - OAuth + metadata
- **Spotify Web API** - OAuth + metadata
- **Podcast Index API** - RSS discovery (primary)
- **iTunes API** - RSS fallback
- **Mistral AI** - Quiz generation
- **Groq Whisper** - Transcription (primary)
- **OpenAI Whisper** - Transcription (fallback)

---

## 🚀 Pour l'App iOS

### Ce qui est prêt
- ✅ Backend API complet et testé
- ✅ Tous les endpoints documentés
- ✅ JWT auth fonctionne
- ✅ OAuth YouTube/Spotify prêt
- ✅ WebView auth TikTok/Instagram validé (test Expo Go)
- ✅ Sync workers tournent côté serveur

### Ce qui manque pour iOS
- Deep links pour callbacks OAuth
- Adaptation des callbacks pour scheme `remember://`
- Push notifications (device token registration)

### Endpoints prioritaires pour iOS
1. `/auth/login` + `/auth/signup` + `/auth/me`
2. `/oauth/status` + connect/disconnect
3. `/content` (liste) + `/content/inbox/count` (badge)
4. `/reviews/due` + `/reviews` (submit)
5. `/reviews/stats` (streak, due count)

---

## 📊 Différences avec PRD/Architecture

| Aspect | PRD/Architecture | Réalité |
|--------|------------------|---------|
| TikTok/Instagram | "Future" | ✅ Implémenté |
| YouTube transcription | `youtube-transcript-api` | `yt-dlp` |
| Podcast RSS | Listen Notes API | Podcast Index API |
| Architecture | Microservices | Monolithique |
| Workers | Python + Redis Queue | Node.js + node-cron |
| Content flow | Direct capture | Inbox → Triage → Learn |
| Quiz types | MC + TF + Flashcard | MC + TF (flashcard partial) |

---

---

## 📱 iOS App (Expo + React Native)

### Statut
- **Phase:** En développement actif
- **Linear Issues:** REM-51 à REM-122
- **Documentation:** `ios/CLAUDE.md` (instructions spécifiques)

### Epics Planifiés

| Epic | Description | Issues | Statut |
|------|-------------|--------|--------|
| **Epic 1** | Auth & Onboarding | REM-51 à REM-57 | 🔄 En cours |
| **Epic 2** | Learn Page & Content | REM-58 à REM-65 | ⏳ Planifié |
| **Epic 3** | Review Session | REM-66 à REM-78 | ⏳ Planifié |
| **Epic 4** | Stats & Notes | REM-79 à REM-90 | ⏳ Planifié |
| **Epic 5** | Settings & Platform Connect | REM-91 à REM-105 | ⏳ Planifié |
| **Epic 6** | Polish & Launch | REM-106 à REM-122 | ⏳ Planifié |

### Stack iOS
- **Framework:** Expo SDK 54
- **Navigation:** expo-router (file-based)
- **State:** Zustand + React Query
- **Styling:** NativeWind (Tailwind for RN)
- **Storage:** expo-secure-store (tokens)

### MCP Servers pour iOS
| MCP | Usage |
|-----|-------|
| `expo-devtools` | Interaction live avec l'app (screenshots, tap, scroll, logs) |
| `expo-docs` | Docs Expo SDK 54 offline |
| `linear-server` | Tracking issues |

### Deep Links (à implémenter)
```
ankora://oauth/youtube/callback
ankora://oauth/spotify/callback
ankora://content/:id
ankora://review
```

---

## 🚧 Prochaines Étapes (V1 Beta)

### Phase 1 - Bloquants infra (DONE)
1. ✅ ~~Acheter domaine + configurer DNS~~
2. ✅ ~~Activer HTTPS (Caddy + Let's Encrypt)~~
3. ✅ ~~Update OAuth callback URLs (.env VPS)~~
4. ✅ ~~Update iOS app (associatedDomains + constants.ts)~~
5. ✅ ~~Update Google Cloud Console (YouTube redirect URI)~~
6. ✅ ~~Update Spotify Developer Dashboard (redirect URI)~~
7. ✅ ~~EAS Preview build (fbbcd528, commit 204d17f)~~

### Phase 2 - Rendre l'app fonctionnelle (EN COURS)
8. ✅ ~~Tester OAuth YouTube end-to-end sur device~~ (06/02/2026)
9. ✅ ~~Tester OAuth Spotify end-to-end sur device~~ (06/02/2026)
10. 🟡 Fix Instagram sync (sélecteurs Playwright outdated sur VPS)
11. 🟡 Deep links iOS (`ankora://` scheme complet)
12. ⬜ Nouveau preview build si corrections nécessaires

### Phase 3 - Polish UX
13. ⬜ Pull-to-refresh sync dans Library
14. ⬜ Loading states manquants
15. ⬜ Gestion erreurs réseau
16. ⬜ Haptic feedback (quiz, triage)

### Phase 4 - Prod Ready
17. ⬜ Monitoring basique (PM2 logs + alertes)
18. ⬜ Backup quotidien BDD Supabase
19. ⬜ Optimisation prompts quiz/mémo (REM-125)
20. ⬜ Production build → TestFlight
21. ⬜ Beta testing (10 users)

---

**Dernière mise à jour:** 2026-02-06
