# Project Research Summary

**Project:** Ankora v2.0 - Theme-Based Content Organization & Cross-Content Synthesis Quizzes
**Domain:** Active learning platform enhancement
**Researched:** 2026-02-10
**Confidence:** HIGH

## Executive Summary

Ankora v2.0 adds a theme-based organization layer to transform the existing tag-centric library into a user-facing knowledge map. The recommended approach is to introduce themes as semantic clusters of tags (5-15 broad categories like "Web Development", "Finance", "Health") that group content automatically via AI classification. This is an extension layer, not a replacement — tags remain as granular AI-generated labels, while themes provide human-readable navigation.

The key technical decision is using Prisma's explicit many-to-many join tables (not implicit) to avoid performance degradation, and leveraging existing cached memos (not raw transcripts) for cross-content synthesis quizzes. The existing architecture already supports topic-based quizzes and memos; themes extend this pattern with dedicated routes, workers, and iOS screens. One new iOS dependency (@shopify/flash-list), zero new backend dependencies — all functionality uses existing Mistral AI, Prisma, and Express infrastructure.

The critical risk is theme proliferation: without careful prompt engineering and semantic deduplication, the AI will generate 50+ overlapping themes per user, destroying the UX. Prevention requires passing existing themes to the LLM during classification, implementing similarity checks before creating new themes, and optionally seeding with a fixed taxonomy. The second major risk is UX confusion between tags (existing "topics") and themes — research shows users struggle when two overlapping organizational concepts coexist. The recommended mitigation is to replace the tag-based "Topics" grid with theme cards on the home screen, keeping tags as hidden classification metadata.

## Key Findings

### Recommended Stack

**No new stack additions required for backend.** Themes use existing Prisma ORM for data model (explicit many-to-many via join table), existing Mistral AI for classification (custom structured output for reliable JSON), and existing Express.js routing patterns. The schema extension adds a Theme model with many-to-many relations to Content and Tag, using `tagPatterns String[]` for deterministic tag-to-theme mapping without repeated LLM calls.

**Core technologies:**
- **Prisma explicit many-to-many** (backend schema) — ContentTheme join table with indexes for performance, prevents Prisma's application-level join overhead
- **Mistral AI custom structured output** (classification) — enforces exact JSON schema for theme assignments, more reliable than plain JSON mode
- **Mistral memo aggregation** (synthesis quizzes) — uses pre-cached per-content memos (~200 words each) instead of raw transcripts (4K-12K chars), fits context window for 10+ content items
- **@shopify/flash-list v2** (iOS) — performant theme grid/list rendering with cell recycling, eliminates FlatList jank for 50+ item lists

**What NOT to add:**
- Vector database (Pinecone, pgvector) — tag space too small (50-200 tags/user) for embedding-based clustering, LLM classification is simpler
- LangChain — project uses direct Mistral API, abstraction adds overhead with no benefit for prompt-response patterns
- Redis/BullMQ — existing node-cron + p-limit pattern sufficient for low-frequency batch classification
- Separate classification microservice — single LLM call logic does not justify deployment complexity

### Expected Features

**Must have (table stakes):**
- Auto-generated themes from existing tags — core value prop, manual creation defeats purpose
- Theme list with content counts — basic navigation, mirrors existing `/content/tags` pattern
- Theme detail view (content grouped by source) — reuse ContentCard component from `topic/[name].tsx`
- Theme-scoped quiz (single-content questions) — minimum: filter existing Quiz/Card records by theme's content IDs
- Theme renaming — users must be able to override AI-generated names ("Intelligence Artificielle" -> "IA & ML")
- Theme deletion — removes grouping only, preserves content and tags
- Theme color/icon — visual distinction in theme grid (auto-assign based on name hash)
- Content-theme reassignment — users must be able to move content between themes to fix AI errors

**Should have (competitive differentiators):**
- **Cross-content synthesis quiz** — THE differentiator. Questions connecting concepts from 2-3 content items in a theme. Based on interleaving research (+50-125% retention). High complexity: memo aggregation + synthesis-specific prompts + separate Quiz scope
- Theme synthesis memo — aggregates memos across all theme content, shows "big picture" knowledge
- Theme learning progress — per-theme stats (cards due, mastery level, content coverage) aggregated from SM-2 data
- Theme discovery onboarding — first-time flow showing AI-created themes, lets users review/rename/merge before committing (critical for trust)
- AI theme suggestions on new content — auto-classifies into existing themes when tagging worker runs, flags content that doesn't fit for next discovery batch

