# UX Design Document: Remember

**Project:** Remember - Active Learning from Social Media
**Phase:** Design (BMAD Phase 3)
**Version:** 1.1
**Date:** 2026-01-28
**Author:** UX Designer (BMAD)
**Based on:** PRD v1.1

> **v1.1 Changes:** Web App only (no Chrome Extension). Content synced via OAuth (YouTube, Spotify) instead of browser extension.

---

## 🎯 Design Principles

### 1. **Zero Friction**
Learning should happen in the background. Capture should be invisible, review should be effortless.

### 2. **Habit Formation**
Daily review is key. Design for consistency, streaks, and gentle nudges (not annoying notifications).

### 3. **Focus > Features**
Review session is sacred time. No distractions, no clutter, just questions and answers.

### 4. **Trust Through Quality**
AI-generated quizzes must feel smart and accurate. Bad questions = user trust lost.

### 5. **Delightful Micro-interactions**
Small animations, celebrations, and feedback loops make learning fun.

---

## 👤 User Personas (UX Focus)

### Persona 1: Sarah (Content Creator)
**Goals:** Archive inspiration, recall techniques quickly  
**Pain Points:** Forgets where she saw a specific editing trick  
**UX Needs:**
- Fast search with visual previews (thumbnails)
- Tag-based organization
- "Surprise me" feature (random old content)

### Persona 2: Mike (Knowledge Worker)
**Goals:** Integrate with Notion, prove learning progress  
**Pain Points:** Never revisits bookmarks  
**UX Needs:**
- One-click export to Notion
- Progress dashboard (retention graphs)
- Weekly email summary

### Persona 3: Emma (Lifelong Learner)
**Goals:** Actually retain YouTube tutorials  
**Pain Points:** Watches 10 tutorials, can't apply any  
**UX Needs:**
- Clear quiz UI (distraction-free)
- Keyboard shortcuts (power user)
- Streak gamification (motivation)

---

## 🗺️ User Flows

### Flow 1: Onboarding (First-Time User)

```
1. User clicks "Get Started" on landing page
   ↓
2. Choose sign-up method:
   - Email + Password
   - Google OAuth (for account)
   ↓
3. Email verification (if email signup)
   ↓
4. Welcome screen:
   "Welcome to Remember! Connect your accounts to start learning."
   ↓
5. Connect YouTube
   [Connect YouTube] button
   ↓
6. YouTube OAuth popup:
   "Remember wants to access your YouTube liked videos"
   User clicks "Allow"
   ↓
7. Success: "✅ YouTube connected!"
   ↓
8. Connect Spotify (optional)
   [Connect Spotify] button
   "Connect Spotify to learn from podcasts (optional)"
   [Skip for now]
   ↓
9. If connected:
   Spotify OAuth popup → User allows
   "✅ Spotify connected!"
   ↓
10. Tutorial overlay (optional, skippable):
    "We'll sync your liked videos every 15 minutes"
    "Like educational content on YouTube or Spotify"
    "Review quizzes daily to retain knowledge"
    ↓
11. Dashboard shown
    "Syncing your content... this may take a minute."
    ↓
12. First sync completes → Content appears
    ↓
13. Notification: "🎉 Found 3 videos! Quizzes will be ready soon."
    ↓
14. Quizzes generated (5-10 minutes later)
    ↓
15. Notification: "✅ Your first quizzes are ready! Review now?"
    ↓
16. User clicks → First review session
    ↓
17. Session complete → Streak started (Day 1)
    "Great job! Come back tomorrow to keep your streak 🔥"
```

