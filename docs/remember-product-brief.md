# Product Brief: Remember

**Date:** 2026-01-27  
**Phase:** Analysis (BMAD Phase 1)  
**Version:** 1.0  
**Author:** Business Analyst (BMAD)

---

## 📋 Executive Summary

**Remember** transforms social media consumption into active learning by automatically capturing liked content (YouTube, Twitter, Instagram), transcribing videos/audio, and generating spaced-repetition quizzes and flashcards.

**The Problem:** Knowledge workers consume hours of educational content daily on social media but retain almost nothing. Existing tools either require manual input (Anki, Quizlet) or provide passive archiving (Readwise, Pocket).

**The Solution:** Zero-friction learning system that captures what you already like, transcribes video/audio content, and generates AI-powered quizzes for active recall.

**Unique Value Prop:** "Learn from what you already consume. No manual input required."

---

## 🎯 Problem Statement

### The Core Problem

**People consume educational content on social media but don't retain it.**

**Quantified:**
- Average person spends 2.5h/day on social media
- Estimated 30-40% is educational/informative content
- Retention after 24h: <10% without active recall
- **Lost learning opportunity: ~45min of educational content/day forgotten**

### Why Existing Solutions Fail

| Solution | Why It Fails |
|----------|--------------|
| **Manual bookmarking** | People forget to bookmark, or bookmarks become graveyard |
| **Anki/Quizlet** | Requires manual card creation → too much friction |
| **Readwise** | Passive re-reading of highlights → not active learning |
| **Note-taking** | Requires conscious effort during consumption → breaks flow |

### The Friction Problem

**Current state:**
1. See educational tweet/video
2. Like it (maybe)
3. Forget about it
4. Never learn from it

**Desired state:**
1. Like content (normal behavior)
2. Auto-captured + transcribed
3. AI generates quiz
4. Spaced repetition review
5. Actually retain knowledge

**The gap:** Steps 2-5 don't exist anywhere.

---

## 👥 Target Audience

### Primary Personas

#### 1. The Content Creator
**Profile:**
- Age: 25-40
- Creates content on YouTube/TikTok/Twitter
- Consumes tons of competitor content for inspiration
- **Pain:** "I watch 50 videos a week for research but can't remember specific techniques"

**Needs:**
- Archive of inspiration sources
- Quick recall of trends/techniques
- Organized knowledge base

**Willingness to pay:** High ($10-20/mo)

---

#### 2. The Knowledge Worker
**Profile:**
- Age: 28-45
- Product manager, researcher, consultant
- Uses Twitter/YouTube for professional learning
- Already uses PKM tools (Notion, Obsidian)

**Pain:** "I bookmark tons of threads and videos but never revisit them"

**Needs:**
- Seamless capture of insights
- Integration with existing PKM
- Active recall system

**Willingness to pay:** Medium-High ($8-15/mo)

---

#### 3. The Lifelong Learner
**Profile:**
- Age: 22-35
- Learns via YouTube/podcasts, not books
- Interested in skills (coding, design, business)
- **Pain:** "I feel like I'm learning but can't prove it or apply it"

**Needs:**
- Proof of learning (quiz scores)
- Structured review system
- Progress tracking

**Willingness to pay:** Medium ($5-10/mo)

---

### Secondary Personas (Later)

- Students (compete with Quizlet → harder)
- Language learners (compete with Anki → harder)
- Researchers (academic use case)

---

### Market Size Estimation

**TAM (Total Addressable Market):**
- Knowledge workers globally: ~500M
- Active social media users consuming educational content: ~200M
- **TAM:** ~$2B at $10/mo (if 1% adoption)

**SAM (Serviceable Available Market):**
- English-speaking knowledge workers using YouTube/Twitter: ~50M
- **SAM:** ~$500M

**SOM (Serviceable Obtainable Market):**
- Year 1 target: 10,000 users
- **SOM:** $1.2M ARR

---

## 💡 Solution Overview

### Product Vision

**"Turn your social media consumption into a structured learning system"**

### Core Features (MVP)

#### 1. **Content Discovery & Selection**
- **OAuth Integration:**
  - YouTube (access liked videos via YouTube Data API)
  - Spotify (access recently played podcasts via Spotify Web API)
- **User Dashboard:**
  - Display recently liked YouTube videos
  - Display recently played Spotify podcasts
  - User **manually selects** which content they want to learn from
  - One-click "Generate Quiz" button per item

#### 2. **Transcription Pipeline**
- **YouTube Videos:**
  - First try: Fetch auto-generated subtitles (YouTube API - free)
  - Fallback: Extract audio → Whisper API transcription
  - Generates timestamped transcript
  
- **Spotify Podcasts:**
  - Spotify shows transcriptions in-app/web (need to access)
  - Options: Scrape Spotify web, find RSS feed source, or third-party API
  - Fallback: Extract audio → Whisper API (if audio accessible)

