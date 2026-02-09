# Codebase Concerns

**Analysis Date:** 2026-02-09

## Tech Debt

**Playwright Instagram Sync - Broken Selectors:**
- Issue: Instagram UI changes regularly, causing sync failures with "No grid items found" errors logged every 30 minutes
- Files: `backend/src/workers/instagramSync.ts` (lines 262-293)
- Impact: Users cannot sync Instagram liked reels reliably. Worker falls back to 50-item limit with retry logic that frequently fails. Generates noise in logs and confuses users about sync status.
- Fix approach: Move to Instagram official Graph API if available, or implement headless browser retry with exponential backoff + screenshot comparison for selector validation. Current DOM selectors (`main div[role="button"]`, `article div[role="button"]`, etc.) are fragile and Instagram-version-specific.

**Large Monolithic Route Files:**
- Issue: `backend/src/routes/content.ts` (1477 lines), `backend/src/routes/review.ts` (1239 lines), `backend/src/routes/oauth.ts` (1065 lines) - routes are too large and mix concerns
- Files: `backend/src/routes/content.ts`, `backend/src/routes/review.ts`, `backend/src/routes/oauth.ts`
- Impact: Difficult to test, maintain, and extend. Hard to locate specific business logic. Tight coupling between route handling and service layer.
- Fix approach: Extract route handlers into separate service modules. Use dependency injection pattern. Consider creating dedicated handler classes for each major operation (sync, transcription, quiz, etc.).

**Missing Comprehensive Error Handling in Workers:**
- Issue: Cron workers catch errors generically and log them, but don't distinguish between transient failures and permanent ones. No alerting mechanism for repeated failures.
- Files: `backend/src/workers/scheduler.ts` (lines 24-38), all sync workers (`youtubeSync.ts`, `spotifySync.ts`, `tiktokSync.ts`, `instagramSync.ts`)
- Impact: Silent failures can go unnoticed for hours. Users don't know their content isn't syncing. No metrics on sync reliability.
- Fix approach: Implement job health tracking (e.g., track failure rate per user/job). Add exponential backoff for user-specific workers. Send alerts after 3 consecutive failures. Store sync metrics in database.

**Transcript Cache Lock Expiration Risk:**
- Issue: `backend/src/services/transcriptCache.ts` uses `cleanupExpiredLocks()` but concurrent access to same content could create orphaned locks if a worker crashes mid-transcription
- Files: `backend/src/services/transcriptCache.ts` (line 384)
- Impact: Content stuck in "TRANSCRIBING" state indefinitely. Subsequent workers skip it, preventing user from seeing transcripts.
- Fix approach: Add timestamp-based lock expiration (e.g., 30-minute TTL). Implement periodic cleanup job. Add warning when locks exceed 1 hour old.

**CORS Configuration Hardcoded Tunnel URL:**
- Issue: CORS allows `https://misc-saver-additionally-podcasts.trycloudflare.com` (old Cloudflare tunnel) hardcoded in `backend/src/index.ts` (line 28)
- Files: `backend/src/index.ts` (line 28)
- Impact: Dead tunnel still in allowlist. Config should use environment variables, not hardcoded values. Risk of accidentally committing tunnel URLs.
- Fix approach: Move allowedOrigins to `.env` file. Remove hardcoded tunnel URL. Use environment-specific configs.

**No Input Validation on Playlist/Show Endpoints:**
- Issue: Content endpoints accept arbitrary filters without explicit validation. SQL injection risk low (using Prisma), but logic errors possible.
- Files: `backend/src/routes/content.ts` (lines 116-144)
- Impact: Malformed queries could return unexpected results or cause 500 errors.
- Fix approach: Use Zod schema validation on all query parameters. Create reusable validators for date ranges, pagination, enum values.

---

## Known Bugs

**Instagram Sync "No grid items found" - Intermittent:**
- Symptoms: `[Instagram Sync] No grid items found with any selector!` appears every 30 minutes, users see 0 new reels despite having liked content
- Files: `backend/src/workers/instagramSync.ts` (line 287)
- Trigger: Instagram updates frontend UI, selectors become invalid. Affects random subset of users based on Instagram's A/B testing.
- Workaround: Manually force sync from admin endpoint, though often fails again. Users must rely on YouTube/Spotify sync instead.

**YouTube Transcription Timeout on Long Videos:**
- Symptoms: Videos >2 hours hang transcription worker, timeout at 60s, marked as failed without retry
- Files: `backend/src/services/transcription.ts` (line 94)
- Trigger: yt-dlp command timeout set to 60000ms (60s). Long videos with lots of segments take longer.
- Workaround: None. Video stuck in "NEEDS_TRANSCRIPT" state. Requires admin manual intervention.

