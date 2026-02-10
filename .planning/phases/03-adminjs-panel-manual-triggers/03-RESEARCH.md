# Phase 3: AdminJS Panel & Manual Triggers - Research

**Researched:** 2026-02-10
**Domain:** AdminJS v7 admin panel with Prisma adapter, Express plugin, authentication, custom actions for manual job triggers
**Confidence:** HIGH

## Summary

AdminJS v7 is a mature, React-based auto-generated admin panel for Node.js that provides CRUD interfaces for database models. It requires ESM (already completed in Phase 1), integrates with Prisma via `@adminjs/prisma` v5, and mounts on Express via `@adminjs/express` v6. The Ankora backend already meets all prerequisites: ESM module system, Prisma ORM with 14 models, Express.js framework, and PostgreSQL database.

The implementation involves four main areas: (1) installing AdminJS packages and registering the Prisma adapter with all 14 models, (2) configuring authenticated sessions via `buildAuthenticatedRouter` with `connect-pg-simple` for PM2 cluster-safe session storage, (3) organizing models into navigation groups matching the required categories, and (4) adding custom resource-level actions on a dedicated "Jobs" virtual resource or the JobExecution model to trigger each of the 11 sync jobs manually. Manual triggers must add a `triggerSource` field to `JobExecution` records to distinguish them from scheduled runs (TRIG-03), requiring a Prisma schema migration.

**Primary recommendation:** Use `adminjs@^7.8`, `@adminjs/express@^6.1`, `@adminjs/prisma@^5.0` with `connect-pg-simple` for session storage. Mount AdminJS at `/admin` before the rate limiter middleware. Add a `triggerSource` enum field (`SCHEDULED`/`MANUAL`) to the `JobExecution` model. Implement manual triggers as custom resource actions on the `JobExecution` resource with `component: false` and `actionType: 'resource'`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **adminjs** | ^7.8.17 | Admin panel core framework | Only maintained Node.js admin panel with React UI, CRUD generation, and custom actions |
| **@adminjs/express** | ^6.1.1 | Express.js integration plugin | Official AdminJS plugin for Express, provides `buildAuthenticatedRouter` |
| **@adminjs/prisma** | ^5.0.4 | Prisma ORM adapter | Official adapter, supports Prisma v5+v6, uses `getModelByName` for DMMF access |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **express-session** | ^1.19.0 | Server-side session management | Required peer dependency of `@adminjs/express` for authentication |
| **express-formidable** | ^1.2.0 | Form data parsing | Required peer dependency of `@adminjs/express` for file uploads/form handling |
| **tslib** | ^2.8.1 | TypeScript runtime helpers | Required peer dependency of `@adminjs/express` |
| **connect-pg-simple** | ^10.0.0 | PostgreSQL session store | Required for PM2 cluster mode - in-memory session store leaks and doesn't share across processes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| connect-pg-simple | In-memory session store (default) | Memory store leaks in production and fails in PM2 cluster mode (requests round-robin to different workers with separate memory) |
| connect-pg-simple | connect-redis | Would require Redis, project doesn't actively use Redis for anything yet |
| AdminJS custom actions for triggers | Separate Express API routes (existing `/api/admin/sync/*`) | Already exist but have no UI; AdminJS actions provide buttons in the admin panel UI |
| AdminJS | Retool/Forest Admin | External SaaS services, overkill for single-dev project, privacy concerns with credentials |

**Installation:**
```bash
npm install adminjs @adminjs/express @adminjs/prisma express-session express-formidable tslib connect-pg-simple
npm install -D @types/express-session @types/connect-pg-simple
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── admin/
│   ├── index.ts              # NEW: AdminJS setup, adapter registration, resource config
│   ├── resources.ts          # NEW: All 14 Prisma model resource definitions with navigation groups
│   └── actions.ts            # NEW: Custom job trigger actions
├── workers/
│   ├── scheduler.ts          # MODIFY: Export job functions map for admin triggers
│   └── jobExecutionTracker.ts # MODIFY: Accept triggerSource parameter
├── config/
│   └── env.ts                # MODIFY: Add ADMIN_EMAIL, ADMIN_PASSWORD env vars
└── prisma/
    └── schema.prisma         # MODIFY: Add triggerSource enum + field to JobExecution
```

### Pattern 1: AdminJS Setup with Prisma Adapter
**What:** Register Prisma adapter and mount AdminJS router on Express app
**When to use:** Initial AdminJS setup - runs once at server boot

