# Feature Landscape: Admin Panel & Backend Observability

**Domain:** Admin dashboard with cron job monitoring and database management
**Researched:** 2026-02-09

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **CRUD Database Operations** | Core purpose of admin panels—managing data without SQL | Low | AdminJS handles automatically via schema introspection |
| **Job Execution Status** | Must know if jobs succeeded/failed at a glance | Low | Binary status (success/fail) per job run |
| **Job Execution History** | Troubleshooting requires reviewing past runs | Medium | PostgreSQL table with automatic cleanup (7-30 day retention) |
| **Error Message Display** | When jobs fail, need to see why | Low | Display stderr/exception from failed runs |
| **Authentication/Authorization** | Admin panels contain sensitive data | Low | Single-user case = simple session/JWT auth |
| **Filtering & Search** | Finding specific records in large datasets | Low | AdminJS provides out-of-box for database models |
| **Real-time Job Status Updates** | Stale data undermines confidence in monitoring | Medium | SSE (Server-Sent Events) preferred over WebSocket for unidirectional updates |
| **Job Duration Tracking** | Performance regression detection requires timing | Low | Store `start_time` and `end_time` per execution |
| **Success/Failure Rate Metrics** | Quick health assessment of each job type | Low | Aggregate query over execution history |
| **Recent Activity Dashboard** | Landing page should show "what's happening now" | Low | Last 10-20 executions across all jobs |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Job Execution Timeline Visualization** | Quickly spot patterns, overlaps, and gaps in scheduling | High | Event timeline UI showing parallel execution and dependencies |
| **Resource Usage Per Job** | Identify memory leaks or CPU-heavy operations | High | Requires instrumentation in each worker (memory, CPU snapshots) |
| **Alerting Integration** | Proactive notification of failures | Medium | Slack/Discord/Email webhooks on job failure threshold |
| **Automatic Job Retry Logic** | Self-healing system reduces manual intervention | Medium | Exponential backoff with max retry count |
| **Performance Trend Analysis** | Detect gradual degradation before it becomes critical | Medium | Charts showing duration over time per job type |
| **Job Dependency Graph** | Visualize which jobs must run before others | High | Useful only if inter-job dependencies exist (likely NO for Ankora) |
| **Manual Job Trigger** | Run jobs on-demand for testing or recovery | Low | Exposes existing worker functions via admin UI button |
| **Job Output/Logs Streaming** | Watch jobs execute in real-time like `tail -f` | Medium | SSE stream of stdout/stderr during execution |
| **Custom Actions on Records** | Bulk operations beyond CRUD (e.g., "Regenerate all quiz for this user") | Medium | AdminJS supports custom actions per resource |
| **Job Pause/Resume** | Temporarily disable jobs without code changes | Low | Flag in database + scheduler checks before running |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Multi-tenancy/Role-Based Access** | Solo developer = single user, adds complexity for no benefit | Use simple authentication (session or API key) |
| **Advanced Scheduling UI** | Cron expressions work fine, visual scheduler is overkill | Keep cron strings in code or simple config file |
| **Data Export in Multiple Formats** | CSV is sufficient for solo dev use case | AdminJS default CSV export |
| **Custom Dashboard Builder** | Draggable widgets = wasted time for fixed-purpose tool | Hard-code dashboard layout with sensible defaults |
| **Audit Log for Data Changes** | Solo developer knows what they changed | Skip unless regulatory requirement |
| **Multi-language Support** | English-only for solo developer | Hard-code UI strings |
| **Mobile-Responsive Admin Panel** | Admin work happens at desk, mobile admin is rare | Desktop-first, mobile acceptable but not optimized |
| **Granular Permissions** | "View-only", "Edit-only" modes meaningless for single user | All-or-nothing access after login |
| **Advanced Query Builder** | Raw SQL in database tool is faster than visual builder | Rely on database client for complex queries |
| **Job Orchestration/DAGs** | No dependencies between Ankora jobs (all independent) | Keep simple cron-based execution |

## Feature Dependencies

```
Authentication (required)
  └─> Database CRUD (requires authenticated user)
  └─> Job History View (requires authenticated user)

Job Execution History (required)
  └─> Performance Trend Analysis (requires historical data)
  └─> Success/Failure Rate Metrics (requires historical data)
  └─> Job Execution Timeline (requires historical data)

Real-time Updates (optional but highly valuable)
  └─> Job Status Display (enhances UX but not required)
  └─> Job Output Streaming (depends on real-time transport layer)
```

## MVP Recommendation

### Prioritize (Phase 1 - Foundation):
1. **Authentication** — Protect admin panel with simple session/JWT
2. **AdminJS Integration** — Database CRUD for User, Content, Quiz, Card, Review models
3. **Job Execution History Table** — PostgreSQL table with jobName, status, startTime, endTime, errorMessage
4. **Basic Dashboard** — Homepage showing recent 20 job executions (table view)
5. **Job Status Endpoint** — GET `/api/admin/jobs/recent` returns last N executions

