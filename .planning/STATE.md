# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** L'utilisateur apprend durablement a partir de ce qu'il consomme deja -- sans effort supplementaire de curation.
**Current focus:** v2.0 Themes-first UX -- Phase 11 in progress

## Current Position

Phase: 11 of 11 (Theme Discovery & Onboarding)
Plan: 1 of 2 in current phase (11-01 complete)
Status: Executing Phase 11
Last activity: 2026-02-11 -- Completed 11-01 (discoveredAt field, status filter, progress aggregation, discovery endpoint)

Progress: [#####################] 21/22 plans (v1.0 complete, v2.0 phases 5-10 complete, 11-01 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 21 (10 v1.0 + 11 v2.0)
- Average duration: ~13 min (improving with simpler integration plans)
- Total execution time: ~4 hours 38 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. ESM Migration | 4 | ~100 min | ~25 min |
| 2. Job Tracking | 2 | ~50 min | ~25 min |
| 3. AdminJS Panel | 2 | ~50 min | ~25 min |
| 4. Observability | 2 | ~50 min | ~25 min |
| 5. Theme Data Model & API | 2 | ~7 min | ~3.5 min |
| 6. Theme Classification Worker | 2/2 | ~5 min | ~2.5 min |
| 7. iOS Theme Screens | 2/2 | ~7 min | ~3.5 min |
| 8. Theme Quiz (Existing Cards) | 1/1 | ~3 min | ~3 min |
| 9. Theme Memo | 1/1 | ~5 min | ~5 min |
| 10. Cross-Content Synthesis Quiz | 2/2 | ~8 min | ~4 min |
| 11. Theme Discovery & Onboarding | 1/2 | ~5 min | ~5 min |

**Recent Trend:**
- v1.0 completed in 2 days (10 plans, 4 phases)
- v2.0 phase 5 completed in ~7 min (2 plans: schema + API)
- v2.0 phase 6 completed in ~5 min (2 plans: service + scheduler/admin integration)
- v2.0 phase 7 completed in ~7 min (2 plans: navigation layer + management screens)
- v2.0 phase 8 completed in ~3 min (1 plan: theme quiz API + iOS screen)
- v2.0 phase 9 completed in ~5 min (1 plan: theme memo API + iOS screen)
- v2.0 phase 10 plan 01 completed in ~5 min (schema + synthesis service + endpoint extension)
- v2.0 phase 10 plan 02 completed in ~3 min (iOS types, hooks, QuestionCard badge, theme quiz screen)
- v2.0 phase 10 complete in ~8 min (2 plans: backend synthesis + iOS UI)
- v2.0 phase 11 plan 01 completed in ~5 min (discoveredAt schema + status filter + progress + discovery endpoint)
- Trend: Accelerating (plans completing in 3-5 min)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Themes are a layer above tags (not replacing)
- Content can belong to multiple themes (many-to-many)
- Themes auto-created by AI, user adjusts after
- Quiz by theme = mix existing questions + new synthesis questions
- Use explicit join tables (not Prisma implicit M:N) for performance
- Use cached memos (not raw transcripts) for synthesis quiz generation
- Cap themes at 15-25 per user to prevent proliferation
- Used --accept-data-loss on prisma db push to drop orphaned admin_sessions table (not in schema, safe)
- Theme ownership scoped via @@unique([userId, slug]) and @@unique([userId, name])
- Used Zod for theme API validation (already a project dependency)
- Flatten contentThemes join data into themes array on content responses for cleaner API
- Set assignedBy to 'user' for manual content-theme associations (vs 'system' for AI)
- Single-use tags filtered before LLM prompt to reduce noise in theme generation
- Deterministic tag-overlap matching before LLM fallback for content classification
- Theme generation gated on 10+ tagged content items per user (minimum signal threshold)
- generateSlug extracted to shared utils/slug.ts (imported by both route and service)
- Theme classification cron placed after auto-tagging (themes depend on tags existing)
- theme-backfill is manual-only (no cron) -- one-time operation via admin triggers
- ThemeCard component uses color bar accent (4px left border) instead of background tint for minimal aesthetic
- Quiz button on theme detail reuses /quiz/topic/[name] by theme name until Phase 8 adds theme-specific quiz
- Pre-registered theme management routes in _layout.tsx so Plan 07-02 does not need to touch root layout
- Combined name, emoji, and color into single save action on theme manage screen (one API call)
- Used inline Modal in content detail for add-to-theme (simpler than separate component, single-use)
- Emoji/color palettes shared between manage and create screens (20 emojis, 12 colors matching AI worker palette)
- Theme quiz capped at 20 questions to prevent overwhelming sessions
- Theme quiz updates SM-2 stats (not practice mode) consistent with topic quiz
- View memo button on theme quiz summary routes to theme detail (theme memos come in Phase 9)
- Quiz button always visible on theme detail screen (moved outside content list conditional)
- Theme memo cached on Theme model fields (memo + memoGeneratedAt) not JSON hack
- 24h TTL with lazy invalidation at read time for theme memos
- Cache cleared on content add/remove from theme for freshness
- Memo button always enabled on theme detail (error handled on memo screen)
- Cap at 15 content memos per synthesis prompt for LLM context limits
- 400 word max for theme synthesis (vs 300 for topic memos)
- Nullable contentId + themeId FK for dual quiz ownership (content vs theme synthesis)
- On-demand synthesis generation at first theme quiz request, then persisted for SM-2
- Up to 5 synthesis + 15 per-content cards per session, capped at 20 total
- Synthesis quizzes invalidated (deleted) on theme content add/remove
- Per-memo cap at 2000 chars for synthesis prompt to prevent LLM overflow
- sourceIndices post-processing filters out single-source LLM questions
- Indigo (#6366F1) pill badge for synthesis questions matching app primary accent
- isSynthesis defaults to false throughout chain so non-synthesis questions unchanged
- No changes to content/topic quiz screens (synthesis only in theme quizzes)
- discoveredAt null = pending discovery, set = user confirmed (gate pattern, simpler than status enum)
- Mastery threshold: repetitions >= 3 (practical for early users)
- Progress computed via single raw SQL with FILTER clauses (no N+1)
- POST /discover registered before POST / to avoid Express path conflict
- User-created themes set discoveredAt immediately (skip discovery flow)
- Merge action clears memo cache and synthesis quizzes on target theme

### Pending Todos

None.

### Blockers/Concerns

- Theme proliferation risk: LLM must receive existing themes in prompt to avoid duplicates
- UX transition: Need progressive disclosure (show tags until 3+ themes exist)
- Synthesis quiz prompt tuning: Will need iteration with real content (Phase 10)

## Session Continuity

Last session: 2026-02-11
Stopped at: Completed 11-01-PLAN.md (discoveredAt field, status filter, progress, discovery endpoint)
Next step: Execute 11-02-PLAN.md (iOS discovery onboarding UI)
Resume file: None
