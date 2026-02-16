# Phase 20: Pipeline Feedback - Research

**Researched:** 2026-02-16
**Domain:** Content processing status visibility (backend status exposure + iOS polling + visual indicators)
**Confidence:** HIGH

## Summary

The Ankora backend already has a complete pipeline status model. The `ContentStatus` enum tracks content through `INBOX -> SELECTED -> TRANSCRIBING -> GENERATING -> READY` (plus `FAILED`, `UNSUPPORTED`, `ARCHIVED`). The transcription and quiz generation services already update these statuses in real-time as content moves through the pipeline. The backend also already has a per-content status endpoint at `GET /api/content/:id/status` that returns the current status, transcript presence, and quiz count.

The key gap is on the **iOS side**: the app currently ignores processing statuses almost entirely. The content detail screen shows a static "Quiz en preparation..." disabled button when `quizCount === 0`, with no distinction between SELECTED, TRANSCRIBING, or GENERATING states. The ContentCard component has no status indicator at all. There is no polling mechanism to detect when content transitions from processing to READY.

**Primary recommendation:** Add a batch pipeline status endpoint on the backend (efficient for polling multiple items), create a `usePipelinePolling` hook in iOS that polls processing content every 5-10 seconds, and add visual status indicators (badge overlays on ContentCard, progress text on content detail, and a toast/haptic when content becomes quiz-ready).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack React Query | already installed | Polling via `refetchInterval` | Built-in polling support, no extra dependency |
| react-native-reanimated | already installed | Status transition animations | Already used throughout app for animations |
| zustand | already installed | Track processing content IDs | Already used for app state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react-native | already installed | Status icons (Loader, CheckCircle, AlertCircle) | Icon overlays on cards |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polling (refetchInterval) | WebSocket/SSE | WebSocket is more real-time but adds significant backend complexity (PM2 cluster mode complicates WebSocket state). Polling every 5-10s is sufficient for this use case. |
| Batch status endpoint | Individual status calls | Individual calls create N+1 problem when user has multiple processing items. Batch is more efficient. |

**Installation:**
No new packages needed. Everything is already installed.

## Architecture Patterns

### Recommended Approach

```
Backend:
  GET /api/content/pipeline-status   -- Batch: returns all processing content for user
  (existing) GET /api/content/:id/status  -- Single content status (already exists)

iOS:
  hooks/usePipelineStatus.ts   -- Polling hook for processing content
  components/content/PipelineStatusBadge.tsx  -- Visual badge for ContentCard
  Content detail screen        -- Enhanced with status text + transition animation
```

### Pattern 1: Batch Pipeline Status Endpoint
**What:** A single endpoint that returns all content currently in processing states (SELECTED, TRANSCRIBING, GENERATING) for the authenticated user.
**When to use:** When the iOS app needs to poll for status updates on multiple items simultaneously.
**Example:**
```typescript
// Backend: GET /api/content/pipeline-status
// Returns: { processing: [{ id, status, title, updatedAt }], recentlyReady: [{ id, title, readyAt }] }
contentRouter.get('/pipeline-status', async (req, res) => {
  const userId = req.user!.id;

  // Get all processing content
  const processing = await prisma.content.findMany({
    where: {
      userId,
      status: { in: ['SELECTED', 'TRANSCRIBING', 'GENERATING'] },
    },
    select: { id: true, status: true, title: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  // Get content that became READY in the last 5 minutes (for transition detection)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentlyReady = await prisma.content.findMany({
    where: {
      userId,
      status: 'READY',
      updatedAt: { gte: fiveMinAgo },
    },
    select: { id: true, title: true, updatedAt: true },
    take: 20,
  });

  return res.json({ processing, recentlyReady });
});
```