**Defer (v2+):**
- Smart theme merging suggestions (overlap analysis)
- Hierarchical/nested themes (Prisma lacks recursive queries, UX complexity)
- Manual theme creation from scratch (undermines auto-classification value)
- Theme sharing between users (social features out of scope)
- Real-time theme updates via WebSocket (changes are slow, polling sufficient)

### Architecture Approach

**Theme system is an extension layer above existing Tag system.** Tags remain granular AI-generated per-content labels; Themes are broad user-facing categories that group tags. The existing codebase uses "topics" (which are tags) throughout the iOS app — themes will replace topics as the primary home screen navigation, while tags become hidden classification metadata.

**Major components:**
1. **Theme model (Prisma)** — Per-user themes with many-to-many Content and Tag relations. Explicit join tables (ContentTheme, ThemeTags) for query performance. `tagPatterns String[]` stores deterministic tag-to-theme mappings
2. **Theme classification worker** — Runs after auto-tagging worker (offset 7 minutes), matches content tags against theme tagPatterns, connects content to themes. Uses pLimit(5) concurrency like existing workers
3. **Theme API routes** (`/api/themes`) — CRUD endpoints, content management, theme memos, AI suggestions. Mirrors existing `/api/content/tags` and `/api/content/topic/:name` patterns
4. **Theme iOS screens** — `/theme/[id].tsx` (detail), `/theme/manage/[id].tsx` (settings), `/quiz/theme/[id].tsx` (quiz), follows expo-router file-based routing like existing `topic/[name].tsx`
5. **Theme hooks** (`useThemes`, `useThemeDetail`) — React Query data fetching, matches existing `useTopics` pattern exactly

**Integration points:**
- Scheduler: Add theme-classification cron job (`*/30 * * * *`)
- Content routes: Include themes in GET responses
- Review routes: Add `POST /reviews/practice/theme` (mirrors existing `/practice/topic`)
- Feed screen: Replace tag grid with theme cards (adaptive: show tags if no themes exist)

**Patterns to follow:**
- Worker pattern: Same structure as `runAutoTaggingWorker()` with pLimit concurrency
- Route pattern: Same auth + error handling as existing content/review routes
- Hook pattern: Same React Query queryKey structure as useTopics/useContent
- Screen pattern: Same expo-router file structure as `topic/[name].tsx`

### Critical Pitfalls

1. **Theme proliferation (CRITICAL)** — Without existing-theme context in LLM prompts, AI generates 50+ near-duplicate themes per user ("intelligence artificielle", "IA", "machine learning" all become separate). Prevention: Always pass existing themes to LLM, implement semantic similarity check before creating new themes (similarity > 0.85 = reuse existing), cap themes at 15-25 per user, optionally seed with fixed taxonomy of 20-30 broad categories

2. **Tags vs themes UX confusion (CRITICAL)** — Users already interact with "topics" (which are tags) throughout the app. Adding "themes" as a separate overlapping concept causes confusion: what's the difference? Which one do I use? Prevention: Replace tags with themes as primary navigation (tags become hidden metadata), OR make themes explicitly hierarchical (themes contain tags), rename existing "Topics" UI to "Themes" simultaneously

3. **Synthesis quizzes lack depth (CRITICAL)** — Sending raw transcripts (60K+ chars for 5 contents) exceeds context limits, sending truncated snippets gives LLM too little context to form synthesis questions. Prevention: Use pre-cached per-content memos (200 words each, 5 memos = 1,250 words), require minimum 3 content items per theme before enabling synthesis quiz, design synthesis-specific prompt ("cannot be answered from any single source"), generate lazily (on-demand when user opens theme quiz)

4. **Many-to-many performance degradation (MODERATE)** — Prisma's implicit many-to-many creates application-level joins, not SQL JOINs. With two M:N relations on Content (tags AND themes), home screen query triggers 4+ sequential queries. Prevention: Use explicit join table (ContentTheme) with composite indexes, denormalize contentCount on Theme model, consider raw SQL for home screen query if Prisma too slow

