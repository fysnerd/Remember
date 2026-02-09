# External Integrations

**Analysis Date:** 2026-02-09

## APIs & External Services

**Content Aggregation - YouTube:**
- YouTube Data API (Google OAuth)
  - What: Fetches user's liked videos from "Liked Videos" playlist
  - Client: passport-google-oauth20, native fetch with bearer token
  - Auth: OAuth 2.0 (access token + refresh token)
  - Scope: `https://www.googleapis.com/auth/youtube.readonly`
  - Worker: `backend/src/workers/youtubeSync.ts` (runs every 15 min)
  - Env vars: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_CALLBACK_URL`
  - Callback: `https://api.ankora.study/api/oauth/youtube/callback`

**Content Aggregation - Spotify:**
- Spotify Web API (OAuth)
  - What: Fetches user's recently-played episodes and saved episodes
  - Client: passport-spotify, native fetch with bearer token
  - Auth: OAuth 2.0 (access token + refresh token)
  - Scope: podcast-read-private, podcast-read-library, playlist-read-private
  - Worker: `backend/src/workers/spotifySync.ts` (runs every 30 min)
  - Env vars: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_CALLBACK_URL`
  - Callback: `https://api.ankora.study/api/oauth/spotify/callback`

**Content Aggregation - TikTok:**
- TikTok (Cookie-based authentication)
  - What: Fetches user's liked videos
  - Client: Playwright browser automation
  - Auth: Browser cookies (user-supplied)
  - Worker: `backend/src/workers/tiktokSync.ts` (runs every 30 min)
  - Service: `backend/src/services/tiktokAuth.ts`
  - Notes: No official API; uses Playwright to automate browser interactions

**Content Aggregation - Instagram:**
- Instagram (API-based, no official OAuth)
  - What: Fetches user's liked/saved reels
  - Client: Private Instagram API (axios-based)
  - Auth: Session cookies (user-supplied)
  - Worker: `backend/src/workers/instagramSync.ts` (runs every 30 min, currently broken)
  - Service: `backend/src/services/instagramAuth.ts`
  - Notes: Known issue - Playwright selectors outdated, "No grid items found"

## Data Storage

**Database:**
- PostgreSQL (via Supabase)
  - Connection: Prisma ORM (`@prisma/client` 6.2)
  - Env var: `DATABASE_URL`, `DIRECT_URL` (optional direct connection)
  - Schema: `backend/prisma/schema.prisma` (Users, Content, Reviews, OAuthAccounts, ConnectedPlatforms, etc.)
  - Migrations: Handled via Prisma migrate commands

**File Storage:**
- Local filesystem only (on VPS)
  - Temp files: `/tmp/` for transcript downloads, video processing
  - Cron cleanup: `/etc/cron.daily/cleanup-remember` (auto-removes temp files)
  - Data export: ZIP archives created dynamically via archiver

**Caching:**
- Redis (optional, production use)
  - Env var: `REDIS_URL` (defaults to `redis://localhost:6379`)
  - Client: ioredis
  - Use cases: Transcript caching to avoid redundant transcription calls
  - File: `backend/src/services/transcriptCache.ts` (global cache with lock mechanism)
  - Not required for development/testing

## Authentication & Identity

**Auth Providers:**
- Google OAuth (user signup/login)
  - Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
  - Implementation: passport-google-oauth20
  - Model: `OAuthAccount` in Prisma schema

**Custom JWT Authentication:**
- Implementation: jsonwebtoken (Node.js backend)
- Access token: 7 days default (configurable via `JWT_EXPIRES_IN`)
- Refresh token: 30 days default (configurable via `JWT_REFRESH_EXPIRES_IN`)
- Storage (iOS): expo-secure-store (encrypted)
- Refresh flow: Automatic retry on 401 response via axios interceptor
- File: `backend/src/services/tokenRefresh.ts`, `ios/lib/api.ts`

**Token Exchange (OAuth providers):**
- YouTube, Spotify tokens refreshed automatically before expiry
- Service: `backend/src/services/tokenRefresh.ts`
- Storage: Encrypted in PostgreSQL (`ConnectedPlatform.accessToken`, `refreshToken`)

## Transcription & Speech-to-Text

**YouTube Transcription:**
- yt-dlp (command-line tool)
  - What: Extracts subtitles from YouTube videos (manual & auto-generated)
  - Cron job: `backend/src/workers/` (every 2 min)
  - Service: `backend/src/services/transcription.ts`
  - Free/no auth required
  - Supports multiple language preferences: French, English, Spanish, German, Portuguese, Italian

**Podcast Transcription (Groq Whisper - Free):**
- Groq API (OpenAI-compatible endpoint)
  - What: Transcribes audio files from podcasts via Whisper
  - Client: OpenAI SDK with `baseURL: https://api.groq.com/openai/v1`
  - Env var: `GROQ_API_KEY`
  - Cron job: `backend/src/workers/` (every 5 min)
  - Service: `backend/src/services/podcastTranscription.ts`
  - Fallback: OpenAI Whisper if Groq not configured
  - Rate limiter: Custom groqLimiter (defined in `backend/src/utils/rateLimiter.ts`)

