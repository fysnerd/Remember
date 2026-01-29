# Product Requirements Document (PRD): Remember

**Project:** Remember - Active Learning from Social Media
**Phase:** Planning (BMAD Phase 2)
**Version:** 1.1
**Date:** 2026-01-28
**Author:** Product Manager (BMAD)
**Based on:** Product Brief v1.0

> **v1.1 Changes:** Simplified architecture - Web App only (no Chrome Extension), YouTube transcripts via `youtube-transcript-api` (free), Spotify podcasts via RSS feed → Whisper API.

---

## 📚 Document Purpose

This PRD translates the Product Brief into detailed, actionable requirements for the development team. It defines **WHAT** the system must do (functional), **HOW WELL** it must perform (non-functional), and **IN WHAT ORDER** features should be built (prioritization).

---

## 🎯 Product Vision & Goals

**Vision:** Turn social media consumption into a structured learning system

**Goals:**
1. Enable zero-friction knowledge capture from social media
2. Generate high-quality learning materials automatically
3. Improve user knowledge retention through spaced repetition
4. Achieve 70% D7 retention with 10K users in 12 months

---

## 👤 User Personas (Reference)

From Product Brief:
1. **Content Creator** - Needs inspiration archive & trend recall
2. **Knowledge Worker** - Integrates with PKM, needs active recall
3. **Lifelong Learner** - Learns via video/podcasts, wants proof of learning

---

## ⚙️ Functional Requirements (FRs)

### FR-001: Content Discovery & Selection System

**Priority:** Must Have (MVP)

**Description:**  
System fetches user's recently liked/played content via OAuth integration and displays it for **manual selection**. User chooses which items to generate quizzes for.

**Platforms (MVP):**
- YouTube (liked videos via YouTube Data API)
- Spotify (recently played podcasts via Spotify Web API)

**Platforms (Future):**
- Instagram (posts, reels via web scraping - Playwright)
- TikTok (videos via web scraping - Playwright)
- Twitter/X (tweets, threads)
- Reddit (posts, comments)

