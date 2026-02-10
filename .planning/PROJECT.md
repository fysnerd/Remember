# Ankora Admin & Observability

## What This Is

A unified admin panel and observability layer for the Ankora backend. Provides structured JSON logging (Pino), persistent cron job execution tracking, a full-featured AdminJS panel at `/admin` for data exploration and manual job triggers, and a real-time dashboard with 6 panels showing system health, sync status, errors, success rates, and timeline.

## Core Value

See at a glance whether the backend is healthy — which syncs ran, what failed, and how much content is flowing through the pipeline.

## Requirements

### Validated

- ✓ ESM module system with `"type": "module"` — v1.0
- ✓ Pino structured JSON logging (replaced 400+ console.log) — v1.0
- ✓ HTTP request auto-logging with timing via pino-http — v1.0
- ✓ JobExecution model with persistent job history (status, duration, errors) — v1.0
- ✓ All 11 cron jobs tracked with non-blocking execution recording — v1.0
- ✓ 30-day automatic cleanup of job execution records — v1.0
- ✓ AdminJS panel at `/admin` with 14 Prisma models in 5 navigation groups — v1.0
- ✓ Session-based admin auth with PostgreSQL store (PM2 cluster-safe) — v1.0
- ✓ 11 manual trigger actions with fire-and-forget pattern — v1.0
- ✓ MANUAL/SCHEDULED trigger source tracking — v1.0
- ✓ Real-time dashboard with 6 panels and SSE auto-refresh — v1.0
- ✓ Stats, sync status, error log, success rates, timeline views — v1.0

### Active

(No active requirements — milestone complete. Define new requirements via `/gsd:new-milestone`.)

### Out of Scope

- Grafana/Prometheus/Datadog — overkill for single VPS with 11 jobs, custom dashboard sufficient
- WebSocket real-time updates — SSE is simpler, unidirectional, sufficient
- Mobile admin access — desktop browser only, solo dev
- Alerting/notifications (Slack, email alerts) — deferred to v2
- Multi-admin with roles — solo dev, single login sufficient
- IP whitelisting for /admin — deferred to v2

## Context

Shipped v1.0 with 1,822 lines added across 41 backend files over 2 days.

Tech stack: Node.js v22, Express.js, TypeScript, Prisma, PostgreSQL (Supabase), Pino, AdminJS v7, Recharts, SSE.

Backend runs 12 cron jobs (11 sync + 1 cleanup) on Hetzner CPX32 VPS with PM2 cluster mode and Caddy reverse proxy.

Admin panel accessible at `https://api.ankora.study/admin`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| AdminJS for data exploration | Auto-generates CRUD from Prisma models, no custom UI needed | ✓ Good — 14 models browsable with zero custom code |
| Custom dashboard page in AdminJS | AdminJS supports custom pages — avoids separate frontend | ✓ Good — 573-line React component with 6 panels |
| JobExecution table in Supabase | Persistent history, queryable, survives PM2 restarts | ✓ Good — verified in production with 16+ records |
| Hardcoded admin credentials | Solo dev, no need for user management system | ✓ Good — simple, works for current scale |
| ESM migration | Required by AdminJS v7+, backend already used ESM syntax | ✓ Good — clean migration, all 11 jobs verified |
| Pino over Winston | 5x faster, structured JSON, ESM-native | ✓ Good — clean logs, queryable with jq |
| connect-pg-simple for sessions | PM2 cluster-safe, auto-creates table | ✓ Good — sessions persist across workers |
| Fire-and-forget triggers | Prevents HTTP timeouts on long-running Playwright jobs | ✓ Good — admin gets instant feedback |
| jobName as String (not enum) | New jobs don't require schema migration | ✓ Good — flexibility confirmed with cleanup job |
| prisma db push (not migrate) | Production schema drift detected, db push is safer | ✓ Good — no data loss |
| Rate limiter scoped to /api | AdminJS assets need unlimited requests | ✓ Good — panel loads without 429 errors |
| SSE over WebSocket | Unidirectional, simpler, sufficient for dashboard | ✓ Good — real-time updates with 30s heartbeat |
| Box-as-table pattern | AdminJS design-system table exports vary between versions | ✓ Good — resilient to AdminJS upgrades |
| Exclude admin/components from tsc | AdminJS bundles with its own bundler | ✓ Good — clean TypeScript compilation |

## Constraints

- **Single VPS**: Everything runs on one Hetzner CPX32 — admin panel must stay lightweight
- **Supabase DB**: Job history in same PostgreSQL — use Prisma schema sync
- **Caddy proxy**: Admin routed via existing `api.ankora.study` → `localhost:3001`
- **PM2 cluster**: Sessions must be database-backed (not in-memory)
- **AdminJS v7**: ESM-only, components bundled separately from tsc

---
*Last updated: 2026-02-10 after v1.0 milestone*
