# Feature Landscape

**Domain:** Theme-based content organization for active learning platform
**Researched:** 2026-02-10
**Context:** Subsequent milestone adding theme-based UX to existing Ankora app. Auto-tagging, quiz generation, SM-2 reviews already in production.

---

## Table Stakes

Features users expect when moving from content-centric to theme-centric navigation. Missing = theme system feels like a cosmetic reskin of tags.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Auto-generated themes from existing tags | Core value prop. Manual theme creation defeats the purpose of an AI-powered learning app. Users have 50-200 tags, cannot manually organize. | Med | Two-phase: batch discovery + incremental classification via Mistral |
| Theme list with content counts | Users need to see what themes exist and how much content each has. Basic navigation. | Low | Simple Prisma query with `_count`, mirrors existing `/content/tags` endpoint |
| Theme detail view (content grouped by source) | Users click a theme and see all related content. Must show YouTube/Spotify/TikTok/Instagram sources with existing content cards. | Low | Reuse existing `ContentCard` component from `topic/[name].tsx` |
| Theme-scoped quiz (single-content questions) | Minimum: serve existing per-content quizzes filtered by theme. Users expect "Quiz me on AI" to work. | Low | Filter existing Quiz/Card records by content IDs in theme. Existing `practice/topic` endpoint pattern. |
| Theme renaming | Users will disagree with AI-generated names. Must be editable. "Intelligence Artificielle" -> "IA & Machine Learning". | Low | PATCH endpoint, mirrors existing tag rename pattern in `content.ts` |
| Theme deletion | Users may not want a theme. Deleting removes the grouping only, not the content or tags. | Low | DELETE endpoint, unlink m2m relations only |
| Theme color/icon | Visual distinction in theme grid. Without this, all themes look identical and the grid is unreadable. | Low | Store hex color + emoji in Theme model. Auto-assign on creation based on name hash. |
| Content-theme reassignment | Users must be able to move content between themes. Without this, AI classification errors are permanent. | Med | Add theme picker on content detail screen, similar to existing tag editor |

## Differentiators

Features that set Ankora apart from simple tag filtering.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cross-content synthesis quiz | Questions connecting concepts ACROSS multiple content items in a theme. "How does concept from Video A relate to concept from Podcast B?" Based on interleaving research (+50-125% retention). | High | Aggregates cached memos (not raw transcripts). New prompt engineering. THE differentiator -- no competing app does this. |
| Theme synthesis memo | Aggregated memo across all content in a theme. Shows the "big picture" of what user learned. | Med | Pattern already exists at `/api/content/topic/:name/memo`. Adapt from tag-based to theme-based grouping. |
| Theme learning progress | Per-theme stats: cards due, mastery level, content coverage. Gives sense of growth per knowledge domain. | Med | Aggregate SM-2 card data by theme. Compute from existing `Card.easeFactor` and `Card.repetitions`. |
| Theme discovery onboarding | First-time flow: "We found 8 themes in your content." Shows AI-created themes, lets user review/rename/merge before committing. | Med | Critical for trust. Users must feel ownership. One-time screen after initial classification. |
| AI theme suggestions on new content | When new content arrives (sync), auto-classifies into existing themes. If no theme fits, flags for next discovery batch. | Low | Extend tagging worker to also classify into themes. Low additional LLM cost (~500 tokens per new tag). |
| Smart theme merging suggestion | Detect when two themes overlap >80% and suggest merging. "Science and Physics share most content." | Med | Tag overlap analysis + user confirmation. Not auto-merge -- user decides. |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Hierarchical/nested themes | Prisma lacks recursive queries. UX complexity (breadcrumbs, drill-down). Users have 5-15 themes, not enough for hierarchy. | Flat theme list. One level is sufficient. Tags remain as the finer-grained layer underneath. |
| Manual theme creation from scratch | Undermines auto-classification value prop. Users will create poorly named, overlapping themes. | AI generates themes. Users can rename/merge/delete but cannot create empty ones. |
| Theme sharing between users | Social features, privacy concerns, multi-tenant data complexity. Way out of scope. | Themes are personal knowledge maps. Each user has their own. |
| Real-time theme updates (WebSocket) | Themes change slowly (new content every 15-30 min). WebSocket infrastructure for negligible UX benefit. | React Query polling with 5-min stale time. Pull-to-refresh on theme list. |
| Theme-based content recommendations | "You might like this because it matches your AI theme." Requires recommendation engine. Out of scope. | Stick to organizing existing synced content. |
| Drag-and-drop theme reordering | Complex gesture handling, persistence, edge cases. Low value for 5-15 themes. | Sort by content count (desc) or alphabetical. Predictable and automatic. |
| Theme-specific spaced repetition schedules | SM-2 operates per-card, not per-theme. Overriding intervals fights the algorithm. | SM-2 stays per-card. Theme view aggregates existing card data but never changes scheduling. |
| Theme colors/icons customization | Design polish that does not improve learning. Bikeshedding risk. | Auto-assign color palette from theme name hash. No user configuration needed. |

