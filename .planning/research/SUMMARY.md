# Research Summary: Ankora Admin Panel & Observability

**Domain:** Admin panel with observability for Node.js/Express backend
**Researched:** 2026-02-09
**Overall confidence:** HIGH

## Executive Summary

Adding an admin panel and observability to Ankora's existing Express.js + Prisma backend requires migrating from CommonJS to ESM (AdminJS v7 requirement), implementing AdminJS with Prisma adapter for auto-generated CRUD, replacing console.log with structured Pino logging, and persisting cron job execution history in PostgreSQL via a new JobExecution model.

The technology choices are mature and production-ready: AdminJS v7.8.17 (published 7 months ago) is the standard Node.js admin panel solution in 2026, Pino v10.3.0 (published 16 days ago) is the fastest Node.js logger (5x faster than Winston), and the official AdminJS Prisma adapter v5.0.4 provides seamless integration with the existing ORM.

The major technical challenge is the CJS-to-ESM migration, which is a breaking change that touches every file with imports. AdminJS v7 is ESM-only and will not work with CommonJS projects. This migration requires updating package.json ("type": "module"), tsconfig.json (module: "ESNext"), and all import statements (.js extensions required).

The custom observability dashboard (timeline of job executions, success rates, recent errors) can be implemented as an AdminJS custom React component, though this has moderate complexity. A simpler fallback is a standalone HTML page with Chart.js served at a separate endpoint.

## Key Findings

**Stack:** AdminJS 7.8.17 + @adminjs/express 6.1.1 + @adminjs/prisma 5.0.4 for admin panel, Pino 10.3.0 for structured logging, Prisma schema extension (JobExecution model) for cron job history tracking.

**Architecture:** AdminJS mounts at `/admin` on existing Express app (api.ankora.study/admin), authenticates with hardcoded credentials via express-session, auto-generates CRUD from Prisma schema (all models including new JobExecution), custom dashboard as React component bundled via AdminJS ComponentLoader.

**Critical pitfall:** ESM migration is high-risk. Every file with require()/module.exports must be updated. Runtime errors likely if any dependency doesn't support ESM. Testing all 11 cron jobs, OAuth flows, and API endpoints is mandatory after migration.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: ESM Migration & Logging Foundation
**Rationale:** AdminJS v7 requires ESM. Must migrate entire codebase first. Add Pino logging before job tracking (needed to validate migration success).

**Addresses:**
- Migrate package.json to "type": "module"
- Update tsconfig.json for ESNext modules
- Convert all require() to import, add .js extensions
- Replace console.log with pino structured logging
- Wrap Express app with pino-http middleware
- Test all existing functionality (cron jobs, OAuth, API)

**Avoids:** Starting AdminJS integration on CJS codebase (will fail immediately). Trying to debug ESM issues while implementing new features (compounding complexity).

**Estimated Complexity:** HIGH - Touches every file, high testing burden
**Risk:** Breaking changes in production if migration incomplete

### Phase 2: Job Execution Tracking
**Rationale:** Before building dashboards, need data to display. JobExecution model provides historical data for observability.

**Addresses:**
- Add JobExecution Prisma model (jobName, status, startedAt, duration, etc.)
- Run migration: `npx prisma migrate dev --name add_job_execution`
- Wrap all 11 cron jobs with execution tracking (try/catch, prisma.jobExecution.create/update)
- Log execution start/complete/error with structured pino logger
- Add daily cleanup job (delete executions older than 30 days)

**Avoids:** Building admin panel without data (empty tables, no value). Losing historical job data due to missing cleanup (database bloat).

**Estimated Complexity:** MEDIUM - Repetitive but straightforward pattern
**Risk:** LOW - Additive changes, doesn't break existing functionality

### Phase 3: AdminJS Integration
**Rationale:** With ESM migration complete and job data flowing, add admin panel for data exploration.

**Addresses:**
- Install AdminJS packages (@adminjs/express, @adminjs/prisma)
- Configure AdminJS resources (map all Prisma models)
- Set up session-based authentication (hardcoded admin credentials from env)
- Mount at /admin route
- Configure navigation (Users, Content, Reviews, Job Executions)
- Sort JobExecution by startedAt desc by default
- Deploy to VPS, test access at https://api.ankora.study/admin

