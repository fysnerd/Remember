# Phase 4: Observability Dashboard - Research

**Researched:** 2026-02-10
**Domain:** AdminJS custom dashboard with Recharts visualization, SSE real-time updates, Express API endpoints for metrics aggregation
**Confidence:** HIGH

## Summary

Phase 4 builds an at-a-glance system health dashboard inside the existing AdminJS panel. The dashboard replaces the default AdminJS homepage with a custom React component that displays job status, errors, statistics, timeline, and success rate charts. Data flows through AdminJS's built-in dashboard handler mechanism (backend aggregation) and a dedicated SSE endpoint (real-time push updates).

The most significant architectural discovery is that **Recharts is pre-bundled in AdminJS** -- it ships as a dependency of `@adminjs/bundler` and can be imported directly in custom components without any npm installation or bundling configuration. This eliminates the biggest risk factor noted in prior planning (the concern about AdminJS ComponentLoader and external dependencies). The AdminJS `dashboard.handler` + `ApiClient.getDashboard()` pattern provides a clean data-fetching channel: the handler runs Prisma queries to aggregate metrics, and the React component fetches and renders them.

For DASH-07 (real-time SSE), the recommended approach is a **standalone Express SSE endpoint** at `/admin/api/sse` that the dashboard React component connects to via `EventSource`. This is separate from AdminJS's handler mechanism because SSE requires a persistent connection (not request-response). PM2 cluster mode creates a challenge for SSE (connections are stateful), but since this is a solo-dev admin dashboard with at most 1-2 concurrent SSE connections, the practical impact is negligible -- the EventSource auto-reconnect mechanism handles worker rotation transparently. Caddy automatically detects `text/event-stream` responses and disables buffering, so no Caddyfile changes are needed.

**Primary recommendation:** Use AdminJS `dashboard` option with `ComponentLoader` for the custom React component, `dashboard.handler` for backend data aggregation via Prisma queries, Recharts (pre-bundled) for charts, and a separate Express SSE route at `/admin/api/sse` for real-time push. No new npm packages needed.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **adminjs** | ^7.8.17 | Custom dashboard via `dashboard` option + `ComponentLoader` | Already deployed, provides dashboard handler + component pattern |
| **@adminjs/design-system** | (bundled with adminjs) | UI atoms: Box, Header, Text, Badge, Table, ValueGroup, MessageBox, Icon | Pre-bundled, ensures visual consistency with AdminJS panel |
| **recharts** | (pre-bundled by adminjs) | Charts: BarChart, LineChart for success rates and timeline | Pre-bundled in AdminJS bundler, importable without npm install |
| **@prisma/client** | ^6.2.1 | Database queries for metrics aggregation | Already deployed, used for all data access |
| **express** | ^4.21.2 | SSE endpoint at `/admin/api/sse` | Already deployed, SSE is just a long-lived HTTP response |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **pino** | ^10.3.0 | Structured logging for dashboard handler/SSE | Already deployed for all logging |

### New Packages Required
None. Every dependency is already installed or pre-bundled.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AdminJS custom dashboard | Standalone HTML page at `/admin/dashboard` | Would bypass AdminJS auth, need custom session validation, lose design consistency |
| Recharts (pre-bundled) | Chart.js via CDN in standalone page | Would work but loses AdminJS integration, needs separate auth |
| Native SSE (`res.write`) | `better-sse` npm package | Library adds channel/broadcast abstractions, but for 1-2 admin connections native SSE is simpler and adds no dependency |
| SSE for real-time | Polling with `setInterval` + `getDashboard()` | Simpler but wastes bandwidth, misses instant updates, and re-runs full Prisma queries every poll cycle |