**Example:**
```typescript
// Source: https://docs.adminjs.co/installation/adapters/prisma
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Database, Resource, getModelByName } from '@adminjs/prisma';
import { PrismaClient } from '@prisma/client';
import session from 'express-session';
import Connect from 'connect-pg-simple';

const prisma = new PrismaClient();
AdminJS.registerAdapter({ Database, Resource });

const admin = new AdminJS({
  resources: [
    {
      resource: { model: getModelByName('User'), client: prisma },
      options: {
        navigation: { name: 'Users', icon: 'User' },
      },
    },
    // ... more resources
  ],
  rootPath: '/admin',
});

// Authentication
const ConnectSession = Connect(session);
const sessionStore = new ConnectSession({
  conObject: { connectionString: process.env.DATABASE_URL },
  tableName: 'admin_sessions',
  createTableIfMissing: true,
});

const authenticate = async (email: string, password: string) => {
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    return { email, id: 'admin' };
  }
  return null;
};

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  admin,
  { authenticate, cookieName: 'adminjs', cookiePassword: process.env.JWT_SECRET },
  null,
  {
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    secret: process.env.JWT_SECRET,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === 'production' },
    name: 'adminjs',
  }
);

// Mount BEFORE rate limiter
app.use(admin.options.rootPath, adminRouter);
```

### Pattern 2: Navigation Groups for Model Organization
**What:** Group Prisma models into logical sidebar categories
**When to use:** For every resource registration

**Example:**
```typescript
// Source: https://docs.adminjs.co/basics/resource
const navigationGroups = {
  users:      { name: 'Users',      icon: 'User' },
  content:    { name: 'Content',    icon: 'Document' },
  learning:   { name: 'Learning',   icon: 'Education' },
  platform:   { name: 'Platform',   icon: 'Connect' },
  monitoring: { name: 'Monitoring', icon: 'Activity' },
};

// Model → Group mapping:
// Users:      User, UserSettings, OAuthAccount
// Content:    Content, Transcript, TranscriptCache, Tag
// Learning:   Quiz, Card, Review, QuizSession, Streak
// Platform:   ConnectedPlatform
// Monitoring: JobExecution
```

### Pattern 3: Custom Resource Action for Job Triggers (component: false)
**What:** Resource-level action that triggers a backend job when button is clicked, no custom UI needed
**When to use:** For each of the 11 manual trigger buttons

**Example:**
```typescript
// Source: https://docs.adminjs.co/basics/action
{
  resource: { model: getModelByName('JobExecution'), client: prisma },
  options: {
    navigation: navigationGroups.monitoring,
    actions: {
      triggerYoutubeSync: {
        actionType: 'resource',
        component: false,
        guard: 'Are you sure you want to trigger YouTube Sync?',
        handler: async (request, response, context) => {
          // Fire and forget - don't await the job
          runJob('youtube-sync', runYouTubeSync, 'MANUAL').catch(err =>
            log.error({ err }, 'Manual youtube-sync failed')
          );
          return {
            notice: { message: 'YouTube Sync triggered', type: 'success' },
            records: [],
          };
        },
      },
      // ... 10 more trigger actions
    },
  },
}
```

### Pattern 4: Rate Limiter Exclusion via Middleware Ordering
**What:** Mount AdminJS router before the global rate limiter so `/admin` routes bypass it
**When to use:** Required for ADM-05

**Example:**
```typescript
// In index.ts - ORDER MATTERS

// 1. Mount AdminJS BEFORE rate limiter
app.use(admin.options.rootPath, adminRouter);

// 2. Apply rate limiter to everything else
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter); // Only rate-limit /api routes
// OR use skip option:
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: (req) => req.path.startsWith('/admin'),
}));
```

