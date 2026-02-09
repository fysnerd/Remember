# Architecture Patterns

**Domain:** Admin Panel + Observability Dashboard for Express.js Backend
**Researched:** 2026-02-09

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Express.js App                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐      ┌──────────────────┐     ┌─────────────┐ │
│  │  API       │      │  AdminJS         │     │  Job        │ │
│  │  Routes    │◄────►│  Router          │◄───►│  Execution  │ │
│  │            │      │  (ESM Module)    │     │  Tracker    │ │
│  └────────────┘      └──────────────────┘     └─────────────┘ │
│       │                      │                       │         │
│       │                      │                       │         │
│       ▼                      ▼                       ▼         │
│  ┌────────────┐      ┌──────────────────┐     ┌─────────────┐ │
│  │  Auth      │      │  Custom          │     │  node-cron  │ │
│  │  Middleware│      │  Dashboard       │     │  Scheduler  │ │
│  │            │      │  Component       │     │  (wrapped)  │ │
│  └────────────┘      └──────────────────┘     └─────────────┘ │
│                             │                       │         │
│                             │                       │         │
│                             ▼                       ▼         │
│                      ┌──────────────────┐     ┌─────────────┐ │
│                      │  Dashboard       │     │  Job        │ │
│                      │  Handler         │     │  Worker     │ │
│                      │  (API Endpoint)  │     │  Functions  │ │
│                      └──────────────────┘     └─────────────┘ │
│                             │                       │         │
└─────────────────────────────┼───────────────────────┼─────────┘
                              │                       │
                              ▼                       ▼
                      ┌──────────────────────────────────┐
                      │        Prisma ORM                │
                      └──────────────────────────────────┘
                              │
                              ▼
                      ┌──────────────────────────────────┐
                      │   PostgreSQL (Supabase)          │
                      │                                  │
                      │   Tables:                        │
                      │   - User                         │
                      │   - Content                      │
                      │   - Quiz                         │
                      │   - JobExecution (NEW)          │
                      │   - JobError (NEW)              │
                      └──────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Isolation Level |
|-----------|---------------|-------------------|-----------------|
| **AdminJS Router** | CRUD UI for Prisma models, mount at `/admin` | Prisma via @adminjs/prisma adapter, Custom Dashboard Component | ESM-only module, dynamically imported |
| **Custom Dashboard Component** | React component displaying job metrics/timeline/errors | Dashboard Handler (backend API), AdminJS ApiClient | Bundled via AdminJS.bundle(), no direct DB access |
| **Dashboard Handler** | REST endpoint returning job statistics/recent executions | JobExecution/JobError models via Prisma | Mounted at AdminJS pages[].handler |
| **Job Execution Tracker** | Wrapper around node-cron jobs, logs to DB | Prisma (JobExecution/JobError), node-cron scheduler | Decorator pattern, called by scheduler |
| **node-cron Scheduler** | Triggers jobs on schedule, prevents overlap | Job Worker Functions, Job Execution Tracker | Existing scheduler.ts with runningJobs Set |
| **Job Worker Functions** | Business logic (sync, transcription, quiz gen) | External APIs, Prisma models | Wrapped by tracker, no direct awareness of logging |
| **Prisma ORM** | Data access layer | PostgreSQL database | Schema includes new JobExecution/JobError models |
| **Auth Middleware** | Protects admin routes | AdminJS Router, API Routes | JWT-based, reusable across both admin and API |

### Data Flow

#### 1. Job Execution Flow (Runtime)
```
Cron trigger → Scheduler checks runningJobs Set → Job Execution Tracker starts
→ Creates JobExecution record (status: RUNNING, startTime)
→ Calls wrapped Worker Function
→ [Success] Updates JobExecution (status: SUCCESS, endTime, result)
→ [Failure] Creates JobError record, updates JobExecution (status: FAILED)
→ Scheduler removes from runningJobs Set
```

#### 2. Admin Dashboard View Flow (User Request)
```
User opens /admin/dashboard → AdminJS serves Custom Dashboard Component
→ Component mounts, calls ApiClient.getDashboardData()
→ Dashboard Handler queries Prisma (JobExecution.findMany, JobError.findMany)
→ Aggregates stats (success rate, avg duration, recent failures)
→ Returns JSON → Component renders charts/tables with @adminjs/design-system
```

