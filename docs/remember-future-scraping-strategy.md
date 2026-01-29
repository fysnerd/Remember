# Future: Instagram & TikTok Integration via Web Scraping

**Status:** Post-MVP (v2)  
**Approach:** Playwright-based web scraping  
**Priority:** After YouTube + Spotify prove PMF

---

## 🎯 Why Web Scraping?

### Instagram
- ❌ **No official API** for user likes/saved posts
- ❌ Instagram Graph API only shows content YOU posted
- ✅ Playwright can automate browser to access "Saved" collection

### TikTok
- ❌ **Research API only** (academic use, not commercial)
- ❌ Display API doesn't give access to user likes
- ✅ Playwright can automate browser to scrape liked videos

---

## 🛠️ Technical Approach

### Option 1: User-Controlled Browser Automation

**Flow:**
1. User clicks "Connect Instagram" in Remember settings
2. Opens a Playwright-controlled browser window
3. User logs in manually (we don't store credentials)
4. Browser stays open in background
5. Cron job navigates to "Saved" section every hour
6. Scrapes new saved posts
7. Extracts: URL, image, caption, author
8. Enqueues for processing

**Pros:**
- ✅ User stays logged in (no credential storage)
- ✅ Works with 2FA
- ✅ Legal (user's own data, their browser)

**Cons:**
- ⚠️ Requires user's computer to stay on
- ⚠️ Browser must stay running
- ⚠️ Only works on desktop

---

### Option 2: Headless Cloud Browser (Risky)

**Flow:**
1. User provides Instagram credentials
2. Backend uses Playwright headless to log in
3. Navigate to "Saved" and scrape
4. Store cookies for future sessions

**Pros:**
- ✅ Works 24/7 (cloud-based)
- ✅ User doesn't need to keep browser open

**Cons:**
- ❌ Violates Instagram ToS
- ❌ High risk of account ban
- ❌ Legal gray area
- ❌ Storing user credentials = security risk
- ❌ Instagram has bot detection

**Verdict:** **DO NOT USE** (too risky)

---

### Option 3: Hybrid (Chrome Extension + Playwright)

**Flow:**
1. User installs Chrome extension
2. Extension injects script on Instagram/TikTok pages
3. When user visits "Saved" or "Liked", extension scrapes
4. Sends data to backend via API
5. No credentials stored, no background automation

**Pros:**
- ✅ User's own session (legal)
- ✅ No credential storage
- ✅ Works with 2FA
- ✅ Real-time capture

**Cons:**
- ⚠️ Requires Chrome extension (desktop only)
- ⚠️ Extension can break if Instagram changes HTML

**Verdict:** **RECOMMENDED** for v2

---

## 📋 Implementation Plan (v2)

### Phase 1: Chrome Extension (Post-MVP)

**Build:**
- Content script injected on `instagram.com/*`
- Listens for "Saved" page navigation
- Scrapes visible posts (title, URL, image, author)
- Sends to backend API: `POST /api/v1/content/capture`

**Content Script:**
```javascript
// Detect "Saved" page
if (window.location.pathname.includes('/saved/')) {
  // Wait for posts to load
  const posts = document.querySelectorAll('article');
  
  posts.forEach(post => {
    const url = post.querySelector('a').href;
    const image = post.querySelector('img').src;
    const caption = post.querySelector('h2')?.textContent;
    
    // Send to Remember
    chrome.runtime.sendMessage({
      type: 'CAPTURE_INSTAGRAM',
      data: { url, image, caption, platform: 'instagram' }
    });
  });
}
```

**Backend:**
- Receives scraped data
- Validates structure
- Extracts video URL if it's a Reel
- For videos: download + transcribe (Whisper)
- For images/carousels: OCR text extraction
- Generate quiz

---

### Phase 2: TikTok Extension (Later)

**Similar approach:**
- Content script on `tiktok.com/*`
- Scrape liked videos page
- Extract video URL, caption, author
- Download video for transcription

**TikTok-specific:**
- Videos are harder to download (obfuscated URLs)
- May need tool like `yt-dlp` for TikTok support
- Transcribe video audio (most TikToks have voiceover)

---

## 🔐 Privacy & Legal Considerations

### Legal
- ✅ **User's own data** (their saves/likes)
- ✅ **User's browser** (extension in their session)
- ✅ Not scraping other users' data
- ✅ Not violating CFAA (user authorized)

### Instagram/TikTok ToS
- ⚠️ Technically gray area (automated access)
- ✅ Mitigated: it's the user's own browser, not a bot
- ✅ Rate-limited (only scrape when user visits page)
- ⚠️ If platform detects → worst case: extension blocks

### User Privacy
- ✅ No credentials stored
- ✅ Scraping happens in user's browser
- ✅ User can disconnect anytime

---

## 🚧 Challenges & Mitigations

### Challenge 1: HTML Changes
**Problem:** Instagram/TikTok change class names frequently  
**Mitigation:**
- Use multiple selectors (fallbacks)
- Semantic selectors when possible (`article`, `img`)
- Monitor error rates, update extension monthly
- Notify users if scraping fails

### Challenge 2: Rate Limiting
**Problem:** Too many scrapes = platform blocks  
**Mitigation:**
- Only scrape when user visits "Saved" page
- Max 50 posts per scrape
- Wait 5s between API calls
- Respect platform limits

### Challenge 3: Detection
**Problem:** Platform detects automation  
**Mitigation:**
- Run in user's real browser (not headless)
- No unusual traffic patterns
- Scrape only visible content (no scrolling loops)

### Challenge 4: Mobile Users
**Problem:** Extension = desktop only  
**Mitigation:**
- **Future:** Mobile app with OAuth (if Instagram/TikTok ever open APIs)
- **For now:** Desktop-only feature

---

## 📊 Estimated Effort

### Chrome Extension (Instagram)
- **Time:** 2 weeks
- **Components:**
  - Content script (scraping logic)
  - Background script (API communication)
  - Settings UI (enable/disable Instagram)
  - Error handling + retries

### TikTok Support
- **Time:** 1 week (after Instagram)
- **Components:**
  - Similar content script
  - Video download logic (yt-dlp integration)

### Testing
- **Time:** 1 week
- **Components:**
  - Test on multiple Instagram UI versions
  - Test with 2FA accounts
  - Test error cases (login expired, rate limit)

**Total:** ~4 weeks for both platforms

---

## 💡 Alternative: Wait for Official APIs

### Instagram
- Meta is unlikely to add "saved posts" API
- Would require partnership or negotiation
- Not realistic for indie SaaS

### TikTok
- Research API exists but academic-only
- Commercial API is very limited
- **Option:** Apply for TikTok partnership once we have traction (10K+ users)

---

## 🎯 Recommendation

### MVP (Now)
- ✅ YouTube (OAuth)
- ✅ Spotify (OAuth)
- ❌ Skip Instagram/TikTok

### v2 (Post-PMF, 6-12 months)
- ✅ Build Chrome extension
- ✅ Instagram scraping (Saved posts)
- ✅ TikTok scraping (Liked videos)
- ⚠️ Accept desktop-only limitation

### v3 (Scale, 12+ months)
- 🔵 Negotiate TikTok partnership (if volume justifies)
- 🔵 Explore Instagram partnership (unlikely)
- 🔵 Mobile app with workarounds

---

## 🔧 Playwright Code Sample (Desktop Automation)

**If we go with Option 1 (user-controlled browser):**

```typescript
import { chromium } from 'playwright';

async function scrapeInstagramSaved(userDataDir: string) {
  // Launch browser with user's profile (they're already logged in)
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 900 }
  });

  const page = context.pages()[0] || await context.newPage();
  
  // Navigate to Saved collection
  await page.goto('https://www.instagram.com/USERNAME/saved/all-posts/');
  await page.waitForTimeout(3000);

  // Scrape visible posts
  const posts = await page.$$eval('article a[href*="/p/"]', links => {
    return links.map(link => ({
      url: link.href,
      thumbnail: link.querySelector('img')?.src,
    }));
  });

  console.log(`Found ${posts.length} saved posts`);
  
  // Send to backend
  for (const post of posts) {
    await fetch('https://api.remember.app/v1/content/capture', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        url: post.url,
        platform: 'instagram',
        thumbnail: post.thumbnail
      })
    });
  }

  await context.close();
}
```

---

## ✅ Decision Matrix

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Chrome Extension** | Legal, user session, real-time | Desktop only, can break | ✅ **RECOMMENDED** |
| **Headless Cloud** | 24/7, mobile support | Illegal, ban risk, unsafe | ❌ **AVOID** |
| **Wait for API** | Official, stable | May never happen | 🔵 **MONITOR** |

---

**Next Steps (Post-MVP):**
1. Validate YouTube + Spotify PMF
2. Gauge user demand for Instagram/TikTok
3. Build Chrome extension if demand exists
4. Launch as "beta" feature (desktop only)
5. Monitor for platform blocks/errors
6. Iterate based on feedback

---

**Document Status:** Future Roadmap  
**Priority:** Low (after PMF)  
**Owner:** Antoine  
**Last Updated:** 2026-01-27
