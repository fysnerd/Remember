# Technology Stack

**Project:** Ankora - Admin Panel & Observability
**Researched:** 2026-02-09

## Recommended Stack

### Core Admin Panel
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| AdminJS | 7.8.17 | Auto-generated admin panel | Official ESM-only v7 with Prisma adapter, mature React-based UI, comprehensive CRUD, active maintenance |
| @adminjs/express | 6.1.1 | AdminJS Express adapter | Official Express plugin with auth provider support (v6.1.0+), session-based authentication, production-ready |
| @adminjs/prisma | 5.0.4 | AdminJS Prisma adapter | Official adapter for Prisma ORM, automatic resource detection from schema, type-safe integration |

**Rationale:** AdminJS v7+ is the standard solution for Node.js admin panels in 2026. Provides auto-generated CRUD interfaces from Prisma schema with minimal configuration. ESM-only requirement aligns with modern Node.js patterns. The official adapters ensure tight integration and ongoing support.

**Confidence:** HIGH - Official packages, recent releases (adminjs: 7 months ago, @adminjs/express: 1 year ago, @adminjs/prisma: 5 months ago), verified from [npm adminjs](https://www.npmjs.com/package/adminjs), [@adminjs/express](https://www.npmjs.com/package/@adminjs/express), [@adminjs/prisma](https://www.npmjs.com/package/@adminjs/prisma)

### Authentication
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| express-session | 1.19.0 | Session management | Required by AdminJS auth, widely adopted Express middleware, active maintenance (published 17 days ago as of 2026-02) |

**Rationale:** AdminJS authentication requires `AdminJSExpress.buildAuthenticatedRouter()` with express-session for session persistence. Hardcoded credentials approach shown in [AdminJS docs](https://docs.adminjs.co/basics/authentication) is sufficient for single admin use case. No need for database-backed user management.

**Confidence:** HIGH - Official requirement, current version verified from [npm express-session](https://www.npmjs.com/package/express-session)

### Logging & Observability
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pino | 10.3.0 | Structured JSON logging | Industry standard for Node.js, 5x faster than Winston, async I/O prevents event loop blocking, NDJSON format for machine parsing |
| pino-http | latest | HTTP request/response logging | Official Express middleware, automatic request ID generation, fastest HTTP logger per [pino-http docs](https://github.com/pinojs/pino-http) |
| pino-pretty | 13.1.3 | Development log formatting | Human-readable colorized output for dev, NOT for production (adds overhead) |

**Rationale:** Pino is the 2026 standard for high-performance logging in Node.js. Async logging prevents cron job delays. NDJSON output enables easy parsing for observability dashboards. Replace all `console.log` calls with structured pino logging.

**Confidence:** HIGH - Current versions verified from [npm pino](https://www.npmjs.com/package/pino) (published 16 days ago), [npm pino-pretty](https://www.npmjs.com/package/pino-pretty) (published 2 months ago), performance claims verified across multiple sources ([Better Stack](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/), [SigNoz](https://signoz.io/guides/pino-logger/))

### Job Execution Tracking
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Prisma ORM | existing | Job execution history schema | Already in stack, type-safe migrations, admin panel auto-generates CRUD from schema |

**Schema Extension Needed:**
```prisma
model JobExecution {
  id          String   @id @default(cuid())
  jobName     String   // e.g. "youtube-sync", "quiz-generation"
  status      String   // "running", "success", "error"
  startedAt   DateTime @default(now())
  completedAt DateTime?
  duration    Int?     // milliseconds
  itemsProcessed Int?  // e.g. videos synced, quizzes generated
  errorMessage String? @db.Text
  errorStack   String? @db.Text
  metadata    Json?    // job-specific details

  @@index([jobName, startedAt])
  @@index([status])
}
```

**Rationale:** Persist all job executions to database for historical analysis and debugging. Inspired by [pg_cron's job_run_details pattern](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL_pg_cron.html). AdminJS will auto-generate CRUD interface. Enable filtering/sorting by job name, status, date ranges.

**Cleanup Strategy:** Schedule a daily cleanup job to delete records older than 30 days, similar to [pg_cron best practices](https://postgres.hashnode.dev/project-openinsight-analyze-the-history-of-postgres-pgcron-jobs).

**Confidence:** HIGH - Established pattern from pg_cron, Prisma already in stack

### Custom Dashboard (Observability)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 18.x | AdminJS custom dashboard component | AdminJS uses React, custom dashboard requires React component per [AdminJS dashboard customization docs](https://docs.adminjs.co/ui-customization/dashboard-customization) |
| Recharts | 2.x | Timeline/stats visualization | Lightweight React-native charting, declarative components, widely adopted in 2026 per [Syncfusion blog](https://www.syncfusion.com/blogs/post/top-5-react-chart-libraries) |

**Custom Dashboard Features:**
- Real-time job status (running/idle)
- Last 24h execution timeline (success/error bars)
- Job success rates (last 100 runs per job)
- Recent errors (last 10 failures with links to JobExecution records)

**Rationale:** AdminJS allows custom dashboard pages via `AdminJS.bundle()` and ComponentLoader. React component fetches data from custom API endpoint (`/api/admin/dashboard/stats`). Recharts provides simple timeline/bar charts without heavy dependencies.

**Confidence:** MEDIUM - AdminJS custom dashboard pattern confirmed in [official blog](https://adminjs.co/blog/how-to-build-a-custom-admin-dashboard-interface-with-react-node-js-and-adminjs), but implementation details require trial. Recharts is proven solution.

## Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsconfig-paths | latest | TypeScript path mapping for ESM | If using `@/*` imports in ESM project, helps resolve paths in compiled .js files |

**Note:** ESM projects require `"type": "module"` in package.json and `.js` extensions in import statements even when importing `.ts` files, per [TypeScript ESM docs](https://www.typescriptlang.org/docs/handbook/esm-node.html).

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Admin Panel | AdminJS | Strapi Admin, Directus, KeystoneJS | AdminJS is lighter, integrates directly with existing Express app without separate CMS layer. Strapi/Directus are full CMSs (overkill). KeystoneJS less mature for Prisma. |
| Logging | Pino | Winston | Pino is 5x faster per [SigNoz comparison](https://signoz.io/guides/pino-logger/), async by default. Winston requires manual async config. |
| Job Persistence | Prisma schema | Agenda (MongoDB), BullMQ | Ankora already uses PostgreSQL + Prisma. Agenda requires MongoDB (new dependency). BullMQ is for queues, not cron history tracking. Keep stack simple. |
| Charting | Recharts | Chart.js, Victory, Nivo | Recharts has best React integration (declarative components). Chart.js uses Canvas (less React-native). Victory/Nivo heavier. |
| Auth | Hardcoded credentials | JWT, OAuth, Prisma user table | Single admin user, internal tool, VPS firewall-protected. Hardcoded is simplest. Database users add complexity for no value. |

## Migration Requirements (CJS → ESM)

AdminJS v7 requires full ESM migration. Current Ankora backend uses CommonJS.

### package.json Changes
```json
{
  "type": "module",
  "scripts": {
    "start": "node dist/index.js"
  }
}
```

### tsconfig.json Changes
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ESNext",
    "moduleResolution": "nodenext"
  }
}
```

### Code Changes
1. Replace all `require()` with `import`
2. Replace all `module.exports` with `export`
3. Add `.js` extensions to relative imports: `import { foo } from './utils.js'` (even for `.ts` files)
4. Use `import.meta.url` instead of `__dirname`

**Rationale:** [AdminJS v7 migration guide](https://docs.adminjs.co/installation/migration-guide-v7) states "AdminJS has fully moved to ESM and will no longer support CJS projects." This is a breaking change. All modules must be ESM-compatible.

**Confidence:** HIGH - Official requirement, migration pattern verified from [TypeScript ESM guide](https://www.typescriptlang.org/docs/handbook/esm-node.html) and [Node.js ESM docs](https://nodejs.org/api/esm.html)

## Installation

### Step 1: Migrate to ESM
```bash
# Update package.json
npm pkg set type=module

# Update tsconfig.json (manually - see above)
```

### Step 2: Install Admin Panel
```bash
npm install adminjs@7.8.17 @adminjs/express@6.1.1 @adminjs/prisma@5.0.4 express-session@1.19.0
```

### Step 3: Install Logging
```bash
npm install pino@10.3.0 pino-http
npm install -D pino-pretty@13.1.3  # dev only
```

### Step 4: Install Dashboard Dependencies
```bash
npm install recharts
```

### Step 5: Add JobExecution Model
```bash
# Add schema to prisma/schema.prisma (see above)
npx prisma migrate dev --name add_job_execution
npx prisma generate
```

## Environment Variables

Add to `.env`:

```env
# Admin Panel
ADMIN_EMAIL=admin@ankora.study
ADMIN_PASSWORD=<strong-password>
ADMIN_SESSION_SECRET=<64-char-random-string>

# Logging
LOG_LEVEL=info  # debug in dev, info in prod
NODE_ENV=production
```

**Security Note:** Store admin password in env var, not hardcoded. Use `process.env.ADMIN_PASSWORD` in authenticate function.

## Integration Points

### 1. Wrap Cron Jobs with Execution Tracking

**Before:**
```typescript
async function syncYouTube() {
  console.log('Starting YouTube sync');
  // sync logic
  console.log('YouTube sync complete');
}
```

**After:**
```typescript
import { prisma } from './database.js';
import { logger } from './logger.js';

async function syncYouTube() {
  const execution = await prisma.jobExecution.create({
    data: {
      jobName: 'youtube-sync',
      status: 'running'
    }
  });

  const startTime = Date.now();
  let itemsProcessed = 0;

  try {
    logger.info({ jobName: 'youtube-sync', executionId: execution.id }, 'Starting YouTube sync');

    // sync logic
    itemsProcessed = 42; // track count

    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        status: 'success',
        completedAt: new Date(),
        duration: Date.now() - startTime,
        itemsProcessed
      }
    });

    logger.info({ jobName: 'youtube-sync', executionId: execution.id, itemsProcessed }, 'YouTube sync complete');
  } catch (error) {
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        status: 'error',
        completedAt: new Date(),
        duration: Date.now() - startTime,
        errorMessage: error.message,
        errorStack: error.stack
      }
    });

    logger.error({ err: error, jobName: 'youtube-sync', executionId: execution.id }, 'YouTube sync failed');
  }
}
```

**Rationale:** Every cron job execution is now tracked, logged, and visible in admin panel. Structured logging enables grep/filter in PM2 logs. Error stack traces preserved for debugging.

### 2. AdminJS Setup

```typescript
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Database, Resource } from '@adminjs/prisma';
import { PrismaClient } from '@prisma/client';
import { DMMFClass } from '@prisma/client/runtime/library.js';
import express from 'express';
import session from 'express-session';

AdminJS.registerAdapter({ Database, Resource });

const prisma = new PrismaClient();
const dmmf = (prisma as any)._dmmf as DMMFClass;

const adminOptions = {
  resources: [
    {
      resource: { model: dmmf.modelMap.JobExecution, client: prisma },
      options: {
        navigation: { name: 'Monitoring', icon: 'Activity' },
        listProperties: ['jobName', 'status', 'startedAt', 'duration', 'itemsProcessed'],
        sort: { sortBy: 'startedAt', direction: 'desc' as const }
      }
    },
    {
      resource: { model: dmmf.modelMap.User, client: prisma },
      options: { navigation: { name: 'Users', icon: 'Users' } }
    },
    // ... other Prisma models
  ],
  rootPath: '/admin',
  branding: {
    companyName: 'Ankora Admin',
    logo: false
  }
};

const admin = new AdminJS(adminOptions);

const authenticate = async (email: string, password: string) => {
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    return { email };
  }
  return null;
};

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(admin, {
  authenticate,
  cookieName: 'adminjs',
  cookiePassword: process.env.ADMIN_SESSION_SECRET
}, null, {
  secret: process.env.ADMIN_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS in prod
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
});

app.use(admin.options.rootPath, adminRouter);
```

**Access:** `https://api.ankora.study/admin` (behind Caddy HTTPS)

**Confidence:** HIGH - Pattern from [AdminJS Express docs](https://docs.adminjs.co/installation/plugins/express) and [authentication guide](https://docs.adminjs.co/basics/authentication)

### 3. Pino Logger Setup

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined
});
```

```typescript
// index.ts (Express app)
import pinoHttp from 'pino-http';
import { logger } from './lib/logger.js';