**Spotify Resume Point Calculation Precision:**
- Symptoms: Episodes show 150%+ listen progress if `resume_point.resume_position_ms` exceeds `duration_ms`
- Files: `backend/src/workers/spotifySync.ts` (lines 165-169)
- Trigger: Spotify API occasionally returns invalid data (resume_position > duration). Math rounds to 150%+ instead of capping at 100%.
- Workaround: UI caps display to 100%, but database stores invalid values.

---

## Security Considerations

**OAuth Tokens Stored in Plaintext in Database:**
- Risk: `ConnectedPlatform.accessToken` stores OAuth tokens without encryption. If database is breached, attacker gains access to user's YouTube/Spotify accounts.
- Files: `backend/prisma/schema.prisma` (line 100 comment: "OAuth tokens (encrypted)" but no actual encryption in code)
- Current mitigation: None observed. Comment says "encrypted" but no encryption layer found in code.
- Recommendations:
  1. Implement token encryption before database storage using `crypto.encrypt()` or similar
  2. Add key rotation mechanism
  3. Add audit logging for token access
  4. Consider using Vault or AWS Secrets Manager for sensitive tokens

**Insufficient Rate Limiting on Public Endpoints:**
- Risk: Rate limiter on `app.ts` (line 50-54) uses 100 requests/15min globally. No per-user limits. Attackers can brute force auth endpoints.
- Files: `backend/src/index.ts` (lines 50-54)
- Current mitigation: Basic express-rate-limit on global IP
- Recommendations: Add stricter limits on `/api/auth/login`, `/api/auth/signup` (e.g., 5/min per IP). Implement account lockout after 5 failed login attempts.

**Password Hash Algorithm Not Specified:**
- Risk: Auth uses `bcrypt.hash(password, 10)` (10 salt rounds). This is acceptable but no documentation on rotation if algorithm becomes weak.
- Files: `backend/src/routes/auth.ts` (bcrypt usage)
- Current mitigation: bcrypt with 10 rounds is industry standard
- Recommendations: Document password policy. Consider increasing salt rounds to 12+ in future. Add migration path if algorithm needs updating.

**JWT Secrets Could Be Exposed in Logs:**
- Risk: Tokens logged during debugging. Error messages might expose token fragments.
- Files: `backend/src/middleware/auth.ts`, `backend/src/index.ts`
- Current mitigation: Production logs only show 'error', 'warn' (line 9 in database.ts)
- Recommendations: Sanitize token values in all logs. Use `error.message` redaction utilities.

**Missing HTTPS Certificate Validation:**
- Risk: Axios calls to external APIs (`backend/src/workers/spotifySync.ts` line 98) don't explicitly validate SSL certificates
- Files: `backend/src/workers/spotifySync.ts`, transcription services
- Current mitigation: Node.js enforces by default, but axios config could override
- Recommendations: Explicitly set `rejectUnauthorized: true` in axios config. Add certificate pinning for critical services.

---

## Performance Bottlenecks

**Cron Jobs Running Sequentially Within Schedule:**
- Problem: If a job takes 5+ minutes and is scheduled every 5 minutes, next job skips (runningJobs Set prevents overlap). This causes cumulative backlog.
- Files: `backend/src/workers/scheduler.ts` (lines 18-37)
- Cause: Each user sync runs sequentially in `spotifySync.ts` (lines 275-279 uses `Promise.allSettled` but processes 10 concurrent). With 100+ users, single sync > 5 minutes.
- Improvement path:
  1. Parallelize user syncs beyond p-limit(10)
  2. Add priority queue (new users first, then changed playlists)
  3. Move Instagram sync to separate worker cluster (Playwright is expensive)
  4. Monitor job duration and alert if approaching window

**Quiz Generation Redundant LLM Calls:**
- Problem: Quiz generation checks content twice (assessment + questions), generating unnecessary LLM calls for same transcript
- Files: `backend/src/services/quizGeneration.ts` (lines 98, 132)
- Cause: Assessment phase (lines 98-111) calls LLM, then again for questions (lines 132+). Could combine into single call.
- Improvement path: Restructure prompt to perform assessment + question generation in single LLM call. Saves 50% LLM tokens on quiz generation.

**Postgres Connection Pool Exhaustion Risk:**
- Problem: No documented connection pool size limits. With 11 active cron jobs + user requests, could exceed Supabase pooler limits (P1001 errors noted).
- Files: `backend/src/config/database.ts` (Prisma config)
- Cause: Prisma uses default pool size. No explicit configuration for production load.
- Improvement path: Set `connection_limit` in DATABASE_URL. Implement connection pooling with pg-boss or similar for background jobs. Monitor active connections in Supabase.

