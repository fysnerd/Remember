# Ankora

## What This Is

Ankora est une plateforme d'apprentissage actif qui transforme le contenu consomme sur les reseaux sociaux (YouTube, Spotify, TikTok, Instagram) en connaissances durables via des quiz generes par IA et la repetition espacee. L'app iOS organise le contenu par themes auto-generes, avec quiz cross-contenu par theme, memos de synthese, et suivi de progression par theme.

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

### Active

(None -- next milestone not yet defined. Run `/gsd:new-milestone` to start.)

### Out of Scope

- Grafana/Prometheus/Datadog -- custom dashboard sufficient
- Multi-admin with roles -- solo dev
- Android app -- iOS only for now
- Social features (sharing, leaderboards) -- not the focus
- Theme collaboration (shared themes between users) -- solo learning app
- Hierarchical/nested themes -- Prisma lacks recursive queries, 5-15 themes not enough for hierarchy
- Vector database for classification -- tag space too small, LLM simpler
- Theme-specific SM-2 schedules -- SM-2 per-card, overriding fights the algorithm

## Context

Backend: Node.js v22, Express.js, TypeScript, Prisma, PostgreSQL (Supabase), Pino, AdminJS v7. Runs on Hetzner CPX32 VPS with PM2 cluster mode and Caddy reverse proxy.

iOS app: Expo SDK 54, expo-router, Zustand, TanStack React Query, Axios.

Shipped v2.0 with ~14,000 LOC across backend + iOS.
Theme system: 3 new Prisma models (Theme, ContentTheme, ThemeTag), 15+ new API endpoints, 8 new iOS screens.
Workers: 15 cron jobs including theme classification at */15 schedule.
Quiz system: per-content + cross-content synthesis questions, 20-card cap per session.

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

## Constraints

- **Single VPS**: Backend + workers on one Hetzner CPX32
- **Supabase DB**: PostgreSQL via Prisma -- schema changes via `prisma db push`
- **Expo SDK 54**: iOS app with OTA updates for JS changes
- **Mistral AI**: Used for tagging, quiz gen, theme classification, and memo synthesis
- **Existing tags**: Themes derive from tags, both coexist

---
*Last updated: 2026-02-11 after v2.0 milestone*