## Feature Dependencies

```
Auto-tagging (existing, in production)
  |
  +---> Theme Discovery (batch LLM clustering of all user tags)
  |       |
  |       +---> Theme Model + CRUD API
  |       |       |
  |       |       +---> Theme List Screen (iOS)
  |       |       |       |
  |       |       |       +---> Theme Detail Screen (iOS)
  |       |       |       |       |
  |       |       |       |       +---> Theme-Scoped Quiz (reuse existing cards)
  |       |       |       |
  |       |       |       +---> Theme Discovery Onboarding (first-time flow)
  |       |       |
  |       |       +---> Theme Rename/Delete
  |       |       +---> Content-Theme Reassignment
  |       |
  |       +---> Incremental Tag Classification (on new content sync)
  |
  +---> Theme Synthesis Memo (requires memos from multiple content items)
  |       |
  |       +---> Cross-Content Synthesis Quiz (requires aggregated knowledge)
  |
  +---> Theme Learning Progress (requires quiz data aggregated by theme)

Critical dependency: Auto-tagging must have already tagged content.
The auto-tagging worker is in production and operational.
```

## MVP Recommendation

### Phase 1: Theme Foundation (must-have)

1. **Theme data model** -- Prisma schema with Theme, ThemeContent, ThemeTags many-to-many relations
2. **Theme discovery worker** -- LLM clusters existing tags into 5-15 themes
3. **Theme CRUD API** -- GET /themes, GET /themes/:slug, PATCH /themes/:slug, DELETE /themes/:slug
4. **Theme list screen** -- Replace/augment current library view with theme cards showing name, count, color
5. **Theme detail screen** -- Adapt existing `/topic/[name].tsx` pattern, re-keyed by theme slug
6. **Theme-scoped quiz** -- Filter existing per-content quiz cards by theme's content IDs
7. **Theme rename/delete** -- Adapt existing tag management UI pattern

### Phase 2: Intelligence Layer (the differentiator)

8. **Incremental tag classification** -- Auto-assign new content to themes when auto-tagging worker runs
9. **Cross-content synthesis quiz** -- LLM generates questions connecting concepts from 2-3 content items
10. **Theme synthesis memo** -- Aggregated memo across all theme content
11. **Theme learning progress** -- Mastery %, cards due, per theme on home screen cards
12. **Theme discovery onboarding** -- First-time review/adjust flow for AI-generated themes

### Defer to Later Milestone

- **Smart theme merging** -- Nice-to-have. Users can manually delete redundant themes for now.
- **Smart quiz mixing (interleaving)** -- Valuable but adds quiz session complexity. Implement after synthesis proves concept.
- **Theme analytics** -- Future premium feature.
- **Content-theme reassignment UI** -- Can ship with a simple "change theme" button. Full drag-and-drop is deferred.

## Complexity Analysis

| Complexity | Features | Estimated Effort |
|------------|----------|------------------|
| **Low** | Theme CRUD API, theme list screen (adapt existing), rename/delete, content count stats | 1-2 days |
| **Medium** | Theme data model + migration, AI theme discovery worker, theme detail screen, incremental classification, theme learning progress, synthesis memo, discovery onboarding | 2-4 days each |
| **High** | Cross-content synthesis quiz (prompt engineering + memo aggregation + new quiz flow) | 1-2 weeks |

**Total estimated effort for Phase 1 (Foundation):** 1.5-2 weeks
**Total with Phase 2 (Intelligence):** 3-4 weeks

## Sources

- Codebase analysis: existing tag system (`backend/src/services/tagging.ts`), topic memo endpoint (`backend/src/routes/content.ts` lines 1257-1328), quiz generation (`backend/src/services/quizGeneration.ts`), topic screen (`ios/app/topic/[name].tsx`)
- Existing iOS patterns: `ios/hooks/useTopics.ts`, `ios/hooks/useContent.ts`
- Interleaving research: 50-125% retention improvement (Roediger & Karpicke, 2006; Kornell & Bjork, 2008)
