---
phase: 03-adminjs-panel-manual-triggers
plan: 01
subsystem: admin
tags: [adminjs, prisma, express-session, connect-pg-simple, admin-panel]

# Dependency graph
requires:
  - phase: 02-job-execution-tracking
    provides: JobExecution model for monitoring resource
  - phase: 01-esm-structured-logging
    provides: ESM module system, Pino logger, config pattern
provides:
  - AdminJS panel mounted at /admin with session auth
  - 14 Prisma model resources in 5 navigation groups
  - TriggerSource enum (SCHEDULED/MANUAL) on JobExecution
  - ADMIN_EMAIL/ADMIN_PASSWORD env config with defaults
  - PostgreSQL session store for PM2 cluster compatibility
affects: [03-02, 04-dashboard]

# Tech tracking
tech-stack:
  added: [adminjs@7.8, "@adminjs/express@6.1", "@adminjs/prisma", express-session, connect-pg-simple, express-formidable, tslib]
  patterns: [admin-module-pattern, pg-session-store, scoped-rate-limiting]

key-files:
  created:
    - backend/src/admin/index.ts
    - backend/src/admin/resources.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/config/env.ts
    - backend/src/index.ts
    - backend/package.json

key-decisions:
  - "Use connect-pg-simple for session store (PM2 cluster-safe, auto-creates table)"
  - "Scope rate limiter to /api only so AdminJS static assets are never limited"
  - "Use prisma db push instead of migrate dev (drift detection, same as Phase 2)"
  - "Optional ADMIN_EMAIL/ADMIN_PASSWORD with defaults for dev convenience"

patterns-established:
  - "Admin module pattern: setupAdminJS() returns { admin, adminRouter } for Express mounting"
  - "Scoped rate limiting: app.use('/api', limiter) instead of global app.use(limiter)"
  - "Navigation groups: 5 categories (Users, Content, Learning, Platform, Monitoring)"

# Metrics
duration: 5min
completed: 2026-02-10
---

# Phase 03 Plan 01: AdminJS Panel Foundation Summary

**AdminJS v7 panel with 14 Prisma resources, 5 navigation groups, pg session auth, and TriggerSource enum for manual job execution tracking**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-10T11:36:23Z
- **Completed:** 2026-02-10T11:41:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Installed AdminJS v7 with Prisma adapter, Express plugin, and PostgreSQL session store
- Added TriggerSource enum (SCHEDULED/MANUAL) and triggerSource field to JobExecution model
- Created admin module with all 14 Prisma models organized into 5 navigation groups (Users, Content, Learning, Platform, Monitoring)
- Mounted AdminJS at /admin with cookie-based session auth using hardcoded credentials
- Scoped rate limiter to /api only so AdminJS panel assets are never rate-limited

## Task Commits

Each task was committed atomically:

1. **Task 1: Install AdminJS packages and add TriggerSource to Prisma schema** - `f4e9de3` (chore)
2. **Task 2: Create AdminJS admin module with resources and mount on Express** - `6007d1a` (feat)

## Files Created/Modified
- `backend/src/admin/index.ts` - AdminJS setup with Prisma adapter, pg session store, and authenticated router
- `backend/src/admin/resources.ts` - All 14 Prisma model resource definitions with 5 navigation groups
- `backend/prisma/schema.prisma` - TriggerSource enum and triggerSource field on JobExecution
- `backend/src/config/env.ts` - ADMIN_EMAIL and ADMIN_PASSWORD with sensible defaults
- `backend/src/index.ts` - AdminJS mount before rate limiter, rate limiter scoped to /api
- `backend/package.json` - AdminJS and related dependencies added

## Decisions Made
- **connect-pg-simple for sessions:** PM2 cluster mode means in-memory sessions would not be shared. PostgreSQL store with `createTableIfMissing: true` auto-creates the `admin_sessions` table.
- **Scoped rate limiter:** Changed from `app.use(limiter)` to `app.use('/api', limiter)` so AdminJS React bundle, CSS, and JS are never rate-limited.
- **prisma db push:** Used `db push` instead of `migrate dev` consistent with Phase 2 decision (handles schema drift).
- **Optional admin env vars:** ADMIN_EMAIL and ADMIN_PASSWORD are optional in zod schema with hardcoded defaults for dev convenience. Production will set them via env vars.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Default admin credentials are hardcoded for development. Production env vars will be set in Plan 02 during VPS deploy.

## Next Phase Readiness
- AdminJS panel foundation complete with all 14 resources
- Ready for Plan 02 to add manual trigger custom actions and deploy to VPS
- TriggerSource enum ready for workers to use when recording manual vs scheduled executions

## Self-Check: PASSED

All 5 created/modified files verified on disk. Both task commits (f4e9de3, 6007d1a) verified in git log.

---
*Phase: 03-adminjs-panel-manual-triggers*
*Completed: 2026-02-10*