5. **Backfilling existing content overwhelms LLM API (MODERATE)** — 200+ existing content items need classification after theme feature launch, existing worker (10 items per 15min run) = 5 hours to complete. Prevention: Derive initial themes from existing tags via one-time LLM call per user (cluster all tag names into themes), prioritize READY content with transcripts, run backfill as dedicated one-time job (not recurring worker), show progressive loading UX

## Implications for Roadmap

Based on research, suggested phase structure follows clear dependency flow: data model → backend API → worker → iOS UI → intelligence features. Each phase can be deployed independently.

### Phase 1: Data Model + Theme CRUD API
**Rationale:** Foundation must be in place before any worker or UI work. Schema migration is additive (no data changes), low risk.
**Delivers:** Theme model in database, REST API for CRUD operations, themes included in content responses
**Addresses:** Table stakes features (theme list, create, rename, delete)
**Avoids:** Pitfall 4 (M:N performance) by using explicit join tables from the start
**Estimated effort:** 2-3 days

### Phase 2: Theme Classification Worker
**Rationale:** Automates theme assignment, unlocks value of auto-generated themes. Runs independently of UI.
**Delivers:** Scheduled worker that matches tags to themes via tagPatterns, creates ContentTheme links
**Addresses:** Table stakes (auto-generated themes from tags)
**Avoids:** Pitfall 1 (proliferation) via existing-theme context in prompts, Pitfall 5 (backfill) via one-time migration job
**Estimated effort:** 3-4 days

### Phase 3: iOS Theme Screens (Core Navigation)
**Rationale:** User-facing value, replaces tag-based "Topics" with theme cards on home screen
**Delivers:** Theme list screen, theme detail screen, theme management UI, Feed screen redesign
**Addresses:** Table stakes (theme detail view, content grouping, renaming, deletion, color/icon)
**Avoids:** Pitfall 2 (UX confusion) by replacing topics with themes, Pitfall 7 (navigation regression) by keeping search + Library tab
**Estimated effort:** 4-5 days

### Phase 4: Theme Quiz (Existing Cards)
**Rationale:** Delivers immediate quiz value by filtering existing per-content cards by theme
**Delivers:** `POST /reviews/practice/theme` endpoint, `/quiz/theme/[id].tsx` screen, reuses existing QuestionCard components
**Addresses:** Table stakes (theme-scoped quiz)
**Avoids:** Pitfall 6 (SM-2 conflicts) by marking theme practice as `isPractice: true` (no SM-2 updates)
**Estimated effort:** 2-3 days

### Phase 5: Theme Memo
**Rationale:** Straightforward adaptation of existing topic memo endpoint, unlocks theme-level synthesis view
**Delivers:** `GET /themes/:id/memo` endpoint, aggregates per-content memos, `/memo/theme/[id].tsx` screen
**Addresses:** Differentiator (theme synthesis memo)
**Avoids:** Pitfall 11 (stale memos) by generating on-demand with 24h TTL
**Estimated effort:** 1-2 days

### Phase 6: Cross-Content Synthesis Quiz (Intelligence)
**Rationale:** THE differentiator, highest complexity, requires memo aggregation + prompt engineering
**Delivers:** Synthesis question generation using aggregated memos, separate Quiz scope (`THEME`), synthesis-specific prompt
**Addresses:** Differentiator (cross-content synthesis quiz)
**Avoids:** Pitfall 3 (insufficient context) by using memos not transcripts, Pitfall 6 (SM-2 conflicts) by creating separate Card records for synthesis questions
**Estimated effort:** 1-2 weeks (includes prompt tuning, testing, iteration)

### Phase 7: Theme Discovery Onboarding + AI Suggestions
**Rationale:** Polish and trust-building, can be added after core value is proven
**Delivers:** First-time flow for reviewing AI-generated themes, ongoing AI suggestions for new content
**Addresses:** Differentiator (theme discovery onboarding, AI suggestions)
**Avoids:** Pitfall 1 (proliferation) by letting users review/merge before committing
**Estimated effort:** 3-4 days

### Phase Ordering Rationale

- **Data model first** — No work can happen without Theme table and relations
- **Worker before UI** — Ensures themes are populated before users see the screens (avoid empty state)
- **Core navigation before intelligence** — Users need basic theme browsing before synthesis features make sense
- **Existing-card quiz before synthesis** — Delivers quiz value immediately while synthesis is being built
- **Memo before synthesis quiz** — Synthesis quiz depends on memo aggregation pattern
- **Discovery onboarding last** — Polish feature, not blocking for core value

