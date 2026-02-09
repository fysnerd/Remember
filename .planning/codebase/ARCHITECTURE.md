# Architecture

**Analysis Date:** 2026-02-09

## Pattern Overview

**Overall:** Distributed two-tier architecture with clear separation of concerns

**Key Characteristics:**
- **Backend-driven content pipeline** - Server handles sync, transcription, and quiz generation; iOS client is thin/presentation layer
- **Platform abstraction layer** - Single API serves web and iOS; OAuth flows coordinate between client app and backend
- **Job scheduler backbone** - node-cron-based workers handle asynchronous content processing (sync, transcription, quizzes)
- **Client-side state management** - Zustand stores for auth and UI state; React Query for server data caching
- **Streaming/progressive processing** - Content moves through statuses (INBOX → PROCESSING → READY) rather than blocking

## Layers

**Presentation Layer (iOS):**
- Purpose: Native iOS UI via Expo + React Native
- Location: `ios/app/`, `ios/components/`, `ios/stores/`
- Contains: Screens (file-based routing), UI components, Zustand stores
- Depends on: React Query for API caching, axios for HTTP
- Used by: iOS app users via Expo

**API Gateway (Express.js Backend):**
- Purpose: Single source of truth for all platform integrations and business logic
- Location: `backend/src/routes/` and `backend/src/middleware/`
- Contains: HTTP routes for auth, OAuth, content, reviews, admin
- Depends on: Prisma ORM, JWT middleware, error handler
- Used by: iOS app, legacy web frontend, admin tooling

**Service Layer (Business Logic):**
- Purpose: Orchestrate complex operations (OAuth flows, transcription, quiz generation)
- Location: `backend/src/services/`
- Contains: `llm.ts` (LLM integration), `transcription.ts` (yt-dlp), `quizGeneration.ts` (Mistral), `tagging.ts` (auto-tagging)
- Depends on: Prisma, external APIs (YouTube, Spotify, Mistral, Groq)
- Used by: Routes and workers

**Worker Layer (Background Jobs):**
- Purpose: Asynchronous content processing on a schedule
- Location: `backend/src/workers/scheduler.ts` and sync workers
- Contains: Cron job scheduler with 11 distinct jobs (YouTube sync, Spotify sync, transcription, quiz generation, etc.)
- Depends on: Prisma, services layer
- Used by: Scheduler itself (self-contained)

**Data Access Layer (Prisma ORM):**
- Purpose: Single abstraction over PostgreSQL
- Location: `backend/prisma/schema.prisma` and `backend/src/config/database.ts`
- Contains: Prisma client, connection pooling
- Depends on: PostgreSQL (Supabase)
- Used by: All backend services and routes

## Data Flow

**Content Ingestion Flow:**

1. **User connects platform** → OAuth route (`/api/oauth/[platform]/connect`)
2. **Backend stores credentials** → `ConnectedPlatform` table with encrypted tokens
3. **Scheduler runs sync worker every 15-30min** → Platform-specific worker (YouTube/Spotify/TikTok/Instagram)
4. **Sync fetches new content** → Creates `Content` rows with status=INBOX
5. **Transcription worker runs every 2-5min** → Processes INBOX content, extracts transcript, updates status=TRANSCRIBED
6. **Quiz generation worker runs every 2min** → Generates questions via Mistral AI, creates `Card` rows, updates status=READY
7. **iOS app fetches content** → `GET /api/content` returns READY items with generated quizzes

```
[OAuth Flow] → [ConnectedPlatform] → [Scheduler] → [Sync Worker] → [Content: INBOX]
                                                          ↓
                                                  [Transcription Worker]
                                                          ↓
                                                  [Content: TRANSCRIBED]
                                                          ↓
                                                  [Quiz Generation Worker]
                                                          ↓
                                                  [Content: READY + Cards]
                                                          ↓
                                                  [iOS displays quiz]
```

**Review/Learning Flow:**

1. iOS app fetches reviews due → `GET /api/reviews/due` (SM-2 algorithm applied server-side)
2. User takes quiz → `POST /api/reviews` with answer
3. Backend records review → SM-2 calculation updates next review date
4. Spaced repetition widget fetches updated schedule

**State Management:**