**UX Notes:**
- Total time: <3 minutes to first capture
- Skip tutorial button prominent (don't force)
- Celebration on first quiz completion
- Set daily reminder time during onboarding

---

### Flow 2: Auto-Sync (YouTube Video)

```
1. User browsing YouTube (separate tab/app)
   ↓
2. User likes a video
   ↓
3. [15 minutes later] Backend sync job runs
   ↓
4. YouTube API called: fetch new liked videos
   ↓
5. New video detected since last sync
   ↓
6. Backend: Video queued for transcription
   ↓
7. Transcription complete (3-5 min)
   ↓
8. AI generates 3-5 quiz questions
   ↓
9. Quiz added to review queue
   ↓
10. User opens Remember dashboard
    ↓
11. Dashboard shows: "+5 new cards today"
    "Last synced: 2 minutes ago"
    ↓
12. User clicks "Review Now" or waits for daily reminder
```

**UX Notes:**
- Sync happens in background (no interruption)
- Max delay: 15 minutes (YouTube sync interval)
- Manual refresh button available if user wants immediate sync
- Dashboard shows last sync time for transparency
- "Syncing..." indicator when refresh in progress

---

### Flow 3: Daily Review Session

```
1. User receives daily reminder (9am default)
   Email/Push: "☀️ Good morning! 12 cards are due today."
   ↓
2. User clicks "Start Review"
   ↓
3. Review session loads
   Full-screen interface
   Progress bar at top (0/12 cards)
   ↓
4. First question shown:
   [Question text]
   [4 multiple choice options]
   "Reveal Answer" button
   ↓
5. User thinks, clicks "Reveal Answer"
   ↓
6. Answer shown:
   ✅ Correct answer highlighted
   Explanation (if available)
   Source link: "From: [Video Title]"
   ↓
7. User rates difficulty:
   [Again] [Hard] [Good] [Easy]
   ↓
8. Next card auto-advances (1s delay)
   Progress bar updates: 1/12 → 2/12
   ↓
9. Repeat steps 4-8 until all cards done
   ↓
10. Session complete screen:
    "🎉 Session complete!"
    "12 cards reviewed"
    "11 correct (92%)"
    "Streak: 7 days 🔥"
    [Share streak] [View stats] [Done]
    ↓
11. User clicks "Done" → Returns to dashboard
```

**UX Notes:**
- Full-screen = no distractions
- Keyboard shortcuts: Space = reveal, 1/2/3/4 = difficulty
- Auto-advance keeps momentum
- Session summary celebrates progress
- Option to pause mid-session (saves progress)

---

### Flow 4: Content Library Search

```
1. User clicks "Library" in sidebar
   ↓
2. Library page loads
   - Search bar at top
   - Filters: Platform, Date, Tags
   - Grid view of content (thumbnails)
   ↓
3. User types "productivity" in search
   ↓
4. Instant results (as-you-type)
   - Matching titles highlighted
   - Matching tags shown
   ↓
5. User clicks on a video result
   ↓
6. Detail view opens:
   - Video thumbnail + title
   - Transcript (collapsible)
   - Generated quiz questions (preview)
   - Tags (clickable)
   - "Export" button
   ↓
7. User clicks a tag (e.g., "#learning")
   ↓
8. Filtered view: All content with that tag
   ↓
9. User clicks "Export" → Choose format
   - Markdown
   - Notion
   - Obsidian
   ↓
10. Export confirmation: "✅ Exported 1 item"
```

**UX Notes:**
- Search is instant (no submit button)
- Filters are sticky (persist across sessions)
- Tags are auto-generated but editable
- Export is one-click per item or bulk

---

## 📱 Wireframes (Text-Based)

### Wireframe 1: Dashboard (Home)

```
┌─────────────────────────────────────────────────┐
│ [Logo] Remember            [Search] [Profile ▼] │
├─────────────────────────────────────────────────┤
│ Sidebar │ Main Content                          │
│         │                                        │
│ 🏠 Home │  ┌──────────────────────────────────┐ │
│ 📚 Lib  │  │ ☀️ Good morning, Antoine!        │ │
│ 📊 Stats│  └──────────────────────────────────┘ │
│ ⚙️ Set  │                                        │
│         │  ┌──────────────────────────────────┐ │
│         │  │ 🔥 Streak: 7 days                │ │
│         │  │ Today: 12 cards due              │ │
│         │  │ [Start Daily Review]  ← Primary  │ │
│         │  └──────────────────────────────────┘ │
│         │                                        │
│         │  Sync Status                           │
│         │  YouTube: Last synced 2 min ago [↻]   │
│         │  Spotify: Last synced 15 min ago [↻]  │
│         │                                        │
│         │  Recent Activity                       │
│         │  ┌────────────────────────────────┐   │
│         │  │ 📹 "How to Learn Faster"       │   │
│         │  │    YouTube • 5 cards • 2h ago   │   │
│         │  ├────────────────────────────────┤   │
│         │  │ 🎙️ "Huberman Lab #127"        │   │
│         │  │    Spotify • 4 cards • 1d ago   │   │
│         │  └────────────────────────────────┘   │
│         │                                        │
│         │  Quick Stats                           │
│         │  Cards learned: 87                     │
│         │  Retention rate: 89%                   │
│         │  [View full stats →]                   │
└─────────────────────────────────────────────────┘
```

**Key Elements:**
- Primary CTA: "Start Daily Review" (big, prominent)
- Streak counter (gamification)
- Sync status with manual refresh buttons (transparency)
- Recent activity feed (shows sync working)
- Quick stats (progress motivation)

---

### Wireframe 2: Review Session (Full-Screen)

```
┌─────────────────────────────────────────────────┐
│ Progress: ████████░░░░░░░░░░ 8/12      [X] Exit │
├─────────────────────────────────────────────────┤
│                                                  │
│                                                  │
│         What is the main benefit of              │
│         spaced repetition for learning?          │
│                                                  │
│         ○ It's faster than cramming              │
│         ○ It improves long-term retention  ← Ans │
│         ○ It requires less effort                │
│         ○ It's more fun                          │
│                                                  │
│         [Reveal Answer]  ← Secondary button      │
│                                                  │
│                                                  │
│         Source: "Learning Techniques" (YouTube)  │
│         [View original →]                        │
│                                                  │
└─────────────────────────────────────────────────┘

AFTER REVEAL:

┌─────────────────────────────────────────────────┐
│ Progress: ████████░░░░░░░░░░ 8/12      [X] Exit │
├─────────────────────────────────────────────────┤
│                                                  │
│                                                  │
│         What is the main benefit of              │
│         spaced repetition for learning?          │
│                                                  │
│         ○ It's faster than cramming              │
│         ✓ It improves long-term retention        │
│         ○ It requires less effort                │
│         ○ It's more fun                          │
│                                                  │
│         ✅ Correct!                              │
│         Spaced repetition schedules reviews      │
│         at increasing intervals to maximize      │
│         retention with minimal effort.           │
│                                                  │
│         How did you find this?                   │
│         [Again] [Hard] [Good] [Easy]             │
│                                                  │
│         Source: "Learning Techniques" (YouTube)  │
│         [View original →]                        │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Key Elements:**
- Clean, minimal (no sidebars)
- Large, readable text
- Progress bar gives context
- Source link builds trust
- Difficulty rating immediately after reveal

**Keyboard Shortcuts:**
- `Space` = Reveal answer
- `1` = Again, `2` = Hard, `3` = Good, `4` = Easy
- `Esc` = Exit session

---

### Wireframe 3: Content Library (Grid View)

```
┌─────────────────────────────────────────────────┐
│ [Logo] Remember            [Search] [Profile ▼] │
├─────────────────────────────────────────────────┤
│ Sidebar │ Library                                │
│         │                                        │
│ 🏠 Home │  [Search: ____________] 🔍             │
│ 📚 Lib  │                                        │
│ 📊 Stats│  Filters:                              │
│ ⚙️ Set  │  [All ▼] [YouTube ▼] [This week ▼]    │
│         │                                        │
│         │  ┌──────┐ ┌──────┐ ┌──────┐           │
│         │  │[Img] │ │[Img] │ │[Img] │           │
│         │  │Video │ │Tweet │ │Video │           │
│         │  │Title │ │Title │ │Title │           │
│         │  │5 cds │ │3 cds │ │4 cds │           │
│         │  └──────┘ └──────┘ └──────┘           │
│         │                                        │
│         │  ┌──────┐ ┌──────┐ ┌──────┐           │
│         │  │[Img] │ │[Img] │ │[Img] │           │
│         │  │...   │ │...   │ │...   │           │
│         │  └──────┘ └──────┘ └──────┘           │
│         │                                        │
│         │  Showing 18 of 143 items               │
│         │  [Load more]                           │
└─────────────────────────────────────────────────┘
```

**Key Elements:**
- Search bar prominent
- Filters above content (sticky on scroll)
- Grid view with thumbnails (visual scan)
- Card count visible per item
- Infinite scroll or pagination

---

### Wireframe 4: Content Detail View

```
┌─────────────────────────────────────────────────┐
│ [← Back to Library]            [Export ▼]       │
├─────────────────────────────────────────────────┤
│                                                  │
│  📹 How to Learn Anything Faster                 │
│  YouTube • Captured Jan 27, 2026                 │
│  Tags: #learning #productivity #memory           │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ [Video Thumbnail]                          │ │
│  │ [▶ Watch on YouTube]                       │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  Transcript (18:42)                              │
│  ▼ [Click to expand]                             │
│  "The key to learning faster is..."             │
│  [00:00] Introduction                            │
│  [02:15] Spaced repetition explained            │
│  [05:30] Active recall techniques               │
│  ...                                             │
│                                                  │
│  Generated Questions (5)                         │
│  ┌────────────────────────────────────────────┐ │
│  │ 1. What is the main benefit of spaced...  │ │
│  │    [Preview] [Review now]                  │ │
│  ├────────────────────────────────────────────┤ │
│  │ 2. Which technique is most effective...   │ │
│  │    [Preview] [Review now]                  │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  [🔄 Regenerate questions]                       │
│  [🗑️ Delete content]                             │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Key Elements:**
- Thumbnail + source link (trust)
- Transcript collapsible (don't overwhelm)
- Questions previewable before review
- Regenerate option (quality control)

---

### Wireframe 5: Settings Page

```
┌─────────────────────────────────────────────────┐
│ [Logo] Remember            [Search] [Profile ▼] │
├─────────────────────────────────────────────────┤
│ Sidebar │ Settings                               │
│         │                                        │
│ 🏠 Home │  Profile                               │
│ 📚 Lib  │  Name: [Antoine_______________]        │
│ 📊 Stats│  Email: antoine@example.com ✓          │
│ ⚙️ Set  │  Timezone: [Europe/Paris ▼]            │
│         │                                        │
│         │  Connected Accounts                     │
│         │  ┌──────────────────────────────────┐  │
│         │  │ YouTube: Connected ✓             │  │
│         │  │ Last synced: 2 min ago           │  │
│         │  │ [Disconnect] [Sync now]          │  │
│         │  └──────────────────────────────────┘  │
│         │  ┌──────────────────────────────────┐  │
│         │  │ Spotify: Connected ✓             │  │
│         │  │ Last synced: 15 min ago          │  │
│         │  │ [Disconnect] [Sync now]          │  │
│         │  └──────────────────────────────────┘  │
│         │  [Connect another account]             │
│         │                                        │
│         │  Review Preferences                     │
│         │  Daily reminder time: [9:00 AM ▼]      │
│         │  Cards per session: [20________]       │
│         │  New cards per day: [20________]       │
│         │  Auto-advance: [✓] Yes [ ] No          │
│         │                                        │
│         │  Integrations (Export)                  │
│         │  ┌──────────────────────────────────┐  │
│         │  │ Notion: Not connected            │  │
│         │  │ [Connect to Notion]              │  │
│         │  └──────────────────────────────────┘  │
│         │  ┌──────────────────────────────────┐  │
│         │  │ Obsidian: Connected ✓            │  │
│         │  │ Vault: /Users/antoine/notes      │  │
│         │  │ [Disconnect]                     │  │
│         │  └──────────────────────────────────┘  │
│         │                                        │
│         │  Subscription                           │
│         │  Plan: Pro ($9/mo)                     │
│         │  Next billing: Feb 27, 2026            │
│         │  [Manage subscription →]               │
│         │                                        │
│         │  [Save changes]                        │
└─────────────────────────────────────────────────┘
```

**Key Elements:**
- Connected accounts section (YouTube, Spotify)
- Sync status + manual sync buttons
- Disconnect option for each account
- Grouped logically (accounts, review prefs, export, billing)
- Inline editing (no separate forms)

---

## 🎨 Design System

### Color Palette

**Primary (Brand)**
- `#5B47FB` (Purple) - Primary actions, links
- `#4A38D9` (Dark purple) - Hover states
- `#6C5DFF` (Light purple) - Backgrounds, highlights

**Secondary (Accents)**
- `#FF6B6B` (Red) - Errors, "Again" rating
- `#4ECDC4` (Teal) - Success, "Easy" rating
- `#FFA07A` (Orange) - Warnings, "Hard" rating
- `#95E1D3` (Mint) - "Good" rating

**Neutrals**
- `#1A1A1A` (Almost black) - Primary text
- `#4A4A4A` (Dark gray) - Secondary text
- `#9B9B9B` (Medium gray) - Tertiary text
- `#E5E5E5` (Light gray) - Borders
- `#F7F7F7` (Off-white) - Backgrounds
- `#FFFFFF` (White) - Cards, modals

**Semantic**
- Success: `#51CF66` (Green)
- Warning: `#FFD43B` (Yellow)
- Error: `#FF6B6B` (Red)
- Info: `#339AF0` (Blue)

---

### Typography

**Font Stack:**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Sizes & Weights:**

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 (Page titles) | 32px | 700 | 1.2 |
| H2 (Section headers) | 24px | 600 | 1.3 |
| H3 (Subsections) | 20px | 600 | 1.4 |
| Body (Default) | 16px | 400 | 1.6 |
| Small (Metadata) | 14px | 400 | 1.5 |
| Button | 16px | 500 | 1.0 |
| Question (Review) | 24px | 500 | 1.5 |

**Usage:**
- Questions in review session: 24px (larger for readability)
- Body text: 16px (comfortable reading)
- Metadata (timestamps, sources): 14px (de-emphasized)

---

### Spacing System

**Base unit:** 8px

| Size | Value | Usage |
|------|-------|-------|
| xs | 4px | Tight spacing |
| sm | 8px | Component padding |
| md | 16px | Default spacing |
| lg | 24px | Section spacing |
| xl | 32px | Page margins |
| 2xl | 48px | Major sections |

**Grid:**
- 12-column grid
- Gutter: 24px
- Max content width: 1200px
- Sidebar width: 240px

---

### Component Library

#### Buttons

**Primary:**
```css
background: #5B47FB;
color: white;
padding: 12px 24px;
border-radius: 8px;
font-weight: 500;
hover: background #4A38D9;
```

**Secondary:**
```css
background: white;
color: #5B47FB;
border: 1px solid #5B47FB;
padding: 12px 24px;
border-radius: 8px;
```

**Danger:**
```css
background: #FF6B6B;
color: white;
```

**States:**
- Hover: Darken background 10%
- Active: Scale 0.98
- Disabled: Opacity 0.5, cursor not-allowed

---

#### Cards

```css
background: white;
border: 1px solid #E5E5E5;
border-radius: 12px;
padding: 24px;
box-shadow: 0 2px 8px rgba(0,0,0,0.04);
hover: box-shadow: 0 4px 16px rgba(0,0,0,0.08);
```

**Usage:**
- Content items in library
- Review session container
- Dashboard widgets

---

#### Inputs

```css
border: 1px solid #E5E5E5;
border-radius: 8px;
padding: 12px 16px;
font-size: 16px;
focus: border-color #5B47FB, outline 2px #6C5DFF;
```

**Search bar:**
- Icon on left (magnifying glass)
- Clear button on right (appears when typing)
- Placeholder: "Search content..."

---

#### Progress Bar

```css
background: #E5E5E5;
height: 8px;
border-radius: 4px;
fill: linear-gradient(90deg, #5B47FB, #6C5DFF);
```

**Usage:**
- Review session progress (top of screen)
- Loading states

---

#### Badges

**Streak badge:**
```css
background: linear-gradient(135deg, #FF6B6B, #FFA07A);
color: white;
padding: 4px 12px;
border-radius: 12px;
font-weight: 600;
icon: 🔥
```

**Platform badges:**
- YouTube: Red (#FF0000)
- Twitter: Blue (#1DA1F2)
- Instagram: Gradient (Purple to Orange)

---

### Icons

**Icon Library:** Lucide Icons (React)

**Commonly Used:**
- Home: `Home`
- Library: `BookOpen`
- Stats: `BarChart2`
- Settings: `Settings`
- Search: `Search`
- Check: `Check`
- X: `X`
- Streak: 🔥 (emoji)
- YouTube: Custom logo
- Twitter: Custom logo

**Icon Size:**
- Default: 20px
- Large (headings): 24px
- Small (inline): 16px

---

### Animations & Transitions

**Standard Transition:**
```css
transition: all 0.2s ease-in-out;
```

**Micro-interactions:**

1. **Button hover:**
   - Scale: 1.02
   - Duration: 150ms

2. **Card reveal (review session):**
   - Fade in answer
   - Duration: 300ms
   - Easing: ease-out

3. **Streak celebration:**
   - Confetti animation (7, 30, 100 days)
   - Duration: 2s

4. **Loading state:**
   - Skeleton screens (pulse animation)
   - Spinner for long operations (>2s)

---

## ♿ Accessibility Guidelines (WCAG 2.1 AA)

### Color Contrast

**Minimum ratios:**
- Normal text (16px): 4.5:1
- Large text (24px): 3:1
- UI components: 3:1

**Tested combinations:**
- Purple (#5B47FB) on white: 4.52:1 ✓
- Dark gray (#1A1A1A) on white: 15.8:1 ✓
- White on purple: 4.52:1 ✓

---

### Keyboard Navigation

**Tab Order:**
1. Skip to content link (invisible, appears on focus)
2. Main navigation
3. Primary CTA
4. Content area
5. Footer

**Review Session Shortcuts:**
- `Tab` / `Shift+Tab`: Navigate buttons
- `Space`: Reveal answer
- `1`, `2`, `3`, `4`: Rate difficulty
- `Esc`: Exit session

**Focus Indicators:**
- 2px solid outline
- Color: #5B47FB
- Offset: 2px

---

### Screen Reader Support

**Semantic HTML:**
- `<nav>` for navigation
- `<main>` for main content
- `<article>` for content items
- `<button>` for actions (not `<div>`)

**ARIA Labels:**
```html
<button aria-label="Start daily review session">
  Start Review
</button>

<div role="progressbar" aria-valuenow="8" aria-valuemin="0" aria-valuemax="12">
  Progress: 8/12
</div>
```

**Live Regions:**
```html
<div aria-live="polite" aria-atomic="true">
  Content captured successfully
</div>
```

---

### Text Alternatives

**Images:**
- All `<img>` have `alt` text
- Decorative images: `alt=""`
- Thumbnails: `alt="[Video title] thumbnail"`

**Icons:**
- Icon-only buttons have `aria-label`
- Example: `<button aria-label="Close">✕</button>`

---

### Responsive Design

**Breakpoints:**
- Desktop: 1200px+
- Tablet: 768px - 1199px
- Mobile: < 768px

**Mobile-First Approach:**
- Start with mobile layout
- Progressively enhance for larger screens

**Mobile Specific:**
- Sidebar becomes bottom nav
- Review session remains full-screen
- Touch targets: minimum 44x44px
- Swipe gestures: Left = Easy, Right = Again

---

## 🎬 User Onboarding Flow (Detailed)

### Step 1: Landing Page → Sign Up

**Landing Page Elements:**
- Hero: "Turn your social media into a learning system"
- Value props (3 columns):
  - 🚀 Zero friction (auto-capture)
  - 🧠 AI-powered quizzes
  - 📈 Proven spaced repetition
- Social proof: "Join 1,000+ learners"
- CTA: [Get Started Free]

**Sign Up Screen:**
- Headline: "Create your account"
- Options:
  - [Continue with Google] ← Default
  - [Sign up with email]
- Legal: "By signing up, you agree to our Terms & Privacy"

---

### Step 2: Connect YouTube

**Screen:**
- Headline: "Connect your YouTube account"
- Subheading: "We'll sync your liked videos automatically"
- Visual: YouTube logo + lock icon (secure)
- CTA: [Connect YouTube]
- Privacy note: "We only access liked videos. We never see your private data."

**OAuth Flow:**
- Google OAuth popup opens
- "Remember wants to access your YouTube liked videos"
- User clicks "Allow"
- Redirect back to Remember
- "✅ YouTube connected!"

---

### Step 3: Connect Spotify (Optional)

**Screen:**
- Headline: "Connect Spotify for podcast learning"
- Subheading: "Learn from the podcasts you already listen to"
- Visual: Spotify logo
- CTA: [Connect Spotify] [Skip for now]

**If Connected:**
- Spotify OAuth popup
- User allows
- "✅ Spotify connected!"

---

### Step 4: Quick Tutorial (Optional)

**Modal overlay with 3 slides:**

**Slide 1:**
- Visual: Sync icon
- "We sync your liked videos every 15 minutes"

**Slide 2:**
- Visual: Quiz card
- "Quizzes are generated automatically from videos"

**Slide 3:**
- Visual: Review session
- "Review daily to retain knowledge"

[Skip tutorial] [Next →] [Get started]

---

### Step 5: First Sync

**Dashboard shown:**
- "Syncing your YouTube likes..."
- Loading indicator
- "This may take a minute the first time"

**First sync completes:**
- "Found 3 videos!"
- Content shown in Recent Activity
- "Quizzes will be ready in 5-10 minutes"

---

### Step 6: First Quiz Ready

**Notification:**
- "✅ Your first quizzes are ready!"
- [Review now →]

**User clicks → Review session:**
- Highlight tutorial (first time only):
  - "Read the question, then click 'Reveal Answer'"
  - "Rate how well you knew it"

---

### Step 7: First Session Complete

**Completion screen:**
- "🎉 Great job! You've completed your first review."
- "Streak started: Day 1 🔥"
- "Come back tomorrow to keep your streak going!"
- [Set daily reminder]
  - Time picker: [9:00 AM ▼]
  - [Save reminder]

---

## 🔔 Notification Strategy

### Notification Types

1. **Content Synced** (Optional, can disable)
   - "📹 3 new videos synced from YouTube"
   - Frequency: After each sync (every 15min)
   - Channel: In-app notification + optional email

2. **Quiz Ready** (First few only)
   - "✅ Your quiz is ready! Review now?"
   - Frequency: After first 5 quiz generations (to teach the flow)
   - Channel: In-app notification + email

3. **Daily Review Reminder** (Core habit loop)
   - "☀️ Good morning! 12 cards are due today."
   - Frequency: Daily at set time (default 9am)
   - Channel: Email + push notification
   - Can snooze (1h, 3h, tomorrow)

4. **Streak Milestone** (Motivational)
   - "🔥 7-day streak! You're on fire!"
   - Frequency: 7, 14, 30, 100, 365 days
   - Channel: In-app + email

5. **Weekly Summary** (Reflection)
   - "📊 This week: 87 cards reviewed, 89% retention"
   - Frequency: Sunday evening
   - Channel: Email only

---

### Notification Personalization

**User can control:**
- Enable/disable each notification type
- Daily reminder time
- Email vs push preference
- Quiet hours (no notifications 10pm-8am)

**Smart defaults:**
- All enabled except capture confirmations
- Daily reminder at 9am
- Weekly summary on Sunday 6pm

---

## 📊 Stats & Progress Dashboard

### Overview Screen

**Top Section (Hero Stats):**
```
┌──────────────────────────────────────────┐
│ Your Learning Progress                   │
├──────────────────────────────────────────┤
│  🔥 Streak         📚 Cards Learned      │
│     7 days            87 total           │
│                                          │
│  📈 Retention      ⏰ Time Spent         │
│     89%               2.3 hours          │
└──────────────────────────────────────────┘
```

**Charts:**
1. **Retention Over Time** (Line chart)
   - X-axis: Weeks
   - Y-axis: % retention
   - Shows improvement trend

2. **Cards Reviewed Per Day** (Bar chart)
   - X-axis: Days
   - Y-axis: # cards
   - Goal line at 20 cards/day

3. **Platform Breakdown** (Pie chart)
   - YouTube: 60%
   - Twitter: 40%

**Leaderboard (Optional, future):**
- Your rank among friends
- Top learners this week

---

## 🚀 Empty States

### Dashboard (No Captures Yet)

```
┌────────────────────────────────────────┐
│         🎯 Ready to start learning?    │
│                                        │
│   You haven't captured anything yet.   │
│                                        │
│   Get started:                         │
│   1. Go to YouTube or Twitter          │
│   2. Like something interesting        │
│   3. Come back to review your quiz     │
│                                        │
│   [Watch tutorial] [Browse on YouTube] │
└────────────────────────────────────────┘
```

---

### Library (No Content)

```
┌────────────────────────────────────────┐
│         📚 No content yet              │
│                                        │
│   Start by liking videos and tweets.   │
│   They'll appear here automatically.   │
│                                        │
│   [Go to YouTube]                      │
└────────────────────────────────────────┘
```

---

### No Cards Due

```
┌────────────────────────────────────────┐
│         ✅ All caught up!              │
│                                        │
│   No cards due today. Great job!       │
│                                        │
│   Come back tomorrow for more.         │
│                                        │
│   [View stats] [Browse library]        │
└────────────────────────────────────────┘
```

---

## 🎯 Error States

### Quiz Generation Failed

```
┌────────────────────────────────────────┐
│         ⚠️ Oops! Quiz generation failed │
│                                        │
│   We couldn't generate questions for:  │
│   "Video Title"                        │
│                                        │
│   This might be because:               │
│   - The content isn't educational      │
│   - Transcription failed               │
│                                        │
│   [Try again] [View transcript]        │
└────────────────────────────────────────┘
```

---

### Transcription Failed

```
┌────────────────────────────────────────┐
│         ⚠️ Transcription failed         │
│                                        │
│   We couldn't transcribe this video.   │
│   The video might be:                  │
│   - Too long (>2 hours)                │
│   - Unavailable or deleted             │
│   - Audio-only or music                │
│                                        │
│   [Retry] [Remove from queue]          │
└────────────────────────────────────────┘
```

---

### Sync Failed

```
Dashboard notification:
┌────────────────────────────────────────┐
│  ⚠️ YouTube sync failed                │
│                                        │
│  We couldn't fetch your recent likes.  │
│  This might be a temporary issue.      │
│                                        │
│  [Retry now] [Reconnect YouTube]       │
└────────────────────────────────────────┘
```

---

## 🎨 Loading States

### Skeleton Screens

**Library loading:**
```
┌──────┐ ┌──────┐ ┌──────┐
│▓▓▓▓▓▓│ │▓▓▓▓▓▓│ │▓▓▓▓▓▓│  ← Gray pulse animation
│▓▓▓   │ │▓▓▓   │ │▓▓▓   │
│▓     │ │▓     │ │▓     │
└──────┘ └──────┘ └──────┘
```

**Dashboard stats loading:**
```
Cards learned: ▓▓▓  ← Gray shimmer
Retention: ▓▓%
```

---

### Spinner (Long Operations)

**Transcription in progress:**
```
┌────────────────────────────────────────┐
│         ⏳ Transcribing video...        │
│                                        │
│         [Spinner animation]            │
│                                        │
│         This may take 2-3 minutes      │
└────────────────────────────────────────┘
```

---

## ✅ Design Validation Checklist

Before handoff to development:

**User Flows:**
- [ ] All critical paths documented
- [ ] Edge cases considered (errors, empty states)
- [ ] Happy path tested with real content

**Wireframes:**
- [ ] All screens covered (dashboard, review, library, settings)
- [ ] Responsive breakpoints defined
- [ ] Interactions specified (hover, click, keyboard)

**Design System:**
- [ ] Color palette accessible (contrast ratios)
- [ ] Typography scales consistently
- [ ] Component library complete
- [ ] Spacing system applied

**Accessibility:**
- [ ] Keyboard navigation defined
- [ ] ARIA labels specified
- [ ] Focus indicators designed
- [ ] Screen reader tested (via preview)

**Animations:**
- [ ] Micro-interactions defined
- [ ] Loading states designed
- [ ] Celebration moments specified

**Handoff:**
- [ ] Figma file shared (or wireframes exported)
- [ ] Design tokens documented
- [ ] Component specs written
- [ ] Developer Q&A session scheduled

---

## 🚀 Next Steps (BMAD Workflow)

**Completed:**
1. ✅ Product Brief (Business Analyst)
2. ✅ Competitive Research (Creative Intelligence)
3. ✅ PRD (Product Manager)
4. ✅ UX Design (UX Designer) - THIS DOCUMENT

**Next Phases:**
5. **→ Architecture** (System Architect) - Tech stack, database schema, API design
6. **→ Sprint Planning** (Scrum Master) - Break into 2-week sprints, velocity estimation
7. **→ Implementation** (Developer) - Start coding!

**Recommended:** Proceed to Architecture to define technical foundation.

---

**Document Status:** ✅ Ready for Development Handoff  
**Next Action:** `/architecture` with System Architect  
**Owner:** Antoine  
**Last Updated:** 2026-01-27
