# Codebase Structure

**Analysis Date:** 2026-02-09

## Directory Layout

```
Remember/                                    # Root (monorepo-style)
├── backend/                                # Express.js API (VPS deployment)
│   ├── src/
│   │   ├── config/                        # Configuration
│   │   │   ├── env.ts                     # Environment variables
│   │   │   └── database.ts                # Prisma client + connection
│   │   ├── middleware/                    # Express middleware
│   │   │   ├── auth.ts                    # JWT token verification + generation
│   │   │   └── errorHandler.ts            # Centralized error handling
│   │   ├── routes/                        # HTTP route handlers
│   │   │   ├── auth.ts                    # POST /auth/login, /auth/signup, /auth/refresh
│   │   │   ├── oauth.ts                   # GET /oauth/[platform]/connect, /oauth/[platform]/callback
│   │   │   ├── content.ts                 # GET/POST /content/* (list, triage, refresh)
│   │   │   ├── review.ts                  # GET/POST /reviews/* (due, submit answer)
│   │   │   ├── user.ts                    # GET /users/* (profile, settings)
│   │   │   ├── admin.ts                   # POST /admin/sync/* (force manual sync)
│   │   │   ├── subscription.ts            # POST /subscription/webhook (Stripe)
│   │   │   └── export.ts                  # GET/POST /export/* (user data export)
│   │   ├── services/                      # Business logic (reusable across routes + workers)
│   │   │   ├── llm.ts                     # Mistral AI client + prompt templates
│   │   │   ├── transcription.ts           # YouTube transcription via yt-dlp
│   │   │   ├── podcastTranscription.ts    # Spotify/podcast transcription via Groq Whisper
│   │   │   ├── tiktokTranscription.ts     # TikTok transcription (yt-dlp + Whisper)
│   │   │   ├── instagramTranscription.ts  # Instagram transcription (yt-dlp + Whisper)
│   │   │   ├── quizGeneration.ts          # Quiz generation from transcripts (Mistral)
│   │   │   ├── tagging.ts                 # Auto-tagging content with topics (Mistral)
│   │   │   ├── tokenRefresh.ts            # OAuth token refresh for YouTube/Spotify
│   │   │   ├── transcriptCache.ts         # Distributed cache for transcripts (DB-backed with locks)
│   │   │   ├── tiktokAuth.ts              # TikTok cookie-based auth
│   │   │   ├── instagramAuth.ts           # Instagram cookie-based auth (API)
│   │   │   ├── email.ts                   # Email delivery (reminders, etc)
│   │   │   ├── stripe.ts                  # Stripe subscription integration
│   │   │   └── export.ts                  # User data export (GDPR)
│   │   ├── workers/                       # Background job implementations (cron-triggered)
│   │   │   ├── scheduler.ts               # Main cron job scheduler (11 jobs total)
│   │   │   ├── youtubeSync.ts             # Sync liked videos from YouTube
│   │   │   ├── spotifySync.ts             # Sync podcasts from Spotify (>80% listened)
│   │   │   ├── tiktokSync.ts              # Sync liked TikToks (Playwright automation)
│   │   │   ├── instagramSync.ts           # Sync reels from Instagram (API automation)
│   │   │   └── reminderWorker.ts          # Send daily email reminders
│   │   ├── utils/                         # Utilities
│   │   │   └── rateLimiter.ts             # API rate limiters (LLM, YouTube)
│   │   └── index.ts                       # Entry point: Express app setup, route registration, scheduler start
│   ├── prisma/
│   │   └── schema.prisma                  # Prisma schema (User, Content, Card, Review, etc)
│   ├── package.json
│   └── .env                               # Environment variables (ignored in git)
│
├── ios/                                   # Expo React Native iOS app
│   ├── app/                               # Screens (expo-router file-based routing)
│   │   ├── _layout.tsx                    # Root layout with auth guard + QueryClientProvider
│   │   ├── (tabs)/                        # Tab bar layout
│   │   │   ├── _layout.tsx                # Tab navigator
│   │   │   ├── index.tsx                  # Feed screen (topics + suggestions)
│   │   │   ├── reviews.tsx                # Reviews/quizzes due today
│   │   │   ├── library.tsx                # Saved content library
│   │   │   └── profile.tsx                # User profile + settings
│   │   ├── login.tsx                      # Login screen
│   │   ├── signup.tsx                     # Signup screen
│   │   ├── content/[id].tsx               # Content detail screen
│   │   ├── topic/[name].tsx               # Topic detail screen (all content for topic)
│   │   ├── topic/manage/[name].tsx        # Topic management (rename, delete)
│   │   ├── quiz/[id].tsx                  # Quiz session screen (take quiz)
│   │   ├── quiz/topic/[name].tsx          # Topic quiz (all quizzes for topic)
│   │   ├── memo/[id].tsx                  # Memo screen (spaced repetition card)
│   │   ├── memo/topic/[name].tsx          # Topic memos (all memos for topic)
│   │   └── oauth/[platform].tsx           # OAuth callback handler (handles deep links)
│   ├── components/                        # Reusable UI components
│   │   ├── ui/                            # Core UI (Button, Text, Card, Input, etc)
│   │   ├── content/                       # Content-specific components
│   │   ├── quiz/                          # Quiz components (QuestionCard, AnswerFeedback, QuizSummary)
│   │   ├── LoadingScreen.tsx              # Full-screen loading spinner
│   │   ├── EmptyState.tsx                 # Empty state with icon + message
│   │   ├── ErrorState.tsx                 # Error display with retry
│   │   └── TopicEditModal.tsx             # Modal for editing/creating topics
│   ├── hooks/                             # React Query hooks for server data
│   │   ├── useContent.ts                  # useContentList, useContentDetail, useTriageContent
│   │   ├── useQuiz.ts                     # useQuiz, useSubmitAnswer, useCreateSession
│   │   ├── useReviews.ts                  # useReviewsDue
│   │   ├── useTopics.ts                   # useTopics, useTopicDetail
│   │   ├── useMemo.ts                     # Spaced repetition memos
│   │   ├── useInbox.ts                    # useInboxContent
│   │   ├── useChannels.ts                 # useChannels (for filtering)
│   │   ├── useOAuth.ts                    # useOAuthFlow (handles platform connection)
│   │   └── index.ts                       # Barrel export
│   ├── stores/                            # Zustand state management
│   │   ├── authStore.ts                   # User auth state (user, isAuthenticated, login, logout)
│   │   └── contentStore.ts                # Content filter/sort state
│   ├── lib/                               # Utilities and configuration
│   │   ├── api.ts                         # Axios instance with token refresh interceptor
│   │   ├── storage.ts                     # Secure token storage (expo-secure-store)
│   │   ├── queryClient.ts                 # React Query client configuration
│   │   └── constants.ts                   # API_URL, theme colors, etc
│   ├── types/                             # TypeScript type definitions
│   │   ├── content.ts                     # Content, Card, Quiz, Review types
│   │   └── (other type files)
│   ├── theme.ts                           # Design tokens (colors, spacing, fonts)
│   ├── assets/
│   │   ├── images/                        # App icons, logos
│   │   └── fonts/                         # Custom fonts
│   ├── app.json                           # Expo app configuration
│   ├── eas.json                           # EAS Build configuration (CI/CD)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                               # Environment variables
│
├── frontend/                              # Legacy React web app (NOT actively maintained)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.tsx
│   └── package.json
│
├── docs/                                  # Historical documentation
├── Ankora/                                # Ankora branding/spec docs
├── experiments/                           # Experimental features
├── scripts/                               # Utility scripts
├── mcp/                                   # MCP (Model Context Protocol) servers
├── .planning/
│   ├── codebase/                          # Architecture documentation (ARCHITECTURE.md, STRUCTURE.md, etc)
│   └── (other planning artifacts)
├── .git/                                  # Git repository
└── package.json                           # Monorepo root (workspace config)
```

