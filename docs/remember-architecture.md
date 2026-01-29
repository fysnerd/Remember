# System Architecture: Remember

**Project:** Remember - Active Learning from Social Media
**Phase:** Solutioning (BMAD Phase 3)
**Version:** 1.1
**Date:** 2026-01-28
**Author:** System Architect (BMAD)
**Based on:** PRD v1.1, UX Design v1.0

> **v1.1 Changes:** Web App only (no Chrome Extension). YouTube transcripts via `youtube-transcript-api` (free). Spotify podcasts via RSS feed lookup → Whisper API.

---

## 🎯 Architecture Goals

1. **Scalability:** Support 10K users Year 1, 100K Year 2
2. **Reliability:** 99.5% uptime, zero data loss
3. **Performance:** <2s page load, <5min video transcription
4. **Cost-Efficiency:** <$2/user/month operational costs
5. **Maintainability:** Modular, testable, documented

---

## 🏛️ System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Web App (SPA - React + TypeScript)          │  │
│  │  - OAuth flows (YouTube, Spotify)                    │  │
│  │  - Review session, Library, Dashboard, Settings      │  │
│  └────────────────────────┬─────────────────────────────┘  │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                         API GATEWAY                          │
│                     (Kong / AWS API GW)                      │
│  - Authentication (JWT)                                      │
│  - Rate Limiting                                             │
│  - Request Routing                                           │
└────────────────────────┬─────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Auth      │  │  Content    │  │   Quiz      │
│  Service    │  │  Service    │  │  Service    │
│ (Node.js)   │  │ (Node.js)   │  │ (Node.js)   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       │         ┌──────┴──────┐         │
       │         ▼             ▼         │
       │  ┌─────────────┐  ┌─────────────┐
       │  │ Transcription│  │   AI Quiz   │
       │  │   Worker     │  │  Generator  │
       │  │  (Python)    │  │  (Python)   │
       │  └──────┬───────┘  └──────┬──────┘
       │         │                 │
       └─────────┼─────────────────┼──────────┐
                 │                 │          │
                 ▼                 ▼          ▼
         ┌──────────────────────────────────────┐
         │        MESSAGE QUEUE (Redis)          │
         │  - Transcription jobs                 │
         │  - Quiz generation jobs               │
         │  - Email notifications                │
         └──────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ PostgreSQL  │  │   Redis     │  │    S3       │
│ (Database)  │  │  (Cache)    │  │  (Storage)  │
└─────────────┘  └─────────────┘  └─────────────┘

        ┌─────────────────────┐
        │   External APIs     │
        ├─────────────────────┤
        │ - youtube-transcript│
        │   -api (free)       │
        │ - Whisper API       │
        │ - OpenAI/Claude API │
        │ - Listen Notes API  │
        │ - Stripe API        │
        │ - YouTube Data API  │
        │ - Spotify Web API   │
        └─────────────────────┘
```

---

## 🧩 Component Architecture

### 1. OAuth & Sync Service (Backend)

**Technology:** Node.js + Express + TypeScript

**Responsibilities:**
- Handle YouTube OAuth 2.0 flow
- Handle Spotify OAuth 2.0 flow
- Store and refresh access tokens
- Background sync jobs (cron)
- Poll YouTube API for new liked videos
- Poll Spotify API for recent podcast episodes
- Enqueue content for processing

**Key Modules:**
```
src/services/oauth/
├── youtube.service.ts    # YouTube OAuth & API calls
├── spotify.service.ts    # Spotify OAuth & API calls
├── sync.scheduler.ts     # Cron job manager
└── token.manager.ts      # Token refresh logic
```

**Cron Jobs:**
- YouTube sync: Every 15 minutes
- Spotify sync: Every 30 minutes
- Token refresh: Every 6 hours (proactive)

**APIs Used:**
```javascript
// YouTube Data API v3
GET https://www.googleapis.com/youtube/v3/channels
  ?part=contentDetails&mine=true
  → Get likes playlist ID

GET https://www.googleapis.com/youtube/v3/playlistItems
  ?playlistId={likesPlaylistId}&part=snippet
  → Get liked videos

// Spotify Web API
GET https://api.spotify.com/v1/me/player/recently-played
  ?type=episode&limit=50
  → Get recent podcast episodes
