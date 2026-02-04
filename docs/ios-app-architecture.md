# Remember iOS App - Architecture Backend

**Version:** 1.1
**Date:** 2026-01-30
**Stack:** React Native + Expo SDK 54
**Backend:** Express.js + Prisma + PostgreSQL (Supabase)

> **📋 Voir aussi:** [`docs/remember-current-state.md`](./remember-current-state.md) - État complet de l'implémentation backend avec tous les endpoints API.

---

## 🎯 Vue d'ensemble

L'app iOS Remember consomme la même API REST que le frontend web. Le backend gère:
- Authentification (JWT)
- OAuth YouTube/Spotify (natif) + TikTok/Instagram (cookies)
- Sync automatique (cron jobs côté serveur)
- Quiz generation (LLM)
- Spaced repetition (SM-2)

```
┌─────────────────────────────────────────────────────────────┐
│                      iOS APP (React Native)                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Login   │ │ Inbox   │ │ Review  │ │ Stats   │           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       └───────────┴───────────┴───────────┘                 │
│                         │                                    │
│                    REST API                                  │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                    BACKEND                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Express.js                         │    │
│  │  /api/auth   /api/oauth   /api/content   /api/reviews│    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Background Workers (Cron)               │    │
│  │  YouTube Sync │ Spotify Sync │ Transcription │ Quiz  │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 PostgreSQL (Supabase)                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentification

### Flow JWT

```
┌──────────────────────────────────────────────────────────┐
│ 1. Login/Signup                                          │
│    POST /api/auth/login {email, password}                │
│    Response: {accessToken, refreshToken, user}           │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Store tokens (Expo SecureStore)                       │
│    await SecureStore.setItemAsync('accessToken', token)  │
│    await SecureStore.setItemAsync('refreshToken', token) │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ 3. API Requests                                          │
│    Headers: { Authorization: 'Bearer {accessToken}' }    │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Token Refresh (quand accessToken expire)              │
│    POST /api/auth/refresh {refreshToken}                 │
│    Response: {accessToken, refreshToken}                 │
└──────────────────────────────────────────────────────────┘
```

### Endpoints Auth

| Méthode | Endpoint | Description | Body |
|---------|----------|-------------|------|
| POST | `/api/auth/signup` | Inscription | `{email, password, name?}` |
| POST | `/api/auth/login` | Connexion | `{email, password}` |
| POST | `/api/auth/refresh` | Rafraîchir token | `{refreshToken}` |
| GET | `/api/auth/me` | Profil user | - |
| POST | `/api/auth/logout` | Déconnexion | - |

### Token Durées

| Token | Durée | Secret |
|-------|-------|--------|
| Access Token | 7 jours | `JWT_SECRET` |
| Refresh Token | 30 jours | `JWT_REFRESH_SECRET` |

---

## 🔗 OAuth Plateformes

### YouTube & Spotify (OAuth 2.0 natif)

```
┌─────────────────────────────────────────────────────────────┐
│ iOS App                                                     │
│                                                             │
│ 1. User tape "Connecter YouTube"                            │
│    ↓                                                        │
│ 2. GET /api/oauth/youtube/connect                           │
│    Response: {authUrl: "https://accounts.google.com/..."}   │
│    ↓                                                        │
│ 3. Ouvrir authUrl avec expo-auth-session                    │
│    ↓                                                        │
│ 4. User autorise sur Google                                 │
│    ↓                                                        │
│ 5. Callback redirect vers app (deep link)                   │
│    remember://oauth/youtube/callback?code=xxx               │
│    ↓                                                        │
│ 6. Backend échange code → tokens                            │
│    Stocke tokens en BDD                                     │
│    ↓                                                        │
│ 7. Sync automatique démarre en background                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Configuration Deep Links

```json
// app.json
{
  "expo": {
    "scheme": "remember",
    "ios": {
      "bundleIdentifier": "com.remember.app",
      "associatedDomains": ["applinks:api.remember.app"]
    }
  }
}
```

### Callback URLs à configurer

| Plateforme | Callback URL (Production) |
|------------|---------------------------|
| YouTube | `https://api.remember.app/api/oauth/youtube/callback` |
| Spotify | `https://api.remember.app/api/oauth/spotify/callback` |

**Note:** Le backend doit rediriger vers le deep link de l'app après OAuth:
```
remember://oauth/success?platform=youtube
```

### TikTok & Instagram (WebView + Cookies)

Ces plateformes n'ont pas d'OAuth officiel. On utilise un WebView pour capturer les cookies de session.

#### ✅ VALIDÉ - Test WebView (2026-01-30)

Test réalisé avec Expo Go sur iPhone. **Les deux plateformes fonctionnent !**