### Pattern 2: Conditional Polling with React Query
**What:** Poll only when there are items in processing states. Stop polling when nothing is processing.
**When to use:** Avoids unnecessary API calls when all content is ready.
**Example:**
```typescript
// iOS: usePipelineStatus hook
export function usePipelineStatus() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['pipeline', 'status'],
    queryFn: async () => {
      const { data } = await api.get('/content/pipeline-status');
      return data; // { processing: [...], recentlyReady: [...] }
    },
    // Poll every 5 seconds ONLY when there are processing items
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.processing?.length > 0) return 5000;
      return false; // Stop polling
    },
    // Also refetch when app comes to foreground
    refetchOnWindowFocus: true,
  });
}
```

### Pattern 3: Status Badge on ContentCard
**What:** A small overlay badge on the ContentCard thumbnail showing the processing state.
**When to use:** On any screen that renders ContentCard for items that are not yet READY.
**Example:**
```typescript
// Status badge component
function PipelineStatusBadge({ status }: { status: ContentStatus }) {
  if (status === 'READY' || status === 'INBOX' || status === 'ARCHIVED') return null;

  const config = {
    SELECTED: { icon: Clock, label: 'En attente', color: colors.textTertiary },
    TRANSCRIBING: { icon: Mic, label: 'Transcription...', color: colors.accent },
    GENERATING: { icon: Sparkles, label: 'Quiz en creation...', color: colors.success },
    FAILED: { icon: AlertCircle, label: 'Erreur', color: colors.error },
  };
  // Render overlay badge on thumbnail area
}
```

### Pattern 4: Ready Transition Detection
**What:** Compare previous polling result with current to detect newly-ready content.
**When to use:** Trigger toast + haptic when content finishes processing.
**Example:**
```typescript
// In usePipelineStatus hook or a separate effect
const previousProcessingRef = useRef<Set<string>>(new Set());

useEffect(() => {
  if (!data) return;
  const currentProcessingIds = new Set(data.processing.map(p => p.id));

  // Items that WERE processing and are no longer = they finished
  for (const id of previousProcessingRef.current) {
    if (!currentProcessingIds.has(id)) {
      // This item finished processing
      const readyItem = data.recentlyReady.find(r => r.id === id);
      if (readyItem) {
        showToast(`"${readyItem.title}" est pret !`, 'success');
        haptics.success();
      }
    }
  }
  previousProcessingRef.current = currentProcessingIds;
}, [data]);
```

### Anti-Patterns to Avoid
- **Polling every content individually:** N+1 calls. Use the batch endpoint instead.
- **Always-on polling:** Wastes battery and API calls when nothing is processing. Use conditional refetchInterval.
- **WebSocket for this use case:** Overkill given PM2 cluster mode and the low-latency tolerance (5s delay is fine).
- **Client-side status derivation:** Don't try to guess status from `hasTranscript + quizCount`. Trust the backend `status` field.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polling | Custom setInterval logic | React Query `refetchInterval` | Handles cleanup, deduplication, background/foreground automatically |
| Transition animations | Manual opacity/scale | Reanimated `FadeIn` / `Layout` transitions | Already used throughout app, consistent animation feel |
| Status text i18n | Hardcoded strings per status | Simple config object mapping | Single source of truth for status labels |

**Key insight:** React Query's `refetchInterval` callback receiving the query object means you can inspect `query.state.data` to decide whether to keep polling. This is the idiomatic way to do conditional polling.

## Common Pitfalls

### Pitfall 1: Stale Status After Triage
**What goes wrong:** User swipes "learn" on a card, the triage API returns, but the content still shows as processing for several seconds before the status actually changes.
**Why it happens:** The triage endpoint returns immediately with `status: SELECTED`, but the transcription/quiz pipeline runs async. If polling hasn't kicked in yet, the UI shows stale data.
**How to avoid:** After a triage mutation succeeds, immediately add the triaged content ID(s) to the "processing" set in the pipeline status query (optimistic update), and start polling.
**Warning signs:** User taps "learn", sees nothing happen for 10+ seconds.