**Installation:**
```bash
# No installation needed -- all dependencies are already present
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── admin/
│   ├── index.ts              # MODIFY: Add componentLoader, dashboard config, SSE route
│   ├── resources.ts          # NO CHANGE
│   ├── actions.ts            # NO CHANGE
│   ├── dashboard.handler.ts  # NEW: Backend data aggregation (Prisma queries)
│   ├── dashboard.sse.ts      # NEW: SSE endpoint for real-time updates
│   └── components/
│       └── dashboard.tsx     # NEW: Custom React dashboard component (Recharts + design-system)
```

### Pattern 1: AdminJS Custom Dashboard with ComponentLoader
**What:** Replace the default AdminJS dashboard with a custom React component that receives data from a backend handler.
**When to use:** For DASH-01 through DASH-06 -- all static data display.

**Backend handler (data aggregation):**
```typescript
// Source: https://docs.adminjs.co/ui-customization/dashboard-customization
// backend/src/admin/dashboard.handler.ts

import { prisma } from '../config/database.js';

export const dashboardHandler = async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // DASH-02: Last run of each job
  const lastRuns = await prisma.$queryRaw`
    SELECT DISTINCT ON ("jobName")
      "jobName", status, "triggerSource", "startedAt", duration, error
    FROM job_executions
    ORDER BY "jobName", "startedAt" DESC
  `;

  // DASH-03: Errors from last 24h
  const recentErrors = await prisma.jobExecution.findMany({
    where: { status: 'FAILED', startedAt: { gte: yesterday } },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });

  // DASH-04: General stats
  const [userCount, contentByPlatform, quizCount, reviewCount] = await Promise.all([
    prisma.user.count(),
    prisma.content.groupBy({ by: ['platform'], _count: true }),
    prisma.quiz.count(),
    prisma.review.count(),
  ]);

  // DASH-05: Timeline (last 100 executions)
  const timeline = await prisma.jobExecution.findMany({
    orderBy: { startedAt: 'desc' },
    take: 100,
    select: { id: true, jobName: true, status: true, triggerSource: true, startedAt: true, duration: true },
  });

  // DASH-06: Success rates per job (last 7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const successRates = await prisma.$queryRaw`
    SELECT "jobName",
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'SUCCESS') as successes
    FROM job_executions
    WHERE "startedAt" >= ${sevenDaysAgo}
    GROUP BY "jobName"
  `;

  return {
    lastRuns,
    recentErrors,
    stats: { userCount, contentByPlatform, quizCount, reviewCount },
    timeline,
    successRates,
    generatedAt: now.toISOString(),
  };
};
```

**AdminJS configuration:**
```typescript
// Source: https://docs.adminjs.co/ui-customization/dashboard-customization
// In backend/src/admin/index.ts

import { ComponentLoader } from 'adminjs';
import { dashboardHandler } from './dashboard.handler.js';

const componentLoader = new ComponentLoader();

const Components = {
  Dashboard: componentLoader.add('Dashboard', './components/dashboard'),
};

const admin = new AdminJS({
  resources,
  rootPath: '/admin',
  dashboard: {
    component: Components.Dashboard,
    handler: dashboardHandler,
  },
  componentLoader,
  branding: {
    companyName: 'Ankora Admin',
    withMadeWithLove: false,
  },
});
```

**React component (dashboard.tsx):**
```tsx
// Source: https://docs.adminjs.co/ui-customization/dashboard-customization
// backend/src/admin/components/dashboard.tsx

import React, { useEffect, useState } from 'react';
import { ApiClient } from 'adminjs';
import { Box, Header, Text, Badge, ValueGroup } from '@adminjs/design-system';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const api = new ApiClient();

  useEffect(() => {
    api.getDashboard().then((res) => setData(res.data));
  }, []);

  if (!data) return <Box><Text>Loading...</Text></Box>;

  return (
    <Box variant="grey" p="xl">
      <Header.H2>System Health</Header.H2>
      {/* Render panels using data */}
    </Box>
  );
};

export default Dashboard;
```

### Pattern 2: SSE Endpoint for Real-Time Updates
**What:** A dedicated Express route that keeps a connection open and pushes job execution events as they happen.
**When to use:** For DASH-07 -- real-time updates without manual refresh.

