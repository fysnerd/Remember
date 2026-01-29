# Feature: Content Curation & Quiz Customization

## Overview

Transform Remember from "import everything" to "curate what matters". Users should actively choose what content they want to learn from, with customizable quiz sessions and post-session recaps.

---

## Phase 0: Inbox & Triage System (Priority: HIGH)

### Problem Statement
Currently, all imported content (YouTube, Spotify, TikTok) goes directly into the learning pipeline. Users have no control over what they actually want to study vs. just archive for reference.

### Solution
Introduce an **Inbox** where new content lands, requiring users to **triage** before it enters their learning queue.

---

### User Stories

#### US-01: View Inbox with New Content
```
AS A user
I WANT TO see all newly imported content in an Inbox
SO THAT I can decide what to learn vs archive
```

**Acceptance Criteria:**
- [ ] New content from all sources (YouTube, Spotify, TikTok) lands in Inbox with status `INBOX`
- [ ] Dashboard shows badge with count of items pending triage: "12 new items to review"
- [ ] Inbox page shows content grouped by source with thumbnails, titles, and import date
- [ ] Empty state when Inbox is clear: "All caught up! No new content to review."

**Technical Notes:**
- Add `INBOX` to `ContentStatus` enum in Prisma schema
- Modify sync workers to set initial status to `INBOX` instead of `PENDING`
- Add `/api/content/inbox` endpoint returning only `INBOX` status content
- Add `inboxCount` to dashboard stats API

---

#### US-02: Triage Content - Mark for Learning
```
AS A user
I WANT TO mark content as "Learn"
SO THAT it enters my active study queue and generates quizzes
```

**Acceptance Criteria:**
- [ ] "Learn" button/swipe moves content from `INBOX` to `SELECTED` status
- [ ] Content marked for learning appears in Library under "Learning" filter
- [ ] Transcription and quiz generation pipeline starts automatically
- [ ] Visual feedback: card animates out, counter decrements

**API:**
```
PATCH /api/content/:id/triage
Body: { action: "learn" }
Response: { success: true, newStatus: "SELECTED" }
```

---

#### US-03: Triage Content - Archive
```
AS A user
I WANT TO archive content I don't want to study
SO THAT it's saved but doesn't clutter my learning queue
```

**Acceptance Criteria:**
- [ ] "Archive" button/swipe moves content from `INBOX` to `ARCHIVED` status
- [ ] Archived content appears in Library under "Archived" filter
- [ ] No transcription or quiz generation for archived content
- [ ] Archived content can be restored to Learning later (see US-06)

**API:**
```
PATCH /api/content/:id/triage
Body: { action: "archive" }
Response: { success: true, newStatus: "ARCHIVED" }
```

---

#### US-04: Triage Content - Delete
```
AS A user
I WANT TO permanently delete content I don't want
SO THAT it doesn't take up space in my archive
```

**Acceptance Criteria:**
- [ ] "Delete" button removes content permanently
- [ ] Confirmation modal: "Delete permanently? This cannot be undone."
- [ ] Content is hard-deleted from database (or soft-deleted with `DELETED` status)

**API:**
```
DELETE /api/content/:id
Response: { success: true }
```

---

#### US-05: Bulk Triage Actions
```
AS A user
I WANT TO triage multiple items at once
SO THAT I can quickly process a large Inbox
```

**Acceptance Criteria:**
- [ ] "Select All" checkbox to select all visible items
- [ ] Individual checkboxes for multi-select
- [ ] Bulk action bar appears when items selected: "Learn All" | "Archive All" | "Delete All"
- [ ] Confirmation for bulk delete only
- [ ] Progress indicator for bulk operations

**API:**
```
POST /api/content/triage/bulk
Body: {
  contentIds: ["id1", "id2", ...],
  action: "learn" | "archive" | "delete"
}
Response: { success: true, processed: 12, failed: 0 }
```

---

#### US-06: Restore Archived Content to Learning
```
AS A user
I WANT TO move archived content back to Learning
SO THAT I can change my mind about what to study
```

**Acceptance Criteria:**
- [ ] "Move to Learning" button on archived content in Library
- [ ] Content status changes from `ARCHIVED` to `SELECTED`
- [ ] Transcription/quiz pipeline starts if not already done

**API:**
```
PATCH /api/content/:id/triage
Body: { action: "learn" }
```

---

