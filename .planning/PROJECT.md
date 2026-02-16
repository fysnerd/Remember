# Ankora

## What This Is

Ankora est une plateforme d'apprentissage actif qui transforme le contenu consomme sur les reseaux sociaux (YouTube, Spotify, TikTok, Instagram) en connaissances durables via des quiz generes par IA et la repetition espacee. L'app iOS organise le contenu par themes auto-generes, avec quiz cross-contenu par theme, memos de synthese, et suivi de progression. Le triage inbox se fait par swipe Tinder-like, et le Daily Digest offre une session microlearning quotidienne avec cloture cognitive.

## Core Value

L'utilisateur apprend durablement a partir de ce qu'il consomme deja -- sans effort supplementaire de curation.

## Requirements

### Validated

- ✓ Auth JWT (signup, login, refresh tokens) -- pre-v1
- ✓ OAuth YouTube, Spotify + cookie-based TikTok, Instagram -- pre-v1
- ✓ Content sync from 4 platforms (cron workers) -- pre-v1
- ✓ Transcription pipeline (yt-dlp + Groq Whisper) -- pre-v1
- ✓ Quiz generation per content (Mistral AI) -- pre-v1
- ✓ Spaced repetition review (SM-2 algorithm) -- pre-v1
- ✓ Auto-tagging with Mistral AI -- pre-v1
- ✓ Content inbox + triage flow -- pre-v1
- ✓ Structured logging (Pino) -- v1.0
- ✓ Job execution tracking + AdminJS panel -- v1.0
- ✓ Real-time observability dashboard -- v1.0
- ✓ Theme data model with M:N content-theme relations -- v2.0
- ✓ Theme CRUD API (7 endpoints, Zod validation, 25-cap) -- v2.0
- ✓ AI-powered theme auto-generation from tag clusters -- v2.0
- ✓ Deterministic content classification + LLM fallback -- v2.0
- ✓ Theme-first home screen with ThemeCard grid -- v2.0
- ✓ Theme management (create, rename, delete, move content) -- v2.0
- ✓ Theme-scoped quiz mixing per-content questions -- v2.0
- ✓ AI-generated theme synthesis memos (24h cache) -- v2.0
- ✓ Cross-content synthesis quiz (LLM questions connecting 2+ sources) -- v2.0
- ✓ Theme discovery onboarding (rename/merge/dismiss) -- v2.0
- ✓ Learning progress visualization (mastery %, due cards) -- v2.0
- ✓ Night Blue color palette + Soft Gold accent across all screens -- v3.0
- ✓ Geist font family replacing system font -- v3.0
- ✓ Glass UI reusable components (GlassCard, GlassButton, GlassSurface, GlassInput) -- v3.0
- ✓ Lucide Icons replacing emoji -- v3.0
- ✓ Home screen: 3 daily themes in glass cards (smart rotation) -- v3.0
- ✓ Explorer screen: Suggestions tab (8 AI-generated) + Library tab (filters/search) -- v3.0
- ✓ Revisions screen: revision cards with category filter + full-text search -- v3.0
- ✓ Profile screen: user info + settings -- v3.0
- ✓ Backend: daily subjects selection endpoint -- v3.0
- ✓ Backend: AI theme suggestions endpoint (8 suggestions via Mistral) -- v3.0
- ✓ Visual freemium indicators (lock/overlay UI, no payment wiring) -- v3.0
- ✓ Micro-interactions: transitions 200-300ms, loading animations, progress feedback -- v3.0
- ✓ SRS fixed intervals J+1/J+3/J+7/J+31 (research-backed) -- v4.0
- ✓ Self-referential quiz prompts (creator name, platform, temporal context) -- v4.0
- ✓ Swipe triage Tinder-like (right=keep, left=dismiss) as primary inbox mode -- v4.0
- ✓ Bulk select toggle as secondary triage mode -- v4.0
- ✓ Source filter pills + pull-to-refresh sync in both modes -- v4.0
- ✓ Daily Digest microlearning session (10-15 questions, SRS-priority selection) -- v4.0
- ✓ Cognitive closure screen with score %, streak, session duration -- v4.0
- ✓ Real-time pipeline feedback (transcribing/generating/ready status badges) -- v4.0

### Active

(None -- start next milestone with `/gsd:new-milestone`)

### Out of Scope

