# Roadmap: Ankora

## Milestones

- ✅ **v1.0 Admin & Observability** -- Phases 1-4 (shipped 2026-02-10)
- 🚧 **v2.0 Themes-first UX** -- Phases 5-11 (in progress)

## Phases

<details>
<summary>✅ v1.0 Admin & Observability (Phases 1-4) -- SHIPPED 2026-02-10</summary>

- [x] Phase 1: ESM Migration & Logging Foundation (4/4 plans) -- completed 2026-02-09
- [x] Phase 2: Job Execution Tracking (2/2 plans) -- completed 2026-02-10
- [x] Phase 3: AdminJS Panel & Manual Triggers (2/2 plans) -- completed 2026-02-10
- [x] Phase 4: Observability Dashboard (2/2 plans) -- completed 2026-02-10

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v2.0 Themes-first UX (In Progress)

**Milestone Goal:** Transform Ankora from content-centric navigation to theme-centric navigation, with AI-generated themes, theme-scoped quizzes, cross-content synthesis, and theme memos.

- [x] **Phase 5: Theme Data Model & API** -- Database schema, CRUD endpoints, and content-theme relations (completed 2026-02-10)
- [ ] **Phase 6: Theme Classification Worker** -- AI-powered auto-generation and classification of themes from tags
- [ ] **Phase 7: iOS Theme Screens & Management** -- Theme-first home screen, detail views, and user management
- [ ] **Phase 8: Theme Quiz (Existing Cards)** -- Quiz scoped to a theme using existing per-content questions
- [ ] **Phase 9: Theme Memo** -- AI-generated synthesis memos aggregating knowledge per theme
- [ ] **Phase 10: Cross-Content Synthesis Quiz** -- New AI-generated questions connecting concepts across multiple content items
- [ ] **Phase 11: Theme Discovery & Onboarding** -- First-time theme review flow and learning progress visibility

## Phase Details

### Phase 5: Theme Data Model & API
**Goal**: Users and workers can create, read, update, and delete themes, and content can be associated with themes through the API
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. Theme table exists in database with name, slug, color, emoji, and user ownership; creating a theme via API persists it correctly
  2. A content item can be assigned to multiple themes, and a theme can contain multiple content items (many-to-many via explicit join table)
  3. API GET /themes returns the authenticated user's themes with accurate content counts per theme
  4. API GET /themes/:id returns paginated content list filterable by source (YouTube, Spotify, TikTok, Instagram)
  5. Content API responses (GET /content, GET /content/:id) include associated theme names and IDs in each content object
**Plans:** 2 plans

Plans:
- [x] 05-01-PLAN.md -- Prisma schema migration (Theme, ContentTheme, ThemeTag models + DB push)
- [x] 05-02-PLAN.md -- Theme CRUD API routes, content association endpoints, content API theme enrichment

### Phase 6: Theme Classification Worker
**Goal**: Themes are automatically generated from a user's tag history and new content is auto-classified into existing themes without manual intervention
**Depends on**: Phase 5
**Requirements**: CLASS-01, CLASS-02, CLASS-03, CLASS-04, CLASS-05
**Success Criteria** (what must be TRUE):
  1. After worker runs for a user with 10+ tagged content items, 5-15 themes are auto-generated from their tag clusters via Mistral AI
  2. When a new content item is tagged by the auto-tagging worker, the classification worker assigns it to matching existing themes within the next scheduled run
  3. Existing content with tags is backfilled into themes via a one-time migration job (all tagged content has theme assignments after backfill completes)
  4. Running the classification worker twice for the same user does not create duplicate or near-duplicate themes (e.g., "IA", "Intelligence Artificielle", "Machine Learning" collapse into one)
  5. No user has more than 25 themes after any worker run
**Plans:** 2 plans

Plans:
- [ ] 06-01-PLAN.md -- Theme generation service (slug utility extraction, LLM tag clustering, deterministic classification, backfill logic)
- [ ] 06-02-PLAN.md -- Scheduler integration + admin triggers (cron entry, REST API endpoints, AdminJS panel buttons)

### Phase 7: iOS Theme Screens & Management
**Goal**: Users navigate their library through theme sections on the home screen and can manage theme organization (rename, delete, move content, create)
**Depends on**: Phase 6
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, MGMT-01, MGMT-02, MGMT-03, MGMT-04
**Success Criteria** (what must be TRUE):
  1. Home screen displays theme cards with name, emoji, color, and content count; tapping a theme opens its detail screen with all associated content
  2. Theme cards replace the previous tag-based "Topics" grid as the primary navigation method on the home/feed screen
  3. User can pull-to-refresh on the home screen and theme detail screen to get updated theme data
  4. User can rename a theme, delete a theme (content preserved), and create a new theme manually from the management UI
  5. User can add or remove content from a theme (move content between themes) through the theme detail or content detail screen