**Transcription Worker Processes All Content Sequentially:**
- Problem: YouTube transcription worker fetches all pending content, then processes sequentially. One slow video blocks others.
- Files: `backend/src/services/transcription.ts` (worker loops)
- Cause: No parallelization with p-limit. Only one transcription at a time.
- Improvement path: Use p-limit(3-5) for concurrent transcriptions. Prioritize short videos first.

---

## Fragile Areas

**Instagram Cookie-Based Authentication:**
- Files: `backend/src/services/instagramAuth.ts`, `backend/src/workers/instagramSync.ts` (lines 64-83)
- Why fragile: Instagram doesn't provide public API for liked reels. Solution relies on:
  1. User manually exporting cookies (error-prone)
  2. Session cookies expiring after 30-90 days
  3. Instagram blocking automated browser access (captchas, IP blocks)
- Safe modification: Add validation that cookies contain required fields (sessionid, csrftoken). Log cookie age on each sync. Alert users to refresh connection if >60 days old.
- Test coverage: No tests for cookie validation. Should add unit tests for cookie parsing and refresh flow.

**Transcription Language Detection:**
- Files: `backend/src/services/transcription.ts` (lines 76-79, 138-140)
- Why fragile: Language detection based on filename regex (`\.([a-z]{2}(?:-[a-zA-Z]+)?)\.json3$`). If yt-dlp changes filename format, detection breaks silently.
- Safe modification: Validate detected language against PREFERRED_LANGUAGES list. Fall back to content detection if filename parsing fails. Add logging if language couldn't be determined.
- Test coverage: No tests for language detection edge cases (e.g., `en-US` vs `en`).

**Quiz Generation Permissive Assessment Logic:**
- Files: `backend/src/services/quizGeneration.ts` (lines 115-122)
- Why fragile: Assessment almost never rejects content (only rejects if `isEducational === false AND reason.includes('unintelligible')`). This could generate nonsensical quizzes from pure music or silence.
- Safe modification: Add check for content type (e.g., word count > 100, multiple sentences). Implement fallback to reject if assessment timeout or LLM returns error. Add user feedback loop.
- Test coverage: No tests for quiz rejection. Should test edge cases (music tracks, empty transcripts, etc.).

**TikTok Playwright Browser Lifecycle:**
- Files: `backend/src/workers/tiktokSync.ts`
- Why fragile: Browser launched per user, closes at end. If crash occurs, browser stays alive consuming memory. No timeout on page.goto() calls in some places.
- Safe modification: Use context manager pattern. Add timeouts to all navigation (currently missing on some pages). Implement periodic browser cleanup job.
- Test coverage: No tests for browser crash recovery.

---

## Scaling Limits