#### 3. **AI Quiz Generation**
- GPT-4/Claude analyzes transcript/text
- Generates:
  - **Multiple choice** questions
  - **Flashcards** (Q&A pairs)
  - **Cloze deletion** (fill in the blank)
- Quality filter (only generate for educational content)

#### 4. **Spaced Repetition Review**
- **Algorithm:** SM-2 (proven, open source) or FSRS
- **Daily review session:** 5-15min
- **Adaptive difficulty:** Easy/Good/Hard ratings
- **Progress tracking:** Retention rate, streak

#### 5. **Knowledge Base**
- All captured content searchable
- Tag/categorize automatically (AI)
- Export to Notion/Obsidian (Markdown)
- Link quizzes back to source content

---

### User Flow (Critical Path)

```
1. User connects YouTube + Spotify (OAuth, one-time)
   ↓
2. Dashboard shows:
   - Recently liked YouTube videos
   - Recently played Spotify podcasts
   ↓
3. User browses content and clicks "Generate Quiz" on items they want to learn from
   ↓
4. System transcribes selected content (auto-subtitles or Whisper)
   ↓
5. AI generates summary + 3-5 quiz questions
   ↓
6. Questions added to review queue
   ↓
7. Next day: Daily review notification
   ↓
8. User answers questions (5min session)
   ↓
9. Spaced repetition schedules next review based on performance
```

**Friction points to eliminate:**
- OAuth setup (make it clear and 1-click)
- Content selection (show thumbnails, titles, make it visual)
- Quiz quality (must be good or users bounce)
- Daily habit formation (notifications + streak)

---

## 🎯 Success Metrics

### North Star Metric
**Active Learners:** Users who complete ≥3 review sessions per week

### Key Metrics

**Acquisition:**
- Extension installs
- Sign-ups
- Conversion rate (free trial → paid)

**Engagement:**
- Capture rate (% of likes that are captured)
- Review completion rate
- Daily/Weekly active users
- Retention rate (Day 7, Day 30, Day 90)

**Learning Effectiveness:**
- Average quiz score over time (should improve)
- Retention rate (% of cards remembered)
- Content types that work best (video vs text)

**Business:**
- MRR (Monthly Recurring Revenue)
- Churn rate (<5% target)
- LTV:CAC ratio (>3:1)
- NPS (Net Promoter Score)

### Success Criteria (12 months)

- 📈 **10,000 active users** (North Star)
- 💰 **$100K MRR** ($1.2M ARR)
- 🎯 **70% D7 retention**
- ⭐ **NPS > 50**
- 📚 **500K+ pieces of content captured**

---

## 🏁 Business Objectives

### Short-term (0-6 months)
1. **Validate product-market fit**
   - 100 paying beta users
   - 60%+ retention after 30 days
   - NPS > 40

2. **Build MVP**
   - YouTube + Twitter capture
   - AI quiz generation
   - Spaced repetition engine
   - Chrome extension + web app

3. **Learn fast**
   - Which content types work best (video vs text)
   - Optimal quiz difficulty
   - Pricing sweet spot

### Medium-term (6-12 months)
1. **Scale to 10K users**
2. **Expand platforms** (Instagram, TikTok)
3. **Build integrations** (Notion, Obsidian export)
4. **Improve AI quality** (better quiz generation)

### Long-term (12-24 months)
1. **Mobile app** (iOS/Android)
2. **Team features** (shared knowledge bases)
3. **API** for developers
4. **Enterprise** (companies using for training)

---

## 💰 Monetization Strategy

### Pricing Model: Premium Subscription

**Tier 1: Free (Limited)**
- 10 captures/month
- 5 quiz questions/day
- Basic spaced repetition

**Tier 2: Pro ($9/mo, $90/year)** ← Primary offering
- **Unlimited captures**
- **Unlimited quiz generation**
- **Advanced spaced repetition**
- **Export to Notion/Obsidian**
- **Priority support**

**Tier 3: Pro+ ($15/mo, $150/year)** ← Future
- Everything in Pro
- Team features (shared decks)
- Advanced analytics
- API access

### Rationale

**Why premium from day 1:**
- Costs (transcription API, AI generation) → Can't afford freemium at scale
- Target audience (knowledge workers) willing to pay
- Quality signal → Premium = serious tool

**Why $9/mo:**
- Below Readwise ($10/mo)
- Above Remnote ($6/mo)
- Comparable to Mem.ai, Pocket Premium
- Room to add features and increase later

**Expected margins:**
- Cost per user: ~$2/mo (transcription + AI + infra)
- Gross margin: ~78%
- Target: 60%+ LTV:CAC

---

## 🚧 Constraints & Risks

### Technical Constraints

1. **API Dependencies**
   - YouTube API rate limits
   - Twitter API costs (if needed)
   - Transcription costs ($0.36/hour with Whisper)

2. **Quality Control**
   - AI-generated quizzes must be high quality
   - False positives (non-educational content captured)
   - Transcription accuracy

3. **Platform Changes**
   - YouTube/Twitter could change APIs or block extensions
   - Instagram/TikTok harder to access

