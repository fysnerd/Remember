# Roadmap: Ankora

## Milestones

- ✅ **v1.0 Admin & Observability** -- Phases 1-4 (shipped 2026-02-10)
- ✅ **v2.0 Themes-first UX** -- Phases 5-11 (shipped 2026-02-11)
- ✅ **v3.0 Night Blue Glass UI** -- Phases 12-16 (shipped 2026-02-12)
- 🚧 **v4.0 UX Triage & Daily Digest** -- Phases 17-20 (in progress)

## Phases

<details>
<summary>✅ v1.0 Admin & Observability (Phases 1-4) -- SHIPPED 2026-02-10</summary>

- [x] Phase 1: ESM Migration & Logging Foundation (4/4 plans) -- completed 2026-02-09
- [x] Phase 2: Job Execution Tracking (2/2 plans) -- completed 2026-02-10
- [x] Phase 3: AdminJS Panel & Manual Triggers (2/2 plans) -- completed 2026-02-10
- [x] Phase 4: Observability Dashboard (2/2 plans) -- completed 2026-02-10

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v2.0 Themes-first UX (Phases 5-11) -- SHIPPED 2026-02-11</summary>

- [x] Phase 5: Theme Data Model & API (2/2 plans) -- completed 2026-02-10
- [x] Phase 6: Theme Classification Worker (2/2 plans) -- completed 2026-02-10
- [x] Phase 7: iOS Theme Screens & Management (2/2 plans) -- completed 2026-02-10
- [x] Phase 8: Theme Quiz (Existing Cards) (1/1 plan) -- completed 2026-02-10
- [x] Phase 9: Theme Memo (1/1 plan) -- completed 2026-02-11
- [x] Phase 10: Cross-Content Synthesis Quiz (2/2 plans) -- completed 2026-02-11
- [x] Phase 11: Theme Discovery & Onboarding (2/2 plans) -- completed 2026-02-11

Full details: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

<details>
<summary>✅ v3.0 Night Blue Glass UI (Phases 12-16) -- SHIPPED 2026-02-12</summary>

- [x] Phase 12: Foundation Build (2/2 plans) -- completed 2026-02-11
- [x] Phase 13: Design System (3/3 plans) -- completed 2026-02-11
- [x] Phase 14: Screen Rebuild (4/4 plans) -- completed 2026-02-12
- [x] Phase 15: Backend Endpoints (1/1 plan) -- completed 2026-02-12
- [x] Phase 16: UX Polish (2/2 plans) -- completed 2026-02-12

</details>

### 🚧 v4.0 UX Triage & Daily Digest

**Milestone Goal:** Refonte complete du flow de triage inbox (swipe Tinder-like + bulk toggle) et implementation du Daily Digest (session microlearning quotidienne avec cloture cognitive). Alignement SRS J+1/J+3/J+7/J+31 et quiz autoreferentiels.

- [ ] **Phase 17: SRS & Quiz Backend** - Align SRS intervals to J+1/J+3/J+7/J+31 and make quiz prompts self-referential with creator/platform context
- [ ] **Phase 18: Swipe Triage** - Full inbox overhaul with Tinder-like swipe as primary mode and bulk select as secondary
- [ ] **Phase 19: Daily Digest** - Pre-built microlearning session with SRS-prioritized card selection and cognitive closure
- [ ] **Phase 20: Pipeline Feedback** - Real-time processing status so users see content progress from triage to quiz-ready

## Phase Details

### Phase 17: SRS & Quiz Backend
**Goal**: The spaced repetition engine uses research-backed intervals and quiz questions reference the creator and platform context -- improving retention through the self-reference effect
**Depends on**: Nothing (first phase of v4.0, backend-only changes)
**Requirements**: SRS-01, SRS-02, SRS-03, SRS-04, QUIZ-01, QUIZ-02, QUIZ-03
**Success Criteria** (what must be TRUE):
  1. After triaging content to "learn", the first review card appears no earlier than 24 hours later (J+1)
  2. Subsequent review intervals progress through J+3, J+7, J+31 for cards answered correctly
  3. A card answered incorrectly (rating < 3) resets to J+1 interval on next scheduling
  4. Quiz questions for a YouTube video include the channel name and reference "cette video YouTube de [creator]" in the question text
  5. Quiz generation prompt uses self-referential framing with temporal context (when the user watched/listened)
**Plans**: 2 plans (Wave 1: 17-01, Wave 2: 17-02)

Plans:
- [ ] 17-01-PLAN.md -- SRS interval alignment (fixed INTERVAL_MAP for reps 1-4, SM-2 fallback for reps > 4, J+1 nextReviewAt on all 3 card.create sites)
- [ ] 17-02-PLAN.md -- Self-referential quiz prompt (creator name + platform label + temporal context injection, TikTok/Instagram contentType fix)