```typescript
// backend/src/admin/dashboard.sse.ts
import type { Request, Response } from 'express';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'dashboard-sse' });

// Connected SSE clients
const clients = new Set<Response>();

export function sseHandler(req: Request, res: Response) {
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Nginx/Caddy hint
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  clients.add(res);
  log.info({ clientCount: clients.size }, 'SSE client connected');

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    log.info({ clientCount: clients.size }, 'SSE client disconnected');
  });
}

// Called from jobExecutionTracker when a job completes
export function broadcastJobEvent(event: {
  type: 'job_started' | 'job_completed' | 'job_failed';
  jobName: string;
  status: string;
  triggerSource: string;
  duration?: number;
  error?: string;
}) {
  const message = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(message);
  }
}
```

**Client-side (in dashboard.tsx):**
```tsx
useEffect(() => {
  const eventSource = new EventSource('/admin/api/sse');
  eventSource.onmessage = (event) => {
    const update = JSON.parse(event.data);
    // Merge update into dashboard state
    if (update.type === 'job_completed' || update.type === 'job_failed') {
      // Refresh dashboard data
      api.getDashboard().then((res) => setData(res.data));
    }
  };
  return () => eventSource.close();
}, []);
```

### Pattern 3: Job Execution Tracker Integration for SSE Broadcast
**What:** Modify `trackJobExecution` to call `broadcastJobEvent` when jobs start/complete/fail.
**When to use:** To wire SSE events into the existing job tracking pipeline.

```typescript
// In jobExecutionTracker.ts - add broadcast calls at key lifecycle points
import { broadcastJobEvent } from '../admin/dashboard.sse.js';

// After creating RUNNING record:
broadcastJobEvent({ type: 'job_started', jobName, status: 'RUNNING', triggerSource });

// After updating to SUCCESS:
broadcastJobEvent({ type: 'job_completed', jobName, status: 'SUCCESS', triggerSource, duration });

// After updating to FAILED:
broadcastJobEvent({ type: 'job_failed', jobName, status: 'FAILED', triggerSource, duration, error: errorMessage });
```