### Pitfall 2: Battery Drain from Aggressive Polling
**What goes wrong:** Polling every 2 seconds on a screen with 20 processing items drains battery.
**Why it happens:** Overly aggressive polling interval.
**How to avoid:** 5-second interval is sufficient. The pipeline typically takes 10-60 seconds for YouTube, 1-5 minutes for podcasts. 5s polling provides good UX without excessive requests.
**Warning signs:** App appears in iOS battery usage report with abnormal background activity.

### Pitfall 3: Toast Spam on Batch Triage
**What goes wrong:** User bulk-triages 15 items, then gets 15 individual "content ready!" toasts over the next 2 minutes.
**Why it happens:** Each item completes independently, triggering individual notifications.
**How to avoid:** Batch notifications. If multiple items become ready within a short window (e.g., 3 seconds), show a single aggregated toast: "5 contenus prets !"
**Warning signs:** Screen fills with overlapping toasts.

### Pitfall 4: Polling Continues on Background Screens
**What goes wrong:** Pipeline status keeps polling even when user navigates to a screen that doesn't show processing status.
**Why it happens:** React Query keeps queries alive by default.
**How to avoid:** Use `enabled` flag tied to screen focus, or rely on React Query's default behavior of pausing unfocused queries. The `refetchInterval` already respects window focus.
**Warning signs:** Unnecessary network requests visible in dev tools.