#### 3. CRUD Operations Flow (AdminJS Auto-generated)
```
User clicks "Users" in admin sidebar → AdminJS Prisma adapter generates UI
→ User edits record → AdminJS sends POST to auto-generated endpoint
→ @adminjs/prisma adapter calls Prisma ORM → PostgreSQL update
→ AdminJS returns success → UI updates
```

#### 4. Manual Job Trigger Flow (Existing)
```
POST /api/admin/sync/all → Auth Middleware validates JWT
→ Controller imports worker function → Executes directly (bypasses scheduler)
→ Job Execution Tracker still wraps execution → Logs to JobExecution model
```

## Patterns to Follow

### Pattern 1: Job Execution Wrapper (Decorator Pattern)
**What:** Wrap all node-cron job functions with execution tracking logic
**When:** Every job scheduled in scheduler.ts
**Why:** Centralized logging, DRY principle, transparent to worker functions

**Example:**
```typescript
// backend/src/services/jobTracker.ts
import prisma from '../config/database';

export async function trackJobExecution<T>(
  jobName: string,
  jobFn: () => Promise<T>
): Promise<T> {
  const execution = await prisma.jobExecution.create({
    data: {
      jobName,
      status: 'RUNNING',
      startTime: new Date(),
    },
  });

  try {
    const result = await jobFn();

    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        status: 'SUCCESS',
        endTime: new Date(),
        result: JSON.stringify(result),
      },
    });

    return result;
  } catch (error) {
    await prisma.jobError.create({
      data: {
        jobExecutionId: execution.id,
        errorMessage: error.message,
        stackTrace: error.stack,
      },
    });

    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        status: 'FAILED',
        endTime: new Date(),
      },
    });

    throw error;
  }
}

// backend/src/workers/scheduler.ts (modified)
import { trackJobExecution } from '../services/jobTracker';
import { syncYouTube } from './youtubeSync';

cron.schedule('*/15 * * * *', async () => {
  if (runningJobs.has('youtube-sync')) return;
  runningJobs.add('youtube-sync');

  try {
    await trackJobExecution('youtube-sync', syncYouTube);
  } finally {
    runningJobs.delete('youtube-sync');
  }
});
```

**Benefits:**
- Worker functions unchanged (single responsibility)
- Consistent logging across all jobs
- Easy to add metrics (duration, retries, etc.)
- Error context preserved (stack traces)

### Pattern 2: AdminJS ESM Dynamic Import
**What:** Use dynamic import() to load ESM-only AdminJS in CommonJS Express app
**When:** Ankora backend is likely CommonJS (tsconfig.json determines this)
**Why:** AdminJS v7 is ESM-only, cannot use require()

**Example:**
```typescript
// backend/src/index.ts (CommonJS)
const express = require('express');
const app = express();

// Dynamic import AdminJS (ESM)
(async () => {
  const { default: AdminJS } = await import('adminjs');
  const AdminJSExpress = await import('@adminjs/express');
  const { Database, Resource } = await import('@adminjs/prisma');
  const { PrismaClient } = require('@prisma/client');

  AdminJS.registerAdapter({ Database, Resource });
  const prisma = new PrismaClient();

  const adminJs = new AdminJS({
    resources: [
      { resource: { model: prisma.user, client: prisma }, options: {} },
      { resource: { model: prisma.content, client: prisma }, options: {} },
      // ... other models
    ],
    pages: {
      dashboard: {
        component: AdminJS.bundle('./components/Dashboard.tsx'),
        handler: async (req, res) => {
          const stats = await getJobStats(); // See Pattern 3
          res.json(stats);
        },
      },
    },
  });

  const router = AdminJSExpress.buildRouter(adminJs);
  app.use('/admin', router);

  app.listen(3001);
})();
```

**Alternative (if project can migrate to ESM):**
```typescript
// backend/src/index.ts (ESM)
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
// ... standard ESM imports
```

**Migration Decision Point:** Check `package.json` for `"type": "module"` and `tsconfig.json` for `"module": "ES2022"`. If not present, use dynamic imports.

### Pattern 3: Dashboard Handler with Aggregations
**What:** Backend handler that aggregates job statistics efficiently
**When:** Custom dashboard page needs metrics (success rate, avg duration, errors)
**Why:** Avoid sending raw data to frontend, reduce payload size

