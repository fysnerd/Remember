# Domain Pitfalls: Theme-Based Content Organization & Cross-Content Quiz Generation

**Domain:** Adding theme-level organization and synthesis quizzes to existing learning app
**Researched:** 2026-02-10
**Context:** Ankora has auto-tagging (Mistral AI, per-content), per-content quiz generation (SM-2), and a topic-based home screen using tags. This milestone adds a dedicated Theme model, AI theme classification, and cross-content synthesis quizzes.

---

## Critical Pitfalls

### Pitfall 1: Theme Proliferation -- AI Creates Too Many Themes With No Governance

**What goes wrong:** The auto-tagging worker already generates 3-5 tags per content item with no deduplication beyond exact string matching. Extending this to create themes produces hundreds of near-duplicate themes per user: "intelligence artificielle", "IA", "machine learning", "deep learning", "apprentissage automatique" all become separate themes. Home screen becomes an unusable wall of theme cards.

**Why it happens:** The current `tagging.ts` (line 30-41) tells the LLM to generate 3-5 tags with no reference to existing tags. Each content is classified independently. The LLM has no context about what themes already exist for this user, so it invents new labels every time. Research confirms LLMs are "lexicographically inconsistent but semantically consistent" -- the same concept gets different textual labels across invocations.

**Consequences:**
- Home screen (currently `ios/app/(tabs)/index.tsx`) shows 50+ theme cards in a 2-column grid, making it useless for navigation
- Users see "psychologie" and "psychologie cognitive" and "neurosciences" as separate themes with 1-2 contents each instead of a unified theme with 6+ contents
- Theme-level quizzes have too few questions to be meaningful (only 3-5 questions from 1 content)
- Users spend time manually merging themes instead of learning
- Database accumulates orphan Tag/Theme records

**Prevention:**
1. **Always pass existing themes to the LLM:** Before classifying new content, query the user's existing themes and include them in the prompt as "preferred themes to reuse"
2. **Implement semantic similarity check:** Before creating a new theme, compute embedding similarity against existing themes (Mistral embeddings or simple string distance). If similarity > 0.85, map to existing theme instead
3. **Cap themes per user:** Hard limit of 15-25 active themes. If exceeded, force merging before creating new ones
4. **Use a fixed taxonomy as seed:** Provide 20-30 broad default themes ("Sciences", "Technologie", "Psychologie", "Business", "Sante", etc.) and classify content INTO these first, only creating custom themes if nothing fits
5. **Batch classification with context:** Instead of classifying one content at a time, batch-classify new content with awareness of all other content in the same theme

**Detection:**
- Monitor average themes per user (alert if > 20)
- Monitor themes with only 1 content item (should be < 30% of total themes)
- Monitor theme creation rate vs. content addition rate (should be << 1:1)

**Phase mapping:** MUST be solved in the theme classification phase, before any UX work. This is the single most likely cause of the feature feeling broken.

**Confidence:** HIGH -- verified through analysis of current `tagging.ts` code which has no deduplication, plus research confirming LLM lexicographic inconsistency.