**Instagram Playwright Concurrency:**
- Current capacity: p-limit(5) concurrent Instagram syncs (line 20 in rateLimiter.ts). Each browser session takes 500MB+ RAM.
- Limit: 5 × 500MB = 2.5GB RAM just for Instagram. VPS CPX32 has 8GB total.
- Scaling path:
  1. Reduce concurrent browsers to 2-3
  2. Implement browser pool/reuse (don't launch new browser per user)
  3. Move Instagram to separate worker cluster if >50 users
  4. Consider headless browser service (BrowserStack, Browserless)

**Groq Whisper API Rate Limits:**
- Current capacity: p-limit(3) concurrent transcriptions. Groq free tier ~30 RPM (requests/minute).
- Limit: With 11 workers running transcription every 2-5 minutes across 100 users, could hit limits (estimated 50+ RPM).
- Scaling path:
  1. Move to paid Groq tier or alternative (AssemblyAI, Rev)
  2. Implement request queuing with priority (prioritize user-initiated transcriptions)
  3. Add backoff when hitting rate limits
  4. Cache results aggressively

**LLM (Mistral) Token Budget:**
- Current capacity: p-limit(5) concurrent LLM calls. No token usage tracking.
- Limit: Quiz generation uses ~4000 tokens per quiz. 100 new videos/day = 400k tokens. Mistral API pricing implies costs grow linearly.
- Scaling path:
  1. Implement token counting before API calls
  2. Add daily budget limits per user
  3. Implement aggressive caching (same content = same quiz)
  4. Consider batching quiz generation (process 10 at once)

---

## Dependencies at Risk

**Playwright - Breaking Changes in Instagram Automation:**
- Risk: Playwright version pinned to ^1.58.0. Instagram regularly breaks selectors. New Playwright versions could introduce incompatibilities.
- Impact: Instagram sync could fail if upgrade required. Mitigation: Implement selector validation tests.
- Migration plan: If Instagram fully blocks automation, move to official API (unlikely) or use Instagram Business Graph API (limited).

**yt-dlp - Unmaintained Upstream:**
- Risk: yt-dlp depends on YouTube's internal API. YouTube can break this without notice. Project is community-maintained, not official.
- Impact: YouTube transcription stops working after YouTube API change.
- Migration plan: Keep backup method (`youtube-transcript` library). Monitor yt-dlp releases for breaking changes.

**Spotify API OAuth Token Expiration:**
- Risk: Refresh tokens granted without expiration, but Spotify can invalidate them. No retry mechanism if token refresh fails.
- Impact: User connection becomes broken, sync stops, no user notification.
- Migration plan: Implement token refresh retry with exponential backoff. Notify user to reconnect if refresh fails 3x.

**Node.js v22 EOL:**
- Risk: Node.js 22 will reach EOL in April 2025. Current code not tested on v20 LTS.
- Impact: Security patches end, production becomes vulnerable.
- Migration plan: Plan migration to Node.js 20 LTS now. Test current codebase on Node 20.

---

## Missing Critical Features

**No Monitoring/Alerting for Production:**
- Problem: Cron jobs run silently. No visibility into job health. Failures only visible in logs if someone reads them.
- Blocks: Cannot guarantee SLA. Cannot debug user issues. Cannot detect data sync gaps.
- Implementation priority: High. Add basic metrics (job duration, success rate per user, error counts). Integrate with Sentry or Datadog.

**No User-Facing Sync Status:**
- Problem: Users don't know if their content is syncing, stuck, or failed. App shows no status indicators.
- Blocks: Users can't troubleshoot. Support tickets for "why isn't my content loading?"
- Implementation priority: High. Add last sync time + status to user profile. Show sync errors in UI.

**No Database Backups Documented:**
- Problem: Supabase provides backups, but no documented backup/restore procedure or frequency.
- Blocks: Data loss recovery untested. Unclear if backups are encrypted, how long retained, recovery RTO.
- Implementation priority: Critical. Document backup strategy. Test restore procedure monthly.

**No Rate Limiting Per User:**
- Problem: Global rate limit (100 req/15min). Users can't be rate-limited individually. Malicious users could DoS other users.
- Blocks: Cannot enforce fair usage. Premium users should get higher limits.
- Implementation priority: Medium. Implement per-user rate limits based on plan (FREE=50/day, PRO=1000/day).

---

## Test Coverage Gaps

**Workers Have Zero Tests:**
- What's not tested: Sync workers (YouTube, Spotify, TikTok, Instagram) run every X minutes but have no unit/integration tests
- Files: `backend/src/workers/youtubeSync.ts`, `spotifySync.ts`, `tiktokSync.ts`, `instagramSync.ts`, `reminderWorker.ts`
- Risk: Sync logic changes break without detection. Regressions ship to production.
- Priority: High. Add integration tests for each worker (mock APIs, test deduplication, error handling).

**No E2E Tests for OAuth Flows:**
- What's not tested: Full OAuth flow (user clicks "Connect YouTube" → redirects to Google → back to app → token stored → sync works)
- Files: `backend/src/routes/oauth.ts` (1065 lines with no corresponding tests)
- Risk: OAuth breaks silently (redirect URL wrong, token parsing fails, deep link not working). Users can't connect accounts.
- Priority: High. Add E2E tests with mock OAuth providers (use nock library).

**Quiz Generation Edge Cases Not Tested:**
- What's not tested: Malformed LLM responses, timeout handling, language detection, assessment rejection
- Files: `backend/src/services/quizGeneration.ts` (only `tests/unit/quiz.test.ts` exists with basic tests)
- Risk: Invalid quizzes created from bad prompts. Silent failures on LLM errors.
- Priority: Medium. Expand quiz tests to cover all code paths.

**Transcription Caching Logic Untested:**
- What's not tested: Cache lock expiration, concurrent access to same content, cache invalidation
- Files: `backend/src/services/transcriptCache.ts` (384 lines, no dedicated tests)
- Risk: Orphaned locks, duplicate transcription, stale cache.
- Priority: Medium. Add unit tests for cache lifecycle.

**iOS App Has No Unit Tests:**
- What's not tested: React hooks (useAuthStore, useQuery hooks), navigation logic, API client
- Files: `ios/app/**/*.tsx`, `ios/hooks/**/*.ts`, `ios/stores/**/*.ts`
- Risk: App logic breaks silently (auth state wrong, navigation loops, API calls fail).
- Priority: Medium. Add React Testing Library tests for critical screens (login, OAuth).

---

*Concerns audit: 2026-02-09*