**Fallback Transcription (OpenAI Whisper):**
- OpenAI API (if Groq not available or Groq fails)
  - Env var: `OPENAI_API_KEY`
  - Client: openai SDK
  - Paid service (fallback only)

**RSS Feed Lookup (Podcast Discovery):**
- Podcast Index API (free, open-source)
  - What: Looks up podcast RSS feeds by show name
  - Client: podcast-index-api SDK
  - Env vars: `PODCAST_INDEX_API_KEY`, `PODCAST_INDEX_API_SECRET`
  - Alternative: Listen Notes API
  - Usage: During Spotify sync to find episode RSS feed URLs

## LLM & AI - Quiz/Memo Generation

**LLM Provider (Configurable):**
- Default: Mistral AI
- Alternatives: OpenAI GPT-4 Turbo, Anthropic Claude
- Configuration: `LLM_PROVIDER` env var (openai|mistral|anthropic)
- Service: `backend/src/services/llm.ts` (unified LLM client)
- Uses: Quiz generation, auto-tagging, content summarization

**Mistral AI:**
- Endpoint: `https://api.mistral.ai/v1/chat/completions`
- Model: mistral-medium-latest
- Env var: `MISTRAL_API_KEY`
- Client: fetch-based (native)

**OpenAI:**
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Model: gpt-4-turbo-preview
- Env var: `OPENAI_API_KEY`
- Client: openai SDK

**Anthropic Claude:**
- Endpoint: `https://api.anthropic.com/v1/messages`
- Model: claude-3-haiku-20240307
- Env var: `ANTHROPIC_API_KEY`
- Client: fetch-based (native)

**Cron Job:**
- Quiz Generation: `backend/src/workers/scheduler.ts` (every 2 min)
- Auto-tagging: `backend/src/workers/scheduler.ts` (every 15 min)
- Service: `backend/src/services/quizGeneration.ts`, `backend/src/services/tagging.ts`

## Payments & Subscriptions

**Stripe:**
- What: Subscription management (monthly/yearly billing)
- Client: stripe SDK v17.5
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`
- Checkout: `POST /api/subscription/checkout` → returns Stripe session URL
- Portal: `POST /api/subscription/portal` → customer billing portal
- Webhooks: Listens on `POST /api/subscription/webhook` (events: checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_failed)
- Service: `backend/src/services/stripe.ts`
- Integration: Raw body middleware for webhook signature verification

## Email & Notifications

**Email Service (Resend):**
- What: Sends transactional emails (daily reminders, subscription confirmations)
- Env vars: `RESEND_API_KEY`, `EMAIL_FROM`
- Client: Custom (not in dependencies yet, likely fetch-based)
- Cron job: Daily Reminder worker (every 5 min window, respects user timezone)
- Service: `backend/src/services/email.ts`

## Webhooks & Callbacks

**Incoming (Webhooks):**
- Stripe webhook: `POST /api/subscription/webhook` (signature-verified via Stripe SDK)
  - Events: payment success, subscription updates, failures
  - Integration: Raw body middleware, webhook signature verification

**Outgoing (Deep Links):**
- iOS app deep link scheme: `ankora://`
- OAuth callbacks use deep links: `ankora://oauth/callback?code=...&state=...`
- File: `ios/app.json` → `scheme: "ankora"`
- Associated domain (iOS): `applinks:api.ankora.study`

## Rate Limiting & Concurrency Control

**Backend Rate Limiting:**
- Express rate limiter: 100 requests per 15 minutes per IP
- Custom rate limiters defined in `backend/src/utils/rateLimiter.ts`:
  - `youtubeLimiter` - YouTube API calls
  - `spotifyLimiter` - Spotify API calls
  - `groqLimiter` - Groq Whisper API calls
- Concurrency control: p-limit (default 5 parallel jobs)

**iOS Caching & Stale State:**
- TanStack React Query: Automatic request deduplication
- Refresh intervals: 60 seconds for inbox content
- Stale-while-revalidate strategy

## Cross-Platform Authentication Flow

**OAuth Flow (Example: YouTube):**
1. iOS app calls `GET /api/oauth/youtube/connect?client=ios&appRedirectUri=ankora://...`
2. Backend returns `{ authUrl }` (Google OAuth URL)
3. iOS opens URL in `expo-web-browser` (Safari)
4. User authenticates with Google
5. Google redirects to `https://api.ankora.study/api/oauth/youtube/callback?code=...&state=...`
6. Backend exchanges code for tokens, stores in DB
7. Backend redirects to deep link: `ankora://oauth/callback?success=true`
8. iOS app receives deep link, closes webview, triggers sync

---

*Integration audit: 2026-02-09*
