---
phase: 20-pipeline-feedback
verified: 2026-02-16T17:30:00Z
status: gaps_found
score: 2/4 must-haves verified
re_verification: false
gaps:
  - truth: "User sees per-content processing status (transcribing, generating quiz, ready) on content cards in the library grid"
    status: failed
    reason: "usePipelineStatus hook exists but is never imported or called. ContentCard accepts status prop but no consumer passes it."
    artifacts:
      - path: "ios/hooks/usePipelineStatus.ts"
        issue: "Hook defined and exported but not used anywhere"
      - path: "ios/app/(tabs)/library.tsx"
        issue: "ContentCard rendered without status prop"
      - path: "ios/app/theme/[id].tsx"
        issue: "ContentCard rendered without status prop"
    missing:
      - "Import and call usePipelineStatus in library.tsx or _layout.tsx"
      - "Pass processingMap status to ContentCard components"
  - truth: "User receives a toast notification with haptic feedback when content transitions from processing to quiz-ready"
    status: partial
    reason: "Haptic feedback implemented, but no visual toast shown. Ready transitions invalidate queries but user sees no explicit notification."
    artifacts:
      - path: "ios/hooks/usePipelineStatus.ts"
        issue: "Only haptic + query invalidation, no toast component"
    missing:
      - "Add toast notification on ready transition (or document that haptic + badge removal is sufficient)"
---

# Phase 20: Pipeline Feedback Verification Report

**Phase Goal:** Users see real-time processing status for their triaged content, so they understand why some content has quizzes and others are still processing

**Verified:** 2026-02-16T17:30:00Z

**Status:** gaps_found

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees per-content processing status (transcribing, generating quiz, ready) on content cards in the library grid | ✗ FAILED | Hook exists but never called. ContentCard accepts status but never receives it. |
| 2 | User sees specific status text on content detail screen instead of generic 'Quiz en preparation...' | ✓ VERIFIED | content/[id].tsx lines 177-181 show per-status text (TRANSCRIBING, GENERATING, FAILED, UNSUPPORTED) |
| 3 | User receives a toast notification with haptic feedback when content transitions from processing to quiz-ready | ⚠️ PARTIAL | Haptic implemented (line 48), query invalidation works (line 50), but no visual toast |
| 4 | Polling only happens when there are items in processing states, and stops when idle | ✓ VERIFIED | usePipelineStatus refetchInterval callback returns 5000 when processing.length > 0, false when idle (lines 25-28) |

**Score:** 2/4 truths verified (50%)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/routes/content.ts` | GET /api/content/pipeline-status batch endpoint | ✓ VERIFIED | Line 542, returns processing + recentlyReady, placed before /:id routes (line 850) |
| `ios/hooks/usePipelineStatus.ts` | Conditional polling hook for processing content | ⚠️ ORPHANED | Exists and exports usePipelineStatus (70 lines), but grep finds NO imports/calls in ios/app/**/*.tsx |
| `ios/components/content/PipelineStatusBadge.tsx` | Visual status badge overlay for ContentCard | ⚠️ ORPHANED | Exists (59 lines), exported from index.ts, imported by ContentCard, but ContentCard never receives status prop from consumers |
| `ios/types/content.ts` | ContentStatus with FAILED and UNSUPPORTED | ✓ VERIFIED | Lines 7-15, includes all 8 states + PipelineStatusResponse types (lines 17-33) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `ios/hooks/usePipelineStatus.ts` | `/content/pipeline-status` | api.get with conditional refetchInterval | ✓ WIRED | Line 22 calls api.get, lines 25-28 conditional polling based on processing.length |
| `ios/components/content/ContentCard.tsx` | `ios/components/content/PipelineStatusBadge.tsx` | status prop passed to PipelineStatusBadge | ⚠️ PARTIAL | ContentCard line 90 renders PipelineStatusBadge when status exists, but consumers never pass status |
| `ios/app/content/[id].tsx` | `content.status` | per-status text in bottom bar | ✓ WIRED | Lines 177-181 switch on content.status for button text |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ios/hooks/usePipelineStatus.ts` | - | Exported hook never imported/used | 🛑 Blocker | Polling never starts, status never updates |
| `ios/app/(tabs)/library.tsx` | 270 | ContentCard missing status prop | 🛑 Blocker | Badge never renders on cards |
| `ios/app/theme/[id].tsx` | 202 | ContentCard missing status prop | 🛑 Blocker | Badge never renders in theme detail |

### Human Verification Required

None - all issues are programmatically detectable.

### Gaps Summary

**Critical wiring gaps prevent goal achievement:**

1. **usePipelineStatus hook orphaned** — The hook is defined, exported, and functionally correct (conditional polling, ready transition detection, haptic feedback). However, grep shows ZERO imports in ios/app/**/*.tsx. The polling never starts.

2. **ContentCard status prop never passed** — ContentCard.tsx accepts optional status prop and renders PipelineStatusBadge when present. However, both consumers (library.tsx line 270, theme/[id].tsx line 202) omit the status prop. Badge never renders.

3. **Toast notification missing** — Plan calls for "toast notification" on ready transition (FEEDBACK-02). Implementation only does haptic + query invalidation. No visual toast component exists.

**What works:**
- Backend endpoint returns correct data structure
- Types include all 8 ContentStatus values + PipelineStatusResponse
- PipelineStatusBadge component renders correctly when given status
- Content detail screen shows per-status text and auto-refreshes
- Conditional polling logic is correct (would work if called)

**What's broken:**
- Hook never called → no polling → no status updates
- Status never passed → no badges → no visual feedback on cards
- No toast → user relies on badge disappearance + haptic only

**Root cause:** Implementation completed at component/hook level but integration with consumer screens was skipped. This is classic "task done, goal not achieved" — files exist, code compiles, but features don't activate because wiring is incomplete.

---

_Verified: 2026-02-16T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
