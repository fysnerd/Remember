# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** L'utilisateur apprend durablement a partir de ce qu'il consomme deja -- sans effort supplementaire de curation.
**Current focus:** v4.0 UX Triage & Daily Digest -- Phase 19 complete (2 of 2 plans done)

## Current Position

Phase: 19 of 20
Plan: 2 of 2 in current phase
Status: Phase 19 complete -- all plans done
Last activity: 2026-02-16 -- Completed 19-02 (digest session UI + home screen CTA)

Progress: [######################################░░] 40/42 plans (95% overall, 75% v4.0)

## Performance Metrics

**Velocity:**
- Total plans completed: 40 (10 v1.0 + 12 v2.0 + 12 v3.0 + 6 v4.0)
- v1.0: ~25 min/plan avg (4 phases, 10 plans)
- v2.0: ~3.75 min/plan avg (7 phases, 12 plans)
- v3.0: 8 min/plan avg (5 phases, 12 plans)
- Total execution time: ~6 hours 18 min across all milestones

**v4.0 Plans:** 8 total (2 + 3 + 2 + 1)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v4.0 scope]: Swipe triage replaces batch select as primary inbox mode
- [v4.0 scope]: Triage and quiz are separate mental modes -- no quiz during triage
- [v4.0 scope]: Daily Digest as new primary learning experience
- [v4.0 scope]: SRS alignment to J+1/J+3/J+7/J+31 (PRD research-backed intervals)
- [v4.0 scope]: Self-referential quiz prompts (creator name, platform, temporal context)
- [17-01]: FIXED_INTERVALS inline in review handler (not module-level) to keep scope tight
- [17-01]: cardNextReview computed once before loop, shared across all cards in batch
- [17-01]: Prisma schema @default(now()) kept as fallback, always overridden by explicit nextReviewAt
- [17-02]: _contentType underscore prefix to satisfy noUnusedParameters while preserving API shape
- [17-02]: Creator context built once at function entry, interpolated into all prompt sections
- [17-02]: French locale date formatting (toLocaleDateString('fr-FR')) for temporal context
- [18-01]: GestureHandlerRootView wraps entire app tree (not per-screen) for global gesture support
- [18-01]: Default triageMode is 'swipe' since swipe is the primary triage experience per PRD
- [18-01]: Spring configs: fly-off (stiffness 900, damping 120, mass 4), snap-back (damping 15, stiffness 150, mass 1)
- [18-01]: CardDisplay inline in SwipeCardStack (not reusing ContentCard) for full-width swipe layout
- [18-02]: Non-scrollable ScrollView wrapper for SwipeCardStack enables pull-to-refresh without gesture conflict
- [18-02]: key={sourceFilter} on SwipeCardStack forces remount on filter change, resetting card index
- [18-02]: Search bar only in bulk mode; swipe mode is for quick triage without search
- [18-02]: SelectionBar guarded by triageMode === 'bulk' to prevent rendering in swipe mode
- [19-01]: useMutation for digest fetch (not useQuery) to prevent duplicate QuizSession creation on re-fetches
- [19-01]: No hard minimum on digest size -- return whatever cards are available (per research recommendation)
- [19-01]: Include quiz.theme in digest card response for future UI theme indicators
- [19-02]: Option normalization duplicated inline in digest.tsx (not shared util) to keep screen self-contained
- [19-02]: ReviewStats type updated to match actual backend response (adds dueToday, reviewDue, etc.)
- [19-02]: gestureEnabled: false on /digest route to prevent accidental back-swipe during session

### Pending Todos

None.

### Blockers/Concerns

- ~~Current quiz prompt explicitly FORBIDS creator references (must be reversed for QUIZ-01/02/03)~~ RESOLVED in 17-02
- ~~Card nextReviewAt defaults to now() in Prisma schema (must change to +24h for SRS-01)~~ RESOLVED in 17-01
- ~~react-native-gesture-handler needed for swipe gestures (verify Expo SDK 54 compatibility)~~ RESOLVED in 18-01 (already installed ~2.28.0, GestureHandlerRootView added)

## Session Continuity

Last session: 2026-02-16
Stopped at: Completed 19-02-PLAN.md (digest session UI + home screen CTA)
Next step: Execute phase 20 (if exists) or milestone complete
Resume file: None