**Example:**
```typescript
// backend/src/routes/admin.ts
import { subHours } from 'date-fns';

export async function getDashboardStats() {
  const last24h = subHours(new Date(), 24);

  // Parallel queries for performance
  const [totalJobs, failedJobs, avgDuration, recentErrors, jobTimeline] =
    await Promise.all([
      prisma.jobExecution.count({
        where: { startTime: { gte: last24h } },
      }),
      prisma.jobExecution.count({
        where: {
          startTime: { gte: last24h },
          status: 'FAILED',
        },
      }),
      prisma.jobExecution.aggregate({
        where: {
          startTime: { gte: last24h },
          status: 'SUCCESS',
        },
        _avg: {
          duration: true, // Computed field: endTime - startTime
        },
      }),
      prisma.jobError.findMany({
        where: {
          jobExecution: { startTime: { gte: last24h } },
        },
        include: { jobExecution: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.$queryRaw`
        SELECT
          DATE_TRUNC('hour', "startTime") as hour,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as successes,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failures
        FROM "JobExecution"
        WHERE "startTime" >= ${last24h}
        GROUP BY hour
        ORDER BY hour DESC
      `,
    ]);

  return {
    summary: {
      total: totalJobs,
      failed: failedJobs,
      successRate: ((totalJobs - failedJobs) / totalJobs * 100).toFixed(2),
      avgDuration: avgDuration._avg.duration,
    },
    recentErrors: recentErrors.map(e => ({
      job: e.jobExecution.jobName,
      time: e.createdAt,
      message: e.errorMessage,
    })),
    timeline: jobTimeline,
  };
}
```

**Benefits:**
- Single database connection for multiple queries (Prisma connection pooling)
- Aggregations on database side (faster than client-side)
- Structured response ready for visualization
- Raw SQL for complex aggregations (hourly breakdown)

### Pattern 4: AdminJS ApiClient Usage in Custom Component
**What:** Use AdminJS's built-in ApiClient for backend communication
**When:** Custom React dashboard needs to fetch data from handler
**Why:** Automatic auth header injection, consistent error handling

**Example:**
```typescript
// backend/src/components/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { ApiClient, useNotice } from 'adminjs';
import { Box, H3, Table, TableRow, TableCell } from '@adminjs/design-system';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState(null);
  const addNotice = useNotice();
  const api = new ApiClient();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.getDashboardData();
        setStats(response.data);
      } catch (error) {
        addNotice({
          message: 'Failed to load dashboard data',
          type: 'error',
        });
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <Box>Loading...</Box>;

  return (
    <Box padding="xxl">
      <H3>Job Execution Dashboard (Last 24h)</H3>

      <Box display="grid" gridTemplateColumns="1fr 1fr 1fr 1fr" gap="lg">
        <Box bg="grey20" padding="lg">
          <div>Total Jobs</div>
          <H3>{stats.summary.total}</H3>
        </Box>
        <Box bg="grey20" padding="lg">
          <div>Success Rate</div>
          <H3>{stats.summary.successRate}%</H3>
        </Box>
        <Box bg="grey20" padding="lg">
          <div>Failures</div>
          <H3>{stats.summary.failed}</H3>
        </Box>
        <Box bg="grey20" padding="lg">
          <div>Avg Duration</div>
          <H3>{stats.summary.avgDuration}s</H3>
        </Box>
      </Box>

      <Box marginTop="xxl">
        <H3>Recent Errors</H3>
        <Table>
          {stats.recentErrors.map((error, idx) => (
            <TableRow key={idx}>
              <TableCell>{error.job}</TableCell>
              <TableCell>{new Date(error.time).toLocaleString()}</TableCell>
              <TableCell>{error.message}</TableCell>
            </TableRow>
          ))}
        </Table>
      </Box>
    </Box>
  );
};

export default Dashboard;
```

**Key Points:**
- `ApiClient.getDashboardData()` calls the handler defined in pages[].handler
- Use `@adminjs/design-system` components for consistent styling
- `useNotice()` hook for user-friendly error messages
- Auto-refresh with setInterval for real-time monitoring

### Pattern 5: Prisma Schema for Job Tracking
**What:** Database models for capturing job execution metadata
**When:** Adding observability to existing schema
**Why:** Queryable history, relationship with errors, scalable

**Example:**
```prisma
// backend/prisma/schema.prisma
model JobExecution {
  id          String      @id @default(cuid())
  jobName     String      // e.g., "youtube-sync", "quiz-generation"
  status      JobStatus   // RUNNING, SUCCESS, FAILED
  startTime   DateTime    @default(now())
  endTime     DateTime?
  result      Json?       // Serialized result data
  errors      JobError[]

  @@index([jobName, startTime])
  @@index([status, startTime])
  @@map("job_executions")
}

model JobError {
  id             String        @id @default(cuid())
  jobExecutionId String
  errorMessage   String
  stackTrace     String?       @db.Text
  createdAt      DateTime      @default(now())

  jobExecution   JobExecution  @relation(fields: [jobExecutionId], references: [id], onDelete: Cascade)

  @@index([jobExecutionId])
  @@map("job_errors")
}

enum JobStatus {
  RUNNING
  SUCCESS
  FAILED
}
```