### Anti-Patterns to Avoid
- **Mounting AdminJS after rate limiter:** AdminJS serves React bundle JS/CSS files as static assets. Rate limiting these will break the admin UI after a few clicks.
- **Using in-memory session store in PM2 cluster mode:** Sessions will be lost when requests round-robin to a different worker. Always use `connect-pg-simple` or Redis.
- **Calling `admin.watch()` in production:** This is dev-only for hot-reloading React components. In production, AdminJS bundles automatically into a temp directory. Do NOT call `watch()` when `NODE_ENV=production`.
- **Awaiting long-running job triggers in action handlers:** AdminJS action handlers have a request timeout. Fire-and-forget pattern with `.catch()` is required for jobs that may take minutes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Admin panel UI | Custom React dashboard | AdminJS v7 | Auto-generates CRUD for all 14 models, search, filter, sort |
| Model metadata extraction | Manual Prisma introspection | `getModelByName()` from `@adminjs/prisma` | Handles DMMF parsing, enum detection, relation mapping |
| Session management | Custom JWT-based admin auth | `buildAuthenticatedRouter` + `express-session` | AdminJS requires cookie-based sessions, JWT won't work |
| Session persistence | Custom database session table | `connect-pg-simple` | Handles table creation, cleanup, serialization |
| Form data parsing | Custom multipart handler | `express-formidable` (peer dep) | AdminJS uses it internally for file uploads |

**Key insight:** AdminJS is an opinionated framework with its own session management, React bundling, and routing system. Fight it and you'll lose -- use its built-in patterns (cookie sessions, `buildAuthenticatedRouter`, navigation groups) rather than trying to integrate your own auth/routing patterns.

## Common Pitfalls

### Pitfall 1: Rate Limiter Blocks AdminJS Static Assets
**What goes wrong:** AdminJS serves its React bundle, CSS, and JS assets through the Express app. The global rate limiter counts these as requests, quickly exhausting the limit (100/15min). The admin UI breaks with 429 errors.
**Why it happens:** `app.use(limiter)` is applied globally before AdminJS router is mounted.
**How to avoid:** Either mount AdminJS router before the rate limiter middleware, or scope the rate limiter to `/api` paths only, or use the `skip` option to exclude `/admin` paths.
**Warning signs:** Admin panel loads once but subsequent pages/actions fail with "Too many requests".

### Pitfall 2: PM2 Cluster Mode Session Loss
**What goes wrong:** Admin logs in successfully but gets logged out randomly on subsequent requests.
**Why it happens:** PM2 cluster mode distributes requests round-robin across workers. The default `MemoryStore` is per-process, so session data only exists on the worker that handled the login.
**How to avoid:** Use `connect-pg-simple` to store sessions in PostgreSQL (already available via Supabase).
**Warning signs:** Intermittent 401s, admin keeps getting redirected to login page.

### Pitfall 3: AdminJS watch() in Production
**What goes wrong:** Server crashes or hangs on startup in production when `admin.watch()` is called.
**Why it happens:** `watch()` spawns a background bundling process for development hot-reload. In production, AdminJS handles bundling automatically.
**How to avoid:** Only call `admin.watch()` when `NODE_ENV !== 'production'`. Or better, don't call it at all -- AdminJS bundles on first request.
**Warning signs:** `ENOENT` errors or excessive CPU on server startup.

### Pitfall 4: Helmet CSP Blocking AdminJS Assets
**What goes wrong:** AdminJS React UI fails to load, console shows Content-Security-Policy violations.
**Why it happens:** Helmet's `contentSecurityPolicy` blocks inline scripts and AdminJS's bundled React code.
**How to avoid:** The project already has `contentSecurityPolicy: false` in the Helmet config. Keep it disabled, or create a specific CSP policy for `/admin` routes.
**Warning signs:** Blank admin page, browser console shows CSP errors.