### Prioritize (Phase 2 - Essential Monitoring):
6. **Success/Failure Rate Metrics** — Dashboard cards showing % success per job type (last 24h)
7. **Error Message Display** — Click execution to see full error details
8. **Manual Job Trigger** — POST `/api/admin/jobs/:jobName/trigger` to run on-demand
9. **Job Duration Tracking** — Display average duration and flag slow executions

### Prioritize (Phase 3 - Enhanced Visibility):
10. **Real-time Job Status Updates** — SSE endpoint streaming job completions to dashboard
11. **Performance Trend Charts** — Line chart showing duration over time per job
12. **Job Pause/Resume** — Disable jobs via UI without redeploying

### Defer:
- **Resource Usage Per Job** — Requires complex instrumentation, defer unless performance issues arise
- **Job Execution Timeline Visualization** — Nice-to-have, but table view sufficient for solo dev
- **Alerting Integration** — Add only if developer isn't checking dashboard regularly
- **Job Output Streaming** — Complex to implement, logs via PM2/SSH sufficient initially
- **Custom Actions on Records** — Wait for actual use case before building generic framework
- **Job Dependency Graph** — Ankora jobs are independent, no dependencies to visualize

## Complexity Analysis

| Complexity | Features | Estimated Effort |
|------------|----------|------------------|
| **Low** | CRUD, authentication, job status, duration tracking, success rate, manual trigger, pause/resume | 1-2 days |
| **Medium** | Job history table design, real-time SSE updates, error display, trend charts, alerting, retry logic | 3-5 days |
| **High** | Timeline visualization, resource tracking, job orchestration, output streaming | 1-2 weeks |

**Recommendation:** Focus on Low + Medium complexity features for MVP. High complexity features offer diminishing returns for solo developer use case.

## Real-time Transport Decision

**Recommendation: Server-Sent Events (SSE) over WebSockets**

| Criterion | SSE | WebSocket |
|-----------|-----|-----------|
| **Use Case Fit** | Perfect for unidirectional server→client updates | Overkill for admin dashboard (no client→server real-time needed) |
| **Implementation** | Native EventSource API in browsers, simple Express endpoint | Requires `ws` library, connection management, reconnection logic |
| **HTTP/2 Support** | Multiple SSE streams share single TCP connection | Separate protocol, doesn't benefit from HTTP/2 multiplexing |
| **Mobile Performance** | HTTP/3 + QUIC improves reliability on unreliable networks | More complex over poor connections |
| **Complexity** | ~20 lines of code | ~100+ lines with proper error handling |
| **Auto-Reconnect** | Built into EventSource API | Must implement manually |

**Conclusion:** SSE is the 2026 best practice for 95% of real-time dashboard use cases. Reserve WebSockets for bidirectional communication needs (chat, collaborative editing).

## Database Schema Recommendations

### Job Execution History Table

```sql
CREATE TABLE job_executions (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'success', 'failure', 'running'
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ms INTEGER, -- Computed: (end_time - start_time) in milliseconds
  error_message TEXT,
  metadata JSONB, -- Flexible storage for job-specific data (e.g., records_synced, api_calls_made)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_executions_job_name ON job_executions(job_name);
CREATE INDEX idx_job_executions_start_time ON job_executions(start_time DESC);
CREATE INDEX idx_job_executions_status ON job_executions(status);
```

### Automatic Cleanup (Prevent Unbounded Growth)

**Critical Best Practice:** Schedule daily cleanup to prevent `job_executions` table from growing indefinitely.

```sql
-- Keep 30 days of history (adjust retention period based on needs)
DELETE FROM job_executions
WHERE start_time < NOW() - INTERVAL '30 days';
```

**Implementation Options:**
1. Add as 12th cron job in `scheduler.ts`
2. Use PostgreSQL `pg_cron` extension (if available on Supabase)
3. Manual periodic cleanup via admin panel button

**Recommendation:** Option 1 (cron job in application code) for simplicity and portability.

## Integration with Existing Codebase

### Minimal Changes Required

**Current State:** 11 workers in `backend/src/workers/scheduler.ts` with `runningJobs` Set for overlap protection.

**Required Modifications:**

1. **Wrap Each Worker Function:**
   ```typescript
   async function runJobWithTracking(jobName: string, jobFn: () => Promise<void>) {
     const startTime = new Date();
     const execution = await prisma.jobExecution.create({
       data: { jobName, status: 'running', startTime }
     });

     try {
       await jobFn();
       await prisma.jobExecution.update({
         where: { id: execution.id },
         data: {
           status: 'success',
           endTime: new Date(),
           durationMs: Date.now() - startTime.getTime()
         }
       });
     } catch (error) {
       await prisma.jobExecution.update({
         where: { id: execution.id },
         data: {
           status: 'failure',
           endTime: new Date(),
           durationMs: Date.now() - startTime.getTime(),
           errorMessage: error.message
         }
       });
     }
   }
   ```