### Anti-Patterns to Avoid
- **Heavy Prisma queries on every SSE tick:** Don't re-run the full dashboard handler every few seconds. The SSE endpoint should push lightweight event objects; the client fetches full data only on initial load or when an event triggers a refresh.
- **Storing SSE clients in a database or Redis:** For 1-2 admin clients, an in-memory `Set<Response>` is sufficient. Redis pub/sub would be over-engineering for this use case.
- **Using AdminJS `dashboard.handler` for SSE:** The handler is request-response (GET `/admin/api/dashboard`). SSE needs a persistent connection on a separate route.
- **Importing from `styled-components` directly:** In AdminJS v7, use `import { styled, css } from '@adminjs/design-system/styled-components'` instead of the bare `styled-components` package.
- **Using `AdminJS.bundle()` for components:** Removed in v7. Must use `ComponentLoader.add()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG/Canvas charts | Recharts (pre-bundled in AdminJS) | Pre-bundled, React-native, responsive, handles axes/tooltips/legends |
| Dashboard UI primitives | Custom HTML/CSS components | `@adminjs/design-system` (Box, Header, Text, Badge, ValueGroup, Table) | Consistent with AdminJS theme, responsive, dark mode support |
| Data fetching in dashboard | Custom fetch/axios calls | `ApiClient.getDashboard()` from AdminJS | Handles auth cookies, base path, error handling automatically |
| Dashboard data aggregation | Multiple frontend API calls | Single `dashboard.handler` with parallel Prisma queries | One round-trip, server-side aggregation, no exposed internal APIs |
| SSE protocol implementation | Custom EventSource polyfill or WebSocket | Native `EventSource` API + `res.write()` | Browser-native, auto-reconnect, no dependencies |

**Key insight:** AdminJS pre-bundles both Recharts and its own design system, making the custom dashboard a pure composition exercise -- no bundling configuration, no external dependency management, no build pipeline changes. The only new code is: (1) Prisma queries for aggregation, (2) a React component composing pre-bundled UI, (3) a thin SSE endpoint.

## Common Pitfalls

### Pitfall 1: ComponentLoader Path Resolution
**What goes wrong:** `ComponentLoader.add()` fails silently or throws "Component not bundled" error.
**Why it happens:** The path argument to `componentLoader.add()` is relative to the file where it's called, not to the project root. If `index.ts` calls `componentLoader.add('Dashboard', './components/dashboard')`, the file must exist at `backend/src/admin/components/dashboard.tsx` (relative to `backend/src/admin/index.ts`).
**How to avoid:** Keep `componentLoader.add()` calls in the same file as the component files, or use absolute paths with `path.resolve()` and `import.meta.url`.
**Warning signs:** AdminJS loads but dashboard shows the default "Welcome to AdminJS" instead of the custom component.

### Pitfall 2: SSE Connection Dropped by Proxy Timeout
**What goes wrong:** SSE connection closes after ~60 seconds of no data, browser reconnects in a loop.
**Why it happens:** Some reverse proxies (Nginx, older Caddy versions) have idle timeouts that close connections with no activity.
**How to avoid:** Send a heartbeat comment (`: heartbeat\n\n`) every 30 seconds. This is a valid SSE comment that keeps the connection alive without triggering client-side event handlers.
**Warning signs:** Browser DevTools shows repeated SSE connections opening and closing every minute.

### Pitfall 3: SSE Endpoint Behind AdminJS Auth
**What goes wrong:** Unauthenticated users can access the SSE endpoint and see real-time job events.
**Why it happens:** The SSE endpoint is a plain Express route, not protected by AdminJS's session auth.
**How to avoid:** Mount the SSE route on the AdminJS router (which has session middleware), or add manual session validation middleware that checks for a valid `adminjs` session cookie.
**Warning signs:** `curl https://api.ankora.study/admin/api/sse` returns data without authentication.

### Pitfall 4: PM2 Cluster Mode and SSE Client Set
**What goes wrong:** SSE clients are stored in-memory per worker. When a job completes on worker A, only SSE clients connected to worker A receive the event.
**Why it happens:** PM2 cluster mode runs multiple Node.js processes, each with its own memory space. The `clients` Set in `dashboard.sse.ts` is per-process.
**How to avoid:** For this solo-dev admin dashboard (1-2 concurrent connections), this is acceptable -- EventSource auto-reconnects, and the admin will see updates within a few seconds. If scaling were needed, use Redis pub/sub to broadcast across workers. For now, this is intentionally not addressed.
**Warning signs:** Dashboard SSE occasionally misses an event (resolved by next heartbeat or manual refresh).

### Pitfall 5: Dashboard Handler N+1 Queries
**What goes wrong:** Dashboard loads slowly because of inefficient Prisma queries.
**Why it happens:** Using multiple `findMany` calls when a single raw SQL query with `DISTINCT ON` or `GROUP BY` would be faster.
**How to avoid:** Use `prisma.$queryRaw` for complex aggregations (last run per job, success rates). Use `Promise.all` to parallelize independent count queries.
**Warning signs:** Dashboard takes >2 seconds to load.

### Pitfall 6: Recharts Import Confusion
**What goes wrong:** `import { LineChart } from 'recharts'` fails in the custom component.
**Why it happens:** Recharts is pre-bundled in AdminJS but requires the correct import syntax. The AdminJS bundler exposes it as a global dependency.
**How to avoid:** Import directly: `import { BarChart, Bar, XAxis, YAxis } from 'recharts'`. This works because AdminJS's bundler marks recharts as an external dependency and provides it at runtime.
**Warning signs:** Build error or blank dashboard with console errors about undefined modules.

## Code Examples