| Platform | Résultat | User Agent | Cookies obtenus |
|----------|----------|------------|-----------------|
| **TikTok** | ✅ SUCCESS | Safari iOS | `msToken` (session) |
| **Instagram** | ✅ SUCCESS | Safari iOS | `csrftoken`, `ds_user_id`, localStorage |

**Findings:**
- Aucun blocage WebView détecté avec Safari UA
- Cookies de session extractibles après login
- `react-native-webview` v13.15.0 compatible Expo Go

**User Agent recommandé (Safari iOS):**
```
Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1
```

#### Flow d'authentification

```
┌─────────────────────────────────────────────────────────────┐
│ iOS App                                                     │
│                                                             │
│ 1. User tape "Connecter TikTok"                             │
│    ↓                                                        │
│ 2. Ouvrir WebView sur https://www.tiktok.com/login          │
│    (avec Safari User-Agent)                                 │
│    ↓                                                        │
│ 3. User se connecte normalement                             │
│    ↓                                                        │
│ 4. User tape "Extraire la session"                          │
│    ↓                                                        │
│ 5. CookieManager.get(url) extrait tous les cookies          │
│    (y compris HttpOnly: sessionid, msToken, etc.)           │
│    ↓                                                        │
│ 6. POST /api/oauth/tiktok/connect                           │
│    Body: {sessionid: "xxx", msToken: "yyy", ...}            │
│    ↓                                                        │
│ 7. Backend stocke cookies, lance sync                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Extraction des cookies via CookieManager (Native API)

L'app utilise `@preeternal/react-native-cookie-manager` pour extraire les cookies **via l'API native iOS**, ce qui permet d'accéder aux cookies `HttpOnly` (inaccessibles via `document.cookie` en JavaScript).

```typescript
import CookieManager from '@preeternal/react-native-cookie-manager';

// Après que l'utilisateur s'est connecté dans le WebView
const extractCookies = async () => {
  const url = platformKey === 'tiktok'
    ? 'https://www.tiktok.com'
    : 'https://www.instagram.com';

  // Récupère TOUS les cookies y compris HttpOnly
  const cookies = await CookieManager.get(url);

  // Format: { cookieName: { name, value, domain, path, ... } }
  const formattedCookies: Record<string, string> = {};
  for (const [name, cookie] of Object.entries(cookies)) {
    formattedCookies[name] = typeof cookie === 'object' ? cookie.value : cookie;
  }

  // Envoyer au backend
  await oauthApi.tiktokConnect(formattedCookies);
  // ou
  await oauthApi.instagramConnect(formattedCookies);
};
```

**Avantages de CookieManager vs JS injection:**
- Accès aux cookies `HttpOnly` (session tokens sécurisés)
- Pas besoin d'injecter de code JavaScript
- Plus fiable et plus rapide

#### Cookies à extraire

**TikTok:**
- `msToken` ✅ (token de session principal)
- `sessionid` (si présent)
- `tt_webid` (device ID)

**Instagram:**
- `csrftoken` ✅ (CSRF protection)
- `ds_user_id` ✅ (user ID numérique)
- `sessionid` (session)
- `ig_did` (device ID)

#### Test app disponible

```
experiments/webview-auth-test/
```

Pour tester:
```bash
cd experiments/webview-auth-test
npx expo start
# Scanner QR code avec Expo Go
```

### Endpoints OAuth

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/oauth/status` | Statut de toutes les connexions |
| GET | `/api/oauth/youtube/connect` | URL OAuth YouTube |
| GET | `/api/oauth/spotify/connect` | URL OAuth Spotify |
| POST | `/api/oauth/tiktok/connect` | Envoyer cookies TikTok |
| POST | `/api/oauth/instagram/connect` | Envoyer cookies Instagram |
| DELETE | `/api/oauth/{platform}/disconnect` | Déconnecter plateforme |

### Format de réponse `/api/oauth/status`

```typescript
// GET /api/oauth/status
{
  youtube: {
    platform: "YOUTUBE",
    sourceType: "YOUTUBE_LIKES" | null,
    lastSyncAt: "2026-02-01T10:30:00Z" | null,
    lastSyncError: string | null,
    createdAt: "2026-01-15T08:00:00Z"
  } | null,
  spotify: { ... } | null,
  tiktok: { ... } | null,
  instagram: { ... } | null
}
```

**Note:** Chaque plateforme retourne un **objet** (si connectée) ou `null` (si pas connectée), **PAS un booléen**. L'interface TypeScript iOS doit refléter ce format.

---

## 📦 Content API

### États du contenu

```
INBOX → SELECTED → TRANSCRIBING → GENERATING → READY
  ↓         ↓           ↓              ↓
ARCHIVED  FAILED    FAILED         FAILED
```