**Design Decisions:**
- `jobName` as String (not enum) → flexible for adding new jobs without migration
- `result` as Json → store success metadata (e.g., "synced 12 items")
- Cascading delete on JobError → cleanup when pruning old executions
- Composite indexes for common queries (job history, failure analysis)
- `endTime` nullable → detect stuck jobs (RUNNING but endTime is old)

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mixing AdminJS Auth with Existing JWT Auth
**What:** Creating separate auth systems for admin panel vs API
**Why bad:** User confusion, dual session management, security gaps
**Instead:** Reuse existing JWT middleware for AdminJS

```typescript
// ❌ BAD: Separate AdminJS auth
const adminRouter = AdminJSExpress.buildAuthenticatedRouter(adminJs, {
  authenticate: async (email, password) => {
    // Separate login logic
  },
  cookiePassword: 'separate-secret',
});

// ✅ GOOD: Reuse JWT middleware
import { authenticateToken } from './middleware/auth';

const adminRouter = AdminJSExpress.buildRouter(adminJs);
app.use('/admin', authenticateToken, adminRouter);
```

### Anti-Pattern 2: Polling Dashboard Instead of Aggregations
**What:** Fetching all JobExecution records to frontend, computing stats in React
**Why bad:** Massive payloads (thousands of records), slow rendering, database overload
**Instead:** Aggregate on backend, send summary (see Pattern 3)

```typescript
// ❌ BAD: Send all records
const allJobs = await prisma.jobExecution.findMany();
res.json(allJobs); // 10MB response

// ✅ GOOD: Aggregate first
const stats = await prisma.jobExecution.groupBy({
  by: ['jobName', 'status'],
  _count: true,
});
res.json(stats); // 5KB response
```

### Anti-Pattern 3: Directly Modifying Worker Functions for Logging
**What:** Adding try/catch + Prisma calls inside each worker function
**Why bad:** Violates single responsibility, duplicated code, hard to maintain
**Instead:** Wrapper pattern (Pattern 1)

```typescript
// ❌ BAD: Logging inside worker
export async function syncYouTube() {
  const execution = await prisma.jobExecution.create({ ... });
  try {
    // actual sync logic
    await prisma.jobExecution.update({ ... });
  } catch (error) {
    await prisma.jobError.create({ ... });
  }
}

// ✅ GOOD: Wrapper handles logging
export async function syncYouTube() {
  // Pure business logic, no logging
  const videos = await fetchVideos();
  await saveVideos(videos);
}

// Wrapper in scheduler.ts
await trackJobExecution('youtube-sync', syncYouTube);
```

### Anti-Pattern 4: Using require() for AdminJS v7
**What:** Attempting `const AdminJS = require('adminjs')` in CommonJS project
**Why bad:** AdminJS v7 is ESM-only, will throw `ERR_REQUIRE_ESM`
**Instead:** Dynamic import (Pattern 2) or migrate project to ESM

### Anti-Pattern 5: Storing Full Error Objects in Database
**What:** Serializing entire Error object including all properties
**Why bad:** Circular references, non-serializable properties, bloated storage
**Instead:** Extract message and stack only

```typescript
// ❌ BAD: Full error object
await prisma.jobError.create({
  data: {
    error: JSON.stringify(error), // May fail or store garbage
  },
});

// ✅ GOOD: Extract relevant fields
await prisma.jobError.create({
  data: {
    errorMessage: error.message,
    stackTrace: error.stack,
    errorType: error.constructor.name,
  },
});
```

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **JobExecution Table Size** | ~50K rows/month (11 jobs, mixed intervals) | Same (job count unchanged) | Same, but add partitioning by month |
| **Dashboard Query Performance** | Direct Prisma queries (<100ms) | Add indexes on jobName+startTime (<200ms) | Materialized views for stats, partition table |
| **Real-Time Updates** | 30s polling in dashboard (Pattern 4) | Consider WebSocket for live updates | Event-driven with Redis pub/sub |
| **Error Log Storage** | Keep all errors indefinitely | Prune errors older than 90 days | Archive to cold storage (S3), keep 30 days |
| **AdminJS CRUD Performance** | Default Prisma pagination (works well) | Ensure foreign key indexes exist | Consider read replicas for heavy admin usage |
| **Job Overlap Prevention** | In-memory Set (runningJobs) works | Same (single PM2 process) | Distributed lock (Redis) for multi-instance |