**Acceptance Criteria:**
- ✅ YouTube OAuth integration (user authorizes once)
- ✅ Spotify OAuth integration (user authorizes once)
- ✅ Dashboard displays recently liked YouTube videos (last 50)
- ✅ Dashboard displays recently played Spotify podcasts (last 50)
- ✅ Each item shows: thumbnail, title, duration, platform
- ✅ "Generate Quiz" button on each item
- ✅ Manual refresh button
- ✅ Sync status visible ("Last synced: 2 min ago")
- ✅ Duplicate detection (don't show already processed items)

**User Selection Flow:**
- User sees list of content
- User clicks "Generate Quiz" on desired item
- System queues item for transcription + quiz generation
- Processing status shown ("Transcribing...", "Generating quiz...", "Ready!")
- User receives notification when quiz is ready

**Data Stored:**
- Content URL
- Platform source
- Timestamp of sync
- User who owns it
- Content metadata (title, thumbnail, duration)
- Processing status (pending, processing, completed, failed)

---

### FR-002: Content Transcription Pipeline

**Priority:** Must Have (MVP)

**Description:**
Extract or transcribe content to text for quiz generation. Different strategies per platform.

---

#### YouTube Videos (FREE - No Whisper needed)

**Method:** `youtube-transcript-api` Python library

**How it works:**
- Fetches existing subtitles (auto-generated or manual) directly from YouTube
- No API key required, no quotas
- Works on any public video
- Returns timestamped transcript segments

**Acceptance Criteria:**
- ✅ Fetch subtitles via `youtube-transcript-api` (free, instant)
- ✅ **Fallback (rare):** If no subtitles → yt-dlp audio + Whisper API
- ✅ Generates timestamped transcript
- ✅ Handles videos up to 2 hours long
- ✅ Supports multiple languages (EN, FR, ES, DE priority)
- ✅ Processing time: <5sec (subtitles exist for 95%+ of videos)
- ✅ Stores transcript linked to original video
- ✅ Transcript viewable in app with timestamps

**Cost:** $0 for 95%+ of videos (subtitles). ~$0.36/hour only for fallback.

---

#### Spotify Podcasts (RSS + Whisper)

**Method:** RSS Feed lookup → Download MP3 → Whisper API

**How it works:**
1. Get podcast metadata from Spotify API (show name, episode title)
2. Lookup RSS feed via Listen Notes API or podcast database
3. Find episode in RSS feed, extract MP3 URL
4. Download audio file
5. Send to Whisper API for transcription

**Acceptance Criteria:**
- ✅ Lookup RSS feed from podcast name/episode
- ✅ Download audio from RSS feed source (MP3)
- ✅ Transcribe via Whisper API
- ✅ Processing time <5min for 1-hour podcast
- ✅ Stores transcript linked to original episode
- ✅ Handle "Spotify Exclusive" podcasts gracefully (no RSS → mark unsupported)

**Cost:** ~$0.36/hour (Whisper API)

---

**Error Handling:**
- YouTube: If no subtitles AND Whisper fails → mark as "transcription unavailable"
- Spotify: If RSS not found (Spotify Exclusive) → show "This podcast is not yet supported"
- If transcription fails → retry 3x with exponential backoff
- User can manually request re-transcription
- Show clear status messages throughout

**Technical Constraints:**
- Whisper API: $0.006/min = $0.36/hour
- Whisper rate limit: 50 requests/min
- youtube-transcript-api: No limits (scrapes YouTube directly)

---

### FR-003: Podcast Metadata Extraction

**Priority:** Must Have (MVP)

**Description:**  
Extract metadata from Spotify podcast episodes for context and quiz generation.

**Acceptance Criteria:**
- ✅ Captures episode title, show name, description
- ✅ Stores duration, release date, publisher
- ✅ Extracts episode URL (Spotify link)
- ✅ Stores show artwork/thumbnail
- ✅ Links back to original episode in Spotify

**Content Structure:**
- Episode: Title, description, duration, release date
- Show: Name, publisher, artwork
- Playback: Timestamp when user listened

---

### FR-004: AI Quiz Generation

**Priority:** Must Have (MVP)

**Description:**  
Use AI (GPT-4/Claude) to generate quiz questions from transcribed/extracted content.

**Quiz Types (MVP):**
1. **Multiple Choice** (4 options, 1 correct)
2. **True/False**
3. **Flashcards** (Q&A pairs)

**Quiz Types (Future):**
4. Cloze deletion (fill in blank)
5. Short answer
6. Image-based questions

**Acceptance Criteria:**
- ✅ Generates 3-5 questions per piece of content
- ✅ Questions are factual and educational
- ✅ Difficulty level: Medium (not too easy, not too hard)
- ✅ Quality filter: Skip non-educational content (memes, rants)
- ✅ Questions have clear correct answers
- ✅ Multiple choice distractors are plausible but wrong
- ✅ Questions stored with reference to source content
- ✅ User can regenerate questions if quality is poor
- ✅ Questions preview before adding to review queue

**Quality Metrics:**
- Target: 80%+ of generated questions are "good quality" (user feedback)
- If <60% quality → improve AI prompt or add human review

**AI Prompt Strategy:**
- Analyze transcript/text for key concepts
- Identify factual claims, definitions, examples
- Generate questions that test understanding (not memorization)
- Vary question types for engagement

---

### FR-005: Spaced Repetition Review System

**Priority:** Must Have (MVP)

**Description:**  
Schedule and present quiz questions using spaced repetition algorithm to optimize retention.

**Algorithm:** SM-2 (SuperMemo 2) or FSRS (Free Spaced Repetition Scheduler)

**Acceptance Criteria:**
- ✅ Daily review session queue
- ✅ User rates answer difficulty: Easy / Good / Hard / Again
- ✅ Algorithm schedules next review based on rating
- ✅ Review intervals: 1 day → 3 days → 1 week → 2 weeks → 1 month → 3 months
- ✅ New cards introduced gradually (max 20/day by default)
- ✅ Review session ends after time limit (15min default) or card limit (20 cards default)
- ✅ Progress saved mid-session (can pause and resume)
- ✅ Streak tracking (consecutive days reviewed)
- ✅ Review reminders (daily notification at set time)

**Review Session Flow:**
1. User opens app or clicks daily reminder
2. System presents due cards in order (oldest first)
3. User reads question → thinks → reveals answer
4. User rates difficulty
5. Card rescheduled or marked as learned
6. Repeat until session complete
7. Show session summary (cards reviewed, accuracy, streak)

**Settings:**
- Daily review time (default: 9am)
- Cards per session (default: 20)
- New cards per day (default: 20)
- Auto-advance to next card (yes/no)

---

### FR-006: Content Library & Search

**Priority:** Should Have (MVP+)

**Description:**  
Searchable archive of all captured content with filters and tags.

**Acceptance Criteria:**
- ✅ List view of all captured content
- ✅ Search by keyword (title, transcript, content)
- ✅ Filter by platform (YouTube, Twitter, etc.)
- ✅ Filter by date captured
- ✅ Filter by content type (video, text, image)
- ✅ Auto-tagging via AI (generate 3-5 tags per item)
- ✅ Manual tagging by user
- ✅ Sort by: date, relevance, platform
- ✅ Pagination (20 items per page)
- ✅ Click to view original content + transcript
- ✅ Link to generated quizzes

**Search Quality:**
- Full-text search on titles + transcripts
- Supports partial matching
- Ranked by relevance

---

### FR-007: Export to PKM Tools

**Priority:** Should Have (MVP+)

**Description:**  
Export captured content and quizzes to Notion, Obsidian, or Markdown.

**Export Formats:**
1. **Markdown** (universal)
2. **Notion** (via API)
3. **Obsidian** (Markdown with frontmatter)

**Acceptance Criteria:**
- ✅ Bulk export (all content or filtered selection)
- ✅ Export includes: title, URL, transcript, tags, quiz questions
- ✅ Markdown formatting preserved
- ✅ Notion integration: one-click export to selected database
- ✅ Obsidian integration: export to vault folder
- ✅ Export preserves timestamps and metadata
- ✅ Re-export updates existing items (no duplicates)

**Export Structure (Markdown example):**
```markdown
# [Video Title]

**Source:** YouTube  
**URL:** https://youtube.com/watch?v=...  
**Captured:** 2026-01-27  
**Tags:** #learning #productivity

## Transcript
[Full transcript here]

## Quiz Questions
1. What is the main benefit of spaced repetition?
   - A) It's faster
   - B) It improves retention ✓
   - C) It's easier
   - D) It's fun
```

---

### FR-008: User Authentication & Profile

**Priority:** Must Have (MVP)

**Description:**  
Secure user accounts with authentication and profile management.

**Acceptance Criteria:**
- ✅ Sign up with email + password
- ✅ Sign up with Google OAuth
- ✅ Email verification required
- ✅ Password reset via email
- ✅ Profile settings: name, email, timezone
- ✅ Review preferences: daily time, cards per session
- ✅ Subscription status visible
- ✅ Payment method management (via Stripe)

**Security:**
- Passwords hashed (bcrypt)
- Session tokens (JWT)
- HTTPS only
- Rate limiting on login (5 attempts/10min)

---

### FR-009: OAuth Integration & Sync

**Priority:** Must Have (MVP)

**Description:**  
OAuth integrations for YouTube and Spotify with background sync.

**YouTube OAuth:**
- ✅ "Connect YouTube" button triggers OAuth flow
- ✅ User authorizes access to liked videos
- ✅ Backend stores access_token + refresh_token
- ✅ Automatic token refresh when expired
- ✅ Scope: `https://www.googleapis.com/auth/youtube.readonly`

**Spotify OAuth:**
- ✅ "Connect Spotify" button triggers OAuth flow
- ✅ User authorizes access to listening history
- ✅ Backend stores access_token + refresh_token
- ✅ Automatic token refresh when expired
- ✅ Scope: `user-read-recently-played`

**Background Sync:**
- ✅ Cron job polls YouTube likes every 15 minutes
- ✅ Cron job polls Spotify history every 30 minutes
- ✅ Compares with last sync timestamp
- ✅ Only processes new content since last sync
- ✅ Updates sync status in user settings

**User Visibility:**
- ✅ Connection status: "Connected ✓" or "Not connected"
- ✅ Last sync timestamp: "Last synced: 2 minutes ago"
- ✅ Manual refresh button
- ✅ Disconnect option

---

### FR-010: Web Application Dashboard

**Priority:** Must Have (MVP)

**Description:**  
Main web interface for reviewing quizzes, viewing content, and managing settings.

**Pages:**

**1. Dashboard (Home)**
- Daily review session prompt
- Streak counter
- Today's stats (cards due, new captures)
- Recent activity feed

**2. Review Session**
- Quiz interface
- Progress bar
- Difficulty rating buttons
- Session summary at end

**3. Content Library**
- List of captured content
- Search & filters
- Content detail view

**4. Settings**
- Profile
- Review preferences
- Integrations (Notion, Obsidian)
- Subscription & billing

**5. Stats & Progress**
- Total cards learned
- Retention rate over time
- Streak history
- Top platforms/tags

**Acceptance Criteria:**
- ✅ Responsive design (desktop + mobile web)
- ✅ Fast load times (<2s)
- ✅ Accessible (WCAG 2.1 AA)
- ✅ Works on Chrome, Firefox, Safari

---

### FR-011: Subscription & Billing

**Priority:** Must Have (MVP)

**Description:**  
Stripe integration for subscription management.

**Plans:**
- **Free Trial:** 14 days, all features
- **Pro:** $9/mo or $90/year (save 17%)

**Acceptance Criteria:**
- ✅ Stripe Checkout for signup
- ✅ Auto-renewal
- ✅ Cancel anytime
- ✅ Update payment method
- ✅ View billing history
- ✅ Downgrade to free (limited)
- ✅ Email receipts

**Free Plan Limits (after trial):**
- 10 captures/month
- 5 quiz questions/day
- No export

---

## 🚀 Non-Functional Requirements (NFRs)

### NFR-001: Performance

**Transcription:**
- Process 1-hour video in <5 minutes
- Handle 100 concurrent transcriptions

**Quiz Generation:**
- Generate 5 questions in <10 seconds
- Support 1000 concurrent generations

**Web App:**
- Page load <2 seconds
- Quiz review UI lag <100ms

**API:**
- Response time <200ms (p95)
- Support 10K concurrent users

---

### NFR-002: Reliability

**Uptime:** 99.5% (max 3.6h downtime/month)

**Data Durability:**
- Zero data loss (backups every 6 hours)
- Point-in-time recovery (7 days)

**Error Handling:**
- Graceful degradation (if transcription fails, user can still review existing quizzes)
- Retry logic for transient failures
- User-friendly error messages

---

### NFR-003: Scalability

**Target:** Support 10K users in Year 1, 100K in Year 2

**Infrastructure:**
- Horizontal scaling (add more servers as needed)
- Database sharding (split by user ID)
- CDN for static assets

**Cost per user:** <$2/mo (transcription + AI + infra)

---

### NFR-004: Security

**Authentication:**
- JWT tokens with 7-day expiry
- Refresh tokens for long-term sessions
- OAuth2 for Google login

**Data Protection:**
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- PII (email, name) stored securely

**Compliance:**
- GDPR compliant (user data export, deletion)
- CCPA compliant

**Rate Limiting:**
- 100 API requests/min per user
- 1000 captures/day per user

---

### NFR-005: Usability

**Onboarding:**
- New user completes first capture in <2 minutes
- In-app tutorial (optional, skippable)

**Review Session:**
- Clear, distraction-free UI
- Keyboard shortcuts (spacebar = reveal, 1/2/3/4 = difficulty)

**Accessibility:**
- WCAG 2.1 AA compliance
- Screen reader support
- Keyboard navigation

---

### NFR-006: Maintainability

**Code Quality:**
- 80%+ test coverage
- TypeScript (type-safe)
- ESLint + Prettier (code style)

**Documentation:**
- API docs (OpenAPI/Swagger)
- Developer onboarding guide
- Architecture decision records (ADRs)

**Monitoring:**
- Error tracking (Sentry)
- Performance monitoring (Datadog or similar)
- User analytics (Mixpanel or PostHog)

---

## 📦 Epics & User Stories

### Epic 1: Content Capture Foundation

**Goal:** Users can automatically capture content from YouTube and Twitter

**Stories:**

#### STORY-001: YouTube OAuth Integration
**As a** user  
**I want to** connect my YouTube account  
**So that** my liked videos are captured automatically

**Acceptance Criteria:**
- "Connect YouTube" button in settings
- OAuth popup opens (Google OAuth)
- User authorizes access to liked videos
- Access token + refresh token stored securely
- Connection status shows "Connected ✓"
- Last sync timestamp visible

**Points:** 8

---

#### STORY-002: Spotify OAuth Integration
**As a** user  
**I want to** connect my Spotify account  
**So that** my podcast listening is captured automatically

**Acceptance Criteria:**
- "Connect Spotify" button in settings
- OAuth popup opens (Spotify OAuth)
- User authorizes access to listening history
- Access token + refresh token stored securely
- Connection status shows "Connected ✓"
- Last sync timestamp visible

**Points:** 8

---

#### STORY-003: YouTube Sync Cron Job
**As a** user  
**I want** my YouTube likes synced automatically  
**So that** I don't have to manually refresh

**Acceptance Criteria:**
- Cron job runs every 15 minutes
- Fetches liked videos from YouTube API
- Compares with last_sync_timestamp
- Only processes videos liked since last sync
- Updates last_sync_timestamp after success
- Handles API errors gracefully (retry)

**Points:** 5

---

#### STORY-004: Spotify Sync Cron Job
**As a** user  
**I want** my Spotify listening synced automatically  
**So that** podcast episodes are captured

**Acceptance Criteria:**
- Cron job runs every 30 minutes
- Fetches recently played episodes from Spotify API
- Filters for podcast episodes (not music)
- Compares with last_sync_timestamp
- Only processes new episodes
- Updates last_sync_timestamp after success

**Points:** 5

---

### Epic 2: Content Processing

**Goal:** Transform captured content into learning materials

**Stories:**

#### STORY-005: YouTube Video Transcription
**As a** user  
**I want** my YouTube videos to be automatically transcribed  
**So that** I can generate quizzes from video content

**Acceptance Criteria:**
- Video audio extracted
- Sent to Whisper API for transcription
- Timestamped transcript generated
- Stored and viewable in app
- Handles videos up to 2 hours

**Points:** 13

---

#### STORY-006: AI Quiz Generation from Transcripts
**As a** user  
**I want** quizzes automatically generated from video transcripts  
**So that** I can test my knowledge

**Acceptance Criteria:**
- 3-5 multiple choice questions per video
- Questions test key concepts
- Quality filter (skip memes/rants)
- Preview questions before adding to queue
- Option to regenerate if quality is poor

**Points:** 13

---

#### STORY-007: AI Quiz Generation from Podcast Transcripts
**As a** user  
**I want** quizzes generated from podcast episodes  
**So that** I can retain what I learn from podcasts

**Acceptance Criteria:**
- 3-5 questions per episode
- Multiple choice questions
- Questions based on key insights
- Quality filter applied (skip music podcasts)

**Points:** 8

---

### Epic 3: Spaced Repetition Review

**Goal:** Users can review quizzes daily using spaced repetition

**Stories:**

#### STORY-008: Review Session Interface
**As a** user  
**I want** a clean, focused quiz review interface  
**So that** I can concentrate on learning

**Acceptance Criteria:**
- Full-screen review mode
- Shows question + options
- Reveal answer button
- Rate difficulty: Easy/Good/Hard/Again
- Progress bar
- Session summary at end

**Points:** 8

---

#### STORY-009: SM-2 Spaced Repetition Algorithm
**As a** user  
**I want** cards scheduled intelligently  
**So that** I review them at optimal intervals

**Acceptance Criteria:**
- SM-2 algorithm implemented
- Intervals: 1d, 3d, 1w, 2w, 1m, 3m
- Difficulty rating affects next interval
- New cards introduced gradually (20/day)
- Due cards shown in order (oldest first)

**Points:** 13

---

#### STORY-010: Daily Review Reminders
**As a** user  
**I want** to be reminded to review daily  
**So that** I build a learning habit

**Acceptance Criteria:**
- Email reminder at set time (default 9am)
- Browser notification if app is open
- Reminder shows # of cards due
- Link directly to review session
- Can snooze or skip day

**Points:** 5

---

#### STORY-011: Streak Tracking
**As a** user  
**I want** to see my review streak  
**So that** I stay motivated

**Acceptance Criteria:**
- Streak counter on dashboard
- Longest streak tracked
- Streak resets if day missed
- Visual celebration on milestone (7, 30, 100 days)

**Points:** 3

---

### Epic 4: Content Library & Organization

**Goal:** Users can search, filter, and organize captured content

**Stories:**

#### STORY-012: Content Library List View
**As a** user  
**I want** to see all my captured content in one place  
**So that** I can browse and search

**Acceptance Criteria:**
- List view with thumbnails
- Shows title, platform, date
- Pagination (20 items/page)
- Click to view details

**Points:** 5

---

#### STORY-013: Search & Filter
**As a** user  
**I want** to search and filter my content  
**So that** I can find specific items

**Acceptance Criteria:**
- Keyword search (title + transcript)
- Filter by platform (YouTube, Twitter)
- Filter by date range
- Filter by tags
- Instant search results

**Points:** 8

---

#### STORY-014: Auto-Tagging with AI
**As a** user  
**I want** content automatically tagged  
**So that** I can organize without manual effort

**Acceptance Criteria:**
- AI generates 3-5 tags per item
- Tags based on content topics
- Tags editable by user
- Tag cloud visible in library

**Points:** 5

---

### Epic 5: Export & Integrations

**Goal:** Users can export content to their PKM tools

**Stories:**

#### STORY-015: Markdown Export
**As a** user  
**I want** to export content as Markdown  
**So that** I can use it in any tool

**Acceptance Criteria:**
- Bulk export (all or filtered)
- Markdown includes title, URL, transcript, quizzes
- Download as .zip
- Individual item export

**Points:** 5

---

#### STORY-016: Notion Integration
**As a** user  
**I want** to export directly to Notion  
**So that** I can add to my knowledge base

**Acceptance Criteria:**
- OAuth connection to Notion
- Select target database
- One-click export
- Updates existing pages (no duplicates)

**Points:** 8

---

#### STORY-017: Obsidian Integration
**As a** user  
**I want** to export to my Obsidian vault  
**So that** I can integrate with my notes

**Acceptance Criteria:**
- Specify vault folder path
- Export as Markdown with frontmatter
- Sync on schedule (daily)
- Manual sync button

**Points:** 5

---

### Epic 6: User Management & Billing

**Goal:** Users can create accounts and manage subscriptions

**Stories:**

#### STORY-018: User Sign Up
**As a** new user  
**I want** to create an account  
**So that** I can start using Remember

**Acceptance Criteria:**
- Sign up with email + password
- Sign up with Google OAuth
- Email verification sent
- Free trial starts (14 days)

**Points:** 5

---

#### STORY-019: Subscription Management
**As a** user  
**I want** to subscribe to Pro plan  
**So that** I can unlock full features

**Acceptance Criteria:**
- Stripe Checkout flow
- Choose monthly or yearly
- Payment method saved
- Auto-renewal enabled
- Email confirmation

**Points:** 8

---

#### STORY-020: Billing Portal
**As a** subscriber  
**I want** to manage my subscription  
**So that** I can update payment or cancel

**Acceptance Criteria:**
- Stripe Customer Portal link
- View billing history
- Update payment method
- Cancel subscription
- Downgrade to free

**Points:** 3

---

## 🎯 Prioritization: MoSCoW

### MUST HAVE (MVP - Weeks 1-8)

**Epic 1: Content Capture**
- STORY-001: YouTube OAuth Integration (8)
- STORY-002: Spotify OAuth Integration (8)
- STORY-003: YouTube Sync Cron Job (5)
- STORY-004: Spotify Sync Cron Job (5)

**Epic 2: Content Processing**
- STORY-005: YouTube Transcription (13)
- STORY-006: AI Quiz from Transcripts (13)
- STORY-007: AI Quiz from Text (8)

**Epic 3: Spaced Repetition**
- STORY-008: Review Session UI (8)
- STORY-009: SM-2 Algorithm (13)
- STORY-010: Daily Reminders (5)
- STORY-011: Streak Tracking (3)

**Epic 6: User Management**
- STORY-018: User Sign Up (5)
- STORY-019: Subscription Management (8)

**Total Must-Have:** 104 points (~8-10 weeks at 10-12 points/week)

---

### SHOULD HAVE (Post-MVP - Weeks 9-12)

**Epic 4: Content Library**
- STORY-012: Library List View (5)
- STORY-013: Search & Filter (8)
- STORY-014: Auto-Tagging (5)

**Epic 5: Export**
- STORY-015: Markdown Export (5)
- STORY-016: Notion Integration (8)

**Epic 6: Billing**
- STORY-020: Billing Portal (3)

**Total Should-Have:** 34 points (~3-4 weeks)

---

### COULD HAVE (Future - Months 4-6)

**Epic 5: More Integrations**
- STORY-017: Obsidian Integration (5)
- Instagram/TikTok capture
- Podcast transcription

**Epic 4: Advanced Features**
- Advanced quiz types (cloze, short answer)
- Image OCR for quiz questions
- Audio quizzes (TTS)

**Total Could-Have:** 20+ points

---

### WON'T HAVE (Not Now)

- Twitter/X integration (API too expensive)
- Mobile native app (iOS/Android) - web app works on mobile
- Social features (shared decks, leaderboards)
- Team accounts
- API for third-party developers
- Offline mode

### FUTURE (Post-MVP)

- Mobile native app (iOS/Android) - long-term vision
- Instagram integration (via Playwright scraping or future API)
- TikTok integration (via Playwright scraping or future API)

---

## 📊 Story Point Summary

| Epic | Must Have | Should Have | Could Have | Total |
|------|-----------|-------------|------------|-------|
| Epic 1: Capture | 26 | - | - | 26 |
| Epic 2: Processing | 34 | - | - | 34 |
| Epic 3: Review | 29 | - | - | 29 |
| Epic 4: Library | - | 18 | 5 | 23 |
| Epic 5: Export | - | 13 | 5 | 18 |
| Epic 6: User/Billing | 13 | 3 | - | 16 |
| **TOTAL** | **104** | **34** | **10+** | **148+** |

**Estimated Timeline:**
- MVP (Must Have): 8-10 weeks
- MVP+ (Should Have): 12-14 weeks total
- Full v1.0: 16-20 weeks

---

## 🔗 Dependencies & Sequencing

**Critical Path:**

1. **Week 1-2:** Foundation
   - User sign up (STORY-018)
   - YouTube OAuth integration (STORY-001)
   - Spotify OAuth integration (STORY-002)

2. **Week 3-4:** Capture & Sync
   - YouTube sync cron job (STORY-003)
   - Spotify sync cron job (STORY-004)

3. **Week 5-6:** Processing
   - YouTube transcription via youtube-transcript-api (STORY-005)
   - Spotify RSS → Whisper transcription (STORY-005b)
   - AI quiz generation (STORY-006, STORY-007)

4. **Week 7-8:** Review
   - Review UI (STORY-008)
   - SM-2 algorithm (STORY-009)
   - Reminders & streak (STORY-010, STORY-011)

5. **Week 9-10:** Monetization
   - Subscription (STORY-019)
   - Billing portal (STORY-020)

6. **Week 11-12:** Polish
   - Library & search (STORY-012, STORY-013)
   - Export (STORY-015)

**Blockers:**
- Quiz generation (STORY-006/007) depends on transcription (STORY-005)
- Review session (STORY-008) depends on quiz generation
- Subscription (STORY-019) can happen in parallel

---

## ✅ Definition of Done

**For each story:**
- [ ] Code written and reviewed
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests pass
- [ ] Acceptance criteria met
- [ ] UX reviewed and approved
- [ ] Deployed to staging
- [ ] QA tested
- [ ] Product owner approval
- [ ] Deployed to production

**For MVP:**
- [ ] All Must-Have stories complete
- [ ] End-to-end user flow tested (sign up → capture → review)
- [ ] Performance targets met (NFRs)
- [ ] Security audit passed
- [ ] 10 beta users successfully onboarded
- [ ] NPS > 40 from beta users
- [ ] Ready for public beta launch

---

## 🚀 Next Steps (BMAD Workflow)

**Completed:**
1. ✅ Product Brief (Business Analyst)
2. ✅ Competitive Research (Creative Intelligence)
3. ✅ PRD (Product Manager) - THIS DOCUMENT

**Next Phases:**
4. **→ UX Design** (UX Designer) - Wireframes, user flows, design system
5. **→ Architecture** (System Architect) - Tech stack, data models, APIs
6. **→ Sprint Planning** (Scrum Master) - Break into sprints, estimate velocity
7. **→ Implementation** (Developer) - Build the thing!

**Recommended:** Proceed to UX Design for wireframes before architecture.

---

**Document Status:** ✅ Ready for Review  
**Next Action:** `/create-ux-design` with UX Designer  
**Owner:** Antoine  
**Last Updated:** 2026-01-27