### Pitfall 5: Long-Running Job Handlers Timeout
**What goes wrong:** Clicking "Trigger YouTube Sync" in admin panel shows an error after 30 seconds even though the job is running fine.
**Why it happens:** AdminJS action handlers are HTTP request/response cycles with timeouts. Sync jobs can take minutes.
**How to avoid:** Use fire-and-forget pattern: start the job asynchronously (don't await), return success immediately. The job writes its status to `JobExecution` table which the admin can view.
**Warning signs:** Action buttons show errors for long jobs but succeed for fast ones.

### Pitfall 6: Missing triggerSource Distinction
**What goes wrong:** Manual triggers create `JobExecution` records identical to scheduled runs, making it impossible to distinguish them in the admin panel (TRIG-03 requirement).
**Why it happens:** The current `trackJobExecution()` wrapper doesn't accept a source parameter.
**How to avoid:** Add `triggerSource` enum (`SCHEDULED` | `MANUAL`) to the `JobExecution` model. Modify `trackJobExecution()` to accept and persist this parameter. Default to `SCHEDULED` for backward compatibility.
**Warning signs:** All job execution records look the same regardless of how they were triggered.

## Code Examples

### Complete AdminJS Setup File
```typescript
// Source: https://docs.adminjs.co/installation/plugins/express + https://docs.adminjs.co/installation/adapters/prisma
// backend/src/admin/index.ts

import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Database, Resource } from '@adminjs/prisma';
import session from 'express-session';
import Connect from 'connect-pg-simple';
import { prisma } from '../config/database.js';
import { config } from '../config/env.js';
import { resources } from './resources.js';

AdminJS.registerAdapter({ Database, Resource });

export function setupAdminJS() {
  const admin = new AdminJS({
    resources,
    rootPath: '/admin',
    branding: {
      companyName: 'Ankora Admin',
      withMadeWithLove: false,
    },
  });

  const ConnectSession = Connect(session);
  const sessionStore = new ConnectSession({
    conObject: { connectionString: config.database.url },
    tableName: 'admin_sessions',
    createTableIfMissing: true,
  });

  const authenticate = async (email: string, password: string) => {
    if (email === config.admin.email && password === config.admin.password) {
      return { email, id: 'admin' };
    }
    return null;
  };

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookieName: 'adminjs',
      cookiePassword: config.jwt.secret,
    },
    null,
    {
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      secret: config.jwt.secret,
      cookie: {
        httpOnly: true,
        secure: config.isProduction,
      },
      name: 'adminjs',
    }
  );

  return { admin, adminRouter };
}
```

### Resource Definitions with Navigation Groups
```typescript
// Source: https://docs.adminjs.co/basics/resource
// backend/src/admin/resources.ts

import { getModelByName } from '@adminjs/prisma';
import { prisma } from '../config/database.js';

const nav = {
  users:      { name: 'Users',      icon: 'User' },
  content:    { name: 'Content',    icon: 'Document' },
  learning:   { name: 'Learning',   icon: 'Education' },
  platform:   { name: 'Platform',   icon: 'Connect' },
  monitoring: { name: 'Monitoring', icon: 'Activity' },
};

export const resources = [
  // === Users ===
  {
    resource: { model: getModelByName('User'), client: prisma },
    options: {
      navigation: nav.users,
      listProperties: ['id', 'email', 'name', 'plan', 'createdAt'],
      sort: { sortBy: 'createdAt', direction: 'desc' as const },
    },
  },
  {
    resource: { model: getModelByName('UserSettings'), client: prisma },
    options: { navigation: nav.users },
  },
  {
    resource: { model: getModelByName('OAuthAccount'), client: prisma },
    options: { navigation: nav.users },
  },

  // === Content ===
  {
    resource: { model: getModelByName('Content'), client: prisma },
    options: {
      navigation: nav.content,
      listProperties: ['id', 'title', 'platform', 'status', 'userId', 'createdAt'],
      sort: { sortBy: 'createdAt', direction: 'desc' as const },
    },
  },
  {
    resource: { model: getModelByName('Transcript'), client: prisma },
    options: { navigation: nav.content },
  },
  {
    resource: { model: getModelByName('TranscriptCache'), client: prisma },
    options: { navigation: nav.content },
  },
  {
    resource: { model: getModelByName('Tag'), client: prisma },
    options: { navigation: nav.content },
  },

  // === Learning ===
  {
    resource: { model: getModelByName('Quiz'), client: prisma },
    options: { navigation: nav.learning },
  },
  {
    resource: { model: getModelByName('Card'), client: prisma },
    options: { navigation: nav.learning },
  },
  {
    resource: { model: getModelByName('Review'), client: prisma },
    options: {
      navigation: nav.learning,
      sort: { sortBy: 'createdAt', direction: 'desc' as const },
    },
  },
  {
    resource: { model: getModelByName('QuizSession'), client: prisma },
    options: { navigation: nav.learning },
  },
  {
    resource: { model: getModelByName('Streak'), client: prisma },
    options: { navigation: nav.learning },
  },

  // === Platform ===
  {
    resource: { model: getModelByName('ConnectedPlatform'), client: prisma },
    options: { navigation: nav.platform },
  },

  // === Monitoring ===
  {
    resource: { model: getModelByName('JobExecution'), client: prisma },
    options: {
      navigation: nav.monitoring,
      listProperties: ['id', 'jobName', 'status', 'triggerSource', 'startedAt', 'duration'],
      sort: { sortBy: 'startedAt', direction: 'desc' as const },
      actions: {
        // Job trigger actions defined here - see actions.ts pattern
      },
    },
  },
];
```

### Custom Job Trigger Actions
```typescript
// Source: https://docs.adminjs.co/basics/action
// backend/src/admin/actions.ts

import type { ActionHandler } from 'adminjs';
import { triggerJob } from '../workers/scheduler.js';
import { logger } from '../config/logger.js';

const log = logger.child({ component: 'admin-triggers' });

type JobName = Parameters<typeof triggerJob>[0];

function createTriggerAction(jobName: JobName, displayName: string) {
  return {
    actionType: 'resource' as const,
    component: false,
    guard: `Are you sure you want to trigger ${displayName}?`,
    handler: (async (_request, _response, _context) => {
      log.info({ job: jobName }, 'Manual trigger from admin panel');
      // Fire and forget - don't await long-running jobs
      triggerJob(jobName).catch(err =>
        log.error({ err, job: jobName }, 'Manual trigger failed')
      );
      return {
        notice: { message: `${displayName} triggered successfully`, type: 'success' },
        records: [],
      };
    }) as ActionHandler<any, any>,
  };
}

export const jobTriggerActions = {
  triggerYoutubeSync:             createTriggerAction('youtube', 'YouTube Sync'),
  triggerSpotifySync:             createTriggerAction('spotify', 'Spotify Sync'),
  triggerTiktokSync:              createTriggerAction('tiktok', 'TikTok Sync'),
  triggerInstagramSync:           createTriggerAction('instagram', 'Instagram Sync'),
  triggerYoutubeTranscription:    createTriggerAction('transcription', 'YouTube Transcription'),
  triggerPodcastTranscription:    createTriggerAction('podcast-transcription', 'Podcast Transcription'),
  triggerTiktokTranscription:     createTriggerAction('tiktok-transcription', 'TikTok Transcription'),
  triggerInstagramTranscription:  createTriggerAction('instagram-transcription', 'Instagram Transcription'),
  triggerQuizGeneration:          createTriggerAction('quiz-generation', 'Quiz Generation'),
  triggerReminder:                createTriggerAction('reminder', 'Reminder'),
  triggerAutoTagging:             createTriggerAction('auto-tagging', 'Auto-Tagging'),
};
```

### Prisma Schema Migration for triggerSource
```prisma
// Add to JobExecution model in schema.prisma

enum TriggerSource {
  SCHEDULED
  MANUAL
}

model JobExecution {
  // ... existing fields ...
  triggerSource  TriggerSource @default(SCHEDULED)
  // ...
}
```

### Modified trackJobExecution with triggerSource
```typescript
// Modified backend/src/workers/jobExecutionTracker.ts
export async function trackJobExecution(
  jobName: string,
  job: () => Promise<void>,
  triggerSource: 'SCHEDULED' | 'MANUAL' = 'SCHEDULED'
): Promise<void> {
  // ...
  const execution = await prisma.jobExecution.create({
    data: {
      jobName,
      status: 'RUNNING',
      triggerSource,
    },
  });
  // ... rest unchanged
}
```

### Modified index.ts Middleware Ordering
```typescript
// In backend/src/index.ts

import { setupAdminJS } from './admin/index.js';

const app = express();

// Security middleware (helmet already has contentSecurityPolicy: false)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS
app.use(cors({ /* existing config */ }));

// Trust proxy
app.set('trust proxy', 1);

// Mount AdminJS BEFORE rate limiter (ADM-05)
const { admin, adminRouter } = setupAdminJS();
app.use(admin.options.rootPath, adminRouter);

// Rate limiting - only for /api routes (excludes /admin)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Body parsing, routes, etc.
app.use(express.json());
// ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AdminJS.bundle()` for components | `ComponentLoader` class | AdminJS v7 (2023) | Must use ComponentLoader for any custom React components |
| `admin.overrideLogin()` | `componentLoader.override('Login', ...)` | AdminJS v7 (2023) | Login page customization API changed |
| `@adminjs/prisma` v4 with `_baseDmmf` | `@adminjs/prisma` v5 with `getModelByName()` | July 2023 | Model registration simplified, DMMF internals hidden |
| CJS + ESM dual support | ESM-only | AdminJS v7 (2023) | Project already ESM (Phase 1), no impact |
| `@adminjs/prisma` Prisma v5 only | Prisma v5 + v6 support | `@adminjs/prisma` v5.0.4 (June 2025) | Full compatibility with project's Prisma v6.2.1 |

**Deprecated/outdated:**
- `AdminJS.bundle()` - removed in v7, use `ComponentLoader` instead
- `admin.overrideLogin()` - removed in v7
- `_baseDmmf` / `_dmmf` Prisma internals - use `getModelByName()` helper
- `styled-components` direct import - must import from `@adminjs/design-system/styled-components`

## Open Questions

1. **AdminJS Icon Names**
   - What we know: Navigation groups accept an `icon` property. AdminJS uses its own icon set.
   - What's unclear: The exact icon names available (e.g., `'User'`, `'Document'`). The docs reference them but don't provide a complete list.
   - Recommendation: Use common names like `'User'`, `'Document'`, `'Settings'`. Test in development and adjust. AdminJS falls back to a default icon if the name doesn't match.

2. **11 Trigger Actions UI Space**
   - What we know: Each trigger action becomes a button in the resource action bar. 11 buttons may crowd the UI.
   - What's unclear: How AdminJS displays many resource actions -- does it collapse into a dropdown?
   - Recommendation: AdminJS supports `parent` property for action grouping into dropdowns. If 11 buttons are too many, group them under categories like "Sync Jobs", "Transcription Jobs", "Processing Jobs". Validate during development.

3. **connect-pg-simple Table in Supabase**
   - What we know: `connect-pg-simple` creates a `session` or custom-named table. Supabase is the PostgreSQL provider.
   - What's unclear: Whether `createTableIfMissing: true` works with Supabase's pooler connection string. Supabase may have restrictions on DDL operations through the pooler.
   - Recommendation: Use the `DIRECT_URL` connection string for the session store (bypasses pooler), or create the session table manually via Prisma migration. Test during development.

## Sources

### Primary (HIGH confidence)
- [AdminJS Getting Started](https://docs.adminjs.co/installation/getting-started) - ESM requirements, core setup
- [AdminJS Express Plugin](https://docs.adminjs.co/installation/plugins/express) - `buildAuthenticatedRouter`, session config, authentication
- [AdminJS Prisma Adapter](https://docs.adminjs.co/installation/adapters/prisma) - `getModelByName`, resource registration
- [AdminJS v7 Migration Guide](https://docs.adminjs.co/installation/migration-guide-v7) - Breaking changes, ESM requirement, ComponentLoader
- [AdminJS Custom Actions](https://docs.adminjs.co/basics/action) - Action types, `component: false`, handler signature, guard
- [AdminJS Resource Configuration](https://docs.adminjs.co/basics/resource) - Navigation groups, property visibility, listProperties, sort
- [adminjs-prisma GitHub README](https://github.com/SoftwareBrothers/adminjs-prisma/blob/main/README.md) - getModelByName usage, clientModule
- [adminjs-prisma Releases](https://github.com/SoftwareBrothers/adminjs-prisma/releases) - v5 changelog, Prisma v6 support
- npm registry: `adminjs@7.8.17`, `@adminjs/express@6.1.1`, `@adminjs/prisma@5.0.4` (verified via `npm view`)

### Secondary (MEDIUM confidence)
- [AdminJS v7 NestJS setup](https://dev.to/arab0v/adminjs-v7-in-classic-nestjs-without-tears-23en) - peer dependency list confirmation
- [express-rate-limit GitHub](https://github.com/express-rate-limit/express-rate-limit) - `skip` option for excluding paths
- [PM2 Cluster Mode docs](https://pm2.keymetrics.io/docs/usage/cluster-mode/) - Session store requirement for cluster mode

### Tertiary (LOW confidence)
- AdminJS icon names - referenced in docs but no complete list found. Needs validation during development.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified via npm registry, official docs confirm compatibility, Prisma v6 explicitly supported by `@adminjs/prisma@5.0.4`
- Architecture: HIGH - Patterns verified against official AdminJS docs and example app, Express + Prisma integration well-documented
- Pitfalls: HIGH - PM2 cluster session issue is well-documented in PM2 and express-session docs, rate limiter ordering is standard Express middleware knowledge
- Custom actions: MEDIUM - `component: false` with `actionType: 'resource'` pattern verified in docs but 11 concurrent actions on one resource is an unusual pattern that needs UI validation

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (stable ecosystem, AdminJS v7 is mature)