| Status | Description |
|--------|-------------|
| `INBOX` | Nouveau, pas encore trié |
| `SELECTED` | User veut apprendre |
| `TRANSCRIBING` | Transcription en cours |
| `GENERATING` | Quiz en génération |
| `READY` | Quiz prêts, révisable |
| `ARCHIVED` | Ignoré par l'user |
| `FAILED` | Erreur de traitement |
| `UNSUPPORTED` | Ex: Spotify Exclusive |

### Endpoints Content

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/content` | Liste avec filtres & pagination |
| GET | `/api/content/inbox` | Nouveaux contenus |
| GET | `/api/content/inbox/count` | Badge count |
| POST | `/api/content/refresh` | Forcer sync |
| POST | `/api/content/triage/bulk` | Trier plusieurs items |
| POST | `/api/content/bulk-generate-quiz` | Générer quiz pour sélection |
| GET | `/api/content/:id` | Détail + transcript + quiz |
| PATCH | `/api/content/:id/triage` | Trier un item |

### Exemple: Liste du contenu

```http
GET /api/content?status=READY&platform=YOUTUBE&limit=20&offset=0
Authorization: Bearer {accessToken}
```

```json
{
  "items": [
    {
      "id": "clx123...",
      "platform": "YOUTUBE",
      "title": "How to Learn Anything",
      "thumbnailUrl": "https://...",
      "duration": 1234,
      "status": "READY",
      "quizCount": 5,
      "tags": ["learning", "productivity"]
    }
  ],
  "total": 42,
  "hasMore": true
}
```

### Exemple: Triage bulk

```http
POST /api/content/triage/bulk
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "contentIds": ["clx123...", "clx456..."],
  "action": "learn"  // "learn" | "archive" | "delete"
}
```

---

## 📝 Review API (Spaced Repetition)

### Algorithme SM-2

```
┌─────────────────────────────────────────────────────────────┐
│ Après chaque réponse:                                       │
│                                                             │
│ Rating   │ Action                                           │
│ ─────────┼─────────────────────────────────────────────────│
│ AGAIN(1) │ Reset: interval=1, repetitions=0                │
│ HARD(2)  │ interval *= 1.2, easeFactor -= 0.15             │
│ GOOD(3)  │ interval *= easeFactor                          │
│ EASY(4)  │ interval *= easeFactor * 1.3                    │
│                                                             │
│ easeFactor: min 1.3, max 2.5 (défaut: 2.5)                 │
│ interval: jours jusqu'à prochaine review                    │
└─────────────────────────────────────────────────────────────┘
```

### Endpoints Review

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/reviews/due` | Cartes à réviser aujourd'hui |
| GET | `/api/reviews/stats` | Streak, due count, etc. |
| POST | `/api/reviews` | Soumettre une réponse |
| GET | `/api/reviews/settings` | Préférences de révision |
| PATCH | `/api/reviews/settings` | Modifier préférences |

### Exemple: Get due cards

```http
GET /api/reviews/due
Authorization: Bearer {accessToken}
```

```json
{
  "cards": [
    {
      "id": "card_123",
      "quiz": {
        "id": "quiz_456",
        "question": "What is spaced repetition?",
        "type": "MULTIPLE_CHOICE",
        "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
        "correctAnswer": "B",
        "explanation": "..."
      },
      "content": {
        "id": "content_789",
        "title": "Learning Techniques",
        "platform": "YOUTUBE",
        "thumbnailUrl": "..."
      },
      "interval": 3,
      "easeFactor": 2.5,
      "repetitions": 2
    }
  ],
  "newCardsToday": 5,
  "reviewCardsToday": 12
}
```

### Exemple: Submit review

```http
POST /api/reviews
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "cardId": "card_123",
  "rating": 3,  // 1=AGAIN, 2=HARD, 3=GOOD, 4=EASY
  "responseTime": 4500  // milliseconds
}
```

```json
{
  "card": {
    "id": "card_123",
    "nextReviewAt": "2026-02-02T09:00:00Z",
    "interval": 6,
    "easeFactor": 2.5,
    "repetitions": 3
  },
  "streak": {
    "current": 7,
    "longest": 14
  }
}
```

---

## 📊 Stats API

### Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/reviews/stats` | Statistiques globales |
| GET | `/api/content/stats` | Stats par plateforme |

### Exemple: Review stats

```json
{
  "streak": {
    "current": 7,
    "longest": 14,
    "lastReviewDate": "2026-01-30"
  },
  "today": {
    "due": 12,
    "new": 5,
    "reviewed": 8
  },
  "total": {
    "cards": 231,
    "reviews": 1456,
    "retention": 0.89
  }
}
```