### Migration Path for Scale

**Phase 1 (MVP):** Patterns 1-5 as-is, in-memory overlap prevention
**Phase 2 (10K users):** Add Prisma indexes, dashboard caching (Redis), error pruning cron
**Phase 3 (100K+ users):** Table partitioning, materialized views, WebSocket updates, distributed locks

## Build Order (Dependency Graph)

```
1. Prisma Schema (JobExecution/JobError models)
   ├─ Migration: npx prisma migrate dev --name add-job-tracking
   └─ Generate client: npx prisma generate

2. Job Execution Tracker (Pattern 1)
   ├─ Depends on: Prisma models
   └─ File: backend/src/services/jobTracker.ts

3. Modify Scheduler (wrap jobs)
   ├─ Depends on: Job Execution Tracker
   └─ File: backend/src/workers/scheduler.ts

4. Dashboard Handler (Pattern 3)
   ├─ Depends on: Prisma models
   └─ File: backend/src/routes/admin.ts (or inline in AdminJS setup)

5. AdminJS Setup (Pattern 2)
   ├─ Depends on: Dashboard Handler, Auth Middleware
   └─ File: backend/src/index.ts (or separate admin.ts)

6. Custom Dashboard Component (Pattern 4)
   ├─ Depends on: AdminJS Setup (for ApiClient), Dashboard Handler
   └─ File: backend/src/components/Dashboard.tsx

7. Testing & Iteration
   ├─ Trigger jobs, verify JobExecution records
   ├─ Access /admin/dashboard, verify stats display
   └─ Introduce job failure, verify error logging
```

**Critical Path:** 1 → 2 → 3 (this enables job tracking)
**Parallel Work:** After step 3, can build 4+5+6 in parallel with testing

**Estimated Timeline:**
- Schema + Migration: 30 minutes
- Job Tracker: 1-2 hours
- Scheduler Integration: 1 hour (11 jobs to wrap)
- Dashboard Handler: 2-3 hours (aggregations, testing)
- AdminJS Setup: 2-4 hours (ESM integration, auth, model config)
- Custom Component: 3-4 hours (React, charts, styling)
- Testing: 2-3 hours (end-to-end, error scenarios)

**Total: 12-18 hours** (single developer, including breaks and debugging)

## Integration with Existing Ankora Architecture

### Existing Components (Don't Modify Extensively)

| Component | Integration Point | Notes |
|-----------|-------------------|-------|
| **PM2 Cluster Mode** | No change needed | AdminJS runs in same Express process, cluster-safe |
| **Caddy Reverse Proxy** | Add `/admin` route if needed | Likely no change (Express handles routing) |
| **Supabase PostgreSQL** | Prisma migration adds tables | Connection pooling handles AdminJS queries |
| **Auth Middleware** | Reuse for `/admin` protection | Extend to check admin role if needed |
| **Existing Cron Jobs** | Wrap with tracker (Pattern 1) | Minimal changes to worker functions |

### New Components (Add)

| Component | Purpose | Location |
|-----------|---------|----------|
| **AdminJS Router** | CRUD UI for all Prisma models | Mounted at `/admin` in Express app |
| **Job Execution Tracker** | Logging wrapper for cron jobs | `backend/src/services/jobTracker.ts` |
| **Dashboard Handler** | REST endpoint for job stats | `backend/src/routes/admin.ts` or inline |
| **Custom Dashboard Component** | React component for observability | `backend/src/components/Dashboard.tsx` |
| **JobExecution/JobError Models** | Database tables for tracking | Prisma schema, migrated to Supabase |

### Deployment Considerations

**Backend Deploy (after implementation):**
```bash
# On VPS
ssh root@116.203.17.203
cd /root/Remember/backend
git pull
npm install  # Installs AdminJS v7 ESM packages
npx prisma migrate deploy  # Applies JobExecution/JobError tables
npm run build  # Compiles TypeScript (handles dynamic imports)
pm2 restart remember-api  # Restarts with new admin panel
```