This order minimizes dependencies, allows incremental deployment, and delivers user value progressively (theme navigation → basic quiz → synthesis → onboarding).

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 6 (Synthesis Quiz)** — Prompt engineering for cross-content questions is complex, needs iteration with real content. Allocate time for testing multiple prompt variations
- **Phase 7 (AI Suggestions)** — Theme discovery prompts need tuning to avoid proliferation. May need semantic similarity algorithm research

**Phases with standard patterns (skip phase-specific research):**
- **Phase 1 (Data Model)** — Prisma many-to-many is well-documented
- **Phase 3 (iOS Screens)** — Direct copy of existing `topic/[name].tsx` patterns
- **Phase 4 (Theme Quiz)** — Reuses existing review system, mirrors `/practice/topic`
- **Phase 5 (Memo)** — Adaptation of existing `topic/:name/memo` endpoint

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified via official docs (Prisma, Mistral, Expo). One new dependency (FlashList) confirmed compatible with Expo SDK 54 |
| Features | HIGH | Based on direct codebase analysis of existing patterns (tag system, topic quizzes, memo generation) and UX research on category vs tag systems |
| Architecture | HIGH | Extends existing patterns exactly (workers, routes, hooks, screens). Integration points identified in live codebase |
| Pitfalls | HIGH | Verified through codebase analysis (no deduplication in tagging.ts, implicit M:N in schema, topics/tags naming throughout iOS) and community research on LLM consistency issues |

**Overall confidence:** HIGH

Research is grounded in direct codebase analysis (not just documentation). All 4 research files reference specific file paths, line numbers, and existing function names from the Ankora codebase. Architecture patterns are proven (already used for topics/tags), not speculative.

### Gaps to Address

**Schema decision (Phase 1):** Explicit vs implicit many-to-many for ContentTheme. Research recommends explicit for performance, but Ankora is early-stage and may not hit scale issues. Consider starting with implicit (simpler Prisma API) and migrating to explicit if performance degrades. Prisma supports this migration path.

**UX transition (Phase 3):** How to handle users mid-transition when themes are partially populated? Research recommends progressive disclosure (show tags until 3+ themes exist), but needs UX validation. Consider A/B testing with real users before full rollout.

**Prompt tuning (Phase 6):** Synthesis quiz quality depends heavily on prompt engineering. Research identifies the approach (use memos, require multi-source questions) but the exact prompt needs iteration with real Ankora content. Allocate 3-5 days for prompt experimentation.

**Theme taxonomy (Phase 2):** Should themes be purely AI-generated or seeded with a fixed list? Research recommends seeding to avoid proliferation, but the taxonomy must be validated against actual Ankora user content. Analyze top 100 most common tags across users before choosing seed themes.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all relevant files (schema.prisma, scheduler.ts, tagging.ts, quizGeneration.ts, review.ts, content.ts, iOS app structure)
- [Prisma Many-to-Many Relations Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations)
- [Mistral Custom Structured Output](https://docs.mistral.ai/capabilities/structured_output/custom)
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54) (FlashList compatibility)
- [Expo FlashList Official Docs](https://shopify.github.io/flash-list/)

### Secondary (MEDIUM confidence)
- [How to Get Consistent Classification From Inconsistent LLMs](https://verdik.substack.com/p/how-to-get-consistent-classification) (theme proliferation)
- [Tags vs. Categories for UX - Mobile Matters](https://www.pugpig.com/2024/09/17/mobile-matters-guide-categories-vs-tags/) (UX confusion)
- [FlashList vs FlatList Performance Comparison](https://medium.com/whitespectre/flashlist-vs-flatlist-understanding-the-key-differences-for-react-native-performance-15f59236a39c) (performance claims)
- [Prisma GitHub Issue #10949](https://github.com/prisma/prisma/issues/10949) (M:N performance concerns)

### Tertiary (LOW confidence, needs validation)
- Interleaving research retention claims (50-125% improvement) — cited in FEATURES.md from Roediger & Karpicke 2006, Kornell & Bjork 2008. Not verified against original papers

---
*Research completed: 2026-02-10*
*Ready for roadmap: yes*