## Directory Purposes

**backend/src/config:**
- Purpose: Centralized configuration management
- Contains: Environment variables parsing, database connection setup
- Key files: `env.ts` (validated config object), `database.ts` (Prisma client singleton)

**backend/src/middleware:**
- Purpose: Cross-cutting concerns for Express
- Contains: Auth token verification, error handling pipeline
- Key files: `auth.ts` (JWT + DB user lookup), `errorHandler.ts` (centralized error mapping)

**backend/src/routes:**
- Purpose: HTTP request handlers organized by feature
- Contains: Route definitions, basic validation, delegation to services
- Pattern: Each file exports a `Router()` with related endpoints

**backend/src/services:**
- Purpose: Business logic reusable across routes and workers
- Contains: External API integration, data transformation, complex workflows
- Pattern: Stateless functions; no direct route dependency

**backend/src/workers:**
- Purpose: Asynchronous background jobs triggered by cron
- Contains: Job implementations; all orchestrated by `scheduler.ts`
- Pattern: Each worker exports `syncUser[Platform]()` or `run[Job]Worker()` function

**ios/app:**
- Purpose: Screens and navigation (expo-router file-based)
- Contains: Page components organized by route segment
- Pattern: `[param].tsx` for dynamic routes; `_layout.tsx` for layout groups

**ios/components:**
- Purpose: Reusable presentational components
- Contains: UI components (Button, Text, Card), feature-specific components (QuestionCard)
- Pattern: No business logic; accept data via props; emit callbacks

**ios/hooks:**
- Purpose: React Query queries and mutations for API communication
- Contains: API calls abstraction, response transformation, cache keys
- Pattern: Each hook exports useQuery/useMutation with type-safe backend integration

**ios/stores:**
- Purpose: Client-side state that persists across navigation
- Contains: Auth state (user, tokens), UI state (content filters, sort)
- Pattern: Zustand stores with actions for state updates

**ios/lib:**
- Purpose: Core utilities and configuration
- Contains: Axios client with interceptors, token storage, React Query config
- Pattern: Singleton instances used by stores and hooks

## Key File Locations

**Entry Points:**
- `backend/src/index.ts` - Express server startup, route registration, scheduler init
- `ios/app/_layout.tsx` - Root layout, auth guard, navigation setup

