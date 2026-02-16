# Requirements: Ankora v4.0

**Defined:** 2026-02-16
**Core Value:** L'utilisateur apprend durablement a partir de ce qu'il consomme deja -- sans effort supplementaire de curation.

## v4.0 Requirements

Requirements for the UX Triage & Daily Digest milestone. Each maps to roadmap phases.

### Triage

- [ ] **TRIAGE-01**: User can swipe right on inbox card to keep content (triggers learn/classify pipeline)
- [ ] **TRIAGE-02**: User can swipe left on inbox card to dismiss content (archives it)
- [ ] **TRIAGE-03**: User can toggle between swipe mode and bulk select mode via top-right button
- [ ] **TRIAGE-04**: User can select/deselect multiple items in bulk mode and batch learn/archive
- [ ] **TRIAGE-05**: User can filter inbox by source platform (YouTube, Spotify, TikTok, Instagram) in both modes
- [ ] **TRIAGE-06**: User can pull-to-refresh to trigger platform sync in swipe mode
- [ ] **TRIAGE-07**: Inbox cards display sorted most recent first (capturedAt desc)
- [ ] **TRIAGE-08**: Swipe actions show animated visual feedback (card flies off-screen with spring physics)

### SRS

- [ ] **SRS-01**: First review is scheduled 24h after content triage (J+1), not immediately
- [ ] **SRS-02**: Review intervals follow J+1, J+3, J+7, J+31 fixed progression
- [ ] **SRS-03**: Failed review (rating < 3) resets card to J+1 interval
- [ ] **SRS-04**: Card easeFactor adjusts based on user performance (SM-2 compatible)

### Quiz

- [ ] **QUIZ-01**: Quiz questions include creator/channel name in question text
- [ ] **QUIZ-02**: Quiz questions reference source platform context (e.g., "dans cette video YouTube de [creator]")
- [ ] **QUIZ-03**: Quiz generation prompt uses self-referential framing with temporal context

### Digest

- [ ] **DIGEST-01**: User can launch a daily digest session from home screen
- [ ] **DIGEST-02**: Daily digest pre-selects 10-15 questions mixing due SRS cards and new cards
- [ ] **DIGEST-03**: User sees question-by-question progress during digest (e.g., "Question 5/12")
- [ ] **DIGEST-04**: User sees cognitive closure screen at end of session with stats summary (score, streak, time)
- [ ] **DIGEST-05**: Daily digest prioritizes SRS due cards over new content cards

### Feedback

- [ ] **FEEDBACK-01**: User sees real-time processing status per content (transcribing, generating, ready)
- [ ] **FEEDBACK-02**: User receives visual indicator when new content becomes quiz-ready after triage

## Future Requirements

Deferred to v4.1 or later.

### Notifications

- **NOTIF-01**: User receives push notification for daily digest reminder
- **NOTIF-02**: User can configure notification time preference

### Gamification

- **GAME-01**: User earns streak for consecutive daily digest completions
- **GAME-02**: User sees milestone badges (7d, 14d, 30d streaks)

### Onboarding

- **ONBD-01**: User completes guided first-use flow (platform connect + first triage)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Quiz during triage | Triage is fast curation, quiz is focused engagement -- different mental modes |
| Infinite scroll in swipe mode | Card stack is finite (current inbox batch), not infinite feed |
| Custom SRS intervals | Fixed J+1/J+3/J+7/J+31 per PRD research, no user override |
| Audio playback during triage | Triage is visual-only quick decision, not content consumption |
| Multi-session digest per day | One daily session is sufficient for habit formation |
| Undo swipe (shake to undo) | Simplicity over features -- user can re-sync if needed |
| Payment/subscription gating | Visual freemium already in v3.0, actual payment deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRIAGE-01 | Phase 18 | Pending |
| TRIAGE-02 | Phase 18 | Pending |
| TRIAGE-03 | Phase 18 | Pending |
| TRIAGE-04 | Phase 18 | Pending |
| TRIAGE-05 | Phase 18 | Pending |
| TRIAGE-06 | Phase 18 | Pending |
| TRIAGE-07 | Phase 18 | Pending |
| TRIAGE-08 | Phase 18 | Pending |
| SRS-01 | Phase 17 | Pending |
| SRS-02 | Phase 17 | Pending |
| SRS-03 | Phase 17 | Pending |
| SRS-04 | Phase 17 | Pending |
| QUIZ-01 | Phase 17 | Pending |
| QUIZ-02 | Phase 17 | Pending |
| QUIZ-03 | Phase 17 | Pending |
| DIGEST-01 | Phase 19 | Pending |
| DIGEST-02 | Phase 19 | Pending |
| DIGEST-03 | Phase 19 | Pending |
| DIGEST-04 | Phase 19 | Pending |
| DIGEST-05 | Phase 19 | Pending |
| FEEDBACK-01 | Phase 20 | Pending |
| FEEDBACK-02 | Phase 20 | Pending |

**Coverage:**
- v4.0 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 after roadmap creation*