### Complete Dashboard Handler
```typescript
// backend/src/admin/dashboard.handler.ts
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'dashboard-handler' });

export const dashboardHandler = async () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [lastRuns, recentErrors, userCount, contentByPlatform, quizCount, reviewCount, timeline, successRates] =
      await Promise.all([
        // DASH-02: Last run of each job (raw SQL for DISTINCT ON)
        prisma.$queryRaw`
          SELECT DISTINCT ON ("jobName")
            "jobName", status, "triggerSource", "startedAt", duration, error
          FROM job_executions
          ORDER BY "jobName", "startedAt" DESC
        `,
        // DASH-03: Errors last 24h
        prisma.jobExecution.findMany({
          where: { status: 'FAILED', startedAt: { gte: yesterday } },
          orderBy: { startedAt: 'desc' },
          take: 50,
          select: { id: true, jobName: true, error: true, startedAt: true, duration: true, triggerSource: true },
        }),
        // DASH-04: Stats
        prisma.user.count(),
        prisma.content.groupBy({ by: ['platform'], _count: true }),
        prisma.quiz.count(),
        prisma.review.count(),
        // DASH-05: Timeline
        prisma.jobExecution.findMany({
          orderBy: { startedAt: 'desc' },
          take: 100,
          select: { id: true, jobName: true, status: true, triggerSource: true, startedAt: true, duration: true },
        }),
        // DASH-06: Success rates per job (last 7 days)
        prisma.$queryRaw`
          SELECT "jobName",
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status = 'SUCCESS')::int as successes
          FROM job_executions
          WHERE "startedAt" >= ${sevenDaysAgo}
          GROUP BY "jobName"
          ORDER BY "jobName"
        `,
      ]);

    return {
      lastRuns,
      recentErrors,
      stats: { userCount, contentByPlatform, quizCount, reviewCount },
      timeline,
      successRates,
      generatedAt: now.toISOString(),
    };
  } catch (err) {
    log.error({ err }, 'Dashboard handler failed');
    return { error: 'Failed to load dashboard data' };
  }
};
```

### Complete SSE Endpoint
```typescript
// backend/src/admin/dashboard.sse.ts
import type { Request, Response } from 'express';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'dashboard-sse' });
const clients = new Set<Response>();

export function sseHandler(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  clients.add(res);
  log.info({ clientCount: clients.size }, 'SSE client connected');

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    log.info({ clientCount: clients.size }, 'SSE client disconnected');
  });
}

export function broadcastJobEvent(event: {
  type: 'job_started' | 'job_completed' | 'job_failed';
  jobName: string;
  status: string;
  triggerSource: string;
  duration?: number;
  error?: string;
  timestamp?: string;
}) {
  event.timestamp = event.timestamp || new Date().toISOString();
  const message = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      clients.delete(client);
    }
  }
}
```

