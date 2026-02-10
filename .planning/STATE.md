# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** See at a glance whether the backend is healthy — which syncs ran, what failed, and how much content is flowing through the pipeline.
**Current focus:** Phase 4 - Observability Dashboard

## Current Position

Phase: 4 of 4 (Observability Dashboard)
Plan: 01 of 02 (Dashboard Backend Data Layer) -- COMPLETE
Status: Plan 04-01 complete -- dashboard handler + SSE endpoint + broadcast wiring
Last activity: 2026-02-10 -- Plan 04-01 complete (backend data layer for observability dashboard)

Progress: [█████████░] 90%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 12 minutes
- Total execution time: 2.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | 122 min | 30 min |
| 02 | 2 | 6 min | 3 min |
| 03 | 2 | 9 min | 5 min |
| 04 | 1 | 4 min | 4 min |

**Recent Trend:**
- Last 5 plans: 02-01 (1 min), 02-02 (5 min), 03-01 (5 min), 03-02 (4 min), 04-01 (4 min)
- Trend: Phase 04 continuing fast execution

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: ESM migration required by AdminJS v7+ (no alternative)
- Phase 1: Pino chosen for structured logging (5x faster than Winston)
- Phase 2: JobExecution model in Supabase for persistent job history (survives PM2 restarts)
- Phase 3: Hardcoded admin credentials for single-user access (solo dev, sufficient for now)
- Phase 3: connect-pg-simple for session store (PM2 cluster-safe, auto-creates admin_sessions table)
- Phase 3: Rate limiter scoped to /api only so AdminJS assets are never limited
- Phase 3: Fire-and-forget pattern for admin trigger actions (prevents HTTP timeouts on long-running jobs)
- Phase 3: createTriggerAction factory generates type-safe AdminJS resource actions for all 11 jobs

**From Phase 1 execution:**
- Keep console.error in env.ts for bootstrap validation (avoids circular dependency with logger)
- Use pino-http named export instead of default (ESM/TypeScript compatibility)
- Skip /health endpoint in HTTP logging (noise reduction)
- Use debug level for browser automation logs (Playwright operations in TikTok/Instagram syncs)
- Stripe service NEVER logs payment amounts, card details, or tokens (PCI compliance)
- Leave client-side console.log in OAuth HTML page (browser console output, not server logs)

**From Phase 2 Plan 01 execution:**
- jobName as String (not enum) for flexibility - new jobs don't require schema migration
- Separate error and errorStack fields (display vs debugging)
- Use prisma db push for production schema sync when migration drift detected
- Two composite indexes: [jobName, startedAt] for job queries, [status, startedAt] for failure analysis
- Non-blocking tracking pattern: all Prisma calls wrapped in try/catch, failures logged but never crash jobs

**From Phase 4 Plan 01 execution:**
- Exclude admin/components from tsc -- AdminJS bundles components with its own bundler
- Placeholder dashboard component prevents AdminJS boot crash before Plan 04-02
- In-memory SSE client Set per PM2 worker -- acceptable for 1-2 admin connections
- Raw SQL for DISTINCT ON and FILTER WHERE -- not available in Prisma query builder
- ::int casts on COUNT to prevent BigInt serialization issues from raw SQL

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 4 ComponentLoader:** Resolved -- ComponentLoader pattern works as expected. Placeholder component prevents boot crash while Plan 04-02 creates the real React dashboard.

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 04-01-PLAN.md (dashboard backend data layer). Ready for Plan 04-02 (React dashboard component).
Resume file: .planning/phases/04-observability-dashboard/04-01-SUMMARY.md