---

## 🔄 Background Sync

Le sync tourne **côté serveur** via cron jobs. L'app iOS n'a qu'à:

1. **Au login:** Le backend trigger un sync automatique
2. **Pull-to-refresh:** `POST /api/content/refresh`
3. **Polling optionnel:** Vérifier `/api/content/inbox/count` périodiquement

### Cron Jobs (serveur)

| Job | Fréquence | Description |
|-----|-----------|-------------|
| YouTube Sync | 15 min | Fetch liked videos |
| Spotify Sync | 30 min | Fetch podcasts écoutés |
| TikTok Sync | 30 min | Fetch liked videos |
| Instagram Sync | 30 min | Fetch saved reels |
| Transcription | 5 min | Process pending |
| Quiz Generation | 5 min | Generate from transcripts |

### Push Notifications (à implémenter)

Pour notifier l'user quand du contenu est prêt:

```
Backend → APNS → iOS App
```

Endpoints à créer:
- `POST /api/notifications/register` - Enregistrer device token
- `DELETE /api/notifications/unregister` - Supprimer device token

---

## 🗂️ Modèles de données iOS

### User

```typescript
interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  plan: 'FREE' | 'PRO' | 'LIFETIME';
  trialEndsAt?: string;
}
```

### Content

```typescript
interface Content {
  id: string;
  platform: 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK' | 'INSTAGRAM';
  externalId: string;
  url: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  duration?: number; // seconds
  status: ContentStatus;
  quizCount?: number;
  tags: string[];
  capturedAt: string;
}

type ContentStatus =
  | 'INBOX'
  | 'SELECTED'
  | 'TRANSCRIBING'
  | 'GENERATING'
  | 'READY'
  | 'ARCHIVED'
  | 'FAILED'
  | 'UNSUPPORTED';
```

### Card & Quiz

```typescript
interface Card {
  id: string;
  quiz: Quiz;
  content: ContentSummary;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: string;
}

interface Quiz {
  id: string;
  question: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FLASHCARD';
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

type Rating = 1 | 2 | 3 | 4; // AGAIN, HARD, GOOD, EASY
```

### Streak

```typescript
interface Streak {
  current: number;
  longest: number;
  lastReviewDate: string;
}
```

---

## 🔧 Configuration iOS

### Environment Variables (app)

```typescript
// config.ts
export const API_BASE_URL = __DEV__
  ? 'http://localhost:3001/api'
  : 'https://api.remember.app/api';

export const OAUTH_REDIRECT_SCHEME = 'remember';
```

### Packages requis

```json
{
  "dependencies": {
    "expo": "~54.0.0",
    "expo-auth-session": "~6.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-web-browser": "~14.0.0",
    "react-native-webview": "13.15.0",
    "@preeternal/react-native-cookie-manager": "^0.1.5",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^5.0.0"
  }
}
```

**Note:** `@preeternal/react-native-cookie-manager` est utilisé pour extraire les cookies HttpOnly lors de l'auth TikTok/Instagram via WebView.
```

---

## 🚀 Checklist iOS Integration

### Phase 1: Auth & Base
- [ ] Setup Expo + React Native
- [ ] Implémenter login/signup
- [ ] Stocker tokens (SecureStore)
- [ ] Auto-refresh tokens
- [ ] Écran profil

### Phase 2: OAuth
- [ ] YouTube OAuth (expo-auth-session)
- [ ] Spotify OAuth
- [ ] TikTok WebView + cookie extraction
- [ ] Instagram WebView + cookie extraction
- [ ] Écran Settings avec connexions

### Phase 3: Content
- [ ] Liste inbox avec pull-to-refresh
- [ ] Triage (learn/archive)
- [ ] Vue mosaïque du contenu
- [ ] Filtres (plateforme, tags)

### Phase 4: Review
- [ ] Écran review full-screen
- [ ] Swipe ou boutons rating
- [ ] Progression bar
- [ ] Session summary
- [ ] Streak display

### Phase 5: Polish
- [ ] Push notifications
- [ ] Offline support (cache)
- [ ] Haptic feedback
- [ ] Dark mode

---

## 📝 Notes importantes

1. **Le backend gère le sync** - L'app n'a pas besoin de background tasks complexes
2. **Tokens OAuth stockés côté backend** - L'app ne voit jamais les tokens des plateformes
3. **SM-2 calculé côté backend** - L'app envoie juste le rating
4. **TikTok/Instagram = WebView** - Pas d'OAuth officiel disponible
5. **Deep links requis** - Pour les callbacks OAuth

---

**Document créé:** 2026-01-30
**Dernière mise à jour:** 2026-02-03 - Correction extraction cookies: CookieManager natif (pas JS injection)