#### US-07: Forced Triage Before Review
```
AS A user
I WANT TO be prompted to triage before starting a review session
SO THAT I consciously choose my learning material
```

**Acceptance Criteria:**
- [ ] If Inbox has items, "Start Session" button shows: "Review Inbox first (12 items)"
- [ ] Clicking redirects to Inbox page
- [ ] Alternative: Modal prompt "You have 12 new items. Triage now or skip?"
- [ ] User can skip but sees reminder next time
- [ ] Setting to disable forced triage (default: enabled)

---

### Data Model Changes

```prisma
// Updated ContentStatus enum
enum ContentStatus {
  INBOX         // NEW: Just imported, pending triage
  ARCHIVED      // NEW: User archived, no quiz generation
  SELECTED      // User wants to learn, pending transcription
  TRANSCRIBING  // Transcription in progress
  GENERATING    // Quiz generation in progress
  READY         // Quiz ready for review
  FAILED        // Processing failed
  UNSUPPORTED   // Cannot process (e.g., Spotify exclusive)
}
```

**Migration Notes:**
- Existing content with `PENDING` status → migrate to `SELECTED` (grandfather existing users)
- New imports → always start as `INBOX`

---

### UI/UX Specifications

#### Inbox Page Layout
```
┌─────────────────────────────────────────────────────────┐
│  Inbox                                    [Select All ☐]│
│  24 items to review                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ☐ [IMG] Why Stoicism Matters in 2024    [TT]    │   │
│  │         @philosophytok · 2 min · Today          │   │
│  │                                                  │   │
│  │         [🗑️ Delete] [📁 Archive] [📚 Learn]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ☐ [IMG] The 4% Rule Explained           [YT]    │   │
│  │         Personal Finance Club · 12 min · Today  │   │
│  │                                                  │   │
│  │         [🗑️ Delete] [📁 Archive] [📚 Learn]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ... more items ...                                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ☑ 3 selected    [Archive All] [Learn All] [Delete]    │
└─────────────────────────────────────────────────────────┘
```

#### Dashboard Inbox Badge
```
┌──────────────────────┐
│  📥 Inbox            │
│  24 new items        │
│  [Review Now →]      │
└──────────────────────┘
```

#### Library Filters Update
```
Platform: [All ▾]   Status: [All ▾]   Category: [Learning | Archived]
                                                 ↑ NEW FILTER
```

---

### API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/content/inbox` | Get all inbox items |
| GET | `/api/content/inbox/count` | Get inbox count for badge |
| PATCH | `/api/content/:id/triage` | Triage single item |
| POST | `/api/content/triage/bulk` | Bulk triage |
| DELETE | `/api/content/:id` | Delete content |

---

### Implementation Checklist

#### Backend
- [ ] Add `INBOX` and `ARCHIVED` to ContentStatus enum
- [ ] Create migration for schema change
- [ ] Migrate existing `PENDING` content to `SELECTED`
- [ ] Update YouTube sync worker: new content → `INBOX`
- [ ] Update Spotify sync worker: new content → `INBOX`
- [ ] Update TikTok sync worker: new content → `INBOX`
- [ ] Create `GET /api/content/inbox` endpoint
- [ ] Create `GET /api/content/inbox/count` endpoint
- [ ] Create `PATCH /api/content/:id/triage` endpoint
- [ ] Create `POST /api/content/triage/bulk` endpoint
- [ ] Update content query to support `category` filter (learning vs archived)

#### Frontend
- [ ] Create InboxPage component
- [ ] Add Inbox to sidebar navigation with badge
- [ ] Create ContentTriageCard component
- [ ] Implement single-item triage actions
- [ ] Implement multi-select functionality
- [ ] Implement bulk actions bar
- [ ] Add inbox prompt to Dashboard
- [ ] Update LibraryPage with Learning/Archived filter
- [ ] Add "Move to Learning" action for archived content

---

## Phase 1: Quiz Customization (Priority: HIGH)

### User Stories

#### US-10: Choose Number of Questions
```
AS A user
I WANT TO choose how many questions per session
SO THAT I can fit review into my available time
```

**Options:** 5 (Quick) | 10 (Default) | 20 (Deep) | Unlimited

---

#### US-11: Filter by Platform
```
AS A user
I WANT TO filter quiz questions by platform
SO THAT I can focus on specific content types
```

**Options:** YouTube | Spotify | TikTok (multi-select)

---