**Plans**: TBD

Plans:
- [ ] 07-01: Theme list and detail screens (home screen redesign, theme cards, theme detail with content list)
- [ ] 07-02: Theme management screens (rename, delete, create, content reassignment)

### Phase 8: Theme Quiz (Existing Cards)
**Goal**: Users can practice quiz questions scoped to a specific theme, mixing existing per-content questions from all content within that theme
**Depends on**: Phase 7
**Requirements**: QUIZ-01, QUIZ-02, QUIZ-05
**Success Criteria** (what must be TRUE):
  1. User can tap "Quiz" on a theme detail screen and receive questions drawn from all content items within that theme
  2. Questions in a theme quiz come from multiple different content items (not just one), shuffled across the theme's content
  3. Theme quiz button is disabled (with explanation) when the theme has fewer than 3 content items with generated quizzes
**Plans**: TBD

Plans:
- [ ] 08-01: Theme quiz API endpoint and iOS quiz screen

### Phase 9: Theme Memo
**Goal**: Users can view an AI-generated synthesis memo that aggregates knowledge from all content in a theme into a coherent summary
**Depends on**: Phase 8
**Requirements**: MEMO-01, MEMO-02, MEMO-03
**Success Criteria** (what must be TRUE):
  1. User can tap "Memo" on a theme detail screen and see a synthesized summary connecting concepts across all content items in the theme
  2. Theme memo is generated on first view and cached; subsequent views within 24 hours return the cached version without re-generation
  3. User can force-refresh the memo to get an updated synthesis reflecting newly added content
**Plans**: TBD

Plans:
- [ ] 09-01: Theme memo API endpoint (aggregation + caching) and iOS memo screen

### Phase 10: Cross-Content Synthesis Quiz
**Goal**: AI generates new quiz questions that require understanding connections between multiple content items within a theme -- questions that cannot be answered from any single source
**Depends on**: Phase 9
**Requirements**: QUIZ-03, QUIZ-04
**Success Criteria** (what must be TRUE):
  1. Theme quiz includes synthesis questions that explicitly reference or connect concepts from 2+ different content items in the theme
  2. Synthesis questions are distinguishable from single-content questions (tagged or labeled so the user can see they test cross-content understanding)
  3. Answering a synthesis question correctly requires knowledge that spans at least 2 different source content items (not answerable from one source alone)
**Plans**: TBD

Plans:
- [ ] 10-01: Synthesis question generation (prompt engineering, memo aggregation, Quiz scope THEME)
- [ ] 10-02: iOS integration (synthesis questions in theme quiz flow, visual distinction)

### Phase 11: Theme Discovery & Onboarding
**Goal**: First-time users review and refine AI-generated themes before committing, and all users can see their learning progress per theme
**Depends on**: Phase 10
**Requirements**: DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):
  1. When themes are first generated for a user, a discovery flow presents the AI-suggested themes for review before they appear in navigation
  2. During the discovery flow, user can rename, merge, or dismiss individual themes before confirming
  3. Theme cards on the home screen display learning progress (mastery percentage and number of cards due for review)
**Plans**: TBD

Plans:
- [ ] 11-01: Theme discovery onboarding flow (iOS screens for review/rename/merge/dismiss)
- [ ] 11-02: Theme learning progress aggregation and display on theme cards

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. ESM Migration & Logging | v1.0 | 4/4 | Complete | 2026-02-09 |
| 2. Job Execution Tracking | v1.0 | 2/2 | Complete | 2026-02-10 |
| 3. AdminJS Panel & Triggers | v1.0 | 2/2 | Complete | 2026-02-10 |
| 4. Observability Dashboard | v1.0 | 2/2 | Complete | 2026-02-10 |
| 5. Theme Data Model & API | v2.0 | 2/2 | Complete | 2026-02-10 |
| 6. Theme Classification Worker | v2.0 | 0/2 | Not started | - |
| 7. iOS Theme Screens & Management | v2.0 | 0/2 | Not started | - |
| 8. Theme Quiz (Existing Cards) | v2.0 | 0/1 | Not started | - |
| 9. Theme Memo | v2.0 | 0/1 | Not started | - |
| 10. Cross-Content Synthesis Quiz | v2.0 | 0/2 | Not started | - |
| 11. Theme Discovery & Onboarding | v2.0 | 0/2 | Not started | - |
