# Requirements: Ankora Admin & Observability

**Defined:** 2026-02-09
**Core Value:** See at a glance whether the backend is healthy — which syncs ran, what failed, and how much content is flowing through the pipeline.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### ESM Migration

- [ ] **ESM-01**: Backend compiles and runs with `"type": "module"` in package.json
- [ ] **ESM-02**: All import statements use ESM syntax with `.js` extensions
- [ ] **ESM-03**: All 11 cron jobs execute correctly after ESM migration
- [ ] **ESM-04**: OAuth flows (YouTube, Spotify, TikTok, Instagram) work after migration
- [ ] **ESM-05**: PM2 cluster mode restarts cleanly with ESM module

### Structured Logging

- [ ] **LOG-01**: Backend uses Pino for all logging instead of console.log
- [ ] **LOG-02**: Each log entry is structured JSON with timestamp, level, and context
- [ ] **LOG-03**: HTTP requests are auto-logged with timing via pino-http
- [ ] **LOG-04**: Cron job logs include job name, status, and duration in structured format

### Job Execution Tracking

- [ ] **JOB-01**: JobExecution Prisma model stores job runs (jobName, status, startedAt, completedAt, duration, itemsProcessed, error)
- [ ] **JOB-02**: All 11 cron jobs are wrapped with execution tracking that persists to database
- [ ] **JOB-03**: Failed jobs capture error message and stack trace in JobExecution record
- [ ] **JOB-04**: Automatic cleanup deletes job execution records older than 30 days
- [ ] **JOB-05**: Job execution tracking does not affect existing job behavior or timing

### AdminJS Panel

- [ ] **ADM-01**: AdminJS mounted at `/admin` on the Express backend
- [ ] **ADM-02**: All Prisma models visible in AdminJS (User, Content, Quiz, Card, Review, ConnectedPlatform, Transcript, Tag, QuizSession, Streak, JobExecution)
- [ ] **ADM-03**: Admin can list, search, and filter records in any model
- [ ] **ADM-04**: Admin authentication via hardcoded email/password from environment variables
- [ ] **ADM-05**: `/admin` routes excluded from express-rate-limit
- [ ] **ADM-06**: Navigation groups models logically (Users, Content, Learning, Platform, Monitoring)

### Manual Job Triggers

- [ ] **TRIG-01**: Admin can trigger any sync job manually from the admin panel
- [ ] **TRIG-02**: Manual triggers go through the same execution tracking as scheduled runs
- [ ] **TRIG-03**: Manual trigger indicates it was manually triggered (not scheduled) in the job record

### Observability Dashboard

- [ ] **DASH-01**: Dashboard homepage shows system health overview at a glance
- [ ] **DASH-02**: Sync status panel shows last run of each job with success/failure indicator and time since last run
- [ ] **DASH-03**: Error log shows errors from last 24 hours, filterable by job type
- [ ] **DASH-04**: General stats displayed: total users, content count by platform, quizzes generated, reviews completed
- [ ] **DASH-05**: Timeline view shows chronological feed of all job executions with status
- [ ] **DASH-06**: Success rate visualization shows per-job success rate over time
- [ ] **DASH-07**: Dashboard updates in real-time via SSE (no manual refresh needed)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Admin

- **ADM-V2-01**: Bulk actions on records (delete old content, regenerate quizzes)
- **ADM-V2-02**: Edit/delete records directly from admin panel
- **ADM-V2-03**: Admin audit log tracking changes made via panel

### Advanced Observability

- **OBS-V2-01**: Alerting via Slack/email when jobs fail repeatedly
- **OBS-V2-02**: Log rotation with pm2-logrotate
- **OBS-V2-03**: Performance trend dashboards (response times, DB query times)
- **OBS-V2-04**: Job pause/resume capability from dashboard

### Security

- **SEC-V2-01**: IP whitelisting for /admin at Caddy level
- **SEC-V2-02**: Multi-admin support with database-backed accounts

## Out of Scope

| Feature | Reason |
|---------|--------|
| Grafana/Prometheus/Datadog | Overkill for single VPS with 11 jobs — custom dashboard sufficient |
| WebSocket real-time updates | SSE is simpler, unidirectional, and sufficient for dashboard updates |
| Mobile admin access | Desktop browser only, solo dev |
| Public analytics dashboard | Admin panel is internal tool |
| Log shipping to external service | Console + Pino sufficient for current scale |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ESM-01 | Phase 1 | Pending |
| ESM-02 | Phase 1 | Pending |
| ESM-03 | Phase 1 | Pending |
| ESM-04 | Phase 1 | Pending |
| ESM-05 | Phase 1 | Pending |
| LOG-01 | Phase 1 | Pending |
| LOG-02 | Phase 1 | Pending |
| LOG-03 | Phase 1 | Pending |
| LOG-04 | Phase 1 | Pending |
| JOB-01 | Phase 2 | Pending |
| JOB-02 | Phase 2 | Pending |
| JOB-03 | Phase 2 | Pending |
| JOB-04 | Phase 2 | Pending |
| JOB-05 | Phase 2 | Pending |
| ADM-01 | Phase 3 | Pending |
| ADM-02 | Phase 3 | Pending |
| ADM-03 | Phase 3 | Pending |
| ADM-04 | Phase 3 | Pending |
| ADM-05 | Phase 3 | Pending |
| ADM-06 | Phase 3 | Pending |
| TRIG-01 | Phase 3 | Pending |
| TRIG-02 | Phase 3 | Pending |
| TRIG-03 | Phase 3 | Pending |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| DASH-04 | Phase 4 | Pending |
| DASH-05 | Phase 4 | Pending |
| DASH-06 | Phase 4 | Pending |
| DASH-07 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-02-09*
*Last updated: 2026-02-09 after roadmap creation*
