# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** L'utilisateur apprend durablement a partir de ce qu'il consomme deja -- sans effort supplementaire de curation.
**Current focus:** v2.0 Themes-first UX -- Phase 6 (Theme Classification Worker)

## Current Position

Phase: 6 of 11 (Theme Classification Worker)
Plan: 1 of 2 in current phase
Status: In Progress
Last activity: 2026-02-10 -- Completed 06-01 (Theme classification service)

Progress: [#############░░░░░░░] 13/22 plans (v1.0 complete, v2.0 phase 6 plan 1 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 13 (10 v1.0 + 3 v2.0)
- Average duration: ~19 min (improving with simpler schema/API/service plans)
- Total execution time: ~4 hours 11 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. ESM Migration | 4 | ~100 min | ~25 min |
| 2. Job Tracking | 2 | ~50 min | ~25 min |
| 3. AdminJS Panel | 2 | ~50 min | ~25 min |
| 4. Observability | 2 | ~50 min | ~25 min |
| 5. Theme Data Model & API | 2 | ~7 min | ~3.5 min |
| 6. Theme Classification Worker | 1/2 | ~3 min | ~3 min |

**Recent Trend:**
- v1.0 completed in 2 days (10 plans, 4 phases)
- v2.0 phase 5 completed in ~7 min (2 plans: schema + API)
- v2.0 phase 6 plan 1 completed in ~3 min (service creation)
- Trend: Accelerating (schema, API, and service plans are quick)

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

### Pending Todos

None.

### Blockers/Concerns

- Theme proliferation risk: LLM must receive existing themes in prompt to avoid duplicates
- UX transition: Need progressive disclosure (show tags until 3+ themes exist)
- Synthesis quiz prompt tuning: Will need iteration with real content (Phase 10)

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 06-01-PLAN.md (Theme classification service)
Next step: Execute 06-02-PLAN.md (Scheduler + Admin integration for theme classification worker)
Resume file: None
