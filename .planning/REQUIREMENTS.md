# Requirements: Ankora v2.0 Themes-first UX

**Defined:** 2026-02-10
**Core Value:** L'utilisateur apprend durablement à partir de ce qu'il consomme déjà — sans effort supplémentaire de curation.

## v2.0 Requirements

Requirements for Themes-first UX milestone. Each maps to roadmap phases.

### Data Model & API

- [ ] **DATA-01**: Theme model exists in database with name, slug, color, emoji, per-user ownership
- [ ] **DATA-02**: Content can belong to multiple themes via many-to-many relation (explicit join table)
- [ ] **DATA-03**: Themes are linked to tag patterns for deterministic classification
- [ ] **DATA-04**: API endpoint returns user's themes with content counts
- [ ] **DATA-05**: API endpoint returns theme detail with its content list (paginated, filterable by source)
- [ ] **DATA-06**: Content API responses include associated themes

### Classification

- [ ] **CLASS-01**: Worker auto-generates themes from user's existing tags via Mistral AI (batch clustering)
- [ ] **CLASS-02**: Worker auto-classifies new content into existing themes when auto-tagging completes
- [ ] **CLASS-03**: Existing content is backfilled into themes via one-time migration job
- [ ] **CLASS-04**: Theme creation passes existing themes to LLM to prevent duplicates/near-duplicates
- [ ] **CLASS-05**: Themes are capped at 15-25 per user to prevent proliferation

### Navigation (iOS)

- [ ] **NAV-01**: Home screen displays theme sections with recent content per theme
- [ ] **NAV-02**: User can tap a theme to see all its content (theme detail screen)
- [ ] **NAV-03**: Theme cards show name, emoji, color, and content count
- [ ] **NAV-04**: Theme list replaces current tag-based "Topics" as primary navigation
- [ ] **NAV-05**: User can pull-to-refresh to update theme data

### Management

- [ ] **MGMT-01**: User can rename a theme
- [ ] **MGMT-02**: User can delete a theme (content preserved, only grouping removed)
- [ ] **MGMT-03**: User can move content between themes (add/remove theme assignment)
- [ ] **MGMT-04**: User can create a new theme manually (optional, AI-first but user can override)

### Quiz

- [ ] **QUIZ-01**: User can start a quiz scoped to a specific theme (mix of existing per-content questions)
- [ ] **QUIZ-02**: Theme quiz mixes questions from all content items within the theme
- [ ] **QUIZ-03**: AI generates new synthesis questions that connect concepts across multiple content items in a theme
- [ ] **QUIZ-04**: Synthesis questions require knowledge from at least 2 different content sources
- [ ] **QUIZ-05**: Theme quiz requires minimum 3 content items with quizzes before enabling

### Memo

- [ ] **MEMO-01**: API generates a theme-level synthesis memo aggregating knowledge from all content in a theme
- [ ] **MEMO-02**: User can view theme memo from theme detail screen
- [ ] **MEMO-03**: Theme memo is cached and refreshed on-demand (24h TTL)

### Onboarding & Discovery

- [ ] **DISC-01**: First-time theme discovery flow shows AI-generated themes for user review
- [ ] **DISC-02**: User can rename, merge, or dismiss themes during onboarding
- [ ] **DISC-03**: Theme learning progress visible on theme cards (mastery %, cards due)

## v3 Requirements (Deferred)

### Intelligence

- **INTEL-01**: Smart theme merge suggestions (detect >80% content overlap)
- **INTEL-02**: Theme-specific spaced repetition analytics
- **INTEL-03**: Theme-based content recommendations

### Polish

- **POLISH-01**: Drag-and-drop theme reordering
- **POLISH-02**: Custom theme colors/icons (user picks beyond auto-assigned)
- **POLISH-03**: Hierarchical/nested themes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hierarchical/nested themes | Prisma lacks recursive queries, UX complexity, 5-15 themes not enough for hierarchy |
| Manual-only theme creation | Undermines auto-classification value prop |
| Theme sharing between users | Social features, privacy, multi-tenant complexity |
| Real-time theme updates (WebSocket) | Themes change slowly, React Query polling sufficient |
| Theme-based content recommendations | Requires recommendation engine, out of scope |
| Vector database for classification | Tag space too small (50-200/user), LLM classification simpler |
| Theme-specific SM-2 schedules | SM-2 operates per-card, overriding intervals fights the algorithm |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 5 | Pending |
| DATA-02 | Phase 5 | Pending |
| DATA-03 | Phase 5 | Pending |
| DATA-04 | Phase 5 | Pending |
| DATA-05 | Phase 5 | Pending |
| DATA-06 | Phase 5 | Pending |
| CLASS-01 | Phase 6 | Pending |
| CLASS-02 | Phase 6 | Pending |
| CLASS-03 | Phase 6 | Pending |
| CLASS-04 | Phase 6 | Pending |
| CLASS-05 | Phase 6 | Pending |
| NAV-01 | Phase 7 | Pending |
| NAV-02 | Phase 7 | Pending |
| NAV-03 | Phase 7 | Pending |
| NAV-04 | Phase 7 | Pending |
| NAV-05 | Phase 7 | Pending |
| MGMT-01 | Phase 7 | Pending |
| MGMT-02 | Phase 7 | Pending |
| MGMT-03 | Phase 7 | Pending |
| MGMT-04 | Phase 7 | Pending |
| QUIZ-01 | Phase 8 | Pending |
| QUIZ-02 | Phase 8 | Pending |
| QUIZ-03 | Phase 10 | Pending |
| QUIZ-04 | Phase 10 | Pending |
| QUIZ-05 | Phase 8 | Pending |
| MEMO-01 | Phase 9 | Pending |
| MEMO-02 | Phase 9 | Pending |
| MEMO-03 | Phase 9 | Pending |
| DISC-01 | Phase 11 | Pending |
| DISC-02 | Phase 11 | Pending |
| DISC-03 | Phase 11 | Pending |

**Coverage:**
- v2.0 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after initial definition*