**Environment Variables (add if needed):**
```env
# .env
ADMIN_BASE_PATH="/admin"  # Optional: customize admin URL
ADMIN_ROLE_REQUIRED="admin"  # Optional: role-based access
```

**Security Checklist:**
- [ ] AdminJS routes protected with JWT middleware
- [ ] Check user role (admin) before allowing access
- [ ] Rate limit admin endpoints (prevent brute force)
- [ ] HTTPS enforced (already handled by Caddy)
- [ ] Audit log for admin actions (optional, AdminJS has built-in)

## Sources

### AdminJS Integration & Architecture
- [AdminJS Prisma Adapter Documentation](https://docs.adminjs.co/installation/adapters/prisma)
- [AdminJS Migration Guide v7](https://docs.adminjs.co/installation/migration-guide-v7) - ESM-only changes
- [AdminJS Dashboard Customization](https://docs.adminjs.co/ui-customization/dashboard-customization)
- [AdminJS Custom Components Guide](https://docs.adminjs.co/ui-customization/writing-your-own-components)
- [Building Custom Admin Dashboard with React, Node.js, and AdminJS](https://medium.com/adminjs/how-to-build-a-custom-admin-dashboard-interface-with-react-node-js-and-adminjs-fba62af55c2a)

### Observability & Monitoring Architecture
- [Observability Dashboards: How to Build Them](https://openobserve.ai/blog/observability-dashboards/)
- [10 Observability Tools Platform Engineers Should Evaluate in 2026](https://platformengineering.org/blog/10-observability-tools-platform-engineers-should-evaluate-in-2026)
- [What is Observability in 2026?](https://clickhouse.com/resources/engineering/what-is-observability)

### Node-Cron Job Monitoring
- [How to Monitor Cron Jobs in 2026: A Complete Guide](https://dev.to/cronmonitor/how-to-monitor-cron-jobs-in-2026-a-complete-guide-28g9)
- [10 Best Cron Job Monitoring Tools in 2026](https://betterstack.com/community/comparisons/cronjob-monitoring-tools/)
- [Job Scheduling in Node.js with Node-cron](https://betterstack.com/community/guides/scaling-nodejs/node-cron-scheduled-tasks/)
- [Cron Job Monitoring | Cronitor](https://cronitor.io/cron-job-monitoring)

### Express.js Patterns & Performance
- [Express.js Tutorial 2026: Practical, Scalable Patterns](https://thelinuxcode.com/expressjs-tutorial-2026-practical-scalable-patterns-for-real-projects/)
- [Monitoring API Performance with Express, Prometheus, and Grafana](https://medium.com/@msveshnikov/monitoring-api-performance-with-express-prometheus-and-grafana-49a4db011246)
- [Node.js Performance Monitoring: A Complete Guide](https://middleware.io/blog/nodejs-performance-monitoring/)
- [How to Add OpenTelemetry Middleware to Express.js](https://oneuptime.com/blog/post/2026-02-06-opentelemetry-middleware-expressjs-application/view)

### Database & Schema Design
- [Design a Distributed Job Scheduler: System Design Guide](https://www.systemdesignhandbook.com/guides/design-a-distributed-job-scheduler/)
- [Design Distributed Job Scheduler | System Design - GeeksforGeeks](https://www.geeksforgeeks.org/system-design/design-distributed-job-scheduler-system-design/)
- [Prisma Schema Best Practices](https://planetscale.com/docs/prisma/prisma-best-practices)
- [Prisma Schema Overview](https://www.prisma.io/docs/orm/prisma-schema/overview)

### ESM/CommonJS Migration
- [ES Modules Dominates 2026: Why CommonJS Is Being Abandoned](https://jeffbruchado.com.br/en/blog/es-modules-goodbye-commonjs-2026-modern-javascript)
- [JavaScript Modules in 2026: Practical Patterns with CommonJS and ES Modules](https://thelinuxcode.com/javascript-modules-in-2026-practical-patterns-with-commonjs-and-es-modules/)
- [AdminJS v7 in NestJS without Tears](https://dev.to/arab0v/adminjs-v7-in-classic-nestjs-without-tears-23en) - Dynamic import workaround

### Job Scheduler Patterns
- [NestJS Cron Decorator Source](https://github.com/nestjs/schedule/blob/master/lib/decorators/cron.decorator.ts)
- [cron-decorators npm](https://www.npmjs.com/package/cron-decorators) - Decorator pattern for cron jobs
- [Cronitor Node SDK](https://cronitor.io/guides/node-cron-jobs) - Wrapper pattern for execution tracking
