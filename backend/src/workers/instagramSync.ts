// Instagram Sync Worker - Fetches liked/saved reels using browser automation
// Uses Playwright with stored session cookies to access private likes/saves
// Pattern based on tiktokSync.ts
import { prisma } from '../config/database.js';
import { Platform, ContentStatus, ContentSourceType } from '@prisma/client';

interface InstagramCookies {
  sessionid: string;
  csrftoken?: string;
  ds_user_id?: string;
  mid?: string;
  ig_did?: string;
  ig_nrcb?: string;
  rur?: string;
  datr?: string;
}

interface InstagramReel {
  id: string;
  code: string; // Shortcode for URL
  caption?: {
    text?: string;
  };
  user: {
    username: string;
    full_name?: string;
  };
  like_count?: number;
  comment_count?: number;
  video_duration?: number;
  image_versions2?: {
    candidates?: Array<{ url: string }>;
  };
  taken_at?: number;
  media_type?: number; // 2 = video/reel
}

/**
 * Fetch liked/saved reels from Instagram for a specific user using browser automation
 */
async function syncUserInstagram(userId: string, connectionId: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    console.error(`[Instagram Sync] Connection ${connectionId} not found`);
    return 0;
  }

  // Parse stored cookies
  let cookies: InstagramCookies;
  try {
    cookies = JSON.parse(connection.accessToken) as InstagramCookies;
  } catch (error) {
    console.error(`[Instagram Sync] Invalid cookies for user ${userId}`);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Invalid cookies format' },
    });
    return 0;
  }

  if (!cookies.sessionid) {
    console.error(`[Instagram Sync] Missing sessionid for user ${userId}`);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: { lastSyncError: 'Missing sessionid cookie' },
    });
    return 0;
  }

  let newReelsCount = 0;

  // Determine what to sync based on sourceType
  // Default: sync both saved and liked (INSTAGRAM_BOTH or null)
  const sourceType = connection.sourceType;
  const syncSaved = !sourceType || sourceType === ContentSourceType.INSTAGRAM_SAVED || sourceType === ContentSourceType.INSTAGRAM_BOTH;
  const syncLiked = !sourceType || sourceType === ContentSourceType.INSTAGRAM_LIKED || sourceType === ContentSourceType.INSTAGRAM_BOTH;

  console.log(`[Instagram Sync] Source type: ${sourceType || 'default (both)'}, syncSaved: ${syncSaved}, syncLiked: ${syncLiked}`);

  try {
    // Dynamic import of playwright to avoid issues if not installed
    const { chromium } = await import('playwright');

    // Convert cookies to Playwright format
    const playwrightCookies = Object.entries(cookies)
      .filter(([_, value]) => value !== undefined)
      .map(([name, value]) => ({
        name,
        value: value as string,
        domain: '.instagram.com',
        path: '/',
      }));

    const savedReels: InstagramReel[] = [];
    const likedReels: InstagramReel[] = [];

    // Launch headless browser
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Inject cookies
    await context.addCookies(playwrightCookies);

    const page = await context.newPage();

    // Intercept API responses to capture reels
    page.on('response', async (response) => {
      const url = response.url();
      try {
        // Saved posts/reels API (REST)
        if (url.includes('/api/v1/feed/saved/') || url.includes('saved_posts')) {
          const data = await response.json();
          if (data.items && Array.isArray(data.items)) {
            // Instagram API returns items with nested 'media' object
            // Extract media and filter only video/reel content (media_type === 2)
            const reels: InstagramReel[] = [];
            for (const item of data.items) {
              // Handle nested structure: item.media contains the actual media data
              const media = item.media || item;
              if (media.media_type === 2 || media.product_type === 'clips') {
                reels.push(media);
              }
            }
            savedReels.push(...reels);
            console.log(`[Instagram Sync] Intercepted ${reels.length} saved reels (from ${data.items.length} items)`);
          }
        }

        // Liked posts API (REST - legacy)
        if (url.includes('/api/v1/feed/liked/') || url.includes('liked_posts')) {
          const data = await response.json();
          if (data.items && Array.isArray(data.items)) {
            const reels: InstagramReel[] = [];
            for (const item of data.items) {
              const media = item.media || item;
              if (media.media_type === 2 || media.product_type === 'clips') {
                reels.push(media);
              }
            }
            likedReels.push(...reels);
            console.log(`[Instagram Sync] Intercepted ${reels.length} liked reels (from ${data.items.length} items)`);
          }
        }

        // GraphQL API (modern Instagram) - likes activity page
        if (url.includes('/graphql') || url.includes('/api/graphql')) {
          const data = await response.json();

          // Handle xdt_api__v1__users__self__feed__saved__connection (saved posts via GraphQL)
          const savedConnection = data?.data?.xdt_api__v1__users__self__feed__saved__connection;
          if (savedConnection?.edges) {
            const reels: InstagramReel[] = [];
            for (const edge of savedConnection.edges) {
              const media = edge?.node?.media || edge?.node;
              if (media && (media.media_type === 2 || media.product_type === 'clips')) {
                reels.push(media);
              }
            }
            if (reels.length > 0) {
              savedReels.push(...reels);
              console.log(`[Instagram Sync] Intercepted ${reels.length} saved reels via GraphQL`);
            }
          }

          // Handle liked media via GraphQL (various possible keys)
          const likedConnection = data?.data?.xdt_api__v1__feed__liked__connection ||
                                   data?.data?.xdt_api__v1__users__self__liked_media__connection;
          if (likedConnection?.edges) {
            const reels: InstagramReel[] = [];
            for (const edge of likedConnection.edges) {
              const media = edge?.node?.media || edge?.node;
              if (media && (media.media_type === 2 || media.product_type === 'clips')) {
                reels.push(media);
              }
            }
            if (reels.length > 0) {
              likedReels.push(...reels);
              console.log(`[Instagram Sync] Intercepted ${reels.length} liked reels via GraphQL`);
            }
          }
        }
      } catch {
        // Ignore JSON parse errors for non-JSON responses
      }
    });

    // Navigate to Instagram home first to verify session
    console.log(`[Instagram Sync] Navigating to Instagram for user ${userId}...`);
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // If redirected to login, cookies are expired
    if (page.url().includes('/accounts/login')) {
      console.error(`[Instagram Sync] Cookies expired for user ${userId}`);
      await browser.close();
      await prisma.connectedPlatform.update({
        where: { id: connectionId },
        data: { lastSyncError: 'Session expired. Please reconnect.' },
      });
      return 0;
    }

    // Extract username from profile link in navigation (more specific selector)
    let username = '';

    // Method 1: Try to get username from ds_user_id cookie and page context
    if (cookies.ds_user_id) {
      // Look for the profile link that matches the user's ID
      try {
        // Instagram's nav has a profile link - find it by looking for avatar or profile section
        const profileLink = await page.$('a[href^="/"][role="link"] svg[aria-label*="Profile"], a[href^="/"][role="link"] img[alt*="profile"]');
        if (profileLink) {
          const parentLink = await profileLink.evaluateHandle(el => el.closest('a'));
          const href = await parentLink.evaluate(el => el.getAttribute('href'));
          if (href && href.match(/^\/[a-zA-Z0-9._]+\/$/)) {
            username = href.replace(/\//g, '');
          }
        }
      } catch {
        // Continue to fallback methods
      }
    }

    // Method 2: Fallback - look for the profile link in the bottom nav (mobile) or side nav
    if (!username) {
      try {
        // Try finding profile link by aria-label or specific nav structure
        const navLinks = await page.$$('nav a[href^="/"]');
        for (const link of navLinks) {
          const href = await link.getAttribute('href');
          if (href && href.match(/^\/[a-zA-Z0-9._]+\/$/) && !href.includes('/explore') && !href.includes('/reels')) {
            username = href.replace(/\//g, '');
            break;
          }
        }
      } catch {
        // Continue without username
      }
    }

    // Method 3: Last resort - navigate to profile settings page which shows username
    if (!username) {
      try {
        await page.goto('https://www.instagram.com/accounts/edit/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        const usernameInput = await page.$('input[name="username"]');
        if (usernameInput) {
          username = await usernameInput.inputValue();
        }
      } catch {
        console.error(`[Instagram Sync] Could not determine username for user ${userId}`);
      }
    }

    // If we have a username and should sync saved posts, navigate to saved posts
    if (syncSaved && username) {
      console.log(`[Instagram Sync] Found username: ${username}, syncing saved posts...`);
      await page.goto(`https://www.instagram.com/${username}/saved/all-posts/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);

      // Scroll to load more reels (up to 15 scrolls)
      const maxScrolls = 15;
      for (let i = 0; i < maxScrolls; i++) {
        const prevCount = savedReels.length;
        await page.mouse.wheel(0, 800);
        await page.waitForTimeout(1500);

        // Stop if no new reels loaded after 3 scrolls
        if (i > 3 && savedReels.length === prevCount) {
          console.log(`[Instagram Sync] No more saved reels to load after ${i} scrolls`);
          break;
        }
      }
    } else if (syncSaved && !username) {
      console.warn(`[Instagram Sync] Could not find username, skipping saved posts sync for user ${userId}`);
    } else {
      console.log(`[Instagram Sync] Skipping saved posts sync (sourceType: ${sourceType})`);
    }

    // Also get liked posts from Your Activity page using DOM-based extraction
    // Instagram's likes page uses GraphQL that doesn't expose data via interceptable API calls
    // So we click on each grid item and extract the URL to identify reels
    if (syncLiked) {
      console.log(`[Instagram Sync] Checking liked posts via DOM extraction...`);
      await page.goto('https://www.instagram.com/your_activity/interactions/likes/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);

      // Check if we're on the likes page (not redirected)
      if (!page.url().includes('/your_activity/interactions/likes')) {
        console.warn(`[Instagram Sync] Could not access likes page, skipping likes sync`);
      } else {
      // DOM-based extraction: click on grid items and check URLs
      const maxLikesToCheck = 30; // Limit to avoid long sync times
      let likesChecked = 0;
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 3;

      while (likesChecked < maxLikesToCheck && consecutiveErrors < maxConsecutiveErrors) {
        try {
          // Instagram's likes grid uses divs with role="button" containing images
          // Try multiple selectors to find clickable grid items
          let gridItem = null;

          // Method 1: Try locator with text "Publication" (aria-label)
          const publicationButtons = page.locator('button:has-text("Publication")');
          const count1 = await publicationButtons.count();
          if (count1 > 0) {
            gridItem = publicationButtons.nth(likesChecked % count1); // Rotate through items
          }

          // Method 2: Try role-based selector for grid items
          if (!gridItem || await gridItem.count() === 0) {
            const gridButtons = page.locator('main div[role="button"]');
            const count2 = await gridButtons.count();
            if (count2 > 0) {
              gridItem = gridButtons.nth(likesChecked % count2);
            }
          }

          // Method 3: Try img elements inside clickable containers
          if (!gridItem || await gridItem.count() === 0) {
            const imgButtonsCount = await page.locator('main button:has(img)').count();
            if (imgButtonsCount > 0) {
              gridItem = page.locator('main button:has(img)').nth(likesChecked % imgButtonsCount);
            }
          }

          const itemCount = gridItem ? await gridItem.count() : 0;
          if (!gridItem || itemCount === 0) {
            console.log(`[Instagram Sync] No more liked items to check`);
            break;
          }

          // Click the grid item
          await gridItem.click();
          await page.waitForTimeout(2000);

          // Check URL to see if it's a reel or post
          const currentUrl = page.url();
          const reelMatch = currentUrl.match(/\/reel\/([A-Za-z0-9_-]+)/);
          const postMatch = currentUrl.match(/\/p\/([A-Za-z0-9_-]+)/);

          if (reelMatch) {
            const shortcode = reelMatch[1];
            // Add as a minimal reel entry (we only have shortcode from DOM extraction)
            likedReels.push({
              id: shortcode,
              code: shortcode,
              user: { username: 'unknown' },
            } as InstagramReel);
            console.log(`[Instagram Sync] Found liked reel: ${shortcode}`);
          } else if (postMatch) {
            // It's a post, not a reel - skip
            console.log(`[Instagram Sync] Skipping liked post (not a reel): ${postMatch[1]}`);
          }

          likesChecked++;
          consecutiveErrors = 0;

          // Navigate back to likes page - use explicit navigation instead of goBack()
          // because Instagram may not restore the page state correctly with goBack()
          await page.goto('https://www.instagram.com/your_activity/interactions/likes/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000 // 60 second timeout
          });
          await page.waitForTimeout(3000);

          // Scroll down to skip items we've already checked (rough approximation)
          // Each row has ~3 items, scroll 150px per checked item
          await page.mouse.wheel(0, Math.floor(likesChecked / 3) * 150);
          await page.waitForTimeout(1000);

        } catch (error) {
          console.warn(`[Instagram Sync] Error extracting liked item:`, error);
          consecutiveErrors++;

          // Try to recover by navigating back to likes page
          try {
            await page.goto('https://www.instagram.com/your_activity/interactions/likes/', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);
          } catch {
            // If recovery fails, break out of loop
            break;
          }
        }
      }

      console.log(`[Instagram Sync] Checked ${likesChecked} liked items, found ${likedReels.length} reels`);
      }
    } else {
      console.log(`[Instagram Sync] Skipping liked posts sync (sourceType: ${sourceType})`);
    }

    await browser.close();

    // Combine and deduplicate reels
    const allReels = [...savedReels, ...likedReels];
    console.log(`[Instagram Sync] User ${userId}: found ${allReels.length} total reels`);

    // Deduplicate reels by ID
    const seenIds = new Set<string>();
    const uniqueReels = allReels.filter((reel) => {
      const id = reel.id || reel.code;
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    // Process each reel using upsert to avoid race conditions (F3 fix)
    for (const reel of uniqueReels) {
      const externalId = reel.id || reel.code;

      // Build URL using shortcode
      const shortcode = reel.code || externalId;
      const url = `https://www.instagram.com/reel/${shortcode}/`;

      // Use upsert to avoid TOCTOU race condition
      // On conflict, only update metadata (likeCount, commentCount) - don't change user's content status
      const authorUsername = reel.user?.username || null;
      const result = await prisma.content.upsert({
        where: {
          userId_platform_externalId: {
            userId,
            platform: Platform.INSTAGRAM,
            externalId,
          },
        },
        update: {
          // Only update engagement metrics on re-sync
          likeCount: reel.like_count || undefined,
          commentCount: reel.comment_count || undefined,
        },
        create: {
          userId,
          platform: Platform.INSTAGRAM,
          externalId,
          url,
          title: reel.caption?.text?.substring(0, 255) || `Instagram Reel by @${authorUsername || 'unknown'}`,
          description: reel.caption?.text || null,
          thumbnailUrl: reel.image_versions2?.candidates?.[0]?.url || null,
          duration: reel.video_duration || null,
          authorUsername,
          channelName: authorUsername ? `@${authorUsername}` : null,  // Unified field for frontend
          viewCount: null, // Instagram doesn't expose view counts publicly
          likeCount: reel.like_count || null,
          commentCount: reel.comment_count || null,
          capturedAt: reel.taken_at ? new Date(reel.taken_at * 1000) : new Date(),
          status: ContentStatus.INBOX,
        },
      });

      // Count only newly created content (check if createdAt equals updatedAt within a small window)
      const isNew = Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000;
      if (isNew) {
        newReelsCount++;
      }
    }

    // Update last sync time
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: null,
      },
    });

    console.log(`[Instagram Sync] User ${userId}: synced ${newReelsCount} new reels`);
    return newReelsCount;

  } catch (error) {
    console.error(`[Instagram Sync] Error for user ${userId}:`, error);
    await prisma.connectedPlatform.update({
      where: { id: connectionId },
      data: {
        lastSyncError: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    return 0;
  }
}

/**
 * Main sync function - syncs all connected Instagram accounts
 */
export async function runInstagramSync(): Promise<void> {
  console.log('[Instagram Sync] Starting sync job...');
  const startTime = Date.now();

  // Get all active Instagram connections
  const connections = await prisma.connectedPlatform.findMany({
    where: { platform: Platform.INSTAGRAM },
    include: { user: true },
  });

  console.log(`[Instagram Sync] Found ${connections.length} Instagram connections`);

  let totalNewReels = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const connection of connections) {
    try {
      const newReels = await syncUserInstagram(connection.userId, connection.id);
      totalNewReels += newReels;
      successCount++;
    } catch (error) {
      console.error(`[Instagram Sync] Failed for user ${connection.userId}:`, error);
      errorCount++;
    }

    // Longer delay between users (Instagram is very sensitive to automation)
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  const duration = Date.now() - startTime;
  console.log(`[Instagram Sync] Completed in ${duration}ms`);
  console.log(`[Instagram Sync] Results: ${successCount} success, ${errorCount} errors, ${totalNewReels} new reels`);
}

/**
 * Sync Instagram for a single user (on-demand)
 */
export async function syncInstagramForUser(userId: string): Promise<number> {
  const connection = await prisma.connectedPlatform.findUnique({
    where: {
      userId_platform: {
        userId,
        platform: Platform.INSTAGRAM,
      },
    },
  });

  if (!connection) {
    throw new Error('Instagram not connected');
  }

  return syncUserInstagram(userId, connection.id);
}