### Dashboard React Component Structure (Skeleton)
```tsx
// backend/src/admin/components/dashboard.tsx
import React, { useEffect, useState } from 'react';
import { ApiClient } from 'adminjs';
import { Box, Header, Text, Badge, ValueGroup, Table, TableBody, TableRow, TableCell, TableHead, MessageBox } from '@adminjs/design-system';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardData {
  lastRuns: Array<{ jobName: string; status: string; triggerSource: string; startedAt: string; duration: number; error?: string }>;
  recentErrors: Array<{ id: string; jobName: string; error: string; startedAt: string }>;
  stats: { userCount: number; contentByPlatform: Array<{ platform: string; _count: number }>; quizCount: number; reviewCount: number };
  timeline: Array<{ id: string; jobName: string; status: string; startedAt: string; duration: number }>;
  successRates: Array<{ jobName: string; total: number; successes: number }>;
  generatedAt: string;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const api = new ApiClient();

  const fetchData = () => {
    api.getDashboard().then((res) => setData(res.data));
  };

  // Initial data load
  useEffect(() => {
    fetchData();
  }, []);

  // DASH-07: SSE real-time updates
  useEffect(() => {
    const es = new EventSource('/admin/api/sse');
    es.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (['job_completed', 'job_failed', 'job_started'].includes(update.type)) {
        fetchData(); // Re-fetch dashboard data on any job event
      }
    };
    return () => es.close();
  }, []);

  if (!data) return <Box p="xl"><Text>Loading dashboard...</Text></Box>;

  return (
    <Box variant="grey" p="xl">
      {/* DASH-01: System health overview */}
      <Header.H2>Ankora System Health</Header.H2>
      <Text>Last updated: {new Date(data.generatedAt).toLocaleString()}</Text>

      {/* DASH-04: General stats */}
      <Box display="flex" flexDirection="row" mt="xl">
        <ValueGroup label="Users" value={String(data.stats.userCount)} />
        <ValueGroup label="Quizzes" value={String(data.stats.quizCount)} />
        <ValueGroup label="Reviews" value={String(data.stats.reviewCount)} />
      </Box>

      {/* DASH-02: Sync status panel */}
      {/* ... Table of lastRuns with Badge for status ... */}

      {/* DASH-03: Error log */}
      {/* ... Filterable list of recentErrors ... */}

      {/* DASH-05: Timeline */}
      {/* ... Chronological feed of timeline entries ... */}

      {/* DASH-06: Success rate chart */}
      <Box mt="xl">
        <Header.H4>Success Rates (Last 7 Days)</Header.H4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.successRates.map(r => ({
            name: r.jobName,
            rate: r.total > 0 ? Math.round((r.successes / r.total) * 100) : 0,
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="rate" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default Dashboard;
```

### SSE Auth Middleware
```typescript
// Simple session check for SSE endpoint
import type { Request, Response, NextFunction } from 'express';

export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  // express-session populates req.session when session middleware is active
  if (req.session && (req.session as any).adminUser) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AdminJS.bundle()` for components | `ComponentLoader.add()` | AdminJS v7 (2023) | Must use ComponentLoader for custom dashboard component |
| External recharts install + bundler config | Pre-bundled recharts in AdminJS | AdminJS v7 bundler | No npm install needed, import directly |
| `import styled from 'styled-components'` | `import { styled } from '@adminjs/design-system/styled-components'` | AdminJS v7 | Must use design-system re-export |
| Polling with setInterval | SSE (EventSource) | HTML5 standard | Native browser API, auto-reconnect, lower overhead |
| WebSockets for real-time | SSE for server-to-client only | General trend | SSE is simpler for unidirectional updates like dashboards |

**Deprecated/outdated:**
- `AdminJS.bundle()` -- removed in v7, use `ComponentLoader`
- `admin.overrideLogin()` -- removed in v7
- Direct `styled-components` import -- must use `@adminjs/design-system/styled-components`
- Recharts v2 import patterns -- v3 (pre-bundled in AdminJS) uses ES modules

## Open Questions

1. **AdminJS Session Check for SSE Route**
   - What we know: AdminJS uses `express-session` with cookie-based auth. The SSE route needs to verify the admin is logged in.
   - What's unclear: Whether the AdminJS session middleware is applied to custom routes mounted alongside AdminJS, or if we need to manually check `req.session`.
   - Recommendation: Mount the SSE handler on the same Express router that AdminJS uses (the `adminRouter` from `buildAuthenticatedRouter`), so session middleware is inherited. If that doesn't work, add explicit session check middleware. Validate during development.
   - Confidence: MEDIUM

2. **ComponentLoader Path with TSX File Extension**
   - What we know: `componentLoader.add('Dashboard', './components/dashboard')` registers the component. AdminJS supports `.tsx` files.
   - What's unclear: Whether the path should include the `.tsx` extension or not, and whether TypeScript compilation is needed for the component file.
   - Recommendation: AdminJS bundles components at runtime using its own bundler (Rollup-based). The `.tsx` file is read directly -- no pre-compilation needed. Omit the extension in the path. Validate during development.
   - Confidence: MEDIUM

