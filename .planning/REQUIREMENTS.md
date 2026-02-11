# Requirements: Ankora v3.0

**Defined:** 2026-02-11
**Core Value:** L'utilisateur apprend durablement a partir de ce qu'il consomme deja -- sans effort supplementaire de curation.

## v3.0 Requirements

Requirements for Night Blue Glass UI milestone. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: App builds with new native dependencies (expo-blur, react-native-svg, lucide-react-native) and runs on iOS device
- [ ] **FOUND-02**: App launches in dark mode with Night Blue background (#0a0f1a) and light status bar
- [ ] **FOUND-03**: Geist font loads and renders correctly for all text weights in the app

### Design System

- [ ] **DS-01**: Night Blue color palette with Soft Gold (#D4A574) accent is applied across all screens with no light mode remnants
- [ ] **DS-02**: Glass surface primitives (GlassSurface, GlassCard, GlassButton, GlassInput) are available as reusable components with blur, border, and shadow
- [ ] **DS-03**: All icons use Lucide library instead of emoji (tab bar, cards, badges, action buttons)
- [ ] **DS-04**: Existing UI components (Text, Button, Card, Input, Badge, TopicChip, Skeleton, Toast) are restyled for Night Blue / Glass UI
- [ ] **DS-05**: Glass tab bar with blur background replaces current solid tab bar

### Screens

- [ ] **SCREEN-01**: Home screen displays 3 daily themes in glass cards showing title, content count, and question count
- [ ] **SCREEN-02**: Explorer screen has Suggestions tab with 8 AI-generated theme suggestions
- [ ] **SCREEN-03**: Explorer screen has Library tab with content list, source/category filters, and search by title or author
- [ ] **SCREEN-04**: Revisions screen shows revision cards with category filter and full-text search
- [ ] **SCREEN-05**: Profile screen shows user info (name, avatar) and settings/preferences

### Backend

- [ ] **API-01**: Daily themes endpoint returns 3 themes prioritized by due reviews and new content
- [ ] **API-02**: Theme suggestions endpoint returns 8 AI-generated theme ideas via Mistral

### UX Polish

- [ ] **UX-01**: Screen transitions use 200-300ms animations with natural easing
- [ ] **UX-02**: Loading states show contextual animations (quiz generation, content loading)
- [ ] **UX-03**: Freemium-locked content displays lock icon overlay on glass surface
- [ ] **UX-04**: Haptic feedback fires on key interactions (button press, quiz answer, tab switch)

## Future Requirements (v3.1 -- Onboarding & Monetization)

### Onboarding

- **ONBOARD-01**: 11-step onboarding flow (splash through home)
- **ONBOARD-02**: Apple Sign-In alongside existing email/password
- **ONBOARD-03**: Google Sign-In alongside existing email/password
- **ONBOARD-04**: Magic link authentication (no password)
- **ONBOARD-05**: Progress bar animated between onboarding steps
- **ONBOARD-06**: First quiz during onboarding (3 questions: easy/easy/hard)

### Monetization

- **PAY-01**: RevenueCat integration for subscription management
- **PAY-02**: 14-day free trial to annual subscription
- **PAY-03**: Paywall soft triggered conditionally during onboarding
- **PAY-04**: Freemium content gating enforced server-side

### Notifications

- **NOTIF-01**: Push notification permission prompt during onboarding
- **NOTIF-02**: Daily review reminders at user-preferred time
- **NOTIF-03**: New content alerts when sync finds new material

## Out of Scope

| Feature | Reason |
|---------|--------|
| Light mode / theme toggle | Night Blue is the identity. No light mode. |
| SwiftUI Liquid Glass (iOS 26+) | Requires iOS 26, not compatible with current user base. expo-blur covers Glass UI. |
| Shared Element Transitions | Not production-ready on Reanimated 4 + New Architecture (Fabric). |
| Actual payment processing | Deferred to v3.1 with RevenueCat. v3.0 is visual-only freemium. |
| Android app | iOS only for now |
| Gamification (streaks, badges) | Post-MVP |
| A/B testing | Post-MVP |
| Custom illustrations per theme | Complexity too high for v3.0. Lucide icons + color differentiation sufficient. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 12 | Pending |
| FOUND-02 | Phase 12 | Pending |
| FOUND-03 | Phase 12 | Pending |
| DS-01 | Phase 13 | Pending |
| DS-02 | Phase 13 | Pending |
| DS-03 | Phase 13 | Pending |
| DS-04 | Phase 13 | Pending |
| DS-05 | Phase 13 | Pending |
| SCREEN-01 | Phase 14 | Pending |
| SCREEN-02 | Phase 14 | Pending |
| SCREEN-03 | Phase 14 | Pending |
| SCREEN-04 | Phase 14 | Pending |
| SCREEN-05 | Phase 14 | Pending |
| API-01 | Phase 15 | Pending |
| API-02 | Phase 15 | Pending |
| UX-01 | Phase 16 | Pending |
| UX-02 | Phase 16 | Pending |
| UX-03 | Phase 16 | Pending |
| UX-04 | Phase 16 | Pending |

**Coverage:**
- v3.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 after roadmap creation*