### Pitfall 5: Race Between Optimistic Update and Backend Status
**What goes wrong:** After triage, the optimistic update shows SELECTED, but a quick poll returns INBOX (because backend hasn't processed the triage yet due to async nature).
**Why it happens:** The triage endpoint fires the processing pipeline async (fire-and-forget), so the DB might still show SELECTED when the poll fires.
**How to avoid:** The triage endpoint already returns `newStatus: SELECTED`, and the pipeline is truly async. The status moves SELECTED -> TRANSCRIBING -> GENERATING -> READY. There's no race back to INBOX. This is actually not a real risk given the current backend behavior.

## Code Examples

### Existing Backend Status Endpoint (already in production)
```typescript
// Source: backend/src/routes/content.ts:1132-1172
// GET /api/content/:id/status
// Returns: { id, status, platform, title, hasTranscript, quizCount }
```

### Existing Status Transitions in Backend
```
Transcription services:
  SELECTED -> TRANSCRIBING -> SELECTED (with transcript) or FAILED

Quiz generation service:
  SELECTED (with transcript) -> GENERATING -> READY or FAILED

Note: After transcription succeeds, status goes back to SELECTED
(not directly to GENERATING), because the quiz generation worker
picks up SELECTED items that have transcripts.

Exception: Triage endpoint chains them directly:
  transcribe(id).then(success => quizThenClassify(id))
  This means SELECTED -> TRANSCRIBING -> SELECTED -> GENERATING -> READY
  can happen in one continuous async chain.
```

### Existing iOS Types (already defined)
```typescript
// Source: ios/types/content.ts:7-13
export type ContentStatus =
  | 'INBOX'
  | 'SELECTED'
  | 'TRANSCRIBING'
  | 'GENERATING'
  | 'READY'
  | 'ARCHIVED';
// Note: Missing 'FAILED' and 'UNSUPPORTED' from backend enum
```

### ContentCard Currently Has No Status Prop
```typescript
// Source: ios/components/content/ContentCard.tsx
// Props: id, title, source, thumbnailUrl, channelName, duration, onPress, onLongPress, isSelected, selectionMode
// NO status prop - this needs to be added
```

### Content Detail Already Shows "Quiz en preparation..."
```typescript
// Source: ios/app/content/[id].tsx:165-168
// Already handles the case but with a single static message for ALL non-ready states
{!hasQuiz ? (
  <Button variant="primary" fullWidth disabled>
    Quiz en preparation...
  </Button>
) : null}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WebSocket for real-time | Polling with React Query refetchInterval | React Query v4+ | Simpler, works with HTTP, no WebSocket server needed |
| Always-on polling | Conditional polling (poll only when processing items exist) | React Query v5 (query function in refetchInterval) | Better battery life, fewer unnecessary requests |
| Individual status calls | Batch status endpoint | Common pattern | O(1) requests instead of O(n) |

**Deprecated/outdated:**
- None relevant. The approach is straightforward HTTP polling with React Query, which is stable and well-established.

## Open Questions

1. **Where to show processing status indicators?**
   - What we know: ContentCard (grid thumbnails), content detail screen, and possibly the home screen recommendations are the main surfaces.
   - What's unclear: Should processing content appear on the home screen at all? Currently home shows quiz recommendations (READY content only).
   - Recommendation: Show status on ContentCard + content detail. On home, optionally show a small "X items processing" summary banner. Claude's discretion on exact placement.

2. **Should FAILED content show a retry button inline on the card?**
   - What we know: There's already a `POST /api/content/:id/retry` endpoint for failed content.
   - What's unclear: UX for retry - inline button on card vs only on content detail screen.
   - Recommendation: Show error icon on card with tap to go to detail screen where retry is available. Keep cards simple.

3. **Polling interval tuning**
   - What we know: YouTube transcription is fast (seconds via yt-dlp subtitles). Podcast/TikTok/Instagram transcription is slower (minutes via Whisper).
   - What's unclear: Ideal polling interval.
   - Recommendation: Start with 5 seconds. Can tune later based on real usage. React Query makes changing this trivial.

## Key Codebase Facts

### Backend: Status field is already returned in list endpoint
The `GET /api/content` list endpoint already includes `status` in the response (line 288-309 of content.ts). The iOS `mapContent` function already maps `item.status` to `Content['status']`. **No backend changes needed for the list endpoint.**

### Backend: Single-item status endpoint already exists
`GET /api/content/:id/status` (content.ts:1132-1172) returns id, status, platform, title, hasTranscript, quizCount. This is already available but unused by iOS.

### Backend: Missing batch pipeline status endpoint
There is no endpoint to get all processing content in one call. This needs to be created.

### iOS: ContentStatus type is missing FAILED and UNSUPPORTED
The iOS `ContentStatus` type (types/content.ts:7-13) lists INBOX, SELECTED, TRANSCRIBING, GENERATING, READY, ARCHIVED but is missing FAILED and UNSUPPORTED which exist in the backend Prisma enum.

### iOS: Content list response already includes status
The `useContentList` hook maps `item.status` from the backend response. Content cards just don't display it yet.

### Backend: Triage triggers immediate pipeline
Both single triage (`PATCH /api/content/:id/triage`) and bulk triage (`POST /api/content/triage/bulk`) fire-and-forget the processing pipeline. The response includes `processingStarted: true/false` which iOS could use to know polling should begin.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/prisma/schema.prisma` - ContentStatus enum definition
- Codebase analysis: `backend/src/routes/content.ts` - Existing status endpoint, triage endpoints, list endpoint
- Codebase analysis: `backend/src/services/transcription.ts` - Status transition: SELECTED -> TRANSCRIBING -> SELECTED
- Codebase analysis: `backend/src/services/quizGeneration.ts` - Status transition: SELECTED -> GENERATING -> READY
- Codebase analysis: `ios/types/content.ts` - Existing ContentStatus type
- Codebase analysis: `ios/hooks/useContent.ts` - Existing content hooks with React Query
- Codebase analysis: `ios/components/content/ContentCard.tsx` - Current card props (no status)
- Codebase analysis: `ios/app/content/[id].tsx` - Content detail screen, existing "Quiz en preparation" message
- Codebase analysis: `ios/hooks/useInbox.ts` - Existing refetchInterval pattern (60s for inbox count)

### Secondary (MEDIUM confidence)
- TanStack React Query docs - `refetchInterval` callback pattern for conditional polling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Codebase patterns are clear, endpoint additions are straightforward
- Pitfalls: HIGH - Common polling pitfalls are well-understood, battery/toast issues are predictable
- Status transitions: HIGH - Read actual backend service code showing exact status changes

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, no fast-moving dependencies)
