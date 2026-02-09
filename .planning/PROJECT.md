# Ankora Admin & Observability

## What This Is

A unified admin panel for the Ankora backend that combines data exploration (AdminJS) with real-time observability. Accessible on `/admin`, it gives full visibility into what's happening: cron job status, error tracking, content pipeline stats, and the ability to browse all database models. Built for a solo developer who currently has no visibility beyond console log spam.

## Core Value

See at a glance whether the backend is healthy — which syncs ran, what failed, and how much content is flowing through the pipeline.

## Requirements

### Validated

- Express.js backend with 11 cron jobs (YouTube/Spotify/TikTok/Instagram sync, transcription, quiz generation, etc.) — existing
- PostgreSQL database via Supabase with Prisma ORM — existing
- PM2 process management with Caddy reverse proxy on Hetzner VPS — existing
- Console-based logging with prefixes (`[Scheduler]`, `[OAuth]`, etc.) — existing
- Worker overlap prevention via `runningJobs` Set — existing

### Active

- [ ] AdminJS panel on `/admin` for browsing all database models (User, Content, Quiz, Card, Review, etc.)
- [ ] Dashboard homepage with real-time overview of system health
- [ ] Job execution tracking — persist every cron job run (start, end, status, items processed, errors) to a `job_runs` table in Supabase
- [ ] Timeline view — chronological feed of all job executions
- [ ] Error log — recent errors from last 24h, filterable by job type
- [ ] Sync status panel — last run of each sync job with success/failure indicator
- [ ] General stats — users actifs, contenus par plateforme, quiz generated, reviews completed
- [ ] Simple email/password authentication for admin access (hardcoded credentials)

### Out of Scope

- Multi-user admin with roles — solo dev, single login sufficient
- External monitoring tools (Grafana, Prometheus, Datadog) — overkill for current scale
- Alerting/notifications (Slack, email alerts) — deferred, manual monitoring for now
- Frontend web admin — everything lives on the backend `/admin` route
- Mobile admin access — desktop browser only

## Context

The Ankora backend runs 11 cron jobs every 2-30 minutes. Currently, the only visibility into these jobs is PM2 logs (`pm2 logs remember-api`) which output unstructured console.log statements. When something breaks (like the Instagram sync selectors becoming outdated), it takes manual SSH + log scrolling to diagnose.

AdminJS v7+ is ESM-only. The backend currently compiles to CJS but uses ESM syntax — adding `"type": "module"` to package.json is needed. A plan for this already exists (REM-131).

The existing `scheduler.ts` already tracks running jobs in memory via a `runningJobs` Set, but doesn't persist execution history. The new `job_runs` table will capture what the Set currently tracks, plus duration, item counts, and error details.

## Constraints

- **ESM migration**: AdminJS v7+ requires `"type": "module"` in package.json — impacts build pipeline
- **Single VPS**: Everything runs on one Hetzner CPX32 — admin panel must be lightweight
- **Supabase DB**: Job history stored in same Supabase PostgreSQL — use Prisma migration
- **Caddy proxy**: Admin already routed via existing `api.ankora.study` → `localhost:3001` — no Caddy changes needed
- **Rate limiter**: AdminJS makes many internal requests — must exclude `/admin` from express-rate-limit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| AdminJS for data exploration | Auto-generates CRUD from Prisma models, no custom UI needed | — Pending |
| Custom dashboard page in AdminJS | AdminJS supports custom pages — avoids separate frontend | — Pending |
| `job_runs` table in Supabase | Persistent history, queryable, survives PM2 restarts | — Pending |
| Simple hardcoded admin credentials | Solo dev, no need for user management system | — Pending |
| ESM migration (`"type": "module"`) | Required by AdminJS v7+, backend already uses ESM syntax | — Pending |

---
*Last updated: 2026-02-09 after initialization*