**Configuration:**
- `backend/src/config/env.ts` - Centralized env variable validation
- `backend/prisma/schema.prisma` - Database schema (single source of truth for data model)
- `ios/app.json` - Expo app metadata (bundle ID, name, version)
- `ios/eas.json` - Build profiles for EAS (dev, preview, production)

**Core Logic:**
- `backend/src/routes/oauth.ts` - OAuth flow orchestration (YouTube, Spotify, TikTok, Instagram)
- `backend/src/workers/scheduler.ts` - Cron job registry (11 jobs)
- `backend/src/services/quizGeneration.ts` - Quiz generation pipeline (Mistral AI)
- `backend/src/services/transcription.ts` - YouTube transcription (yt-dlp)
- `ios/stores/authStore.ts` - Authentication state + login/signup actions
- `ios/hooks/useContent.ts` - Content list/detail queries with filtering

**Testing:**
- `backend/**/*.test.ts` - Unit/integration tests (if present)
- `ios/**/*.test.ts` - Unit/component tests (if present)
- See: TESTING.md for test patterns

## Naming Conventions

**Files:**
- `[feature].ts` - Services, utilities, helpers (e.g., `transcription.ts`, `tokenRefresh.ts`)
- `[entity].route.ts` or `[feature].ts` - Route handlers (e.g., `auth.ts`, `content.ts`)
- `[name]Store.ts` - Zustand stores (e.g., `authStore.ts`, `contentStore.ts`)
- `[name]Screen.tsx` - iOS screens (e.g., `FeedScreen`, `QuizScreen`)
- `[Name].tsx` - React components (PascalCase; e.g., `LoadingScreen.tsx`, `QuestionCard.tsx`)
- `use[Name].ts` - React hooks (e.g., `useContent.ts`, `useQuiz.ts`)
- `[name]Worker.ts` - Background jobs (e.g., `youtubeSync.ts`, `reminderWorker.ts`)

**Directories:**
- Lowercase plural for feature groups: `routes/`, `services/`, `workers/`, `components/`, `hooks/`
- Lowercase with hyphens for multi-word: `backend/src/` (short), `(tabs)/` (layout group in expo-router)

## Where to Add New Code

**New Backend Endpoint:**
1. Create handler in `backend/src/routes/[feature].ts` or extend existing
2. If needs business logic → Extract to `backend/src/services/[name].ts`
3. If needs data access → Update `backend/prisma/schema.prisma`
4. Register router in `backend/src/index.ts` at `app.use('/api/[feature]', [featureRouter])`

**New iOS Screen:**
1. Create file in `ios/app/[route]/[screen].tsx` matching desired URL path
2. Use expo-router hooks: `useRouter()`, `useLocalSearchParams()`, `useRoute()`
3. Fetch data with hooks from `ios/hooks/` (React Query)
4. Import components from `ios/components/`
5. Access auth state from `useAuthStore()` if needed

**New Feature with UI + API:**
1. **Backend:** Add route file `backend/src/routes/[feature].ts`, service in `backend/src/services/`
2. **iOS:** Create screen in `ios/app/[route]/`, hook in `ios/hooks/use[Feature].ts`
3. **Database:** Update `backend/prisma/schema.prisma` if new entities needed
4. **Worker:** If async processing → Add job to `backend/src/workers/scheduler.ts`

**Background Job (Worker):**
1. Create new file in `backend/src/workers/[jobName].ts`
2. Export `run[JobName]Worker()` function and `jobName` constant
3. Import and schedule in `backend/src/workers/scheduler.ts`: `cron.schedule('timing', () => runJob('name', run[JobName]Worker))`
4. Ensure job uses `prisma` for data access
5. Add error logging with `[Scheduler]` prefix for consistency

**Utility/Helper:**
1. Backend: `backend/src/utils/[name].ts` for shared utilities
2. iOS: `ios/lib/[name].ts` for utilities, `ios/hooks/use[Name].ts` for hooks
3. Use barrel exports (`index.ts`) to simplify imports

## Special Directories

**backend/prisma/:**
- Purpose: Database schema and migrations
- Generated: Prisma client auto-generated in node_modules
- Committed: schema.prisma (migrations stored in migrations/ folder if needed)
- Usage: `prisma migrate dev` during development; `prisma deploy` in production

**ios/.expo/:**
- Purpose: Expo development client cache
- Generated: Automatically by `npx expo start`
- Committed: No (in .gitignore)
- Usage: Can delete safely; will be regenerated

**backend/dist/ or ios/dist/:**
- Purpose: Build output
- Generated: By `npm run build`
- Committed: No (in .gitignore)
- Usage: Source of truth is src/ files; dist/ is for deployment

**.env files:**
- Purpose: Secrets and environment configuration
- Generated: Manual creation required
- Committed: No (in .gitignore)
- Usage: `backend/.env`, `ios/.env`; Never commit secrets

**.planning/codebase/:**
- Purpose: Architecture documentation for future Claude instances
- Generated: By `/gsd:map-codebase` command
- Committed: Yes
- Files: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

---

*Structure analysis: 2026-02-09*
