# Roadmap: Ankora Admin & Observability

## Overview

Transform backend visibility from console log spam to structured observability. Migrate codebase to ESM (AdminJS requirement), implement Pino structured logging, persist cron job execution history in PostgreSQL, deploy AdminJS panel at `/admin` for data exploration, add manual job triggers, and build custom dashboard for at-a-glance system health monitoring.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: ESM Migration & Logging Foundation** - Migrate to ESM and replace console.log with Pino (completed 2026-02-09)
- [ ] **Phase 2: Job Execution Tracking** - Persist cron job history to database
- [ ] **Phase 3: AdminJS Panel & Manual Triggers** - Deploy admin panel with data exploration
- [ ] **Phase 4: Observability Dashboard** - Build custom dashboard for system health

## Phase Details

### Phase 1: ESM Migration & Logging Foundation
**Goal**: Backend runs on ESM modules with structured Pino logging
**Depends on**: Nothing (first phase)
**Requirements**: ESM-01, ESM-02, ESM-03, ESM-04, ESM-05, LOG-01, LOG-02, LOG-03, LOG-04
**Success Criteria** (what must be TRUE):
  1. Backend compiles and runs with `"type": "module"` in package.json
  2. All import statements use `.js` extensions and ESM syntax
  3. All 11 cron jobs execute successfully after migration
  4. OAuth flows (YouTube, Spotify, TikTok, Instagram) work end-to-end
  5. All logging is structured JSON via Pino (no console.log statements remain)
  6. HTTP requests are auto-logged with timing via pino-http middleware
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md -- ESM migration, Pino setup, wire into index/middleware
- [x] 01-02-PLAN.md -- Replace console.log in workers (6 files, 127 occurrences)
- [x] 01-03-PLAN.md -- Replace console.log in services (12 files, 218 occurrences)
- [x] 01-04-PLAN.md -- Replace console.log in routes (5 files, 54 occurrences) + final verification

### Phase 2: Job Execution Tracking
**Goal**: Every cron job run is persisted to database with status, duration, and error tracking
**Depends on**: Phase 1
**Requirements**: JOB-01, JOB-02, JOB-03, JOB-04, JOB-05
**Success Criteria** (what must be TRUE):
  1. JobExecution model exists in Prisma schema with all required fields (jobName, status, startedAt, completedAt, duration, itemsProcessed, error)
  2. All 11 cron jobs write execution records at start and completion
  3. Failed jobs capture error message and stack trace in JobExecution table
  4. Automatic cleanup deletes execution records older than 30 days
  5. Job execution tracking does not delay or interfere with existing job behavior
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md -- Prisma JobExecution model + migration + tracker wrapper + cleanup worker
- [ ] 02-02-PLAN.md -- Wire tracking into scheduler.ts + register cleanup cron + deploy to VPS

### Phase 3: AdminJS Panel & Manual Triggers
**Goal**: Admin can browse all database models and manually trigger sync jobs
**Depends on**: Phase 2
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06, TRIG-01, TRIG-02, TRIG-03
**Success Criteria** (what must be TRUE):
  1. AdminJS is accessible at `https://api.ankora.study/admin` with hardcoded authentication
  2. All Prisma models are visible (User, Content, Quiz, Card, Review, ConnectedPlatform, Transcript, Tag, QuizSession, Streak, JobExecution)
  3. Admin can list, search, filter, and sort records in any model
  4. Navigation groups models logically (Users, Content, Learning, Platform, Monitoring)
  5. Admin can manually trigger any of the 11 sync jobs from the panel
  6. Manual triggers create JobExecution records marked as manual (not scheduled)
**Plans**: TBD

Plans:
- [ ] TBD during planning

### Phase 4: Observability Dashboard
**Goal**: At-a-glance system health dashboard shows job status, errors, and stats
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Success Criteria** (what must be TRUE):
  1. Dashboard homepage displays system health overview
  2. Sync status panel shows last run of each job with success/failure indicator
  3. Error log shows errors from last 24 hours, filterable by job type
  4. General stats displayed: total users, content by platform, quizzes generated, reviews completed
  5. Timeline view shows chronological feed of all job executions
  6. Success rate visualization shows per-job success percentage
  7. Dashboard updates in real-time via Server-Sent Events (SSE)
**Plans**: TBD

Plans:
- [ ] TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. ESM Migration & Logging Foundation | 4/4 | ✅ Complete | 2026-02-09 |
| 2. Job Execution Tracking | 0/2 | In progress | - |
| 3. AdminJS Panel & Manual Triggers | 0/TBD | Not started | - |
| 4. Observability Dashboard | 0/TBD | Not started | - |