app.use(pinoHttp({ logger }));
```

**Rationale:** Structured logging with request ID correlation. pino-pretty only in dev (no production overhead). HTTP requests auto-logged with timing.

**Confidence:** HIGH - Standard pattern from [Pino docs](https://github.com/pinojs/pino) and [Better Stack guide](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/)

## Deployment Considerations

### PM2 Logs with Pino
PM2 captures stdout/stderr. Pino writes JSON to stdout. No conflicts.

**View logs:**
```bash
ssh root@116.203.17.203 "pm2 logs remember-api --lines 100 --nostream"
```

**Filter by job:**
```bash
ssh root@116.203.17.203 "pm2 logs remember-api --lines 1000 --nostream | grep youtube-sync"
```

### Caddy Configuration
No changes needed. Admin panel served at `/admin` on existing `api.ankora.study` domain.

### Database Growth
JobExecution table will grow ~500 records/day (11 jobs × ~45 runs/day each). At 30 days retention: ~15k records (negligible PostgreSQL impact).

**Cleanup job:**
```typescript
cron.schedule('0 3 * * *', async () => { // 3 AM daily
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const deleted = await prisma.jobExecution.deleteMany({
    where: { startedAt: { lt: thirtyDaysAgo } }
  });
  logger.info({ deletedCount: deleted.count }, 'Cleaned up old job executions');
});
```

## Known Limitations

### AdminJS Custom Dashboard Complexity
Custom React dashboard requires bundling with AdminJS ComponentLoader. Moderate learning curve. If too complex, fallback: add custom Express endpoint `/admin-stats` with simple HTML/Chart.js page (no AdminJS integration).

**Confidence:** LOW - AdminJS custom dashboard is documented but implementation details sparse. May require experimentation. Fallback strategy mitigates risk.

### ESM Migration Breaking Changes
Migrating from CJS to ESM touches every file with imports. High risk of runtime errors if any dependency doesn't support ESM. Thorough testing required.

**Mitigation:** Test all cron jobs, OAuth flows, API endpoints after migration. Keep PM2 restart policy (`max_restarts: 10`).

**Confidence:** MEDIUM - ESM migration is well-documented but touches entire codebase. Testing critical.

### No Real-Time Dashboard Updates
Custom dashboard requires page refresh to see latest job executions. WebSocket/SSE for live updates adds significant complexity.

**Decision:** Page refresh is acceptable for admin tool. Add "Refresh" button. Avoid WebSocket overhead.

**Confidence:** HIGH - Tradeoff decision based on simplicity > real-time

## Sources

### High Confidence (Official Docs & Package Registries)
- [AdminJS npm](https://www.npmjs.com/package/adminjs) - v7.8.17 verified
- [@adminjs/express npm](https://www.npmjs.com/package/@adminjs/express) - v6.1.1 verified
- [@adminjs/prisma npm](https://www.npmjs.com/package/@adminjs/prisma) - v5.0.4 verified
- [express-session npm](https://www.npmjs.com/package/express-session) - v1.19.0 verified
- [pino npm](https://www.npmjs.com/package/pino) - v10.3.0 verified
- [pino-pretty npm](https://www.npmjs.com/package/pino-pretty) - v13.1.3 verified
- [AdminJS Migration Guide v7](https://docs.adminjs.co/installation/migration-guide-v7) - ESM requirement
- [AdminJS Prisma Adapter Docs](https://docs.adminjs.co/installation/adapters/prisma) - Setup pattern
- [AdminJS Authentication Docs](https://docs.adminjs.co/basics/authentication) - Hardcoded credentials example
- [TypeScript ESM Handbook](https://www.typescriptlang.org/docs/handbook/esm-node.html) - Import extensions
- [Node.js ESM Documentation](https://nodejs.org/api/esm.html) - "type": "module" requirement

### Medium Confidence (Recent Guides & Comparisons)
- [Better Stack: Pino Guide 2026](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/) - Performance claims
- [SigNoz: Pino Logger Complete Guide](https://signoz.io/guides/pino-logger/) - Pino 5x faster than Winston
- [AdminJS Blog: Custom Dashboard](https://adminjs.co/blog/how-to-build-a-custom-admin-dashboard-interface-with-react-node-js-and-adminjs) - Implementation pattern
- [AdminJS Dashboard Customization Docs](https://docs.adminjs.co/ui-customization/dashboard-customization) - React component approach
- [AWS RDS: pg_cron Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL_pg_cron.html) - job_run_details pattern
- [Syncfusion: Top React Chart Libraries 2026](https://www.syncfusion.com/blogs/post/top-5-react-chart-libraries) - Recharts recommendation
- [GitHub: pino-http](https://github.com/pinojs/pino-http) - Express middleware

### Low Confidence (WebSearch Only - Need Verification)
- [DEV Community: Cron Job Monitoring 2026](https://dev.to/cronmonitor/how-to-monitor-cron-jobs-in-2026-a-complete-guide-28g9) - node-cron lacks persistence
- [GitHub: node-cron Issue #340](https://github.com/node-cron/node-cron/issues/340) - Job persistence discussion