**Avoids:** Complex user management (single hardcoded admin is sufficient). Database-backed sessions (in-memory session store is fine for single admin).

**Estimated Complexity:** MEDIUM - Well-documented integration pattern
**Risk:** LOW - AdminJS is mature, Prisma adapter is official

### Phase 4: Custom Observability Dashboard (OPTIONAL)
**Rationale:** AdminJS provides CRUD for JobExecution, but custom dashboard adds visual analytics (timeline, success rates).

**Addresses:**
- Create React component for custom dashboard page
- Add AdminJS ComponentLoader configuration
- Build API endpoint for dashboard stats (/api/admin/dashboard/stats)
- Query JobExecution with aggregations (success rate per job, last 24h timeline)
- Use Recharts for timeline/bar chart visualization
- Display: job status (running/idle), last 24h timeline, success rates, recent errors

**OR Fallback (if AdminJS custom dashboard too complex):**
- Create standalone HTML page at /admin-stats
- Use vanilla Chart.js (lighter than Recharts, no React)
- Same data queries, simpler implementation

**Avoids:** Real-time updates via WebSocket (page refresh is acceptable). Over-engineering observability for 11 cron jobs (KISS principle).

**Estimated Complexity:** MEDIUM-HIGH (AdminJS route), LOW (fallback route)
**Risk:** MEDIUM - Custom dashboard pattern is documented but implementation details sparse

## Phase Ordering Rationale

**Why ESM first:** AdminJS v7 is ESM-only. Cannot install or run AdminJS on CommonJS project. Migration is a prerequisite, not optional. Attempting AdminJS integration on CJS codebase wastes time.

**Why logging before job tracking:** Pino provides structured context for debugging ESM migration issues. Easier to validate cron jobs work correctly post-migration with proper logging. Logging is foundational infrastructure.

**Why job tracking before admin panel:** Admin panel without data is useless. JobExecution records must exist before AdminJS can display them. Building UI first = waterfall dependencies.

**Why custom dashboard last (and optional):** AdminJS CRUD provides 80% of value (view/filter/sort job executions). Custom dashboard is polish, not core functionality. Can ship Phase 3 to production and defer Phase 4.

## Research Flags for Phases

**Phase 1 (ESM Migration):** Unlikely to need additional research. Migration pattern is well-documented. Main risk is execution/testing, not knowledge gaps. Flag: Allocate extra time for testing all integrations (OAuth, Prisma, node-cron).

**Phase 2 (Job Tracking):** Standard patterns, unlikely to need research. Prisma migrations and CRUD are well-understood in codebase.

**Phase 3 (AdminJS):** Unlikely to need research. Official docs and examples are comprehensive. AdminJS Prisma adapter handles resource mapping automatically.

**Phase 4 (Custom Dashboard):** Likely needs deeper research IF AdminJS ComponentLoader pattern is unclear. AdminJS custom dashboard docs provide high-level overview but sparse implementation details. May require trial-and-error or community examples search. Fallback option (standalone HTML + Chart.js) mitigates this risk.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified from npm (published recently), AdminJS is industry standard for Node.js admin panels, Pino is proven fastest logger |
| ESM Migration | HIGH | TypeScript ESM patterns well-documented, migration steps clear, but HIGH RISK due to codebase-wide changes |
| Job Tracking | HIGH | Prisma schema extension is standard practice, pg_cron pattern (job_run_details) provides proven model |
| AdminJS Integration | HIGH | Official adapters (@adminjs/express, @adminjs/prisma), authentication pattern in docs, production-ready |
| Custom Dashboard | MEDIUM | AdminJS ComponentLoader pattern confirmed but implementation details sparse, may require experimentation, fallback strategy mitigates |

## Gaps to Address

### ESM Compatibility Verification (Pre-Migration)
Before starting Phase 1, audit existing dependencies for ESM support. Some packages may only support CommonJS. Check:
- `node-cron` - ESM support?
- `express` - ESM compatible (yes, verified in research)
- `express-session` - ESM compatible?
- `@prisma/client` - ESM compatible?
- `axios` - ESM compatible?
- Custom modules (tokenRefresh, transcription services)

**Mitigation:** Search npm pages for "ESM" / "type: module" mentions. Test small ESM project with critical dependencies before full migration.