**Sources:**
- Current code: `backend/src/services/tagging.ts` lines 26-57 (no existing-tag awareness)
- [How to Get Consistent Classification From Inconsistent LLMs](https://verdik.substack.com/p/how-to-get-consistent-classification)
- [LLM Ensemble for Content Categorization](https://arxiv.org/html/2511.15714)

---

### Pitfall 2: Tags vs. Themes UX Confusion

**What goes wrong:** Users already interact with "topics" (which are tags) throughout the app. The home screen shows topics, the library has a topic filter, content detail shows tags, topic quiz exists. Adding "themes" as a separate concept creates confusion: what is a theme? How is it different from a topic/tag? Why does my content have both?

**Why it happens:** The current codebase uses `Tag` model but surfaces it as "Topics" in the UI (`useTopics.ts`, `TopicScreen`, `topic/[name].tsx`). Adding a `Theme` model that also groups content creates a concept that overlaps heavily with the existing tag/topic system. UX research confirms that users struggle when two organizational concepts exist side-by-side without clear differentiation.

**Consequences:**
- Users ignore themes entirely (stick with familiar tags/topics)
- Users try to make themes and tags match, creating duplicate organizational work
- Feature feels bolted-on rather than integrated
- "Start quiz" button exists in both topic view and theme view -- which one do they use?
- Support requests: "What's the difference between a topic and a theme?"

**Prevention:**
1. **REPLACE tags with themes, don't add alongside.** Themes become the primary organizational concept. Tags become hidden metadata used for search/filtering only
2. **If both must coexist:** Make themes explicitly hierarchical -- themes contain tags, and the UI only shows themes on the home screen while tags appear inside theme detail views
3. **Rename existing "Topics" to avoid ambiguity:** If themes replace topics as the primary navigation, rename `useTopics` hook to `useThemes` and update all UI references simultaneously
4. **One quiz entry point per level:** Theme quiz (cross-content synthesis) and content quiz (per-content) should be clearly differentiated. Theme quiz should appear ONLY on theme detail screen, not on content detail
5. **Migration path for existing tag data:** Map existing tags to themes in a migration. Don't leave users with orphan tags that have no parent theme

**Detection:**
- A/B test navigation: track whether users navigate via themes vs. via library search
- Track "theme quiz started" vs. "content quiz started" ratio
- User interviews: ask users to explain the difference between tags and themes

**Phase mapping:** MUST be decided in architecture/UX design phase BEFORE any implementation. This is a product decision, not a technical one. Wrong decision here means rework of the entire feature.

**Confidence:** HIGH -- verified through analysis of existing codebase (tags surfaced as "Topics" in 6+ screens) and UX research on category vs. tag confusion.

**Sources:**
- Current code: `ios/hooks/useTopics.ts`, `ios/app/topic/[name].tsx`, `ios/app/(tabs)/index.tsx`
- [Tags vs. Categories for UX - Mobile Matters](https://www.pugpig.com/2024/09/17/mobile-matters-guide-categories-vs-tags/)
- [Content Tagging for Better UX](https://heymarvin.com/resources/content-tagging)

---

### Pitfall 3: Cross-Content Synthesis Quizzes With Insufficient Context

**What goes wrong:** Theme-level quizzes are supposed to test synthesis across multiple content items. But the LLM generates questions that are indistinguishable from single-content quizzes -- they test facts from one video, not connections between videos. Users see "theme quiz" but get the same experience as a content quiz with questions shuffled together.

**Why it happens:** The current quiz generation (`quizGeneration.ts` lines 60-212) processes ONE content's transcript at a time, using max 12,000 chars. For a theme quiz across 5 contents, naively sending 5 transcripts = 60,000+ chars, far exceeding context window limits. The practical approach of sending truncated snippets from each content gives the LLM too little context to form genuine synthesis questions. The LLM falls back to asking about individual content details.

**Consequences:**
- Theme quiz adds no value over existing per-content quizzes
- Users feel the "synthesis" feature is fake/marketing
- LLM costs increase (processing multiple transcripts) without quality improvement
- SM-2 scheduling for theme-level cards gets mixed with content-level cards, creating confusion about what's "due"

**Prevention:**
1. **Don't send raw transcripts for synthesis questions.** Instead, send the already-generated per-content MEMOS (stored in `transcript.segments.memo`). Memos are 200-250 words each, so 5 memos = ~1,250 words -- easily fits in context
2. **Require minimum 3 content items per theme** before enabling synthesis quiz. One or two items cannot produce meaningful cross-content questions
3. **Design synthesis-specific prompt:** The prompt must explicitly request questions that "cannot be answered from any single source" and "test connections, contrasts, or patterns across the content"
4. **Separate quiz types in the data model:** Add a `scope` field to Quiz: `CONTENT` vs. `THEME`. This prevents synthesis questions from being mixed into daily per-content review sessions
5. **Generate synthesis questions lazily:** Only when user opens theme quiz, not in background worker. This avoids generating stale synthesis questions that become outdated as new content is added to the theme

**Detection:**
- Manual QA: Read generated synthesis questions and check if they reference 2+ content items
- Metric: Track "references_multiple_sources" flag in quiz generation response
- User feedback: "These questions are the same as the normal quiz"

**Phase mapping:** Quiz generation modification phase. Requires per-content memos to exist first (already implemented). The prompt engineering is the hardest part.

**Confidence:** HIGH -- verified through analysis of current quiz generation code (single-content design) and LLM context window constraints.

**Sources:**
- Current code: `backend/src/services/quizGeneration.ts` lines 24-55 (12K char limit, single content)
- Current code: `backend/src/routes/content.ts` lines 1258-1328 (topic memo aggregation pattern -- reuse this approach)

---

## Moderate Pitfalls

### Pitfall 4: Many-to-Many Performance Degradation with Prisma Implicit Relations

**What goes wrong:** The existing schema uses Prisma implicit many-to-many for Content-to-Tag (`tags Tag[] @relation("ContentTags")`). Adding a Theme-to-Content many-to-many with the same pattern creates compound query complexity. Fetching "all themes with their content counts and latest content" becomes 3+ database round-trips because Prisma does application-level joins, not SQL JOINs.

**Why it happens:** Prisma's documented approach splits many-to-many queries into separate queries per table, then merges results in the application layer. With two separate many-to-many relations on Content (tags AND themes), a single "home screen" query triggers: 1) fetch themes for user, 2) fetch content IDs per theme, 3) fetch content details, 4) fetch tag names -- potentially 4+ sequential queries. With Supabase connection pooling (PgBouncer), each query has connection overhead.

**Consequences:**
- Home screen load time increases from 200ms to 800ms+
- API latency spikes visible in user experience (loading spinner on home tab)
- Connection pool exhaustion under concurrent users
- PM2 worker processes blocked waiting for database responses

**Prevention:**
1. **Use explicit many-to-many join table** with Prisma, not implicit:
   ```prisma
   model ContentTheme {
     id        String   @id @default(cuid())
     contentId String
     themeId   String
     content   Content  @relation(fields: [contentId], references: [id], onDelete: Cascade)
     theme     Theme    @relation(fields: [themeId], references: [id], onDelete: Cascade)
     assignedAt DateTime @default(now())

     @@unique([contentId, themeId])
     @@index([themeId])
     @@index([contentId])
   }
   ```
2. **Add composite indexes** on the join table for common query patterns
3. **Denormalize content count** on the Theme model (`contentCount Int @default(0)`) to avoid COUNT queries on every home screen load
4. **Use raw SQL for the home screen query** if Prisma's generated queries are too slow:
   ```typescript
   const themes = await prisma.$queryRaw`
     SELECT t.*, COUNT(ct."contentId") as content_count
     FROM "Theme" t
     JOIN "ContentTheme" ct ON ct."themeId" = t.id
     JOIN "Content" c ON c.id = ct."contentId" AND c."userId" = ${userId}
     GROUP BY t.id
     ORDER BY content_count DESC
   `;
   ```

**Detection:**
- Enable Prisma query logging and check query count per API request
- Measure home screen API response time (should be < 300ms)
- Monitor Supabase "active connections" metric

**Phase mapping:** Schema design phase. Must be decided before migration is written.

**Confidence:** MEDIUM -- Prisma performance issues with M:N are documented in GitHub issues, but actual impact depends on data volume (Ankora is early-stage, so may not hit issues immediately).

**Sources:**
- [Prisma Issue #10949: Generated SQL Performance Issues for implicit M2N](https://github.com/prisma/prisma/issues/10949)
- [Prisma Issue #16889: Performance with one-to-many query](https://github.com/prisma/prisma/issues/16889)
- [Modeling many-to-many relations | Prisma Documentation](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/working-with-many-to-many-relations)

---

### Pitfall 5: Backfilling Existing Content Into Themes Overwhelms LLM API

**What goes wrong:** After deploying the Theme model, ALL existing content (potentially hundreds of items per user) needs to be classified into themes. Running this through the auto-tagging worker pattern (batch of 10, every 15 minutes) means backfill takes hours/days. Users see an empty home screen after "upgrade" -- themes exist but have no content yet.

**Why it happens:** The current auto-tagging worker (`tagging.ts` lines 149-179) processes 10 items per run with `pLimit(5)` concurrency. With 200 existing content items, that's 20 worker runs = 20 * 15 minutes = 5 hours. Meanwhile, Mistral API rate limits further throttle throughput. The `llmLimiter` utility adds additional delays.

**Consequences:**
- Users see empty theme home screen for hours after feature launch
- "Where did my topics go?" if themes replace tags/topics
- LLM API cost spike during backfill (hundreds of classification calls at once)
- Backfill competes with regular quiz generation and tagging for LLM API quota
- Risk of Mistral rate limiting affecting real-time quiz generation for new users

**Prevention:**
1. **Derive initial themes from existing tags, not LLM:** Group current tags into themes using a one-time LLM call per user (send all tag names, ask LLM to cluster them into 5-15 themes). This is 1 API call per user instead of 1 per content item
2. **Pre-populate during migration:** Write a Prisma migration script that maps existing tags to themes based on string similarity or a simple mapping table
3. **Prioritize READY content:** Only backfill content that has transcripts and quizzes. INBOX/ARCHIVED content can wait
4. **Run backfill in a dedicated one-time job,** not the recurring worker. Use a separate concurrency limit so it doesn't interfere with real-time quiz generation
5. **Show progressive loading UX:** "Organizing your content into themes... 45% complete" rather than empty state

**Detection:**
- Monitor LLM API usage spike during deployment
- Track "contents without theme assignment" count -- should decrease rapidly
- Alert if backfill job has been running for > 2 hours

**Phase mapping:** Migration/deployment phase. Must be planned BEFORE the theme classification worker is built.

**Confidence:** HIGH -- verified through analysis of current worker patterns and LLM rate limiting infrastructure.

**Sources:**
- Current code: `backend/src/services/tagging.ts` lines 149-179 (10-item batches, pLimit(5))
- Current code: `backend/src/utils/rateLimiter.ts` (llmLimiter shared across all LLM operations)

---

### Pitfall 6: SM-2 Scheduling Conflict Between Content Quizzes and Theme Quizzes

**What goes wrong:** A user reviews a content-level quiz card and rates it EASY (next review in 7 days). Then they do a theme quiz which includes the SAME underlying questions plus synthesis questions. The content-level card's SM-2 state gets updated twice -- once for content review, once for theme review. The scheduling algorithm gets confused: is the card easy or not? Interval calculations become unreliable.

**Why it happens:** The current data model has Quiz -> Card with SM-2 fields on Card. If synthesis questions are also stored as Quiz -> Card, and a user reviews both content quiz and theme quiz within the same day, the same Card might be reviewed twice with different ratings. The SM-2 algorithm (`review.ts` lines 360-393) wasn't designed for overlapping review sessions.

**Consequences:**
- Cards appear as "due" even though user just reviewed them in a theme quiz
- SM-2 ease factor oscillates wildly (EASY in content quiz, HARD in theme quiz)
- Users feel forced to re-answer questions they just got right
- Daily review count is inflated (same knowledge tested multiple times)

**Prevention:**
1. **Synthesis questions get their OWN cards** with their own SM-2 state, completely separate from content-level cards. A theme quiz only includes synthesis-level cards, never content-level ones
2. **If theme quiz includes content-level questions:** Mark theme quiz reviews as `isPractice: true` (already supported in `review.ts` line 352-357) so they don't update SM-2 stats
3. **Alternative approach:** Theme quiz pulls content-level cards BUT with a "cross-reference deduplication" -- if a card was reviewed in the last 24 hours, skip it in the theme quiz
4. **Add `quizScope` field to Quiz model:** `CONTENT | THEME` enum, and filter by scope when building review sessions

**Detection:**
- Monitor "cards reviewed more than once per day" count
- Track ease factor standard deviation per user (high variance = problem)
- User feedback: "I keep seeing the same questions"

**Phase mapping:** Quiz generation + review system modification phase. Must be designed before implementing theme quizzes.

**Confidence:** MEDIUM -- the existing review code has `isPractice` flag which suggests this was partially anticipated, but the current Quiz model doesn't support scope separation.

**Sources:**
- Current code: `backend/src/routes/review.ts` lines 335-443 (SM-2 implementation)
- Current code: `backend/src/routes/review.ts` lines 520-592 (topic practice already exists -- reuse pattern)
- Current schema: `prisma/schema.prisma` lines 280-327 (Quiz -> Card model)

---

### Pitfall 7: Home Screen Navigation Regression -- Losing Content-First Discovery

**What goes wrong:** Changing the home screen from current 2-column topic grid + suggestions list to a theme-first layout makes it harder for users to find specific content. Users who navigate by "I want to review that YouTube video about X" now have to figure out which theme it's in first, then find the content within the theme.

**Why it happens:** The current home screen (`ios/app/(tabs)/index.tsx`) is a simple flat layout: topics grid + recent content suggestions. Both are at the top level. A theme-first redesign adds a navigation layer: Home -> Theme -> Content. This is cognitively more expensive for users who know WHAT they want but not WHERE it lives.

**Consequences:**
- Users with < 3 themes see a sparse, empty-feeling home screen
- Users with 10+ themes can't scan quickly (cards are larger, need scrolling)
- "Where's that video?" becomes a multi-tap journey instead of a search
- Power users who use Library tab exclusively don't benefit from themes
- First-time users with 0 themes see a completely empty home screen

**Prevention:**
1. **Keep content search accessible at all times:** Search bar at top of home screen, regardless of theme layout
2. **Progressive disclosure:** Show flat content list until user has 3+ themes, THEN switch to theme-based layout
3. **Don't remove the Library tab or its current filtering:** Themes enhance the home tab, Library remains content-first
4. **Add "All content" entry point** that's not theme-filtered, alongside theme cards
5. **"Recent" section survives redesign:** Keep the 5 most recent content items visible on home screen regardless of theme organization

**Detection:**
- Track "time to first quiz start" before and after redesign
- Monitor Library tab usage increase (signal that users bypassed themes)
- Track search usage frequency (increase = users can't find content via themes)

**Phase mapping:** UX/navigation phase. Should be prototyped (Figma or wireframes) and tested with 2-3 users before implementation.

**Confidence:** HIGH -- verified through analysis of current home screen code and standard UX patterns for information architecture changes.

**Sources:**
- Current code: `ios/app/(tabs)/index.tsx` (flat topics grid + suggestions)
- Current code: `ios/app/(tabs)/library.tsx` (collection + triage with filtering)

---

## Minor Pitfalls

### Pitfall 8: Theme Assignment Inconsistency Across Content Types

**What goes wrong:** The LLM classifies YouTube videos (long transcripts, detailed content) into specific themes reliably, but TikTok/Instagram (30-60 second clips, informal language) get classified into generic or wrong themes. A TikTok about a cooking tip gets classified as "nutrition" alongside a 45-minute YouTube documentary about malnutrition.

**Prevention:**
- Include content type and duration in the classification prompt as context
- Apply stricter confidence threshold for short-form content (< 60s): if confidence < 0.7, don't auto-assign a theme
- Allow users to manually override theme assignment for short-form content
- Consider excluding content below a duration threshold from theme assignment entirely

**Phase mapping:** Theme classification worker phase.

**Confidence:** MEDIUM -- based on observation that current auto-tagging quality varies by content type (not formally measured).

---

### Pitfall 9: Prisma Migration on Production With Large Tables

**What goes wrong:** Adding a Theme model and ContentTheme join table requires a Prisma migration that adds new tables and potentially modifies the Content table (adding relations). On Supabase with PgBouncer, migration locks can timeout or fail partway through.

**Prevention:**
- Run migrations during low-traffic window (early morning UTC)
- Use `DIRECT_URL` (not pooled connection) for migrations: already configured in schema.prisma
- Test migration on a Supabase branch or staging database first
- Keep migration additive (new tables only, no ALTER on existing tables if possible)
- Have rollback migration ready

**Phase mapping:** Schema design and deployment phase.

**Confidence:** MEDIUM -- Supabase migration issues are documented but Ankora's table sizes are small enough that this may not be a problem.

---

### Pitfall 10: Theme Deletion Cascade Destroying Quiz History

**What goes wrong:** User deletes a theme, and the cascade delete removes all ContentTheme join records. If synthesis quizzes reference the theme, those quiz records (and their SM-2 Card history) are also deleted. User loses review progress.

**Prevention:**
- Theme deletion should DISCONNECT content, not DELETE it. Content continues to exist without a theme
- Synthesis quizzes should be preserved even after theme deletion (soft reference, not cascade)
- Add confirmation dialog: "Deleting this theme will remove X synthesis quiz questions. Your content and content-level quizzes will be preserved."
- Consider soft delete for themes (`deletedAt` timestamp) instead of hard delete

**Phase mapping:** Schema design phase (onDelete behavior).

**Confidence:** HIGH -- the existing schema uses `onDelete: Cascade` extensively, which is a pattern that will be copied by default.

---

### Pitfall 11: Stale Theme Memos After Content Changes

**What goes wrong:** A theme memo is generated from 5 content items. User adds 3 more items to the theme, but the memo still reflects only the original 5. User reads outdated synthesis. Worse: user removes a content item from the theme, but the memo still references it.

**Prevention:**
- Never cache theme-level memos permanently. Generate on-demand or with a short TTL (24h)
- Invalidate theme memo whenever content is added/removed from theme
- Show "last updated" timestamp on theme memos
- The existing `topic/:name/memo` endpoint (content.ts line 1258) already generates on-demand -- maintain this pattern for themes

**Phase mapping:** Theme memo generation phase.

**Confidence:** HIGH -- verified through analysis of current memo caching in `transcript.segments.memo`.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Priority |
|-------------|---------------|------------|----------|
| **Schema Design** | Implicit M:N performance (Pitfall 4) | Use explicit join table with indexes | HIGH |
| | Cascade delete destroying quiz history (Pitfall 10) | Soft-delete themes, preserve cards | HIGH |
| **Theme Classification** | Theme proliferation (Pitfall 1) | Pass existing themes to LLM, semantic dedup | CRITICAL |
| | Short-form content misclassification (Pitfall 8) | Content-type-aware prompts, confidence threshold | MEDIUM |
| **Content Migration** | Backfill overwhelms LLM API (Pitfall 5) | Derive themes from existing tags, one-time job | HIGH |
| | Existing tag/topic data orphaned | Map tags to themes in migration script | MEDIUM |
| **Quiz Generation** | Synthesis quizzes lack depth (Pitfall 3) | Use memos not transcripts, require 3+ contents | CRITICAL |
| | SM-2 scheduling conflicts (Pitfall 6) | Separate card scopes, or use isPractice flag | HIGH |
| **UX/Navigation** | Tags vs themes confusion (Pitfall 2) | Replace tags with themes as primary concept | CRITICAL |
| | Content-first discovery regression (Pitfall 7) | Keep search, progressive disclosure, Library tab | HIGH |
| **Deployment** | Production migration issues (Pitfall 9) | Use DIRECT_URL, test on staging first | MEDIUM |
| **Ongoing** | Stale theme memos (Pitfall 11) | On-demand generation, invalidate on changes | LOW |

---

## Pre-Implementation Checklist

Before starting theme implementation:
- [ ] **Product decision:** Do themes REPLACE topics/tags or exist alongside? (Pitfall 2)
- [ ] **Define theme taxonomy:** Fixed seed themes or fully user-generated? (Pitfall 1)
- [ ] **Design schema:** Explicit vs implicit M:N? Theme soft-delete? (Pitfalls 4, 10)
- [ ] **Plan migration:** How to convert existing tags to themes? (Pitfall 5)
- [ ] **Prototype synthesis quiz prompt:** Test with real content memos before building (Pitfall 3)
- [ ] **Decide quiz scope separation:** Content cards vs theme cards vs shared? (Pitfall 6)

Before going to production:
- [ ] **Test with real user data:** Classify at least 50 content items and check theme quality
- [ ] **Verify theme count per user:** Should be 5-15, not 30+
- [ ] **Benchmark home screen API:** Should be < 300ms with themes
- [ ] **Test synthesis quiz quality:** Manually review 10 generated synthesis questions
- [ ] **Verify SM-2 behavior:** Review same content via content quiz and theme quiz, check card state
- [ ] **Test backfill:** Run against staging data, measure time and API costs
- [ ] **UX walkthrough:** New user (0 themes), moderate user (5 themes), power user (15+ themes)

---

## Sources by Confidence Level

### HIGH Confidence (Verified through codebase analysis + official docs)
- Codebase analysis: `backend/src/services/tagging.ts` (no dedup, no existing-tag context)
- Codebase analysis: `backend/src/services/quizGeneration.ts` (single-content design, 12K limit)
- Codebase analysis: `backend/src/routes/review.ts` (SM-2 implementation, isPractice flag)
- Codebase analysis: `ios/app/(tabs)/index.tsx` (flat topic grid, current UX)
- Codebase analysis: `prisma/schema.prisma` (Tag model, implicit M:N via @relation)
- [Tags vs. Categories for UX - Mobile Matters | Pugpig](https://www.pugpig.com/2024/09/17/mobile-matters-guide-categories-vs-tags/)

### MEDIUM Confidence (Community sources + research papers)
- [How to Get Consistent Classification From Inconsistent LLMs](https://verdik.substack.com/p/how-to-get-consistent-classification)
- [LLM Ensemble for Content Categorization (arXiv)](https://arxiv.org/html/2511.15714)
- [Prisma Issue #10949: M2N Performance](https://github.com/prisma/prisma/issues/10949)
- [Prisma M:N Relation Documentation](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/working-with-many-to-many-relations)
- [Content Tagging for Better UX](https://heymarvin.com/resources/content-tagging)

### LOW Confidence (Needs validation with actual Ankora data)
- Theme classification quality across content types (Pitfall 8) -- needs real-world testing
- Supabase migration performance impact (Pitfall 9) -- depends on table sizes at deployment time
