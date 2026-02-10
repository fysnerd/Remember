# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** L'utilisateur apprend durablement a partir de ce qu'il consomme deja -- sans effort supplementaire de curation.
**Current focus:** v2.0 Themes-first UX -- Phase 7 (iOS Theme Management)

## Current Position

Phase: 7 of 11 (iOS Theme Management)
Plan: 1 of 2 in current phase
Status: Executing Phase 7
Last activity: 2026-02-10 -- Completed 07-01 (Theme navigation layer)

Progress: [###############░░░░░] 15/22 plans (v1.0 complete, v2.0 phases 5-6 complete, phase 7 in progress)

## Performance Metrics

**Velocity:**
- Total plans completed: 15 (10 v1.0 + 5 v2.0)
- Average duration: ~17 min (improving with simpler integration plans)
- Total execution time: ~4 hours 16 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. ESM Migration | 4 | ~100 min | ~25 min |
| 2. Job Tracking | 2 | ~50 min | ~25 min |
| 3. AdminJS Panel | 2 | ~50 min | ~25 min |
| 4. Observability | 2 | ~50 min | ~25 min |
| 5. Theme Data Model & API | 2 | ~7 min | ~3.5 min |
| 6. Theme Classification Worker | 2/2 | ~5 min | ~2.5 min |
| 7. iOS Theme Screens | 1/2 | ~3 min | ~3 min |

**Recent Trend:**
- v1.0 completed in 2 days (10 plans, 4 phases)
- v2.0 phase 5 completed in ~7 min (2 plans: schema + API)
- v2.0 phase 6 completed in ~5 min (2 plans: service + scheduler/admin integration)
- v2.0 phase 7 plan 01 completed in ~3 min (types + hooks + components + screens)
- Trend: Accelerating (UI plans as fast as backend service plans)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Themes are a layer above tags (not replacing)
- Content can belong to multiple themes (many-to-many)
- Themes auto-created by AI, user adjusts after
- Quiz by theme = mix existing questions + new synthesis questions
- Use explicit join tables (not Prisma implicit M:N) for performance
- Use cached memos (not raw transcripts) for synthesis quiz generation
- Cap themes at 15-25 per user to prevent proliferation
- Used --accept-data-loss on prisma db push to drop orphaned admin_sessions table (not in schema, safe)
- Theme ownership scoped via @@unique([userId, slug]) and @@unique([userId, name])
- Used Zod for theme API validation (already a project dependency)
- Flatten contentThemes join data into themes array on content responses for cleaner API
- Set assignedBy to 'user' for manual content-theme associations (vs 'system' for AI)
- Single-use tags filtered before LLM prompt to reduce noise in theme generation
- Deterministic tag-overlap matching before LLM fallback for content classification
- Theme generation gated on 10+ tagged content items per user (minimum signal threshold)
- generateSlug extracted to shared utils/slug.ts (imported by both route and service)
- Theme classification cron placed after auto-tagging (themes depend on tags existing)
- theme-backfill is manual-only (no cron) -- one-time operation via admin triggers
- ThemeCard component uses color bar accent (4px left border) instead of background tint for minimal aesthetic
- Quiz button on theme detail reuses /quiz/topic/[name] by theme name until Phase 8 adds theme-specific quiz
- Pre-registered theme management routes in _layout.tsx so Plan 07-02 does not need to touch root layout

### Pending Todos

None.

### Blockers/Concerns

- Theme proliferation risk: LLM must receive existing themes in prompt to avoid duplicates
- UX transition: Need progressive disclosure (show tags until 3+ themes exist)
- Synthesis quiz prompt tuning: Will need iteration with real content (Phase 10)

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 07-01-PLAN.md (Theme navigation layer)
Next step: Execute 07-02-PLAN.md (Theme management screens)
Resume file: None