### AdminJS Custom Dashboard Learning Curve
Research found ComponentLoader concept but not step-by-step tutorial. May need to:
- Review AdminJS GitHub examples (beyond docs)
- Check AdminJS Discord/community for custom dashboard examples
- Experiment with simple custom component first (static content) before building dashboard

**Mitigation:** Start with fallback option (standalone HTML page) if ComponentLoader pattern unclear after 4 hours of experimentation.

### Pino Log Rotation Strategy
Research covered Pino logging but not log rotation. PM2 captures stdout, but logs can grow indefinitely. Needs:
- Research PM2 log rotation settings (`pm2 install pm2-logrotate`?)
- Or investigate pino-roll for file-based rotation
- Define retention policy (7 days? 30 days?)

**Mitigation:** PM2's default log rotation may be sufficient. Verify with `pm2 logs --help`. Can defer to post-MVP if not critical.

### AdminJS Production Security Hardening
Research showed basic session authentication, but production needs:
- CSRF protection (express-session + AdminJS configuration?)
- Rate limiting for /admin routes (express-rate-limit?)
- IP whitelisting at Caddy level (restrict /admin to specific IPs?)

**Mitigation:** Single admin user reduces attack surface. Admin panel is internal tool, not public-facing. Can implement post-launch if needed.

### Performance Impact of JobExecution Writes
Every cron job execution writes 2 database rows (create at start, update at end). With 11 jobs running frequently:
- YouTube sync: every 15 min = 96/day
- Spotify sync: every 30 min = 48/day
- ... 11 jobs total ≈ 500 writes/day

**Question:** Will this impact Supabase connection pool or add latency to cron jobs?

**Mitigation:** JobExecution writes are async (await prisma.jobExecution.create). Non-blocking. Prisma connection pooling handles concurrency. Monitor with pino-http request timing logs. Can disable execution tracking for low-value jobs (e.g., health check) if needed.

## Success Criteria

Research is complete when:

- [x] Domain ecosystem surveyed (admin panels, logging, job tracking patterns)
- [x] Technology stack recommended with rationale (AdminJS, Pino, Prisma schema)
- [x] Feature landscape mapped (CRUD, custom dashboard, structured logging)
- [x] Architecture patterns documented (ESM migration, AdminJS setup, job tracking wrapper)
- [x] Domain pitfalls catalogued (ESM migration risk, custom dashboard complexity)
- [x] Source hierarchy followed (npm packages verified, official docs cited)
- [x] All findings have confidence levels (HIGH for stack/integration, MEDIUM for custom dashboard)
- [x] Output files created in `.planning/research/` (STACK.md, SUMMARY.md)
- [x] SUMMARY.md includes roadmap implications (4-phase structure with rationale)
- [x] Gaps identified (ESM dependency audit, log rotation, custom dashboard learning curve)

**Quality:** Comprehensive coverage of admin panel and observability domain. Opinionated recommendations (AdminJS + Pino, not alternatives). Verified versions from npm (published dates confirm maintenance). Honest about custom dashboard uncertainty (MEDIUM confidence, fallback provided). Actionable for roadmap (clear phase structure with dependencies).

## Recommended Next Steps

1. **Pre-Flight Check (Before Phase 1):**
   - Audit existing package.json dependencies for ESM support
   - Test Prisma client in small ESM project (verify import works)
   - Check node-cron ESM compatibility (GitHub issues/docs)

2. **Phase 1 Preparation:**
   - Backup production database (Supabase snapshot)
   - Create feature branch: `feature/esm-migration`
   - Set up local testing environment (duplicate .env)
   - Document rollback plan (revert to CJS if migration fails)

3. **Risk Mitigation:**
   - Deploy Phase 1 (ESM migration) to staging/preview branch first
   - Test all 11 cron jobs manually in staging (check PM2 logs)
   - Validate OAuth flows (YouTube, Spotify, TikTok, Instagram)
   - Monitor Supabase connection pool during cron execution

4. **Defer to Later Milestones:**
   - Advanced observability (real-time dashboard updates, alerting)
   - Multi-admin support (database-backed users, RBAC)
   - Admin audit logs (track who changed what in admin panel)
   - Public-facing analytics dashboard (separate from admin panel)

These features were identified but are not necessary for MVP observability. Avoid scope creep.
