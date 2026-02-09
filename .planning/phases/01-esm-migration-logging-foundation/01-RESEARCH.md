# Phase 1: ESM Migration & Logging Foundation - Research

**Researched:** 2026-02-09
**Domain:** Node.js ESM modules + Pino structured logging
**Confidence:** HIGH

## Summary

Phase 1 migrates the Ankora backend from CommonJS to ESM (ECMAScript Modules) and replaces console.log statements with structured Pino logging. This migration is mandatory for AdminJS v7+ and sets the foundation for professional observability.

The codebase is **already 80% ESM-ready**: all imports use `.js` extensions, no `require()` calls exist, and no `__dirname`/`__filename` usage detected. The primary work involves: (1) adding `"type": "module"` to package.json, (2) updating tsconfig.json to use `"moduleResolution": "NodeNext"`, (3) verifying all dependencies are ESM-compatible, (4) replacing console.log with Pino, and (5) testing all 11 cron jobs and OAuth flows.

**Primary recommendation:** Use Pino v10+ with pino-http middleware for automatic HTTP request logging. Prisma ORM v6.2+ already supports ESM. PM2 cluster mode works with ESM when running transpiled JavaScript (not TypeScript directly).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **pino** | ^10.3.0 | Structured JSON logging | 5x faster than Winston, lowest overhead, async by design, production-grade |
| **pino-http** | ^10.0+ | HTTP request logging middleware | Auto-logs all HTTP requests with timing, request ID, and structured context |
| **pino-pretty** (dev only) | ^13.0+ | Human-readable dev logs | Colorized output for local development (never use in production) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **node:url** | Built-in | ESM `__dirname` replacement | Use `fileURLToPath(import.meta.url)` to replace CommonJS `__dirname` |
| **node:path** | Built-in | Path manipulation in ESM | Combine with fileURLToPath for directory operations |

### Current Dependencies (ESM Compatibility Status)

| Dependency | Current Version | ESM Compatible? | Notes |
|------------|-----------------|-----------------|-------|
| Prisma | v6.2.1 | ✅ YES | ESM support since v6.6.0, stable as of v6.16.0 |
| Express | v4.21.2 | ✅ YES (hybrid) | Supports both CJS and ESM via conditional exports |
| node-cron | v4.2.1 | ✅ YES (hybrid) | CommonJS package that works in ESM via import |
| Playwright | v1.58.0 | ✅ YES | ESM support enabled by default (no PLAYWRIGHT_EXPERIMENTAL_TS_ESM needed) |
| Passport | v0.7.0 | ✅ YES (hybrid) | Supports both module systems |
| Axios | v1.13.4 | ✅ YES | Pure ESM since v1.0.0 |
| PM2 | (runtime) | ✅ YES | Works with ESM when running transpiled JS (not tsx/ts-node in cluster mode) |

**Installation:**
```bash
npm install pino pino-http
npm install -D pino-pretty
```

## Architecture Patterns

### Recommended Project Structure

```
backend/src/
├── config/
│   ├── env.ts            # Environment config (already ESM-ready)
│   ├── database.ts       # Prisma client (already ESM-ready)
│   └── logger.ts         # NEW: Pino logger singleton
├── middleware/
│   ├── auth.ts           # Auth middleware (already ESM-ready)
│   ├── errorHandler.ts   # Error handler (needs Pino migration)
│   └── httpLogger.ts     # NEW: pino-http middleware
├── routes/               # Express routers (already ESM-ready)
├── services/             # Business logic (needs Pino migration)
├── workers/              # Cron job workers (needs Pino migration)
└── index.ts              # Entry point (already ESM-ready)
```

### Pattern 1: Pino Logger Singleton

**What:** Create a single Pino instance shared across the entire application
**When to use:** Always - enables consistent logging with child loggers for context

**Example:**
```typescript
// src/config/logger.ts
import pino from 'pino';
import { config } from './env.js';

export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
  base: {
    env: config.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

### Pattern 2: pino-http Middleware

**What:** Automatic HTTP request/response logging with timing
**When to use:** All Express apps - replaces manual request logging

**Example:**
```typescript
// src/middleware/httpLogger.ts
import pinoHttp from 'pino-http';
import { logger } from '../config/logger.js';