- **Server state** (auth, content, reviews): Managed in PostgreSQL, accessed via Axios + React Query
- **Client state** (user session, temp UI state): Managed in Zustand stores (`authStore`, `contentStore`)
- **Cache strategy**: React Query with `invalidateQueries` on refresh; Axios interceptor handles token refresh

## Key Abstractions

**Worker Overlap Prevention:**
- Purpose: Prevent concurrent execution of same cron job
- Examples: `backend/src/workers/scheduler.ts` uses `runningJobs` Set
- Pattern: Guard before job execution, track active jobs, skip if running

**LLM Client Abstraction:**
- Purpose: Support multiple LLM providers (Mistral primary)
- Examples: `backend/src/services/llm.ts` exports `getLLMClient()`
- Pattern: Provider pattern with unified interface

**Transcript Caching:**
- Purpose: Share transcripts across users (avoid re-transcribing same YouTube video)
- Examples: `backend/src/services/transcriptCache.ts` manages global cache with locking
- Pattern: Distributed lock via DB to prevent duplicate work

**OAuth State Encoding:**
- Purpose: Pass user/client context through OAuth redirect
- Examples: `backend/src/routes/oauth.ts` encodes userId/client in base64 state
- Pattern: State parameter carries round-trip context (userId, platform, appRedirectUri)

**Platform Adapter Pattern:**
- Purpose: Normalize different platform APIs (YouTube, Spotify, TikTok, Instagram)
- Examples: `youtubeSync.ts`, `spotifySync.ts`, `tiktokSync.ts`, `instagramSync.ts`
- Pattern: Each worker exports `syncUserPlatform(userId, connectionId)` with unified output

## Entry Points

**iOS App:**
- Location: `ios/app/_layout.tsx`
- Triggers: App launch on iOS device
- Responsibilities: Root layout with auth guard, QueryClientProvider setup, navigation stack

**Express Server:**
- Location: `backend/src/index.ts`
- Triggers: Node.js process starts
- Responsibilities: App initialization, middleware setup, route registration, scheduler startup

**Scheduler:**
- Location: `backend/src/workers/scheduler.ts` → `startScheduler()`
- Triggers: Called from `index.ts` on server startup
- Responsibilities: Register 11 cron jobs, prevent overlap, log execution

**OAuth Callback:**
- Location: `backend/src/routes/oauth.ts` → `[platform]/callback`
- Triggers: User completes OAuth grant in browser
- Responsibilities: Exchange code for token, store credentials, trigger initial sync, redirect back to app

## Error Handling

**Strategy:** Centralized error handler with AppError class

**Patterns:**

- **Known errors** (401 auth, 400 validation) → AppError thrown with statusCode
- **Prisma errors** → Caught, mapped to 400 with generic "Database error"
- **JWT errors** → TokenExpiredError → 401; JsonWebTokenError → 401
- **Unhandled errors** → 500; message hidden in production
- **Worker errors** → Logged but don't crash scheduler; job marked as failed in DB

See: `backend/src/middleware/errorHandler.ts`

## Cross-Cutting Concerns

**Logging:**
- Approach: console.log with prefixes `[Scheduler]`, `[OAuth]`, `[YouTube Sync]`, etc.
- Location: Scattered throughout services and workers
- Future improvement: Could use Winston or Pino for structured logging

**Validation:**
- Approach: Manual validation in routes (e.g., `asString()` helper for query params)
- Location: `backend/src/routes/*` files
- Pattern: Validate early, throw AppError with 400 status

**Authentication:**
- Approach: JWT middleware on protected routes; tokens stored in iOS secure storage
- Location: `backend/src/middleware/auth.ts` exports `authenticateToken`
- Pattern: Verify token signature, check user exists, attach to req.user

**Rate Limiting:**
- Approach: express-rate-limit middleware on all routes (15 min window, 100 req/IP)
- Location: `backend/src/index.ts` and `backend/src/utils/rateLimiter.ts`
- Pattern: LLM and YouTube API have separate limiters to respect provider quotas

**CORS:**
- Approach: Allow frontend URL + Cloudflare tunnel URL; accept no-origin (mobile apps)
- Location: `backend/src/index.ts`
- Pattern: Origin whitelist with dev mode exception

---

*Architecture analysis: 2026-02-09*
