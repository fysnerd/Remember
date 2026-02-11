# Roadmap: Ankora

## Milestones

- ✅ **v1.0 Admin & Observability** -- Phases 1-4 (shipped 2026-02-10)
- ✅ **v2.0 Themes-first UX** -- Phases 5-11 (shipped 2026-02-11)
- 🚧 **v3.0 Night Blue Glass UI** -- Phases 12-16 (in progress)

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

### 🚧 v3.0 Night Blue Glass UI (In Progress)

**Milestone Goal:** Complete visual transformation from light monochrome to premium Night Blue dark mode with Glass UI components, Geist typography, Lucide icons, and restructured screens.

- [x] **Phase 12: Foundation Build** - Native dependencies + dark mode base + proof-of-concept validation -- completed 2026-02-11
- [ ] **Phase 13: Design System** - Night Blue tokens, Glass components, icon system, restyled primitives
- [ ] **Phase 14: Screen Rebuild** - Home (daily themes), Explorer (suggestions + library), Revisions, Profile
- [ ] **Phase 15: Backend Endpoints** - Daily themes selection + AI theme suggestions APIs
- [ ] **Phase 16: UX Polish** - Micro-interactions, loading animations, freemium overlays, haptics

## Phase Details

### Phase 12: Foundation Build
**Goal**: App runs on a new production binary with all native dependencies installed, dark mode base active, and key technologies validated on-device
**Depends on**: Nothing (first phase of v3.0)
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Success Criteria** (what must be TRUE):
  1. App builds and runs on iOS device with expo-blur, react-native-svg, and lucide-react-native installed
  2. App launches with Night Blue background (#0a0f1a) and light status bar -- no white flash
  3. Geist font renders correctly at multiple weights (Regular, Medium, SemiBold, Bold) in a test screen
  4. A Lucide icon renders on-device in a New Architecture + React 19 environment (proof-of-concept validated)
  5. New production binary is submitted to TestFlight via eas build
**Plans**: 2 plans

Plans:
- [x] 12-01-PLAN.md -- Install native deps, configure dark mode + Geist font globally, create validation test screen
- [x] 12-02-PLAN.md -- Preview build validation on device + production build to TestFlight

### Phase 13: Design System
**Goal**: A complete, reusable design system is in place -- Night Blue palette, Glass UI components, Lucide icon wrappers, and all existing UI primitives restyled -- so screens can be rebuilt using these building blocks
**Depends on**: Phase 12 (native dependencies must be in binary)
**Requirements**: DS-01, DS-02, DS-03, DS-04, DS-05
**Success Criteria** (what must be TRUE):
  1. Every screen uses Night Blue color palette with Soft Gold accent -- zero light-mode colors remain in any component
  2. GlassSurface, GlassCard, GlassButton, and GlassInput components render with blur, border, and shadow and are importable from a shared path
  3. All icons across the app (tab bar, cards, badges, action buttons) use Lucide icons -- no emoji remain
  4. Existing UI components (Text, Button, Card, Input, Badge, TopicChip, Skeleton, Toast) render in Night Blue / Glass style
  5. Tab bar uses glass blur background that content scrolls behind
**Plans**: TBD

Plans:
- [ ] 13-01: Night Blue tokens + Geist font loading + restyled UI primitives
- [ ] 13-02: Glass UI components (GlassSurface, GlassCard, GlassButton, GlassInput) + Glass tab bar
- [ ] 13-03: Lucide icon system (Icon, TabIcon, PlatformIcon wrappers) + emoji replacement pass

### Phase 14: Screen Rebuild
**Goal**: All four main screens are rebuilt using Glass UI components, delivering the new information architecture (daily themes home, explorer with suggestions + library, revisions with filter/search, profile with settings)
**Depends on**: Phase 13 (design system components must exist)
**Requirements**: SCREEN-01, SCREEN-02, SCREEN-03, SCREEN-04, SCREEN-05
**Success Criteria** (what must be TRUE):
  1. Home screen shows 3 daily themes in glass cards with title, content count, and question count
  2. Explorer screen has a Suggestions tab displaying 8 AI-generated theme suggestions
  3. Explorer screen has a Library tab with content list, source/category filters, and search by title or author
  4. Revisions screen shows revision cards with category filter chips and full-text search
  5. Profile screen displays user info (name, avatar) and settings/preferences
**Plans**: TBD

Plans:
- [ ] 14-01: Home screen (3 daily theme cards, greeting, stats)
- [ ] 14-02: Explorer screen (Suggestions tab + Library tab with filters/search)
- [ ] 14-03: Revisions screen (revision cards, category filter, search) + Profile screen (user info, settings)

### Phase 15: Backend Endpoints
**Goal**: Backend serves the data that Home and Explorer screens need -- daily theme selection with smart rotation and AI-generated theme suggestions
**Depends on**: Nothing (can execute in parallel with Phases 13-14; wired into screens during or after Phase 14)
**Requirements**: API-01, API-02
**Success Criteria** (what must be TRUE):
  1. GET /api/themes/daily returns 3 themes prioritized by due reviews, new content, and recency
  2. GET /api/themes/suggestions returns 8 AI-generated theme ideas via Mistral
  3. Both endpoints return valid JSON and handle edge cases (no themes, no content, API errors)
**Plans**: TBD

Plans:
- [ ] 15-01: Daily themes endpoint + AI suggestions endpoint + React Query hooks

### Phase 16: UX Polish
**Goal**: The app feels premium and alive with micro-interactions, loading animations, freemium visual indicators, and haptic feedback on key actions
**Depends on**: Phase 14 (screens must exist to polish)
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Screen transitions use 200-300ms animations with natural easing (no instant jumps)
  2. Loading states display contextual animations during quiz generation and content loading
  3. Freemium-locked content shows lock icon overlay on glass surface (visual only, no payment wiring)
  4. Haptic feedback fires on button press, quiz answer submission, and tab switch
**Plans**: TBD

Plans:
- [ ] 16-01: Transitions + loading animations + haptic feedback
- [ ] 16-02: Freemium lock overlays on glass surfaces

## Progress

**Execution Order:**
Phases 12 → 13 → 14 → 16 (sequential, each depends on prior).
Phase 15 can execute in parallel with 13/14/16 (backend is independent).

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
| 13. Design System | v3.0 | 0/3 | Not started | - |
| 14. Screen Rebuild | v3.0 | 0/3 | Not started | - |
| 15. Backend Endpoints | v3.0 | 0/1 | Not started | - |
| 16. UX Polish | v3.0 | 0/2 | Not started | - |