#### US-12: Filter by Tags/Categories
```
AS A user
I WANT TO filter quiz questions by topic
SO THAT I can study specific subjects
```

---

#### US-13: Select Specific Content
```
AS A user
I WANT TO quiz myself on specific videos
SO THAT I can deep-dive into particular content
```

---

### Quiz Session Builder UI
```
┌─────────────────────────────────────────┐
│         Configure Session               │
├─────────────────────────────────────────┤
│                                         │
│  Questions                              │
│  ○ 5   ● 10   ○ 20   ○ All             │
│                                         │
│  Sources                                │
│  ☑ YouTube  ☑ TikTok  ☐ Spotify        │
│                                         │
│  Topics (optional)                      │
│  [Finance ×] [+ Add topic]              │
│                                         │
│  ─────────── OR ───────────            │
│                                         │
│  [Select specific videos...]            │
│                                         │
│  ─────────────────────────────────────  │
│  📊 47 cards match your criteria        │
│                                         │
│         [Start Session]                 │
└─────────────────────────────────────────┘
```

---

## Phase 2: Post-Session Recap (Priority: MEDIUM)

### User Stories

#### US-20: View Session Stats
```
AS A user
I WANT TO see my performance stats after a session
SO THAT I can track my progress
```

**Stats shown:**
- Questions answered
- Correct answers (%)
- Cards to review again
- Current streak

---

#### US-21: Request AI Memo
```
AS A user
I WANT TO request an AI-generated summary
SO THAT I can review key concepts
```

**Acceptance Criteria:**
- [ ] "Generate Memo" button at end of session
- [ ] AI summarizes key points from reviewed content
- [ ] Shows 3-5 main takeaways
- [ ] Option to save memo to notes

---

#### US-22: Review Mistakes
```
AS A user
I WANT TO see which questions I got wrong
SO THAT I can focus on weak areas
```

---

### Session Complete UI
```
┌─────────────────────────────────────────┐
│         Session Complete! 🎉            │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  10 questions · 80% correct     │   │
│  │  🔥 3 day streak                │   │
│  │  ⚠️ 2 cards marked for review   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [View Mistakes]  [Generate AI Memo]    │
│                                         │
│  [New Session]      [Back to Dashboard] │
└─────────────────────────────────────────┘
```

---

## Technical Architecture

### New Database Models

```prisma
model QuizSession {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id])

  // Configuration
  questionLimit Int?          // null = unlimited
  platforms     Platform[]    // Filter by platform
  tagIds        String[]      // Filter by tags
  contentIds    String[]      // Specific content selection

  // Results
  startedAt     DateTime      @default(now())
  completedAt   DateTime?
  correctCount  Int           @default(0)
  totalCount    Int           @default(0)

  // AI Memo (generated on request)
  aiMemo        String?
  memoGeneratedAt DateTime?

  reviews       Review[]

  @@index([userId, startedAt])
}
```

### API Endpoints (Phase 1-2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/review/session` | Create configured session |
| GET | `/api/review/session/:id` | Get session with config |
| POST | `/api/review/session/:id/complete` | Mark session complete |
| POST | `/api/review/session/:id/memo` | Generate AI memo |
| GET | `/api/review/session/:id/mistakes` | Get wrong answers |

---

## Migration Strategy

### Phase 0 Rollout
1. Deploy schema changes with `INBOX` status
2. Existing content stays as-is (grandfathered)
3. New imports go to Inbox
4. Add Inbox UI with soft prompt (not forced initially)
5. After 1 week, enable forced triage for new users
6. Existing users get setting to enable/disable

### Data Migration
```sql
-- Migrate existing PENDING to SELECTED (they already chose to import)
UPDATE "Content" SET status = 'SELECTED' WHERE status = 'PENDING';
```

---

## Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Triage completion rate | >80% | Users engage with curation |
| Archive rate | 20-40% | Users actually filter content |
| Session completion rate | +15% | Shorter/custom sessions = more completions |
| Quiz accuracy | +10% | Focused content = better retention |

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Triage obligatoire ou optionnel ? | **Obligatoire** - force le tri avant review |
| Archivé = supprimé des quiz ? | **Non** - on peut repasser en Learning |
| Mémo IA = automatique ? | **Non** - seulement si demandé à la fin |

---

## References

- Remember PRD: `/docs/remember-prd.md`
- Architecture: `/docs/remember-architecture.md`
- UX Design: `/docs/remember-ux-design.md`
