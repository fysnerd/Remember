# Domain Pitfalls: AdminJS + Observability for Express.js/Prisma Backend

**Domain:** Admin panel integration and cron job monitoring
**Researched:** 2026-02-09
**Context:** Adding AdminJS v7+ and observability to existing Express.js + Prisma backend with 11 node-cron jobs in PM2 cluster mode

---

## Critical Pitfalls

### Pitfall 1: ESM Migration Breaking Production Build

**What goes wrong:** AdminJS v7+ is ESM-only but your backend compiles to CommonJS. Direct `import AdminJS from 'adminjs'` at top-level causes runtime crashes. Build succeeds but production server fails on startup with "require() of ES Module" errors.

**Why it happens:** TypeScript with `"module": "commonjs"` transforms all imports into `require()` calls. Node.js cannot `require()` an ESM-only package. Teams assume TypeScript will handle it automatically.

**Consequences:**
- Production server crash on startup
- PM2 restart loop exhausting resources
- Hours lost debugging why dev works but production fails
- Emergency rollback required

**Prevention:**
1. **Phase 1 (Setup):** DO NOT add `"type": "module"` to package.json without full codebase audit
2. Use dynamic imports: `const AdminJS = (await import('adminjs')).default` inside async functions
3. Keep rest of codebase CommonJS initially
4. Test production build locally: `npm run build && node dist/index.js` before deploying
5. Alternative: Use [tsx](https://github.com/privatenumber/tsx) or Bun for hybrid module support

**Detection:**
- Error: `Error [ERR_REQUIRE_ESM]: require() of ES Module`
- PM2 logs show immediate restart after server start
- `npm run build` succeeds but `node dist/index.js` fails

**Phase mapping:** Setup phase (MUST be caught before production deploy)

**Sources:**
- [Migration Guide v7 | AdminJS](https://docs.adminjs.co/installation/migration-guide-v7)
- [AdminJS v7 in classic NestJS without tears](https://dev.to/arab0v/adminjs-v7-in-classic-nestjs-without-tears-23en)
- [Node.js CommonJS to ESM Migration Guide (2025)](https://glinteco.com/en/post/navigating-the-commonjs-to-esm-transition-in-nodejs-pain-points-progress-and-best-practices/)

---

### Pitfall 2: Duplicate Cron Job Execution in PM2 Cluster Mode

**What goes wrong:** Observability dashboard shows each cron job running 2-4x per schedule (once per PM2 worker). Instagram sync runs 4 times every 30 minutes instead of once, hammering API rate limits.

**Why it happens:** PM2 cluster mode spawns multiple Node.js processes (one per CPU core). Each process runs the full app including cron schedulers. If you have 4 CPUs = 4 workers = 4 copies of every cron job.

**Consequences:**
- API rate limit bans (Instagram, Spotify, YouTube)
- Database lock contention from parallel writes
- 4x cost on paid APIs (Groq Whisper, Mistral)
- Duplicate quiz generation for same content
- Monitoring dashboards show inflated job counts

**Prevention:**
1. **Phase 1 (Observability):** Check `process.env.NODE_APP_INSTANCE` in scheduler.ts:
   ```typescript
   if (process.env.NODE_APP_INSTANCE === '0') {
     // Only schedule on primary worker
     cron.schedule('*/30 * * * *', instagramSync);
   }
   ```
2. **Better:** Separate PM2 apps in ecosystem.config.js:
   ```javascript
   {
     name: 'ankora-api',
     instances: 4,  // Cluster for HTTP
   },
   {
     name: 'ankora-scheduler',
     instances: 1,  // Single instance for cron
     script: './dist/workers/scheduler.js'
   }
   ```
3. **Best:** Use distributed lock (Redis) with packages like [redlock](https://www.npmjs.com/package/redlock) or BullMQ for job queue

**Detection:**
- Backend logs show duplicate "Starting Instagram sync" entries at same timestamp
- Supabase shows 4 INSERT statements for same content URL within seconds
- External API dashboards show 4x expected request volume
- `pm2 list` shows `instances: 4` for app with cron jobs

**Phase mapping:** MUST address in Observability phase before monitoring goes live

**Sources:**
- [PM2 cluster mode - Jobs are duplicated](https://github.com/node-cron/node-cron/issues/159)
- [PM2: Run cron-job from single process in cluster mode](https://md-anjarul-islam.medium.com/pm2-run-cron-job-from-single-process-in-cluster-mode-35f44ace9e4d)
- [Handling Cronjobs in PM2 Clusters with Redis Distributed Lock](https://www.linkedin.com/pulse/handling-cronjobs-pm2-clusters-redis-distributed-lock-can-mekiko%C4%9Flu)

---

### Pitfall 3: Rate Limiter Blocking AdminJS Routes

**What goes wrong:** Admin panel becomes unusable. Every click triggers "Too many requests" errors. Pagination, filters, bulk actions all blocked by rate limiter middleware.

**Why it happens:** Backend has global rate limiter on all routes (`app.use(rateLimiter)`). AdminJS makes many rapid requests (load page → fetch resources → fetch relations → load counts). Default 100 req/15min gets exhausted instantly.

**Consequences:**
- Admin panel timeout on every page load
- Can't triage content or review user reports
- Team loses faith in admin tools
- Workaround by disabling rate limiter entirely = security vulnerability

**Prevention:**
1. **Phase 1 (Setup):** Apply rate limiter AFTER AdminJS middleware:
   ```typescript
   app.use('/admin', adminRouter); // No rate limit
   app.use(rateLimiter);            // Rate limit everything else
   app.use('/api', apiRouter);
   ```
2. **Better:** Use `skip` function in express-rate-limit:
   ```typescript
   const limiter = rateLimit({
     skip: (req) => req.path.startsWith('/admin')
   });
   ```
3. **Best:** Separate rate limits by role:
   ```typescript
   const limiter = rateLimit({
     max: async (req) => {
       const user = await getUser(req);
       return user?.role === 'admin' ? 1000 : 100;
     }
   });
   ```

**Detection:**
- Admin panel shows 429 errors in browser console
- Backend logs: `Rate limit exceeded for /admin/api/resources/users`
- AdminJS dashboard loads but tables show "Error loading data"

**Phase mapping:** Setup phase (integration testing)

**Sources:**
- [express-rate-limit - npm](https://www.npmjs.com/package/express-rate-limit)
- [Rate Limiting in Express.js | Better Stack Community](https://betterstack.com/community/guides/scaling-nodejs/rate-limiting-express/)
- [Dynamic rate-limiting middleware in Express](https://dev.to/techjayvee/dynamic-rate-limiting-middleware-in-express-5hlm)

---

### Pitfall 4: Silent Cron Job Failures

**What goes wrong:** Cron jobs fail silently for days/weeks. Team discovers Instagram sync hasn't worked in 2 weeks when users complain. No alerts, no logs, no indication of failure.

**Why it happens:** node-cron swallows unhandled exceptions inside scheduled tasks. If Instagram scraper throws error, cron catches it and continues silently. Default node-cron behavior prioritizes "keep running" over "report failures."

**Consequences:**
- Users sync Instagram but see no content
- Silent API token expiration (OAuth refresh fails)
- Missed transcriptions = no quiz generation
- Loss of user trust ("app is broken")
- Revenue impact (users churn during silent failure period)

**Prevention:**
1. **Phase 2 (Monitoring):** Wrap ALL cron task code in try-catch:
   ```typescript
   cron.schedule('*/30 * * * *', async () => {
     try {
       await instagramSync();
       logger.info('Instagram sync completed', { timestamp: Date.now() });
     } catch (error) {
       logger.error('Instagram sync failed', { error, timestamp: Date.now() });
       // Send alert (email, Slack, PagerDuty)
       await notifyFailure('instagram-sync', error);
     }
   });
   ```
2. **Add heartbeat monitoring:** Ping [healthchecks.io](https://healthchecks.io) or [cronitor.io](https://cronitor.io) after each successful run
3. **Track last success timestamp** in database:
   ```sql
   CREATE TABLE cron_heartbeats (
     job_name TEXT PRIMARY KEY,
     last_success TIMESTAMPTZ,
     last_failure TIMESTAMPTZ,
     error_message TEXT
   );
   ```
4. **Alert on staleness:** If `last_success` > 2 hours old for 30-min job → alert

**Detection:**
- Check PM2 logs: `pm2 logs remember-api | grep -i error` (but likely nothing)
- Database: No new content rows for platform despite user having linked account
- User reports: "My Instagram Reels aren't syncing"

**Phase mapping:** Monitoring phase (MUST-HAVE for production)

**Sources:**
- [How to Create a Cron Job in Node.js with Proper Error Handling](https://medium.com/@kfaizal307/how-to-create-a-cron-job-in-node-js-with-proper-error-handling-993b1439d925)
- [Exception thrown inside scheduled task is silently swallowed](https://github.com/node-cron/node-cron/issues/399)
- [Debug Silent Cron Job Failures: Complete Troubleshooting Guide 2025](https://cronmonitor.app/blog/how-debug)

---

### Pitfall 5: AdminJS N+1 Queries with Prisma Relations

**What goes wrong:** Admin panel becomes unusably slow. Loading 50 content items takes 30+ seconds. Database shows 100+ queries per page load. Supabase connection pool exhausted.

**Why it happens:** AdminJS loads resources without Prisma `include` by default. Displaying user.name for each content item triggers separate query per row (1 + N pattern). 50 rows = 1 list query + 50 user queries.

**Consequences:**
- Admin panel timeout (Caddy 60s timeout)
- Database connection pool exhaustion
- Supabase throttling/billing spike
- Can't use admin panel during business hours
- Production API requests queued behind admin queries

**Prevention:**
1. **Phase 1 (Setup):** Configure AdminJS resources with proper includes:
   ```typescript
   resources: [{
     resource: { model: dmmf.modelMap.Content, client: prisma },
     options: {
       listProperties: ['title', 'user.email', 'platform'],
       actions: {
         list: {
           before: async (request) => {
             // Force include on list queries
             request.query = {
               ...request.query,
               include: { user: true }
             };
             return request;
           }
         }
       }
     }
   }]
   ```
2. **Monitor slow queries:** Enable Prisma query logging:
   ```typescript
   const prisma = new PrismaClient({
     log: [{ level: 'query', emit: 'event' }]
   });
   prisma.$on('query', (e) => {
     if (e.duration > 100) {
       logger.warn('Slow query detected', { query: e.query, duration: e.duration });
     }
   });
   ```
3. **Use Prisma Studio for complex queries** (read-only) instead of AdminJS

**Detection:**
- Network tab shows 50+ API calls for single page load
- Backend logs show rapid-fire Prisma queries
- `pm2 monit` shows 100% CPU during admin panel usage
- Prisma query log: Repeated `findUnique({ where: { id: ... } })` calls

**Phase mapping:** Setup phase (performance testing)

**Sources:**
- [Prisma ORM Performance Optimization Tips](https://www.urhoba.net/2025/11/prisma-orm-performance-optimization-tips.html)
- [Query optimization using Prisma Optimize](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance)
- [Bug: Issue with findMany Query Filtering in AdminJS with Prisma](https://github.com/prisma/prisma/issues/21435)

---

## Moderate Pitfalls

### Pitfall 6: Missing adminJS.watch() in Development

**What goes wrong:** AdminJS admin panel loads but shows blank white screen in browser. No errors in console. Route exists, authentication works, but UI doesn't render.

**Why it happens:** In development, AdminJS requires `adminJS.watch()` to launch bundler for React components. Without it, HTML shell loads but JavaScript bundle is never built.

**Prevention:**
```typescript
if (process.env.NODE_ENV === 'development') {
  await adminJS.watch();
}
```

**Detection:**
- `/admin` route returns 200 but blank page
- Browser console: No JavaScript errors, but also no React app
- Network tab shows HTML but missing `/admin/frontend/assets/bundle.js`

**Phase mapping:** Setup phase (development environment)

**Sources:**
- [Getting started | AdminJS](https://docs.adminjs.co/installation/getting-started)
- [Prisma | AdminJS](https://docs.adminjs.co/installation/adapters/prisma)

---

### Pitfall 7: MemoryStore Session Leaks in Production

**What goes wrong:** Backend memory usage grows unbounded. PM2 eventually kills process due to OOM. Server restarts every 6-12 hours.

**Why it happens:** AdminJS defaults to in-memory session store. Sessions never expire (default = session per admin user forever). In cluster mode, sessions not shared between workers = inconsistent auth state.

**Prevention:**
1. **Use Redis for session store:**
   ```typescript
   import RedisStore from 'connect-redis';
   import { createClient } from 'redis';

   const redisClient = createClient();
   await redisClient.connect();

   const adminJs = new AdminJS({
     // ... config
   });

   const router = AdminJSExpress.buildRouter(adminJs, null, null, {
     store: new RedisStore({ client: redisClient }),
     secret: process.env.ADMIN_SESSION_SECRET,
     resave: false,
     saveUninitialized: false,
     cookie: {
       maxAge: 1000 * 60 * 60 * 24, // 24 hours
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production'
     }
   });
   ```
2. **Monitor memory:** `pm2 monit` or New Relic
3. **Set PM2 max memory restart:** `max_memory_restart: '500M'` in ecosystem.config.js

**Detection:**
- PM2 logs: `Process killed due to memory limit`
- `pm2 monit` shows linearly increasing memory
- Admin users logged out randomly (worker restarts)

**Phase mapping:** Setup phase (production configuration)

**Sources:**
- [MemoryStore is not designed for production environment](https://copyprogramming.com/howto/warning-connect-session-memorystore-is-not-designed-for-a-production-environment-as-it-will-leak-memory-and-will-not-scale-past-a-single-process)
- [Managing Node.js - Express Sessions with Redis](https://medium.com/mtholla/managing-node-js-express-sessions-with-redis-94cd099d6f2f)

---

### Pitfall 8: Prisma Client in AdminJS with PgBouncer

**What goes wrong:** AdminJS actions fail with "prepared statement already exists" or "cannot run command outside transaction" errors. Bulk operations timeout.

**Why it happens:** Supabase uses PgBouncer (transaction pooling). Prisma Client requires `?pgbouncer=true` in connection string, which disables prepared statements. AdminJS Prisma adapter may create new client instances without this flag.

**Prevention:**
1. **Use correct connection string:**
   ```env
   # For Prisma migrations (direct connection)
   DIRECT_URL="postgresql://..."

   # For Prisma Client (pooled connection)
   DATABASE_URL="postgresql://...?pgbouncer=true"
   ```
2. **Verify AdminJS uses same Prisma Client:**
   ```typescript
   import { PrismaClient } from '@prisma/client';

   // Singleton pattern
   const prisma = new PrismaClient();

   // Pass to AdminJS
   resources: [{
     resource: { model: dmmf.modelMap.Content, client: prisma },
     // Don't create new PrismaClient instances
   }]
   ```
3. **Test bulk operations** (bulk delete, bulk update) in staging

**Detection:**
- AdminJS errors: "prepared statement 'XXX' already exists"
- Prisma logs: `Error: P1001: Can't reach database server`
- Bulk operations timeout after 30s

**Phase mapping:** Setup phase (database integration testing)

**Sources:**
- [Troubleshooting prisma errors | Supabase Docs](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting)
- [Configure Prisma Client with PgBouncer](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- [Prisma with Supabase and connection pooling](https://github.com/prisma/prisma/discussions/17109)

---

### Pitfall 9: __dirname Not Defined in ESM

**What goes wrong:** If you do full ESM migration, existing code using `__dirname` breaks. File uploads, static asset serving, log file paths all fail.

**Why it happens:** `__dirname` is CommonJS global, not available in ESM. TypeScript doesn't warn about this at compile time.

**Prevention:**
1. **Recreate __dirname manually:**
   ```typescript
   import path from 'path';
   import { fileURLToPath } from 'url';

   const __filename = fileURLToPath(import.meta.url);
   const __dirname = path.dirname(__filename);
   ```
2. **Use Node.js 20.11+ native support:**
   ```typescript
   const __dirname = import.meta.dirname;
   const __filename = import.meta.filename;
   ```
3. **Search codebase first:** `grep -r "__dirname" backend/src/` before migration

**Detection:**
- Runtime error: `ReferenceError: __dirname is not defined`
- File operations fail silently (uploads go to wrong path)

**Phase mapping:** ESM migration phase (if full migration chosen)

**Sources:**
- [__dirname Is Not Defined in ES Module Scope Error Solved](https://builtin.com/articles/dirname-not-defined-es-module-scope)
- [Alternatives to __dirname in Node.js with ES modules](https://blog.logrocket.com/alternatives-dirname-node-js-es-modules/)
- [ES Modules __dirname Fix: Complete Guide (2025)](https://devin-rosario.medium.com/es-modules-dirname-fix-complete-guide-2025-b068a076712c)

---

## Minor Pitfalls

### Pitfall 10: Observability Dashboard Without Context

**What goes wrong:** Monitoring dashboard shows "job failed" but no details. Team can't debug without SSH-ing into VPS and grepping logs.

**Prevention:**
- Log structured data: `{ jobName, userId, platform, error, duration, timestamp }`
- Include correlation IDs across services
- Link to relevant content/user in logs

**Phase mapping:** Monitoring phase (dashboard design)

---

### Pitfall 11: Missing AdminJS Authentication in Production

**What goes wrong:** Admin panel accessible without login. Security audit finds open admin panel with full database access.

**Prevention:**
```typescript
const router = AdminJSExpress.buildAuthenticatedRouter(
  adminJs,
  {
    authenticate: async (email, password) => {
      // ALWAYS validate credentials, don't hardcode
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && await bcrypt.compare(password, user.passwordHash) && user.role === 'admin') {
        return user;
      }
      return null;
    },
    cookiePassword: process.env.ADMIN_COOKIE_SECRET, // Must be set
  }
);
```

**Detection:**
- Security scan tools flag `/admin` as unauthenticated
- Manual test: Open incognito window → navigate to `/admin` → no login prompt

**Phase mapping:** Setup phase (security checklist)

**Sources:**
- [Getting started | AdminJS](https://docs.adminjs.co/installation/getting-started)

---

### Pitfall 12: Monitoring Dashboard Itself Becomes Performance Bottleneck

**What goes wrong:** Adding real-time job monitoring dashboard causes more load than the jobs themselves. WebSocket connections multiply in cluster mode. Redis pub/sub overwhelms database.

**Prevention:**
- Use polling (30s intervals) not WebSockets for non-critical updates
- Aggregate metrics in Redis, not live database queries
- Pre-compute dashboard data in background job

**Phase mapping:** Monitoring phase (load testing)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Priority |
|-------------|---------------|------------|----------|
| **Phase 1: AdminJS Setup** | ESM/CJS runtime crash | Dynamic imports, test production build | CRITICAL |
| | Rate limiter blocking admin routes | Apply limiter after admin middleware | HIGH |
| | N+1 queries on relations | Configure Prisma includes | HIGH |
| | Missing watch() in dev | Add to development startup | MEDIUM |
| | Session memory leaks | Use Redis store from start | MEDIUM |
| **Phase 2: Observability** | Duplicate cron execution | Check NODE_APP_INSTANCE or split apps | CRITICAL |
| | Silent cron failures | Wrap in try-catch + heartbeat monitoring | CRITICAL |
| | Dashboard becomes bottleneck | Pre-aggregate metrics, use polling | MEDIUM |
| **Phase 3: Production Deploy** | PgBouncer connection issues | Use ?pgbouncer=true flag | HIGH |
| | Missing admin authentication | Use buildAuthenticatedRouter | HIGH |

---

## Pre-Implementation Checklist

Before starting AdminJS integration:
- [ ] Decide: Full ESM migration or dynamic imports?
- [ ] Audit codebase for `__dirname` usage (if ESM)
- [ ] Choose session store (Redis recommended)
- [ ] Plan PM2 architecture (single app with instance check OR separate scheduler app)
- [ ] Set up error tracking (Sentry/LogRocket) before cron changes
- [ ] Create staging environment with production PM2 config
- [ ] Document expected cron job frequencies for alerting thresholds

Before going to production:
- [ ] Test admin panel with rate limiter enabled
- [ ] Load test admin panel (50+ rows with relations)
- [ ] Verify cron jobs run ONCE per schedule in cluster mode
- [ ] Set up external heartbeat monitoring (healthchecks.io)
- [ ] Test admin authentication in incognito window
- [ ] Verify PgBouncer connection string
- [ ] Set PM2 max memory restart limits
- [ ] Document admin panel credentials in team password manager

---

## Sources by Confidence Level

### HIGH Confidence (Official docs + multiple verified sources)
- [Migration Guide v7 | AdminJS](https://docs.adminjs.co/installation/migration-guide-v7)
- [PM2 cluster mode - Jobs are duplicated](https://github.com/node-cron/node-cron/issues/159)
- [express-rate-limit - npm](https://www.npmjs.com/package/express-rate-limit)
- [Configure Prisma Client with PgBouncer](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- [Troubleshooting prisma errors | Supabase Docs](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting)

### MEDIUM Confidence (Community articles + multiple sources agree)
- [AdminJS v7 in classic NestJS without tears](https://dev.to/arab0v/adminjs-v7-in-classic-nestjs-without-tears-23en)
- [PM2: Run cron-job from single process in cluster mode](https://md-anjarul-islam.medium.com/pm2-run-cron-job-from-single-process-in-cluster-mode-35f44ace9e4d)
- [How to Create a Cron Job in Node.js with Proper Error Handling](https://medium.com/@kfaizal307/how-to-create-a-cron-job-in-node-js-with-proper-error-handling-993b1439d925)
- [Managing Node.js - Express Sessions with Redis](https://medium.com/mtholla/managing-node-js-express-sessions-with-redis-94cd099d6f2f)

### LOW Confidence (Single source or requires validation)
- Community discussions on GitHub issues (used for problem identification, not solutions)