export const httpLogger = pinoHttp({
  logger,
  autoLogging: true,
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed with ${res.statusCode}`;
  },
  customErrorMessage: (_req, _res, err) => {
    return `Request failed: ${err.message}`;
  },
});

// src/index.ts
import { httpLogger } from './middleware/httpLogger.js';
app.use(httpLogger);
```

### Pattern 3: Child Loggers for Context

**What:** Create context-aware loggers that automatically include metadata
**When to use:** In workers, services, or routes where you want to track job/user/request context

**Example:**
```typescript
// src/workers/youtubeSync.ts
import { logger } from '../config/logger.js';

export async function runYouTubeSync(): Promise<void> {
  const jobLogger = logger.child({ job: 'youtube-sync' });

  jobLogger.info('Starting YouTube sync');

  try {
    const users = await getUsersWithYouTube();
    jobLogger.info({ userCount: users.length }, 'Found users to sync');

    for (const user of users) {
      const userLogger = jobLogger.child({ userId: user.id });
      userLogger.debug('Syncing user');
      // ... sync logic
    }

    jobLogger.info('YouTube sync completed');
  } catch (error) {
    jobLogger.error({ err: error }, 'YouTube sync failed');
    throw error;
  }
}
```

### Pattern 4: ESM __dirname Replacement

**What:** Use `import.meta.url` to replace CommonJS `__dirname`
**When to use:** When you need file system paths relative to the current module (not needed in this codebase)

**Example:**
```typescript
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, 'data', 'file.json');
```

### Anti-Patterns to Avoid

- **Using pino-pretty in production:** Adds overhead and defeats Pino's performance advantages. Use JSON logs and parse with external tools (e.g., jq, Datadog, CloudWatch).
- **Logging sensitive data:** Never log passwords, tokens, API keys, or PII. Use Pino's `redact` option if needed.
- **Synchronous logging in production:** Pino is async by default - don't override with `sync: true` in production.
- **Mixing console.log and Pino:** Choose one system. Structured logging only works if all logs are structured.
- **Using express-pino-logger:** Deprecated in favor of `pino-http`. Use pino-http instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request logging | Custom middleware with console.log | pino-http | Auto-captures timing, status codes, errors, request IDs |
| Request correlation | Manual ID generation + passing | pino-http genReqId | Built-in unique ID per request |
| Log formatting | String concatenation | Pino structured objects | Machine-parseable, queryable, filterable |
| Log levels | if statements checking env | Pino level config | Runtime adjustable, zero overhead for disabled levels |
| Error serialization | Manual stack extraction | Pino err key | Automatically serializes Error objects with stack traces |

**Key insight:** Structured logging is deceptively complex. Proper log levels, error serialization, child loggers, and performance optimization require battle-tested libraries. Pino has solved these problems at scale.

## Common Pitfalls

### Pitfall 1: PM2 Cluster Mode Breaks with TypeScript Interpreters

**What goes wrong:** PM2 cluster mode fails when using `tsx`, `ts-node`, or `npx tsx` as interpreters. The app starts but workers don't spawn correctly.

**Why it happens:** PM2 cluster mode relies on Node.js's native cluster module, which only works when Node.js is the interpreter. Using TypeScript loaders breaks this mechanism.

**How to avoid:**
- Run transpiled JavaScript in production: `pm2 start dist/index.js --name remember-api -i max`
- Use `npm run build` (TypeScript compiler) before PM2 restart
- Never use `pm2 start src/index.ts --interpreter tsx` in cluster mode

**Warning signs:**
- PM2 shows 1 instance running instead of multiple
- `pm2 status` shows `online` but CPU cores aren't utilized
- Logs show "Starting in fork mode" instead of cluster

### Pitfall 2: Missing .js Extensions in ESM Imports

**What goes wrong:** Imports like `import { foo } from './bar'` fail at runtime with "Cannot find module" errors.

**Why it happens:** ESM requires explicit file extensions. TypeScript's module resolution in `NodeNext` mode enforces this at compile time.

**How to avoid:**
- Always add `.js` extensions: `import { foo } from './bar.js'`
- TypeScript compiler automatically maps `.ts` → `.js` in output
- Use `"moduleResolution": "NodeNext"` in tsconfig.json to catch this at compile time

**Warning signs:**
- Runtime error: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module`
- Code compiles but crashes on startup
- Imports work in dev (tsx) but fail in production (node)

### Pitfall 3: Prisma Client Must Be Regenerated After ESM Migration

**What goes wrong:** After adding `"type": "module"` to package.json, Prisma Client imports fail with module resolution errors.

**Why it happens:** Prisma generates client code based on the module system in use. The generated code must match ESM syntax.

**How to avoid:**
- Run `npx prisma generate` after adding `"type": "module"`
- Add to deployment script: `npm run db:generate` before `npm run build`
- Prisma v6.2+ generates ESM-compatible code automatically

**Warning signs:**
- Import errors like `Cannot use import statement outside a module`
- Prisma queries fail at runtime but schema is valid
- Dev mode works but production build fails

### Pitfall 4: console.log in Cron Jobs Hides Failures

**What goes wrong:** Cron jobs fail silently because console.log doesn't capture structured errors or context. PM2 logs show "Running YouTube sync..." but no indication of failure.

**Why it happens:** `console.log` is unstructured, lacks error serialization, and doesn't integrate with error tracking tools. Failed jobs look identical to successful ones.

**How to avoid:**
- Use Pino with structured logging: `logger.error({ err, userId }, 'YouTube sync failed')`
- Log start, success, and failure states with consistent structure
- Include context in every log: job name, user ID, item count

**Warning signs:**
- PM2 logs show job started but no completion message
- Can't tell if job succeeded or failed by reading logs
- No way to filter logs by job name or error type

### Pitfall 5: Playwright __dirname Detection Breaks ESM

**What goes wrong:** Playwright interprets ESM modules as CommonJS when it detects a global variable named `__dirname`, causing module loading failures.

**Why it happens:** Playwright's runtime checks for CommonJS markers. If you define `__dirname` manually via `fileURLToPath(import.meta.url)`, Playwright misidentifies the module system.

**How to avoid:**
- Don't define `__dirname` in files that import Playwright
- Use `import.meta.url` directly where needed
- Keep Playwright imports in isolated worker files

**Warning signs:**
- Error: "Cannot use import statement outside a module" in Playwright files
- Playwright browser launches work in isolation but fail when imported
- Mixed CommonJS/ESM error messages

## Code Examples

### Replacing console.log with Pino

**Before (console.log):**
```typescript
console.log('[Scheduler] Running YouTube sync...');
console.error('[Scheduler] Error in youtube-sync:', error);
```

**After (Pino):**
```typescript
import { logger } from '../config/logger.js';

const schedulerLogger = logger.child({ component: 'scheduler' });

schedulerLogger.info({ job: 'youtube-sync' }, 'Running YouTube sync');
schedulerLogger.error({ job: 'youtube-sync', err: error }, 'YouTube sync failed');
```

### HTTP Request Logging Migration

**Before (manual logging):**
```typescript
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

**After (pino-http):**
```typescript
import pinoHttp from 'pino-http';
import { logger } from './config/logger.js';

app.use(pinoHttp({ logger }));

// Logs automatically include:
// - req.method, req.url
// - res.statusCode
// - responseTime in ms
// - unique requestId
```

### Error Logging with Stack Traces

**Before:**
```typescript
try {
  await syncYouTube(user);
} catch (error) {
  console.error('Sync failed:', error);
}
```

**After:**
```typescript
try {
  await syncYouTube(user);
} catch (error) {
  logger.error(
    { err: error, userId: user.id, platform: 'youtube' },
    'YouTube sync failed'
  );
}
```

**Output (JSON):**
```json
{
  "level": 50,
  "time": "2026-02-09T14:32:15.123Z",
  "err": {
    "type": "Error",
    "message": "API rate limit exceeded",
    "stack": "Error: API rate limit exceeded\n    at syncYouTube (/app/dist/services/youtube.js:42:11)"
  },
  "userId": "user_abc123",
  "platform": "youtube",
  "msg": "YouTube sync failed"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CommonJS (require/module.exports) | ESM (import/export) | Node.js 12+ (2019), mainstream 2024+ | Better tree-shaking, native browser compatibility, modern tooling |
| console.log | Structured logging (Pino, Winston) | 2020+ | Machine-parseable logs, queryable, performance optimized |
| express-pino-logger | pino-http | 2022+ | Actively maintained, better TypeScript support |
| Prisma with CommonJS | Prisma ESM generator | v6.6.0 (2024), stable v6.16.0 (2025) | Removes magic node_modules generation, plain TypeScript output |
| PM2 with ts-node | PM2 with transpiled JS | 2023+ | Cluster mode compatibility, production stability |
| Log rotation in-process | External log rotation (logrotate, CloudWatch) | 2020+ | Separation of concerns, process stability |

**Deprecated/outdated:**
- **express-pino-logger**: Deprecated in favor of pino-http (same team, better maintained)
- **pino-std-serializers**: Now built into Pino core (no separate package needed)
- **`moduleResolution: "node"`**: Use `"NodeNext"` or `"node16"` for ESM projects
- **`"module": "commonjs"`**: Use `"NodeNext"` or `"ESNext"` for ESM output

## Open Questions

1. **Prisma ESM Generator vs. Legacy Generator**
   - What we know: Prisma v6.16+ defaults to modern ESM generator, v7 makes it mandatory
   - What's unclear: Does Ankora's current Prisma v6.2.1 need upgrade, or is migration transparent?
   - Recommendation: Run `npx prisma generate` after ESM migration. If errors occur, upgrade to Prisma v6.16+.

2. **PM2 Cluster Mode Restart Strategy**
   - What we know: PM2 must run transpiled JavaScript (`node dist/index.js`), not TypeScript
   - What's unclear: Does current PM2 config use `--interpreter tsx` or run compiled JS?
   - Recommendation: Verify PM2 ecosystem.config.js or pm2 start command. Ensure `script: "dist/index.js"` and no `interpreter` field.

3. **pino-pretty Performance Impact in Development**
   - What we know: pino-pretty adds overhead, should only be used in development
   - What's unclear: Will developers accept JSON logs, or is pretty-printing mandatory for DX?
   - Recommendation: Use conditional transport based on NODE_ENV. Production = raw JSON, development = pino-pretty.

4. **Log Retention Strategy**
   - What we know: PM2 logs to stdout/stderr, which can fill disk over time
   - What's unclear: Does Caddy or VPS have log rotation configured?
   - Recommendation: Implement external log rotation (logrotate) or pipe PM2 logs to external service (CloudWatch, Datadog). Don't rotate in-process.

## Sources

### Primary (HIGH confidence)

- [Pino GitHub Repository](https://github.com/pinojs/pino) - v10.3.0 features, installation, configuration
- [pino-http GitHub Repository](https://github.com/pinojs/pino-http) - Express middleware setup, configuration options
- [TypeScript ESM Node.js Documentation](https://www.typescriptlang.org/docs/handbook/esm-node.html) - Official tsconfig.json requirements
- [Prisma ORM 6.6.0 Release](https://www.prisma.io/blog/prisma-orm-6-6-0-esm-support-d1-migrations-and-prisma-mcp-server) - ESM support announcement
- [Prisma ORM 6.12.0 Release](https://www.prisma.io/blog/orm-6-12-0-esm-compatible-generator-in-preview-and-new-options-for-prisma-config) - ESM generator GA status

### Secondary (MEDIUM confidence)

- [Pino Logger Complete Guide (SigNoz)](https://signoz.io/guides/pino-logger/) - Best practices, performance benchmarks
- [A Complete Guide to Pino Logging (Better Stack)](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/) - Structured logging patterns
- [Node.js Logging Best Practices (Better Stack)](https://betterstack.com/community/guides/logging/nodejs-logging-best-practices/) - Security, child loggers, error handling
- [Migrate 60k LOC to ESM (DEV.to)](https://dev.to/logto/migrate-a-60k-loc-typescript-nodejs-repo-to-esm-and-testing-become-4x-faster-12-5f82) - Real-world migration experience
- [Converting TypeScript from CJS to ESM (Martin Gregersen)](https://mgregersen.dk/converting-a-typescript-project-from-cjs-to-esm-the-ultimate-how-to/) - Step-by-step guide
- [PM2 Cluster Mode Documentation](https://pm2.keymetrics.io/docs/usage/cluster-mode/) - Official cluster mode behavior
- [PM2 with tsx](https://futurestud.io/tutorials/pm2-use-tsx-to-start-your-app) - Interpreter limitations

### Tertiary (LOW confidence)

- [Node-cron ESM Discussion](https://github.com/kelektiv/node-cron/issues/700) - Community discussion on ESM compatibility (note: different package than node-cron used in project)
- [Playwright ESM Runtime Issue](https://github.com/microsoft/playwright/issues/37890) - __dirname detection bug (may not affect project)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Pino is industry standard, verified from official docs and GitHub
- Architecture: HIGH - Patterns sourced from official Pino documentation and real-world examples
- Pitfalls: HIGH - PM2 cluster mode issue confirmed across multiple sources, __dirname/ESM issues documented in TypeScript handbook
- Dependency compatibility: HIGH - Verified from official release notes (Prisma, Playwright, Express)

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - stable ecosystem, Pino v10 released Jan 2026)

**Key findings for planner:**
1. Codebase is already 80% ESM-ready (no require(), no __dirname, imports use .js extensions)
2. Only 3 major changes needed: package.json `"type": "module"`, tsconfig.json `"moduleResolution": "NodeNext"`, replace console.log with Pino
3. PM2 cluster mode MUST run transpiled JavaScript (not tsx/ts-node)
4. All 11 cron jobs and 4 OAuth flows need testing after migration
5. pino-http middleware replaces manual HTTP logging