```

**Security:**
- OAuth tokens encrypted at rest
- Automatic token refresh before expiry
- PKCE flow for enhanced security
- Scopes: minimal required only

---

### 2. Web App (Client)

**Technology:** React 18 + TypeScript, Vite

**Responsibilities:**
- Dashboard UI (review, library, stats, settings)
- Review session (quiz interface)
- Content library (search, filter, detail)
- User settings & profile management
- Subscription & billing UI

**Key Modules:**
```
src/
├── components/          # React components
│   ├── Dashboard/
│   ├── ReviewSession/
│   ├── Library/
│   └── Settings/
├── hooks/              # Custom React hooks
├── services/           # API clients
├── store/              # State management (Zustand)
├── utils/              # Helpers
└── types/              # TypeScript types
```

**State Management:** Zustand (lightweight, simple)

**Routing:** React Router v6

**Styling:** Tailwind CSS + CSS Modules

**Build:** Vite (fast dev, optimized prod)

---

### 3. API Gateway

**Technology:** Kong (self-hosted) or AWS API Gateway

**Responsibilities:**
- Centralized entry point for all API requests
- JWT token validation
- Rate limiting (100 req/min per user)
- Request routing to services
- CORS handling
- Logging & monitoring

**Endpoints:**
```
/api/v1/auth/*          → Auth Service
/api/v1/content/*       → Content Service
/api/v1/quiz/*          → Quiz Service
/api/v1/review/*        → Quiz Service
/api/v1/subscription/*  → Auth Service (Stripe)
```

**Rate Limits:**
- Authentication: 5 req/min (login attempts)
- Content capture: 100 req/min
- Quiz generation: 50 req/min
- API calls: 100 req/min (general)

---

### 4. Auth Service (Backend)

**Technology:** Node.js + Express + TypeScript

**Responsibilities:**
- User registration (email/password, Google OAuth)
- Login & JWT token issuance
- Email verification
- Password reset
- User profile management
- Subscription management (Stripe integration)

**Database Tables:**
- `users` (id, email, password_hash, created_at, etc.)
- `subscriptions` (user_id, plan, stripe_customer_id, etc.)
- `oauth_connections` (user_id, provider, access_token, refresh_token, expires_at)

**APIs:**
```
POST   /api/v1/auth/signup              # Create account
POST   /api/v1/auth/login               # Login
POST   /api/v1/auth/google              # Google OAuth
POST   /api/v1/auth/logout              # Logout
GET    /api/v1/auth/verify/:token       # Email verification
POST   /api/v1/auth/reset-password      # Password reset
GET    /api/v1/auth/me                  # Get current user
PATCH  /api/v1/auth/profile             # Update profile

# OAuth Connections
GET    /api/v1/oauth/youtube/connect    # Initiate YouTube OAuth
GET    /api/v1/oauth/youtube/callback   # YouTube OAuth callback
DELETE /api/v1/oauth/youtube/disconnect # Disconnect YouTube
GET    /api/v1/oauth/spotify/connect    # Initiate Spotify OAuth
GET    /api/v1/oauth/spotify/callback   # Spotify OAuth callback
DELETE /api/v1/oauth/spotify/disconnect # Disconnect Spotify
POST   /api/v1/oauth/sync/manual        # Trigger manual sync
```

**Security:**
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens (7-day expiry)
- Refresh tokens (30-day expiry)
- Email verification required
- Rate limiting on login (5 attempts/10min)

---

### 5. Content Service (Backend)

**Technology:** Node.js + Express + TypeScript

**Responsibilities:**
- Receive content from OAuth sync jobs (YouTube, Spotify)
- Store content metadata (URL, platform, timestamp)
- Manage user content selection ("Generate Quiz" action)
- Enqueue transcription jobs
- Search & filter content
- Tag management (AI-generated + manual)
- Export content (Markdown, Notion, Obsidian)

**Database Tables:**
- `content` (id, user_id, url, platform, title, created_at, etc.)
- `transcripts` (content_id, text, timestamps, language)
- `tags` (id, name)
- `content_tags` (content_id, tag_id)

**APIs:**
```
# Content is now created by sync jobs, not direct capture
GET    /api/v1/content                # List content (paginated)
GET    /api/v1/content/:id            # Get content detail
DELETE /api/v1/content/:id            # Delete content
GET    /api/v1/content/search         # Search content
POST   /api/v1/content/:id/tags       # Add tags
GET    /api/v1/content/export         # Export content
POST   /api/v1/content/export/notion  # Export to Notion
GET    /api/v1/content/sync-status    # Get last sync times per platform
```

**Background Jobs:**
- Enqueue transcription (YouTube videos)
- Enqueue quiz generation (after transcription)
- AI auto-tagging

---

### 6. Quiz Service (Backend)

**Technology:** Node.js + Express + TypeScript

**Responsibilities:**
- Manage quiz questions (CRUD)
- Review session logic
- Spaced repetition scheduling (SM-2 algorithm)
- Track user answers & difficulty ratings
- Calculate retention metrics
- Daily review queue generation

**Database Tables:**
- `questions` (id, content_id, question_text, options, correct_answer, etc.)
- `reviews` (id, user_id, question_id, rating, next_review_date, interval, ease_factor)
- `review_sessions` (id, user_id, cards_reviewed, accuracy, duration, created_at)

**APIs:**
```
GET    /api/v1/quiz/due               # Get due cards for review
POST   /api/v1/review/answer          # Submit answer + rating
GET    /api/v1/review/stats           # Get review statistics
GET    /api/v1/quiz/:contentId        # Get quizzes for content
POST   /api/v1/quiz/:contentId/regen  # Regenerate quizzes
DELETE /api/v1/quiz/:id               # Delete question
```

**Spaced Repetition:**
- Algorithm: SM-2 (SuperMemo 2)
- Intervals: 1d, 3d, 1w, 2w, 1m, 3m
- Ease factor: 1.3 - 2.5
- Rating impact:
  - Again (1): Reset interval to 1 day
  - Hard (2): Multiply interval × 1.2
  - Good (3): Multiply interval × ease_factor
  - Easy (4): Multiply interval × ease_factor × 1.3

---

### 7. Transcription Worker (Background)

**Technology:** Python 3.11 + FastAPI

**Responsibilities:**
- Consume transcription jobs from Redis queue
- Route to appropriate transcription strategy based on platform
- Store transcripts in database
- Enqueue quiz generation job
- Handle errors (retries, notifications)

---

#### 7a. YouTube Transcription (FREE)

**Library:** `youtube-transcript-api` (Python)

**How it works:**
- Fetches existing subtitles directly from YouTube (no API key needed)
- Works on any public video with subtitles (95%+ of videos)
- Returns timestamped transcript segments
- Supports auto-generated and manual captions
- Supports multiple languages

**Processing Flow:**
```python
from youtube_transcript_api import YouTubeTranscriptApi

# 1. Extract video_id from URL
video_id = "dQw4w9WgXcQ"

# 2. Fetch transcript (tries auto-generated if manual not available)
transcript = YouTubeTranscriptApi.get_transcript(video_id)

# 3. Result: list of segments
# [{'text': 'Hello', 'start': 0.0, 'duration': 1.5}, ...]
```

**Fallback (rare - no subtitles):**
1. Download audio via yt-dlp
2. Send to Whisper API
3. Parse timestamped result

**Cost:** $0 for 95%+ of videos. ~$0.36/hour only for fallback.

---

#### 7b. Spotify Podcast Transcription (RSS + Whisper)

**Libraries:** `feedparser` (RSS), `requests` (download), `openai` (Whisper)

**Processing Flow:**
```
1. Get podcast metadata from Spotify API (show name, episode title)
2. Lookup RSS feed:
   - Search Listen Notes API by show name
   - Or query podcast database (Podchaser, etc.)
3. Parse RSS feed, find matching episode by title/date
4. Extract MP3 URL from <enclosure> tag
5. Download audio file to temp storage
6. Send to Whisper API for transcription
7. Parse timestamped result
8. Clean up temp file
```

**RSS Feed Lookup:**
```python
import feedparser

# Option 1: Listen Notes API (recommended)
# GET https://listen-api.listennotes.com/api/v2/search?q={show_name}&type=podcast

# Option 2: Direct RSS if known
feed = feedparser.parse(rss_url)
for entry in feed.entries:
    if entry.title == episode_title:
        audio_url = entry.enclosures[0].href  # MP3 URL
```

**Handling Spotify Exclusives:**
- If RSS not found → mark content as "unsupported"
- Show user: "This Spotify Exclusive podcast is not yet supported"
- Future: evaluate Zotify/Votify if demand is high (ToS risk)

**Cost:** ~$0.36/hour (Whisper API)

---

**Job Queue:**
```
Redis Queue: transcription_jobs
Payload: {
  content_id: "uuid",
  platform: "youtube" | "spotify",
  url: "https://...",
  user_id: "uuid",
  language: "en",
  metadata: { show_name, episode_title }  // for Spotify
}
```

**Error Handling:**
- Retry 3 times with exponential backoff
- YouTube: If no subtitles AND Whisper fails → mark "unavailable"
- Spotify: If RSS not found → mark "unsupported" (Spotify Exclusive)
- Store error logs for debugging

**Cost Management (Monthly, 10K users):**

| Platform | Volume | Cost |
|----------|--------|------|
| YouTube | 30K videos | ~$0 (subtitles) |
| YouTube fallback | ~1.5K videos (5%) | ~$540 |
| Spotify podcasts | 10K episodes × 1h avg | ~$3,600 |
| **Total** | | **~$4,140/mo** |

**Optimization:** Cache RSS feeds per show (don't re-lookup for each episode)

---

### 8. AI Quiz Generator (Background)

**Technology:** Python 3.11 + FastAPI

**Responsibilities:**
- Consume quiz generation jobs from queue
- Load transcript from database
- Call OpenAI API (GPT-4) or Anthropic (Claude)
- Parse generated questions
- Validate question quality
- Store questions in database
- Notify user when ready

**Job Queue:**
```
Redis Queue: quiz_generation_jobs
Payload: {
  content_id: "uuid",
  transcript_id: "uuid",
  user_id: "uuid",
  num_questions: 5
}
```

**AI Prompt Template:**
```
You are an expert educator creating quiz questions from educational content.

Transcript:
{transcript_text}

Generate {num_questions} high-quality multiple-choice questions that:
1. Test key concepts and factual understanding
2. Have 4 options each (A, B, C, D)
3. Have clear, unambiguous correct answers
4. Have plausible but incorrect distractors
5. Are appropriate difficulty (not too easy, not too hard)

Format as JSON:
[
  {
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "B",
    "explanation": "..."
  }
]

Only generate questions if the content is educational. If the content is entertainment, memes, or rants, return an empty array.
```

**Quality Filter:**
- Skip if AI returns empty array (non-educational)
- Validate JSON structure
- Check that correct_answer matches an option
- Store question confidence score (if provided by AI)

**Cost Management:**
- GPT-4: ~$0.03 per 1K tokens input, ~$0.06 per 1K tokens output
- Average transcript: 5K tokens input, 1K tokens output = $0.21
- Monthly budget: $300 (1,428 transcripts)

---

## 💾 Data Models (PostgreSQL)

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),  -- NULL if Google OAuth
  display_name VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'UTC',
  email_verified BOOLEAN DEFAULT false,
  google_id VARCHAR(255),  -- For Google OAuth
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
```

---

### Subscriptions Table

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL,  -- 'free', 'pro'
  status VARCHAR(20) NOT NULL,  -- 'active', 'canceled', 'past_due'
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
```

---

### OAuth Connections Table

```sql
CREATE TABLE oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,  -- 'youtube', 'spotify'
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type VARCHAR(20) DEFAULT 'Bearer',
  expires_at TIMESTAMP NOT NULL,
  scope TEXT,  -- OAuth scopes granted
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_oauth_user_provider ON oauth_connections(user_id, provider);
CREATE INDEX idx_oauth_expires_at ON oauth_connections(expires_at);
```

---

### Content Table

```sql
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,  -- 'youtube', 'twitter', etc.
  content_type VARCHAR(20) NOT NULL,  -- 'video', 'text', 'image'
  title VARCHAR(500),
  description TEXT,
  thumbnail_url TEXT,
  author VARCHAR(255),
  duration_seconds INTEGER,  -- For videos
  captured_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT false,
  processing_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'transcribing', 'generating_quiz', 'complete', 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_content_user_id ON content(user_id);
CREATE INDEX idx_content_platform ON content(platform);
CREATE INDEX idx_content_captured_at ON content(captured_at DESC);
CREATE INDEX idx_content_processing_status ON content(processing_status);
```

---

### Transcripts Table

```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  timestamps JSONB,  -- [{start: 0, end: 10, text: "..."}, ...]
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transcripts_content_id ON transcripts(content_id);
CREATE INDEX idx_transcripts_text_gin ON transcripts USING GIN(to_tsvector('english', text));  -- Full-text search
```

---

### Questions Table

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(20) DEFAULT 'multiple_choice',  -- 'multiple_choice', 'true_false', 'flashcard'
  options JSONB,  -- ["Option A", "Option B", "Option C", "Option D"]
  correct_answer VARCHAR(10),  -- "A", "B", "C", "D" or "true", "false"
  explanation TEXT,
  difficulty VARCHAR(20) DEFAULT 'medium',  -- 'easy', 'medium', 'hard'
  confidence_score FLOAT,  -- AI confidence (0.0-1.0)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_questions_content_id ON questions(content_id);
```

---

### Reviews Table (Spaced Repetition State)

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  ease_factor FLOAT DEFAULT 2.5,  -- SM-2 ease factor (1.3 - 2.5)
  interval_days INTEGER DEFAULT 1,  -- Days until next review
  repetitions INTEGER DEFAULT 0,  -- Number of successful reviews
  next_review_date DATE NOT NULL,
  last_reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX idx_reviews_user_next_review ON reviews(user_id, next_review_date);
CREATE INDEX idx_reviews_question_id ON reviews(question_id);
```

---

### Review Answers Table (History)

```sql
CREATE TABLE review_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,  -- 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
  answer_correct BOOLEAN,
  time_spent_seconds INTEGER,
  reviewed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_answers_user_id ON review_answers(user_id);
CREATE INDEX idx_review_answers_reviewed_at ON review_answers(reviewed_at DESC);
```

---

### Tags Table

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tags_name ON tags(name);
```

---

### Content Tags Table (Many-to-Many)

```sql
CREATE TABLE content_tags (
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  auto_generated BOOLEAN DEFAULT true,  -- true if AI-generated, false if manual
  PRIMARY KEY (content_id, tag_id)
);

CREATE INDEX idx_content_tags_content_id ON content_tags(content_id);
CREATE INDEX idx_content_tags_tag_id ON content_tags(tag_id);
```

---

### User Settings Table

```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_review_time TIME DEFAULT '09:00:00',
  cards_per_session INTEGER DEFAULT 20,
  new_cards_per_day INTEGER DEFAULT 20,
  auto_advance BOOLEAN DEFAULT true,
  auto_capture_youtube BOOLEAN DEFAULT true,
  auto_capture_twitter BOOLEAN DEFAULT true,
  show_capture_notifications BOOLEAN DEFAULT false,
  show_quiz_ready_notifications BOOLEAN DEFAULT true,
  show_daily_reminder BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 API Specifications

### Authentication Endpoints

#### POST /api/v1/auth/signup

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "display_name": "John Doe"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "John Doe",
    "email_verified": false
  },
  "message": "Verification email sent"
}
```

---

#### POST /api/v1/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "access_token": "jwt_token_here",
  "refresh_token": "refresh_token_here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "John Doe"
  }
}
```

---

### Content Endpoints

#### POST /api/v1/content/capture

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=...",
  "platform": "youtube",
  "content_type": "video",
  "title": "How to Learn Faster",
  "author": "Channel Name",
  "duration_seconds": 1200
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "url": "https://youtube.com/watch?v=...",
  "platform": "youtube",
  "processing_status": "pending",
  "estimated_ready_time": "2026-01-27T15:35:00Z"
}
```

---

#### GET /api/v1/content?page=1&limit=20&platform=youtube

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "url": "https://youtube.com/...",
      "platform": "youtube",
      "title": "How to Learn Faster",
      "author": "Channel Name",
      "thumbnail_url": "https://...",
      "duration_seconds": 1200,
      "processing_status": "complete",
      "question_count": 5,
      "tags": ["learning", "productivity"],
      "captured_at": "2026-01-27T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 143,
    "pages": 8
  }
}
```

---

### Quiz Endpoints

#### GET /api/v1/quiz/due

**Response (200):**
```json
{
  "due_count": 12,
  "cards": [
    {
      "id": "uuid",
      "question_text": "What is the main benefit of spaced repetition?",
      "question_type": "multiple_choice",
      "options": [
        "A) It's faster than cramming",
        "B) It improves long-term retention",
        "C) It requires less effort",
        "D) It's more fun"
      ],
      "correct_answer": "B",
      "source": {
        "content_id": "uuid",
        "title": "Learning Techniques",
        "platform": "youtube",
        "url": "https://youtube.com/..."
      }
    }
  ]
}
```

---

#### POST /api/v1/review/answer

**Request:**
```json
{
  "question_id": "uuid",
  "rating": 3,  // 1=Again, 2=Hard, 3=Good, 4=Easy
  "answer_correct": true,
  "time_spent_seconds": 15
}
```

**Response (200):**
```json
{
  "next_review_date": "2026-01-30",
  "interval_days": 3,
  "cards_remaining": 11
}
```

---

#### GET /api/v1/review/stats

**Response (200):**
```json
{
  "streak_days": 7,
  "longest_streak": 14,
  "total_cards_learned": 87,
  "retention_rate": 0.89,
  "total_time_spent_seconds": 8340,
  "cards_due_today": 12,
  "cards_reviewed_today": 0,
  "this_week": {
    "cards_reviewed": 84,
    "accuracy": 0.92,
    "time_spent_seconds": 3600
  }
}
```

---

## 🛠️ Technology Stack

### Frontend

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Web Framework** | React 18 | Industry standard, great ecosystem, hooks |
| **Language** | TypeScript | Type safety, better DX, fewer bugs |
| **Build Tool** | Vite | Fast dev server, optimized builds |
| **State Management** | Zustand | Lightweight, simple, no boilerplate |
| **Routing** | React Router v6 | Standard routing library |
| **Styling** | Tailwind CSS | Utility-first, fast prototyping, consistent |
| **HTTP Client** | Axios | Interceptors, better error handling |
| **Forms** | React Hook Form | Performance, minimal re-renders |
| **Testing** | Vitest + RTL | Fast, Jest-compatible |

---

### Backend

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Runtime** | Node.js 20 | Async I/O for API calls, team expertise |
| **Framework** | Express.js | Simple, flexible, huge ecosystem |
| **Language** | TypeScript | Type safety across stack |
| **Database** | PostgreSQL 16 | ACID, JSON support, full-text search |
| **Cache** | Redis 7 | Fast reads, also used for queue |
| **Queue** | BullMQ (Redis) | Reliable, retries, delay, priority |
| **Auth** | JWT + bcrypt | Stateless, scalable, secure |
| **API Validation** | Zod | TypeScript-first, runtime validation |
| **Testing** | Jest + Supertest | Unit + integration tests |

---

### Workers (Background Jobs)

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Runtime** | Python 3.11 | AI/ML libraries, Whisper SDK |
| **Framework** | FastAPI | Fast, modern, type hints |
| **YouTube Download** | yt-dlp | Robust, maintained, supports all sites |
| **Transcription** | Whisper API (OpenAI) | Best quality, affordable, fast |
| **AI Quiz Gen** | OpenAI GPT-4 or Anthropic Claude | Best reasoning, follows instructions |
| **Queue Consumer** | rq (Redis Queue) | Simple, Python-native |

---

### Infrastructure

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Hosting** | AWS / Railway | Scalable, managed services |
| **API Gateway** | Kong (self-hosted) | Open source, plugins, rate limiting |
| **File Storage** | AWS S3 | Cheap, durable, CDN-ready |
| **CDN** | CloudFront | Fast static assets, global |
| **Monitoring** | Sentry (errors) + Datadog (metrics) | Best-in-class, integrations |
| **CI/CD** | GitHub Actions | Free, integrated, YAML config |
| **Deployment** | Docker + Docker Compose | Containerized, reproducible |

---

### External APIs & Libraries

| API/Library | Purpose | Cost |
|-------------|---------|------|
| **youtube-transcript-api** | YouTube subtitles extraction | Free (Python library) |
| **Whisper API** (OpenAI) | Podcast transcription (Spotify) | $0.006/min |
| **GPT-4** (OpenAI) | Quiz generation | ~$0.03/1K tokens in |
| **Listen Notes API** | Podcast RSS feed lookup | $99/mo (Pro) |
| **Stripe API** | Payments & subscriptions | 2.9% + $0.30/transaction |
| **YouTube Data API** | OAuth + video metadata | Free (10K units/day) |
| **Spotify Web API** | OAuth + podcast metadata | Free |

---

## 🚀 Deployment Architecture

### Development Environment

```
Local Machine:
├── Frontend (Vite dev server) → http://localhost:5173
├── Backend (Node.js) → http://localhost:3000
├── PostgreSQL (Docker) → localhost:5432
├── Redis (Docker) → localhost:6379
└── Workers (Python) → Background processes
```

**Setup:**
```bash
# Frontend
cd web-app && npm install && npm run dev

# Backend
cd backend && npm install && npm run dev

# Database & Redis
docker-compose up -d

# Workers
cd workers && pip install -r requirements.txt && python worker.py
```

---

### Production Environment (AWS)

```
┌─────────────────────────────────────────────────┐
│                  CloudFront (CDN)                │
│  - Static assets (JS, CSS, images)              │
│  - Origin: S3 bucket (web-app build)            │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              Application Load Balancer           │
│  - SSL termination                               │
│  - Health checks                                 │
│  - Route: /api → Backend                        │
└─────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │ Backend │   │ Backend │   │ Backend │
    │  EC2    │   │  EC2    │   │  EC2    │
    │ (Node)  │   │ (Node)  │   │ (Node)  │
    └─────────┘   └─────────┘   └─────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │PostgreSQL│  │  Redis  │   │ Workers │
    │   RDS    │  │ElastiCache│ │  EC2    │
    │Multi-AZ │  │           │   │ Python  │
    └─────────┘   └─────────┘   └─────────┘
```

**Services:**
- **EC2 Auto Scaling Group** (Backend): 2-10 instances
- **RDS PostgreSQL** (Multi-AZ): db.t4g.medium
- **ElastiCache Redis**: cache.t4g.micro
- **S3**: Static assets + user uploads
- **CloudFront**: CDN for global distribution
- **Route 53**: DNS management
- **ACM**: SSL certificates (free)

---

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  backend:
    image: remember/backend:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/remember
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - db
      - redis

  workers:
    image: remember/workers:latest
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/remember
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: remember

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 📊 NFR Mapping (How We Meet Non-Functional Requirements)

### Performance

**Requirement:** <2s page load, <5min transcription, <200ms API response

**Solution:**
- **Frontend:** Code splitting, lazy loading, CDN for assets
- **Backend:** Redis caching for frequent queries (content list, user stats)
- **Transcription:** Parallel processing (multiple workers), queue prioritization
- **Database:** Indexes on all foreign keys, full-text search index on transcripts
- **API:** Connection pooling (max 20 connections per instance)

**Metrics:**
- Lighthouse score: >90
- Time to Interactive (TTI): <2s
- API p95 latency: <200ms

---

### Reliability

**Requirement:** 99.5% uptime, zero data loss

**Solution:**
- **High Availability:** Multi-AZ deployment (backend + database)
- **Auto-Scaling:** Scale backend 2-10 instances based on CPU
- **Health Checks:** ALB health checks every 30s, auto-replace unhealthy
- **Database:** RDS Multi-AZ (automatic failover), daily backups (7-day retention)
- **Redis:** ElastiCache with Multi-AZ replication
- **Monitoring:** Sentry (errors), Datadog (uptime), PagerDuty (alerts)

**SLA:**
- Uptime: 99.5% = 3.6 hours downtime/month max
- RTO (Recovery Time Objective): <15 minutes
- RPO (Recovery Point Objective): <1 hour (backups every hour)

---

### Scalability

**Requirement:** 10K users Year 1, 100K Year 2

**Solution:**
- **Horizontal Scaling:** All services stateless, can add more instances
- **Database:** Connection pooling, read replicas for reports/analytics
- **Queue:** Redis queue can handle 10K+ jobs/sec
- **Storage:** S3 scales infinitely
- **CDN:** CloudFront handles global traffic

**Capacity Planning:**
- 10K users × 20 cards/day × 0.7 (70% active) = 140K card reviews/day
- 140K reviews ÷ 86,400 seconds = ~2 req/sec (easy)
- 10K users × 5 captures/week = 7,142 captures/day
- 7,142 captures × 20% video = 1,428 transcriptions/day = 60/hour

---

### Security

**Requirement:** GDPR compliant, encrypted, secure auth

**Solution:**
- **Authentication:** JWT (7-day expiry), refresh tokens (30-day)
- **Passwords:** bcrypt (10 rounds), never stored plain
- **Encryption:** TLS 1.3 in transit, AES-256 at rest (RDS, S3)
- **API Gateway:** Rate limiting, CORS, CSRF protection
- **OAuth:** Google OAuth 2.0 with PKCE
- **PII:** User email, name stored in EU region (GDPR)
- **Data Deletion:** User can export + delete all data (GDPR Article 17)
- **Secrets:** AWS Secrets Manager (API keys, database passwords)

**Compliance:**
- GDPR: Right to access, right to delete, data portability
- CCPA: Same as GDPR (easier to comply)
- HIPAA: Not required (no health data)

---

### Usability

**Requirement:** <2min onboarding, WCAG 2.1 AA

**Solution:**
- **Onboarding:** Tutorial skippable, OAuth 1-click connect (YouTube, Spotify), Google OAuth signup
- **Accessibility:** Semantic HTML, ARIA labels, keyboard navigation, focus indicators
- **Contrast:** All text >4.5:1 ratio
- **Responsive:** Mobile-first design, works on phone/tablet/desktop
- **Testing:** Lighthouse accessibility score >90, manual screen reader testing

---

### Maintainability

**Requirement:** 80%+ test coverage, documented, modular

**Solution:**
- **Code Quality:** TypeScript (type-safe), ESLint + Prettier (consistent style)
- **Testing:** Jest (unit), Supertest (integration), Playwright (E2E)
- **Documentation:** OpenAPI (API docs), ADRs (architecture decisions), README per service
- **Monitoring:** Sentry (error tracking), Datadog (performance), logs (CloudWatch)
- **CI/CD:** GitHub Actions (automated tests, deploy on merge to main)
- **Versioning:** Semantic versioning (v1.0.0), changelogs

---

## 💰 Cost Estimation (Monthly)

### Infrastructure (10K users)

| Service | Specs | Cost/mo |
|---------|-------|---------|
| **EC2** (Backend) | 3 × t3.medium (on-demand) | $100 |
| **RDS** (PostgreSQL) | db.t4g.medium (Multi-AZ) | $120 |
| **ElastiCache** (Redis) | cache.t4g.micro | $15 |
| **S3** (Storage) | 100GB data + requests | $10 |
| **CloudFront** (CDN) | 1TB transfer | $85 |
| **Route 53** (DNS) | Hosted zone + queries | $5 |
| **ACM** (SSL) | Free | $0 |
| **Total Infra** | | **$335** |

---

### External APIs (10K users)

**Assumptions:**
- 70% of users active daily (7K)
- Content split: 60% YouTube, 40% Spotify podcasts
- YouTube: 20K videos/month × 20min avg
- Spotify: 12K podcast episodes/month × 45min avg

**YouTube Transcription (FREE via youtube-transcript-api):**

| Item | Volume | Cost/mo |
|------|--------|---------|
| YouTube subtitles | 19K videos (95%) | **$0** |
| YouTube fallback (Whisper) | 1K videos (5%) × 20min | $120 |
| **YouTube Total** | | **$120** |

**Spotify Transcription (RSS + Whisper):**

| Item | Volume | Cost/mo |
|------|--------|---------|
| RSS-accessible podcasts | 10K episodes (80%) × 45min | $2,700 |
| Spotify Exclusives | 2K episodes (20%) | $0 (unsupported) |
| **Spotify Total** | | **$2,700** |

**Other APIs:**

| API | Usage | Cost/mo |
|-----|-------|---------|
| **GPT-4** (Quiz Gen) | 29K transcripts × $0.15 | $4,350 |
| **Listen Notes API** | RSS lookups | $99 (Pro plan) |
| **YouTube API** | OAuth + metadata | $0 |
| **Spotify API** | OAuth + metadata | $0 |
| **Stripe** | 2K subs × $9 × 2.9% + $0.30 | $580 |
| **Total Other** | | **$5,029** |

| Category | Cost/mo |
|----------|---------|
| YouTube transcription | $120 |
| Spotify transcription | $2,700 |
| Other APIs | $5,029 |
| **Total APIs** | **$7,849** |

---

### Total Cost (10K users)

```
Infrastructure:      $335
External APIs:     $7,849
Monitoring/Tools:    $100
───────────────────────────
TOTAL:             $8,284/mo
```

**Revenue (10K users × $9/mo):** $90,000/mo
**Gross Margin:** 90.8%
**Cost per user:** $0.83/mo

**Savings vs previous architecture:** $2,631/mo (24% reduction) thanks to free YouTube transcripts!

**Cost Optimization:**
- Use OpenAI batch API (50% discount) → $3,150 saved
- Cache transcripts (avoid re-transcribing) → Save 20%
- Negotiate volume discounts after 100K API calls/mo

**Optimized Cost:** ~$8,000/mo → **91% gross margin**

---

## 🔐 Security Considerations

### Authentication & Authorization

**JWT Structure:**
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "plan": "pro",
  "iat": 1706371200,
  "exp": 1706976000
}
```

**Token Storage:**
- Access token: LocalStorage (web app)
- Refresh token: HttpOnly cookie (backend sets)
- Tokens rotated on refresh

**Rate Limiting:**
- Login: 5 attempts/10 minutes per IP
- API: 100 requests/minute per user
- Capture: 1000/day per user (prevent abuse)

---

### Data Privacy

**PII Storage:**
- Email, name → encrypted at rest (RDS encryption)
- Never log PII in application logs
- Stripe handles payment data (PCI DSS compliant)

**User Data Deletion (GDPR):**
```sql
-- Delete all user data
DELETE FROM review_answers WHERE user_id = ?;
DELETE FROM reviews WHERE user_id = ?;
DELETE FROM content WHERE user_id = ?;
DELETE FROM subscriptions WHERE user_id = ?;
DELETE FROM user_settings WHERE user_id = ?;
DELETE FROM users WHERE id = ?;
```

**Data Export:**
- User clicks "Export my data"
- Background job generates JSON + Markdown
- Sent via email link (expires in 7 days)

---

### API Security

**Input Validation:**
- Zod schemas on all endpoints
- Sanitize user input (prevent XSS)
- Parameterized queries (prevent SQL injection)

**CORS:**
```javascript
app.use(cors({
  origin: ['https://remember.app', 'https://app.remember.app'],
  credentials: true
}));
```

**CSRF Protection:**
- Double-submit cookie pattern
- SameSite=Strict on cookies

---

## 🧪 Testing Strategy

### Unit Tests (80% coverage target)

**Backend:**
```bash
# Auth Service
tests/
├── auth.service.test.ts    # JWT generation, password hashing
├── user.model.test.ts      # Database queries
└── auth.controller.test.ts # Endpoint logic

# Quiz Service
tests/
├── sm2.algorithm.test.ts   # Spaced repetition math
├── quiz.service.test.ts    # Due cards, scheduling
└── review.controller.test.ts
```

**Frontend:**
```bash
# Components
tests/
├── Dashboard.test.tsx
├── ReviewSession.test.tsx
├── Library.test.tsx
└── hooks/useReviewSession.test.ts
```

---

### Integration Tests

**API Tests (Supertest):**
```javascript
describe('POST /api/v1/content/capture', () => {
  it('should capture YouTube video', async () => {
    const res = await request(app)
      .post('/api/v1/content/capture')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url: 'https://youtube.com/watch?v=test',
        platform: 'youtube',
        title: 'Test Video'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.processing_status).toBe('pending');
  });
});
```

---

### E2E Tests (Playwright)

**Critical User Flows:**
1. Sign up → Connect YouTube/Spotify → Select content → Review
2. Daily review session → Rate cards → Complete
3. Search library → Export to Notion
4. Update settings → Change reminder time

```javascript
test('complete review session', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name=email]', 'test@example.com');
  await page.fill('input[name=password]', 'password');
  await page.click('button[type=submit]');
  
  await page.click('text=Start Daily Review');
  await page.click('text=Reveal Answer');
  await page.click('text=Good');
  
  await expect(page.locator('text=Session complete')).toBeVisible();
});
```

---

## 📊 Monitoring & Observability

### Application Metrics (Datadog)

**Key Metrics:**
- Request rate (req/sec)
- Response time (p50, p95, p99)
- Error rate (%)
- Database query time
- Queue length (jobs pending)
- Cache hit rate

**Dashboards:**
- Overview (traffic, errors, latency)
- API performance (per endpoint)
- Background jobs (transcription, quiz gen)
- User activity (signups, reviews, captures)

---

### Error Tracking (Sentry)

**Captured:**
- Uncaught exceptions
- API errors (4xx, 5xx)
- Failed background jobs
- Client-side errors (React)

**Context:**
- User ID
- Request ID
- Stack trace
- Breadcrumbs (recent actions)

---

### Logging (CloudWatch)

**Log Levels:**
- ERROR: Exceptions, failed jobs
- WARN: Retries, rate limits hit
- INFO: Requests, job completions
- DEBUG: Development only

**Structured Logging:**
```json
{
  "level": "info",
  "message": "Content captured",
  "user_id": "uuid",
  "content_id": "uuid",
  "platform": "youtube",
  "duration_ms": 150,
  "timestamp": "2026-01-27T15:30:00Z"
}
```

---

### Alerts (PagerDuty)

**Critical Alerts:**
- Error rate > 5% (5 minutes)
- API latency p95 > 1s (5 minutes)
- Database CPU > 80% (10 minutes)
- Queue length > 1000 jobs (stuck workers)

**Warning Alerts:**
- SSL certificate expiry (30 days)
- Disk usage > 80%
- Unusual traffic spike (10x normal)

---

## ✅ Architecture Validation

### Scalability Testing

**Load Test (k6):**
```javascript
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Sustain
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

export default function () {
  const res = http.get('https://api.remember.app/v1/quiz/due', {
    headers: { 'Authorization': `Bearer ${__ENV.TOKEN}` },
  });
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

**Target:** 100 concurrent users, <200ms p95 latency

---

### Security Audit

**Checklist:**
- [ ] All endpoints authenticated (except public)
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized output)
- [ ] CSRF protection
- [ ] TLS 1.3 enforced
- [ ] Secrets in environment variables (not code)
- [ ] Database backups tested (restore works)
- [ ] Dependency vulnerability scan (npm audit, pip audit)

---

## 🚀 Next Steps (BMAD Workflow)

**Completed:**
1. ✅ Product Brief (Business Analyst)
2. ✅ Competitive Research (Creative Intelligence)
3. ✅ PRD (Product Manager)
4. ✅ UX Design (UX Designer)
5. ✅ Architecture (System Architect) - THIS DOCUMENT

**Next Phases:**
6. **→ Sprint Planning** (Scrum Master) - Break into 2-week sprints, assign stories
7. **→ Implementation** (Developer) - Start coding!

**Recommended:** Proceed to Sprint Planning to organize the 20 user stories into executable sprints.

---

**Document Status:** ✅ Ready for Development  
**Next Action:** `/sprint-planning` with Scrum Master  
**Owner:** Antoine  
**Last Updated:** 2026-01-27