- Grafana/Prometheus/Datadog -- custom dashboard sufficient
- Multi-admin with roles -- solo dev
- Android app -- iOS only for now
- Social features (sharing, leaderboards) -- not the focus
- Theme collaboration (shared themes between users) -- solo learning app
- Hierarchical/nested themes -- Prisma lacks recursive queries, 5-15 themes not enough for hierarchy
- Vector database for classification -- tag space too small, LLM simpler
- Theme-specific SM-2 schedules -- SM-2 per-card, overriding fights the algorithm
- Quiz during triage -- triage is fast curation, quiz is focused engagement (different mental modes)
- Custom SRS intervals -- fixed J+1/J+3/J+7/J+31 per PRD research
- Undo swipe (shake to undo) -- simplicity over features
- Payment/subscription gating -- visual freemium in v3.0, actual payment deferred

## Context

Backend: Node.js v22, Express.js, TypeScript, Prisma, PostgreSQL (Supabase), Pino, AdminJS v7. Runs on Hetzner CPX32 VPS with PM2 cluster mode and Caddy reverse proxy.

iOS app: Expo SDK 54, expo-router, Zustand, TanStack React Query, Axios, react-native-gesture-handler, react-native-reanimated.

Shipped v4.0 with ~20,000 LOC across backend + iOS.
20 phases completed across 4 milestones (v1.0-v4.0), 41 plans total.
Theme system: 3 Prisma models, 15+ API endpoints, 8+ iOS screens.
Workers: 15 cron jobs including theme classification at */15 schedule.
Quiz system: per-content + cross-content synthesis + daily digest sessions.
Triage: dual-mode (swipe + bulk), source filters, pull-to-refresh.
Design: Night Blue Glass UI, Geist font, Lucide icons, spring animations.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ESM migration | Modern module system, Pino compatibility | ✓ Good |
| Pino structured logging | JSON logging for observability pipeline | ✓ Good |
| AdminJS v7 for admin panel | Full CRUD on all models, custom actions | ✓ Good |
| SSE for dashboard | Real-time without WebSocket complexity | ✓ Good |
| Themes above tags (not replacing) | Tags provide detail, themes provide navigation | ✓ Good |
| Multi-theme content (M:N) | Content naturally spans topics | ✓ Good |
| Explicit join tables | Performance + assignedBy tracking (vs Prisma implicit) | ✓ Good |
| 100% AI auto-creation | Lower friction, user adjusts via discovery flow | ✓ Good |
| Deterministic matching before LLM | Saves API costs, consistent results | ✓ Good |
| Nullable Quiz.contentId for synthesis | Polymorphic ownership without extra tables | ✓ Good |
| On-demand synthesis generation | Avoids background job for rarely-used feature | ✓ Good |
| discoveredAt gate (not status enum) | Simpler schema, nullable DateTime sufficient | ✓ Good |
| Zod validation on theme routes | Consistent with existing project patterns | ✓ Good |
| 24h memo caching on model fields | Avoid separate cache table, lazy invalidation | ✓ Good |
| Night Blue + Soft Gold palette | Premium feel, warm contrast against dark blue | ✓ Good |
| Geist font (expo-font) | Modern, clean typography, Google Fonts available | ✓ Good |
| Glass UI via expo-blur | Native blur, no SwiftUI dependency, OTA-compatible | ✓ Good |
| Lucide Icons | Consistent line icons, better than emoji for Glass UI | ✓ Good |
| Swipe triage over batch select | Tinder-like swipe is faster, more satisfying for binary decisions | ✓ Good |
| Triage != Quiz (separate modes) | Triage is fast curation, quiz is focused engagement -- mixing creates friction | ✓ Good |
| J+1 first review (not immediate) | Sleep consolidation before first review, per PRD research | ✓ Good |
| Self-referential quiz framing | Creator name + platform context improves retention (self-reference effect) | ✓ Good |
| Daily Digest as primary learning | Pre-built session beats content-by-content review for daily habit | ✓ Good |
| useMutation for digest fetch | Prevents duplicate QuizSession creation on re-fetches | ✓ Good |
| Conditional 5s polling for pipeline | Polls only when processing items exist, stops when idle (battery-safe) | ✓ Good |
| GestureHandlerRootView at app root | Global gesture support, no per-screen wrappers needed | ✓ Good |

## Constraints

- **Single VPS**: Backend + workers on one Hetzner CPX32
- **Supabase DB**: PostgreSQL via Prisma -- schema changes via `prisma db push`
- **Expo SDK 54**: iOS app with OTA updates for JS changes
- **Mistral AI**: Used for tagging, quiz gen, theme classification, and memo synthesis
- **Existing tags**: Themes derive from tags, both coexist

---
*Last updated: 2026-02-16 after v4.0 milestone*