2. **Add SSE Endpoint (Optional but Recommended):**
   ```typescript
   app.get('/api/admin/jobs/stream', (req, res) => {
     res.setHeader('Content-Type', 'text/event-stream');
     res.setHeader('Cache-Control', 'no-cache');
     res.setHeader('Connection', 'keep-alive');

     const sendEvent = (data: any) => {
       res.write(`data: ${JSON.stringify(data)}\n\n`);
     };

     // Emit job completions in real-time
     // (Implementation depends on event emitter in worker)
   });
   ```

3. **Add AdminJS Route:**
   ```typescript
   import AdminJS from 'adminjs';
   import AdminJSExpress from '@adminjs/express';

   const adminJs = new AdminJS({
     resources: [
       { resource: prisma.user },
       { resource: prisma.content },
       { resource: prisma.quiz },
       { resource: prisma.jobExecution, options: {
         sort: { sortBy: 'startTime', direction: 'desc' }
       }}
     ]
   });

   const adminRouter = AdminJSExpress.buildRouter(adminJs);
   app.use('/admin', adminRouter);
   ```

**Estimated Implementation Time:** 4-6 hours for MVP (Phase 1 features).

## Sources

### Admin Panel Best Practices
- [Admin Dashboard: Ultimate Guide, Templates & Examples (2026)](https://www.weweb.io/blog/admin-dashboard-ultimate-guide-templates-examples)
- [How to Create a Good Admin Panel: Design Tips & Features List](https://aspirity.com/blog/good-admin-panel-design)

### Cron Job Monitoring
- [How to Monitor Cron Jobs in 2026: A Complete Guide](https://dev.to/cronmonitor/how-to-monitor-cron-jobs-in-2026-a-complete-guide-28g9)
- [Cron Monitoring & Scheduled Task Tracking | Simple Observability](https://simpleobservability.com/cron-monitoring)
- [Dedicated Job Observability in Grafana Cloud Kubernetes Monitoring](https://grafana.com/whats-new/2025-10-22-dedicated-job-observability-in-grafana-cloud-kubernetes-monitoring/)

### AdminJS
- [AdminJS - the leading open-source admin panel for Node.js apps](https://adminjs.co/)
- [GitHub - SoftwareBrothers/adminjs](https://github.com/SoftwareBrothers/adminjs)
- [AdminJS Documentation](https://docs.adminjs.co/)

### Error Tracking
- [Error Tracking Monitor | Datadog](https://docs.datadoghq.com/monitors/types/error_tracking/)
- [Track Backend Error Logs | Datadog](https://docs.datadoghq.com/logs/error_tracking/backend/)

### Job Execution History
- [GitHub - citusdata/pg_cron: Run periodic jobs in PostgreSQL](https://github.com/citusdata/pg_cron)
- [using and monitoring pg_cron](https://postgres.hashnode.dev/project-openinsight-analyze-the-history-of-postgres-pgcron-jobs)

### MVP Development
- [Can a Solo Developer Build a SaaS App Successfully?](https://www.softsuave.com/blog/can-a-solo-developer-build-a-saas-app/)
- [The Software Building Process Solo: What You Should Know As An Indie Developer In 2026](https://nasilemaktech.com/the-software-building-process-solo-what-you-should-know-as-an-indie-developer-in-2026/)

### Anti-Patterns
- [Top 5 Software Anti Patterns to Avoid for Better Development Outcomes](https://www.bairesdev.com/blog/software-anti-patterns/)
- [Eight project management anti-patterns and how to avoid them](https://www.catalyte.io/insights/project-management-anti-patterns/)

### Real-Time Updates
- [Why Server-Sent Events Beat WebSockets for 95% of Real-Time Cloud Applications](https://medium.com/codetodeploy/why-server-sent-events-beat-websockets-for-95-of-real-time-cloud-applications-830eff5a1d7c)
- [Server-Sent Events vs WebSockets: Key Differences and Use Cases in 2026](https://www.nimbleway.com/blog/server-sent-events-vs-websockets-what-is-the-difference-2026-guide)
- [Why Server-Sent Events (SSE) are ideal for Real-Time Updates](https://talent500.com/blog/server-sent-events-real-time-updates/)

### Timeline Visualization
- [Workflow visualization with Temporal's Timeline View](https://temporal.io/blog/lets-visualize-a-workflow)
- [Curated Dashboard Design Examples for UI Inspiration (2026)](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)