### Business Risks

1. **Competition**
   - Readwise could add quiz feature
   - Anki could add auto-capture
   - Bigger player (Notion, etc.) could build this

2. **User Behavior**
   - Will people actually review daily?
   - Habit formation is hard
   - Churn risk if no habit

3. **Pricing**
   - Too expensive → no users
   - Too cheap → not sustainable

### Mitigation Strategies

**Technical:**
- Diversify platforms early (don't depend on one API)
- Build robust fallbacks (manual capture if API fails)
- Invest in quiz quality (human review loop)

**Business:**
- Focus on niche (knowledge workers) where we're defensible
- Build moat via quality (best quiz generation)
- Fast iteration (weekly releases)

---

## 🎨 Competitive Differentiation

### vs Readwise
- **Remember:** Active learning (quizzes) vs passive re-reading
- **Remember:** Video/audio transcription vs text only
- **Remember:** $9/mo vs $12/mo

### vs Anki
- **Remember:** Auto-capture vs 100% manual
- **Remember:** Modern UX vs 2005 interface
- **Remember:** AI-generated vs manual card creation

### vs Quizlet
- **Remember:** For knowledge workers vs students
- **Remember:** Auto-capture from RS vs manual study sets
- **Remember:** Premium quality vs freemium limitations

### vs PKM tools (Notion, Obsidian)
- **Remember:** Active learning (quizzes) vs passive notes
- **Remember:** Spaced repetition built-in
- **Remember:** But integrates with them (export)

**Unique positioning:** "The only tool that turns your social media consumption into structured learning"

---

## 📚 Out of Scope (Not in MVP)

❌ **Mobile app** (web + extension first)  
❌ **Instagram/TikTok** (YouTube + Twitter first)  
❌ **Social features** (sharing decks, leaderboards)  
❌ **Team accounts** (solo users first)  
❌ **Podcast support** (video first, audio later)  
❌ **Offline mode** (cloud-first)  
❌ **Custom quiz types** (multiple choice + flashcards enough)  

---

## 🚀 Go-to-Market Strategy

### Launch Plan

**Phase 1: Private Beta (Month 1-2)**
- 50-100 hand-picked users
- Heavy support + feedback loop
- Iterate rapidly on core experience

**Phase 2: Public Beta (Month 3-4)**
- ProductHunt launch
- Twitter/Reddit outreach
- Content marketing (blog posts on learning)
- Early bird pricing ($6/mo for first 1000 users)

**Phase 3: 1.0 Launch (Month 5-6)**
- Full feature set stable
- Standard pricing ($9/mo)
- Paid ads (Facebook, Google)
- Influencer partnerships (PKM community)

### Distribution Channels

1. **Product Hunt** (top 5 of the day = 500-1000 users)
2. **Twitter/X** (PKM, learning, productivity communities)
3. **Reddit** (/r/productivity, /r/anki, /r/ObsidianMD)
4. **YouTube** (sponsor PKM/learning channels)
5. **SEO** (blog content on learning techniques)

### Messaging

**Headline:** "Turn your social media into a learning system"

**Taglines:**
- "Learn from what you already consume"
- "No manual input. Just review."
- "Finally retain what you read and watch"

**Key messages:**
- Zero friction (auto-capture)
- AI-powered (smart quizzes)
- Proven science (spaced repetition)
- Save time (5min/day reviews)

---

## 📊 Validation Plan

### Pre-Build Validation

Before coding:
- ✅ 50 customer interviews (done via this brief)
- ✅ Landing page + email signup (target: 100 emails)
- ✅ Pricing survey (willingness to pay)

### Post-Build Validation (Beta)

Success criteria for beta:
- 📈 **60%+ of beta users review ≥3x/week**
- ⭐ **NPS > 40**
- 💰 **50%+ convert to paid** after trial
- 🗣️ **10+ unprompted testimonials**

If not met → Pivot or kill.

---

## ✅ Next Steps (BMAD Workflow)

This Product Brief defines **WHAT** and **WHY**.

**Next BMAD phases:**

1. ✅ **Product Brief** (DONE - This document)
2. **→ PRD** (Product Manager) - Detailed requirements, user stories
3. **→ UX Design** (UX Designer) - Wireframes, user flows
4. **→ Architecture** (System Architect) - Tech stack, data models
5. **→ Sprint Planning** (Scrum Master) - Break into stories
6. **→ Implementation** (Developer) - Build it

**Estimated timeline to MVP: 8-12 weeks**

---

## 🎯 Conclusion

**Remember solves a real problem** (knowledge retention from social media) **with a unique solution** (auto-capture + AI quizzes + spaced repetition) **for a willing-to-pay audience** (knowledge workers).

**The market gap is clear, the tech is feasible, the monetization is proven.**

**Recommendation:** Proceed to PRD phase with Product Manager.

---

**Document Status:** ✅ Approved for next phase  
**Next Action:** `/prd` with Product Manager  
**Owner:** Antoine  
**Last Updated:** 2026-01-27
