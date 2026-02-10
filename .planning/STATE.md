# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** See at a glance whether the backend is healthy — which syncs ran, what failed, and how much content is flowing through the pipeline.
**Current focus:** Phase 3 - AdminJS Panel & Manual Triggers

## Current Position

Phase: 3 of 4 (AdminJS Panel & Manual Triggers) -- COMPLETE
Plan: 02 of 02 (Manual Trigger Actions & VPS Deploy) -- COMPLETE
Status: Phase 3 complete — AdminJS panel with 11 manual triggers deployed to production
Last activity: 2026-02-10 — Plan 03-02 complete (manual triggers + VPS deploy)

Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 13 minutes
- Total execution time: 2.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | 122 min | 30 min |
| 02 | 2 | 6 min | 3 min |
| 03 | 2 | 9 min | 5 min |

**Recent Trend:**
- Last 5 plans: 01-03 (9 min), 02-01 (1 min), 02-02 (5 min), 03-01 (5 min), 03-02 (4 min)
- Trend: Phase 03 fast (2 plans, 9 min total)

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

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 4 complexity:** AdminJS custom dashboard pattern (ComponentLoader) has sparse documentation. Fallback option (standalone HTML + Chart.js) available if needed.

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 03-02-PLAN.md (manual triggers + VPS deploy). Phase 3 complete. Ready for Phase 4 (custom dashboard).
Resume file: .planning/phases/03-adminjs-panel-manual-triggers/03-02-SUMMARY.md