### Phase 18: Swipe Triage
**Goal**: Users can quickly curate their inbox through satisfying swipe gestures (right to keep, left to dismiss) with animated card physics, or switch to bulk select mode for batch operations
**Depends on**: Nothing (independent of Phase 17; can execute in parallel)
**Requirements**: TRIAGE-01, TRIAGE-02, TRIAGE-03, TRIAGE-04, TRIAGE-05, TRIAGE-06, TRIAGE-07, TRIAGE-08
**Success Criteria** (what must be TRUE):
  1. User can swipe right on an inbox card to keep it (triggers learn pipeline) and swipe left to dismiss it (archives), with cards flying off-screen with spring physics
  2. User can tap a top-right button to toggle from swipe mode into bulk select mode, then select/deselect multiple items and batch learn or archive them
  3. User can filter inbox cards by source platform (YouTube, Spotify, TikTok, Instagram) using filter pills, available in both modes
  4. User can pull-to-refresh in swipe mode to trigger a platform sync, and inbox cards display sorted most recent first
**Plans**: TBD

Plans:
- [ ] 18-01-PLAN.md -- Swipe card stack component (gesture handler, spring animations, swipe right=keep, swipe left=dismiss)
- [ ] 18-02-PLAN.md -- Bulk select toggle mode (multi-select UI, batch learn/archive actions)
- [ ] 18-03-PLAN.md -- Source filter pills + pull-to-refresh sync + capturedAt desc sorting

### Phase 19: Daily Digest
**Goal**: Users have a single daily learning session that mixes SRS due cards and new content into a focused 10-15 question experience, ending with a cognitive closure screen showing their performance
**Depends on**: Phase 17 (SRS intervals must be correct for card selection logic)
**Requirements**: DIGEST-01, DIGEST-02, DIGEST-03, DIGEST-04, DIGEST-05
**Success Criteria** (what must be TRUE):
  1. User can tap a prominent button on the home screen to launch a daily digest session
  2. The digest pre-selects 10-15 questions, prioritizing SRS due cards over new content cards
  3. User sees question-by-question progress indicator during the session (e.g., "Question 5/12")
  4. After the last question, user sees a cognitive closure screen with score percentage, answer streak, and session duration
**Plans**: TBD

Plans:
- [ ] 19-01-PLAN.md -- Digest session backend (card selection algorithm: SRS due priority + new cards fill, 10-15 cap)
- [ ] 19-02-PLAN.md -- Digest session UI (launch from home, question progress, answer flow, cognitive closure screen with stats)

### Phase 20: Pipeline Feedback
**Goal**: Users see real-time processing status for their triaged content, so they understand why some content has quizzes and others are still processing
**Depends on**: Phase 18 (triage must exist to show post-triage feedback)
**Requirements**: FEEDBACK-01, FEEDBACK-02
**Success Criteria** (what must be TRUE):
  1. User can see per-content processing status (transcribing, generating quiz, ready) on content cards or detail screens
  2. User receives a visual indicator (badge, animation, or status change) when content transitions from processing to quiz-ready
**Plans**: TBD

Plans:
- [ ] 20-01-PLAN.md -- Pipeline status tracking (backend status field + API exposure + iOS status indicators + ready transition animation)

## Progress

**Execution Order:**
Phase 17 and 18 can execute in parallel (backend SRS vs iOS triage are independent).
Phase 19 depends on Phase 17 (SRS intervals).
Phase 20 depends on Phase 18 (triage must exist).
Recommended: 17 → 18 → 19 → 20 (serial for simplicity).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. ESM Migration & Logging | v1.0 | 4/4 | Complete | 2026-02-09 |
| 2. Job Execution Tracking | v1.0 | 2/2 | Complete | 2026-02-10 |
| 3. AdminJS Panel & Triggers | v1.0 | 2/2 | Complete | 2026-02-10 |
| 4. Observability Dashboard | v1.0 | 2/2 | Complete | 2026-02-10 |
| 5. Theme Data Model & API | v2.0 | 2/2 | Complete | 2026-02-10 |
| 6. Theme Classification Worker | v2.0 | 2/2 | Complete | 2026-02-10 |
| 7. iOS Theme Screens & Management | v2.0 | 2/2 | Complete | 2026-02-10 |
| 8. Theme Quiz (Existing Cards) | v2.0 | 1/1 | Complete | 2026-02-10 |
| 9. Theme Memo | v2.0 | 1/1 | Complete | 2026-02-11 |
| 10. Cross-Content Synthesis Quiz | v2.0 | 2/2 | Complete | 2026-02-11 |
| 11. Theme Discovery & Onboarding | v2.0 | 2/2 | Complete | 2026-02-11 |
| 12. Foundation Build | v3.0 | 2/2 | Complete | 2026-02-11 |
| 13. Design System | v3.0 | 3/3 | Complete | 2026-02-11 |
| 14. Screen Rebuild | v3.0 | 4/4 | Complete | 2026-02-12 |
| 15. Backend Endpoints | v3.0 | 1/1 | Complete | 2026-02-12 |
| 16. UX Polish | v3.0 | 2/2 | Complete | 2026-02-12 |
| 17. SRS & Quiz Backend | v4.0 | 0/2 | Not started | - |
| 18. Swipe Triage | v4.0 | 0/3 | Not started | - |
| 19. Daily Digest | v4.0 | 0/2 | Not started | - |
| 20. Pipeline Feedback | v4.0 | 0/1 | Not started | - |