3. **SSE Event Volume Under Heavy Cron Activity**
   - What we know: 11 cron jobs run at intervals as low as 2 minutes. Each generates start + complete/fail events (22 events per cycle).
   - What's unclear: Whether re-fetching the full dashboard on every SSE event is efficient, or if partial state updates are needed.
   - Recommendation: Start with full re-fetch on each event (simplest). If performance is an issue, debounce: accumulate events for 2 seconds, then fetch once. Monitor with `performance.now()` in development.
   - Confidence: HIGH (full re-fetch is fine for 1-2 clients with 8 parallel Prisma queries)

## Sources

### Primary (HIGH confidence)
- [AdminJS Dashboard Customization](https://docs.adminjs.co/ui-customization/dashboard-customization) - ComponentLoader, dashboard handler, ApiClient.getDashboard()
- [AdminJS Writing Custom Components](https://docs.adminjs.co/ui-customization/writing-your-own-components) - ComponentLoader.add(), @adminjs/design-system imports, styled-components path
- [AdminJS Migration Guide v7](https://docs.adminjs.co/installation/migration-guide-v7) - ESM-only, ComponentLoader replaces bundle(), pre-bundled dependencies
- [AdminJS Charts FAQ](https://docs.adminjs.co/faq/charts) - Recharts recommended, data format, handler + component pattern
- [AdminJS Design System GitHub](https://github.com/SoftwareBrothers/adminjs-design-system) - Component inventory: Box, Header, Text, Badge, ValueGroup, MessageBox, Table, Icon
- [AdminJS Design System Docs](https://adminjs-docs.web.app/module-@adminjs_design-system.html) - Full component list: 19 atoms, 17 molecules, 3 organisms
- [AdminJS ApiClient Docs](https://softwarebrothers.github.io/adminjs-dev/ApiClient.html) - getDashboard(), getPage(), resourceAction() methods
- [AdminJS Bundler Pre-bundled Dependencies](https://www.npmjs.com/package/@adminjs/bundler) - recharts, react, react-dom, axios, styled-components all pre-bundled
- [MDN EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) - Browser-native SSE client
- [MDN Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) - Protocol specification

### Secondary (MEDIUM confidence)
- [Caddy SSE Buffering Forum](https://caddy.community/t/server-sent-events-buffering-with-reverse-proxy/11722) - Caddy auto-detects text/event-stream and disables buffering; no config needed
- [Caddy reverse_proxy docs](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) - flush_interval -1 available but not needed for standard SSE
- [better-sse Getting Started](https://matthewwid.github.io/better-sse/guides/getting-started/) - Alternative SSE library (decided not to use -- native approach is simpler for this use case)
- [AdminJS External Dependencies Issue #492](https://github.com/SoftwareBrothers/adminjs/issues/492) - Historical bundling issue, resolved; recharts now pre-bundled

### Tertiary (LOW confidence)
- [AdminJS Custom Component Bundling Issue #1674](https://github.com/SoftwareBrothers/adminjs/issues/1674) - Some external packages still fail to bundle in v7; only pre-bundled dependencies are guaranteed to work
- PM2 cluster mode SSE behavior -- no authoritative source found; based on general Node.js cluster knowledge and EventSource reconnect behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All dependencies already installed or pre-bundled. No new packages. Patterns verified in official AdminJS docs.
- Architecture: HIGH -- Dashboard handler + ComponentLoader + ApiClient pattern is the documented AdminJS approach. SSE is standard Express pattern.
- Pitfalls: HIGH -- ComponentLoader path resolution, SSE heartbeat, and PM2 cluster caveats are well-documented in community issues.
- SSE + AdminJS auth: MEDIUM -- How to share AdminJS session middleware with a custom SSE route needs validation during development.

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable ecosystem, AdminJS v7 is mature, SSE is browser standard)
