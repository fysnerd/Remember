// Podcast Transcription Service - RSS feed lookup + Whisper API
// For Spotify podcasts that aren't "Spotify Exclusive"
// Uses global TranscriptCache to avoid redundant transcription calls
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { ContentStatus, TranscriptSource, TranscriptCacheStatus, Platform } from '@prisma/client';
import OpenAI from 'openai';
import Parser from 'rss-parser';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import * as crypto from 'crypto';
import {
  generateWorkerId,
  getOrCreateCacheWithLock,
  markCacheSuccess,
  markCacheUnavailable,
  markCacheFailed,
  linkCacheToContent,
  copyTranscriptFromCache,
  cleanupExpiredLocks,
} from './transcriptCache.js';

// Initialize Groq client (free Whisper) - falls back to OpenAI if Groq not available
const groqClient = config.groq?.apiKey
  ? new OpenAI({
      apiKey: config.groq.apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null;

// Fallback to OpenAI if Groq not configured
const openaiClient = config.openai.apiKey
  ? new OpenAI({ apiKey: config.openai.apiKey })
  : null;

// Use Groq by default (free), fallback to OpenAI
const whisperClient = groqClient || openaiClient;

const rssParser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Remember/1.0)',
  },
});

interface PodcastRSSResult {
  rssUrl: string | null;
  episodeAudioUrl: string | null;
  episodeTitle?: string;
  error?: string;
}

interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

// MP3 magic bytes check
const MP3_SIGNATURES = [
  [0xFF, 0xFB], // MP3 frame sync
  [0xFF, 0xFA], // MP3 frame sync
  [0xFF, 0xF3], // MP3 frame sync
  [0xFF, 0xF2], // MP3 frame sync
  [0x49, 0x44, 0x33], // ID3 tag
];

function isValidAudioFile(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(10);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 10, 0);
    fs.closeSync(fd);

    // Check for MP3 signatures
    for (const sig of MP3_SIGNATURES) {
      let match = true;
      for (let i = 0; i < sig.length; i++) {
        if (buffer[i] !== sig[i]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }

    // Check file size (should be > 100KB for audio)
    const stats = fs.statSync(filePath);
    if (stats.size < 100000) {
      console.log(`[Podcast] File too small: ${stats.size} bytes`);
      return false;
    }

    // If file is large enough, assume it might be valid audio
    // (some MP3s have weird headers)
    if (stats.size > 500000) {
      console.log(`[Podcast] File is ${Math.round(stats.size / 1024 / 1024)}MB, assuming valid`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Podcast] Error checking file:', error);
    return false;
  }
}

/**
 * Normalize string for fuzzy matching
 */
function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '') // Keep only alphanumeric
    .substring(0, 50);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0-1) using Levenshtein distance
 */
function stringSimilarity(a: string, b: string): number {
  const normA = normalizeForMatch(a);
  const normB = normalizeForMatch(b);

  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;

  // Check if one contains the other (substring match)
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;

  // Use Levenshtein distance for proper string similarity
  const distance = levenshteinDistance(normA, normB);
  const maxLength = Math.max(normA.length, normB.length);

  return 1 - (distance / maxLength);
}

/**
 * Generate Podcast Index API auth headers
 */
function getPodcastIndexHeaders(): Record<string, string> {
  const apiKey = config.podcastIndex?.apiKey;
  const apiSecret = config.podcastIndex?.apiSecret;

  if (!apiKey || !apiSecret) {
    throw new Error('Podcast Index API credentials not configured');
  }

  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHash('sha1')
    .update(apiKey + apiSecret + apiHeaderTime)
    .digest('hex');

  return {
    'X-Auth-Date': apiHeaderTime.toString(),
    'X-Auth-Key': apiKey,
    'Authorization': hash,
    'User-Agent': 'Remember/1.0',
  };
}

/**
 * Search for podcast using Podcast Index API (4.4M+ podcasts, free)
 */
async function searchPodcastIndex(showName: string, episodeTitle: string): Promise<PodcastRSSResult | null> {
  if (!config.podcastIndex?.apiKey || !config.podcastIndex?.apiSecret) {
    console.log('[Podcast] Podcast Index not configured, skipping');
    return null;
  }

  try {
    console.log(`[Podcast] Searching Podcast Index for: "${showName}"`);

    // Search for the podcast by title
    const headers = getPodcastIndexHeaders();
    const searchResponse = await axios.get('https://api.podcastindex.org/api/1.0/search/byterm', {
      params: { q: showName },
      headers,
      timeout: 15000,
    });

    const feeds = searchResponse.data.feeds;
    if (!feeds || feeds.length === 0) {
      console.log('[Podcast] No results from Podcast Index');
      return null;
    }

    // Find best match by name similarity
    let bestFeed = feeds[0];
    let bestScore = 0;

    for (const feed of feeds) {
      const score = stringSimilarity(feed.title || '', showName);
      if (score > bestScore) {
        bestScore = score;
        bestFeed = feed;
      }
    }

    console.log(`[Podcast] Podcast Index best match: "${bestFeed.title}" (score: ${bestScore.toFixed(2)})`);

    if (bestScore < 0.5) {
      console.log(`[Podcast] ✗ Podcast Index match score too low (${bestScore.toFixed(2)} < 0.5)`);
      return null;
    }

    const feedUrl = bestFeed.url;
    if (!feedUrl) {
      console.log('[Podcast] No RSS URL in Podcast Index result');
      return null;
    }

    console.log(`[Podcast] Found RSS via Podcast Index: ${feedUrl}`);

    // Parse RSS to find episode
    const feed = await rssParser.parseURL(feedUrl);
    if (!feed || !feed.items || feed.items.length === 0) {
      console.log('[Podcast] RSS feed empty or invalid');
      return null;
    }

    // Find matching episode by title similarity
    let bestEpisode = null;
    let bestEpisodeScore = 0;

    for (const item of feed.items) {
      const score = stringSimilarity(item.title || '', episodeTitle);
      if (score > bestEpisodeScore) {
        bestEpisodeScore = score;
        bestEpisode = item;
      }
    }

    console.log(`[Podcast] Best episode match: "${bestEpisode?.title}" (score: ${bestEpisodeScore.toFixed(2)})`);

    if (bestEpisode && bestEpisode.enclosure?.url && bestEpisodeScore > 0.5) {
      console.log(`[Podcast] ✓ Found episode via Podcast Index: ${bestEpisode.title}`);
      return {
        rssUrl: feedUrl,
        episodeAudioUrl: bestEpisode.enclosure.url,
        episodeTitle: bestEpisode.title,
      };
    }

    console.log(`[Podcast] ✗ Episode match score too low (${bestEpisodeScore.toFixed(2)} < 0.5)`);
    return null;

  } catch (error: any) {
    console.error('[Podcast] Podcast Index API error:', error.message || error);
    return null;
  }
}

/**
 * Search for podcast RSS feed - tries Podcast Index first, then iTunes
 */
async function findPodcastRSS(showName: string, episodeTitle: string): Promise<PodcastRSSResult> {
  console.log(`[Podcast] Searching for: "${showName}" - "${episodeTitle}"`);

  // Method 1: Podcast Index API (4.4M+ podcasts, better coverage)
  const podcastIndexResult = await searchPodcastIndex(showName, episodeTitle);
  if (podcastIndexResult) {
    return podcastIndexResult;
  }

  // Method 2: iTunes Search API (fallback, free, no key required)
  try {
    console.log(`[Podcast] Falling back to iTunes for: ${showName}`);
    const itunesResponse = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: showName,
        media: 'podcast',
        entity: 'podcast',
        limit: 10,
      },
      timeout: 15000,
    });

    const podcasts = itunesResponse.data.results;
    if (podcasts && podcasts.length > 0) {
      // Find best match by name similarity
      let bestPodcast = podcasts[0];
      let bestScore = 0;

      for (const p of podcasts) {
        const score = stringSimilarity(p.collectionName || '', showName);
        if (score > bestScore) {
          bestScore = score;
          bestPodcast = p;
        }
      }

      console.log(`[Podcast] Best match: "${bestPodcast.collectionName}" (score: ${bestScore.toFixed(2)})`);

      const feedUrl = bestPodcast.feedUrl;
      // IMPORTANT: Increased threshold from 0.3 to 0.5 to avoid false positives
      if (feedUrl && bestScore > 0.5) {
        console.log(`[Podcast] Found RSS: ${feedUrl}`);

        // Parse RSS to find episode
        try {
          const feed = await rssParser.parseURL(feedUrl);
          if (feed && feed.items && feed.items.length > 0) {
            // Find matching episode by title similarity
            let bestEpisode = null;
            let bestEpisodeScore = 0;

            for (const item of feed.items) {
              const score = stringSimilarity(item.title || '', episodeTitle);
              if (score > bestEpisodeScore) {
                bestEpisodeScore = score;
                bestEpisode = item;
              }
            }

            console.log(`[Podcast] Best episode match: "${bestEpisode?.title}" (score: ${bestEpisodeScore.toFixed(2)})`);

            // IMPORTANT: Increased threshold from 0.4 to 0.5 to avoid false positives
            // A score of 0.5+ with Levenshtein means strings are fairly similar
            if (bestEpisode && bestEpisode.enclosure?.url && bestEpisodeScore > 0.5) {
              console.log(`[Podcast] ✓ Found episode audio: ${bestEpisode.title}`);
              return {
                rssUrl: feedUrl,
                episodeAudioUrl: bestEpisode.enclosure.url,
                episodeTitle: bestEpisode.title,
              };
            } else {
              console.log(`[Podcast] ✗ Episode match score too low (${bestEpisodeScore.toFixed(2)} < 0.5), skipping to avoid wrong transcription`);
            }
          }
        } catch (rssError) {
          console.error(`[Podcast] Failed to parse RSS:`, rssError);
        }
      } else {
        console.log(`[Podcast] ✗ Podcast match score too low (${bestScore.toFixed(2)} < 0.5) for "${showName}" → found "${bestPodcast.collectionName}"`);
      }
    }
  } catch (error) {
    console.error('[Podcast] iTunes Search API error:', error);
  }

  // Method 2: Listen Notes API if available
  if (config.listenNotes?.apiKey) {
    try {
      console.log(`[Podcast] Trying Listen Notes API...`);
      const searchResponse = await axios.get('https://listen-api.listennotes.com/api/v2/search', {
        params: {
          q: `${showName} ${episodeTitle}`,
          type: 'episode',
          len_min: 1,
        },
        headers: {
          'X-ListenAPI-Key': config.listenNotes.apiKey,
        },
        timeout: 15000,
      });

      const results = searchResponse.data.results;
      if (results && results.length > 0) {
        const episode = results[0];
        console.log(`[Podcast] Listen Notes found: ${episode.title_original}`);

        return {
          rssUrl: null,
          episodeAudioUrl: episode.audio,
          episodeTitle: episode.title_original,
        };
      }
    } catch (error) {
      console.error('[Podcast] Listen Notes API error:', error);
    }
  }

  return {
    rssUrl: null,
    episodeAudioUrl: null,
    error: 'Could not find matching episode - may be Spotify Exclusive or RSS unavailable',
  };
}

/**
 * Download audio file to temporary location with redirect handling
 */
async function downloadAudio(audioUrl: string): Promise<string> {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `podcast_${Date.now()}.mp3`);

  console.log(`[Podcast] Downloading from: ${audioUrl}`);

  // Follow redirects and get final URL
  const response = await axios({
    method: 'get',
    url: audioUrl,
    responseType: 'stream',
    timeout: 600000, // 10 minute timeout for large files
    maxRedirects: 10,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'audio/mpeg, audio/*, */*',
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const contentType = response.headers['content-type'] || '';
  console.log(`[Podcast] Content-Type: ${contentType}, Status: ${response.status}`);

  // Check if response is HTML (error page)
  if (contentType.includes('text/html')) {
    throw new Error('Received HTML instead of audio - URL might be a redirect page');
  }

  const writer = fs.createWriteStream(tempFile);
  response.data.pipe(writer);

  await new Promise<void>((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  // Validate the downloaded file
  const stats = fs.statSync(tempFile);
  console.log(`[Podcast] Downloaded ${Math.round(stats.size / 1024 / 1024 * 100) / 100}MB`);

  if (!isValidAudioFile(tempFile)) {
    fs.unlinkSync(tempFile);
    throw new Error('Downloaded file is not a valid audio file');
  }

  // Check file size for Groq limit (25MB) - compress if needed
  const maxSize = 25 * 1024 * 1024;
  if (groqClient && stats.size > maxSize) {
    console.log(`[Podcast] File too large (${Math.round(stats.size / 1024 / 1024)}MB), compressing with ffmpeg...`);
    const compressedFile = await compressAudio(tempFile);
    fs.unlinkSync(tempFile); // Remove original

    const compressedStats = fs.statSync(compressedFile);
    console.log(`[Podcast] Compressed to ${Math.round(compressedStats.size / 1024 / 1024 * 100) / 100}MB`);

    if (compressedStats.size > maxSize) {
      fs.unlinkSync(compressedFile);
      throw new Error(`File still too large after compression (${Math.round(compressedStats.size / 1024 / 1024)}MB > 25MB limit)`);
    }
    return compressedFile;
  }

  return tempFile;
}

/**
 * Get audio duration using ffprobe
 */
async function getAudioDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Podcast] ffprobe error:', stderr);
        reject(new Error(`ffprobe failed: ${error.message}`));
        return;
      }
      const duration = parseFloat(stdout.trim());
      resolve(isNaN(duration) ? 0 : duration);
    });
  });
}

/**
 * Compress audio file using ffmpeg to reduce file size
 * Calculates optimal bitrate to stay under 24MB (safe margin for 25MB limit)
 */
async function compressAudio(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace('.mp3', '_compressed.mp3');
  const targetSizeBytes = 24 * 1024 * 1024; // 24MB target (safe margin)
  const minBitrate = 16; // Minimum 16kbps for speech quality
  const maxBitrate = 48; // Maximum 48kbps

  // Get duration to calculate optimal bitrate
  let bitrate = 32; // Default
  try {
    const duration = await getAudioDuration(inputPath);
    if (duration > 0) {
      // Calculate bitrate: size (bits) / duration (seconds) = bitrate (bps)
      // targetSizeBytes * 8 (bits) / duration (seconds) / 1000 = kbps
      const optimalBitrate = Math.floor((targetSizeBytes * 8) / duration / 1000);
      bitrate = Math.max(minBitrate, Math.min(maxBitrate, optimalBitrate));
      console.log(`[Podcast] Duration: ${Math.round(duration / 60)}min, optimal bitrate: ${bitrate}kbps`);
    }
  } catch (error) {
    console.warn('[Podcast] Could not get duration, using default bitrate');
  }

  return new Promise((resolve, reject) => {
    // Compress to mono, 16kHz (good enough for speech), calculated bitrate
    const cmd = `ffmpeg -y -i "${inputPath}" -ac 1 -ar 16000 -b:a ${bitrate}k "${outputPath}"`;

    exec(cmd, { timeout: 600000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Podcast] ffmpeg compression error:', stderr);
        reject(new Error(`ffmpeg compression failed: ${error.message}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

/**
 * Transcribe audio using Whisper API (Groq free or OpenAI)
 */
async function transcribeWithWhisper(audioPath: string): Promise<{
  text: string;
  segments: TranscriptSegment[];
  language: string;
}> {
  if (!whisperClient) {
    throw new Error('No Whisper API configured. Set GROQ_API_KEY (free) or OPENAI_API_KEY.');
  }

  const audioFile = fs.createReadStream(audioPath);
  const isGroq = !!groqClient;

  // Groq uses whisper-large-v3, OpenAI uses whisper-1
  const model = isGroq ? 'whisper-large-v3' : 'whisper-1';

  console.log(`[Podcast] Using ${isGroq ? 'Groq (free)' : 'OpenAI'} for transcription`);

  // Use verbose_json for timestamped segments
  const transcription = await whisperClient.audio.transcriptions.create({
    file: audioFile,
    model,
    response_format: 'verbose_json',
    ...(isGroq ? {} : { timestamp_granularities: ['segment'] }),
  });

  // Clean up temp file
  fs.unlinkSync(audioPath);

  // Extract segments from response
  const segments: TranscriptSegment[] = (transcription as any).segments?.map((seg: any) => ({
    start: seg.start,
    duration: seg.end - seg.start,
    text: seg.text.trim(),
  })) || [];

  return {
    text: transcription.text,
    segments,
    language: (transcription as any).language || 'fr',
  };
}

/**
 * Process a Spotify podcast episode for transcription
 */
export async function processPodcastTranscript(contentId: string): Promise<boolean> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: { transcript: true },
  });

  if (!content) {
    console.error(`[Podcast] Content ${contentId} not found`);
    return false;
  }

  // Skip if already has transcript
  if (content.transcript) {
    console.log(`[Podcast] Content ${contentId} already has transcript`);
    return true;
  }

  // Only process Spotify content
  if (content.platform !== Platform.SPOTIFY) {
    console.log(`[Podcast] Content ${contentId} is not Spotify, skipping`);
    return false;
  }

  // Update status to transcribing
  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.TRANSCRIBING },
  });

  try {
    // Step 1: Find RSS feed and audio URL
    console.log(`[Podcast] Looking up RSS for: ${content.showName} - ${content.title}`);
    const rssResult = await findPodcastRSS(content.showName || '', content.title);

    if (!rssResult.episodeAudioUrl) {
      // Mark as unsupported (likely Spotify Exclusive)
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.UNSUPPORTED },
      });
      console.log(`[Podcast] ${rssResult.error || 'No audio found'} - marking as unsupported`);
      return false;
    }

    // Step 2: Download audio
    console.log(`[Podcast] Downloading audio...`);
    const audioPath = await downloadAudio(rssResult.episodeAudioUrl);

    // Step 3: Transcribe with Whisper
    console.log(`[Podcast] Transcribing with Whisper...`);
    const result = await transcribeWithWhisper(audioPath);

    // Step 4: Save transcript
    await prisma.transcript.create({
      data: {
        contentId: content.id,
        text: result.text,
        segments: JSON.parse(JSON.stringify(result.segments)),
        language: result.language,
        source: TranscriptSource.WHISPER,
      },
    });

    // Update content status
    await prisma.content.update({
      where: { id: contentId },
      data: { status: ContentStatus.SELECTED },
    });

    console.log(`[Podcast] ✅ Successfully transcribed "${content.title}" (${result.text.length} chars, ${result.language})`);
    return true;

  } catch (error: any) {
    console.error(`[Podcast] ❌ Error processing ${content.title}:`, error.message || error);
    await prisma.content.update({
      where: { id: contentId },
      data: { status: ContentStatus.FAILED },
    });
    return false;
  }
}

/**
 * Background worker to process pending podcast transcriptions
 * Uses global TranscriptCache to avoid redundant Whisper calls
 */
export async function runPodcastTranscriptionWorker(): Promise<void> {
  console.log('[Podcast Worker] Starting...');

  const workerId = generateWorkerId();

  // Clean up any expired locks
  await cleanupExpiredLocks();

  // Get Spotify content items that need transcription
  const pendingContent = await prisma.content.findMany({
    where: {
      status: ContentStatus.SELECTED,
      platform: Platform.SPOTIFY,
      transcript: null,
    },
    take: 10, // Increased since we deduplicate
    orderBy: { createdAt: 'asc' },
  });

  if (pendingContent.length === 0) {
    console.log('[Podcast Worker] No pending podcasts to process');
    return;
  }

  // Deduplicate by externalId (multiple users may have the same episode)
  const uniqueEpisodes = new Map<string, typeof pendingContent[0]>();
  for (const content of pendingContent) {
    if (!uniqueEpisodes.has(content.externalId)) {
      uniqueEpisodes.set(content.externalId, content);
    }
  }

  console.log(`[Podcast Worker] Processing ${pendingContent.length} items → ${uniqueEpisodes.size} unique episodes`);

  let success = 0;
  let cacheHits = 0;
  let failed = 0;

  for (const [externalId, content] of uniqueEpisodes) {
    const result = await processPodcastWithCache(workerId, content);
    if (result === 'success') {
      success++;
    } else if (result === 'cache_hit') {
      cacheHits++;
    } else {
      failed++;
    }
  }

  console.log(`[Podcast Worker] Completed: ${success} transcribed, ${cacheHits} cache hits, ${failed} failed`);
}

/**
 * Process a podcast episode using the global cache
 */
async function processPodcastWithCache(
  workerId: string,
  content: { id: string; platform: Platform; externalId: string; showName: string | null; title: string; url: string }
): Promise<'success' | 'cache_hit' | 'failed'> {
  // Try to get or create cache entry with lock
  const result = await getOrCreateCacheWithLock(content.platform, content.externalId, workerId);

  if (!result) {
    // Cache is locked by another worker, skip for now
    return 'failed';
  }

  const { cache, acquired } = result;

  // If cache already has transcript (SUCCESS), just link and copy
  if (cache.status === TranscriptCacheStatus.SUCCESS && cache.text) {
    await linkCacheToContent(content.platform, content.externalId, cache.id);
    await copyTranscriptToAllSpotifyContent(content.externalId, cache);
    console.log(`[Podcast] Cache hit for ${content.externalId}`);
    return 'cache_hit';
  }

  // If cache is UNAVAILABLE and not retrying, mark content as unsupported
  if (cache.status === TranscriptCacheStatus.UNAVAILABLE && !acquired) {
    await markSpotifyContentUnsupported(content.externalId);
    return 'failed';
  }

  // We acquired the lock, need to fetch transcript
  if (!acquired) {
    return 'failed';
  }

  try {
    // Step 1: Find RSS feed and audio URL
    console.log(`[Podcast] Looking up RSS for: ${content.showName} - ${content.title}`);
    const rssResult = await findPodcastRSS(content.showName || '', content.title);

    if (!rssResult.episodeAudioUrl) {
      // Mark as unsupported (likely Spotify Exclusive)
      await markCacheUnavailable(cache.id, rssResult.error || 'No audio found', workerId);
      await markSpotifyContentUnsupported(content.externalId);
      console.log(`[Podcast] ${rssResult.error || 'No audio found'} - marking as unsupported`);
      return 'failed';
    }

    // Step 2: Download audio
    console.log(`[Podcast] Downloading audio...`);
    const audioPath = await downloadAudio(rssResult.episodeAudioUrl);

    // Step 3: Transcribe with Whisper
    console.log(`[Podcast] Transcribing with Whisper...`);
    const transcript = await transcribeWithWhisper(audioPath);

    // Step 4: Save to cache
    await markCacheSuccess(cache.id, {
      text: transcript.text,
      segments: transcript.segments,
      language: transcript.language,
      source: TranscriptSource.WHISPER,
    }, workerId);

    // Step 5: Link and copy to all Content records
    await linkCacheToContent(content.platform, content.externalId, cache.id);
    await copyTranscriptToAllSpotifyContent(content.externalId, {
      text: transcript.text,
      segments: transcript.segments,
      language: transcript.language,
      source: TranscriptSource.WHISPER,
    });

    // Update status for all content with this externalId
    await prisma.content.updateMany({
      where: {
        platform: Platform.SPOTIFY,
        externalId: content.externalId,
        status: ContentStatus.TRANSCRIBING,
      },
      data: { status: ContentStatus.SELECTED },
    });

    console.log(`[Podcast] ✅ ${content.externalId} - SUCCESS (${transcript.text.length} chars)`);
    return 'success';

  } catch (error: any) {
    await markCacheFailed(cache.id, error, workerId);
    console.error(`[Podcast] ${content.externalId} - ERROR: ${error.message}`);
    return 'failed';
  }
}

/**
 * Copy transcript from cache to all Spotify Content records with this externalId
 */
async function copyTranscriptToAllSpotifyContent(
  externalId: string,
  cache: { text: string | null; segments: any; language: string | null; source: TranscriptSource | null }
): Promise<void> {
  if (!cache.text || !cache.source) return;

  const contents = await prisma.content.findMany({
    where: {
      platform: Platform.SPOTIFY,
      externalId,
      transcript: null,
    },
    select: { id: true },
  });

  for (const content of contents) {
    try {
      await copyTranscriptFromCache(content.id, cache);
    } catch (error) {
      // Ignore duplicate errors
    }
  }
}

/**
 * Mark all Spotify content with this externalId as unsupported
 */
async function markSpotifyContentUnsupported(externalId: string): Promise<void> {
  await prisma.content.updateMany({
    where: {
      platform: Platform.SPOTIFY,
      externalId,
      status: { not: ContentStatus.UNSUPPORTED },
    },
    data: { status: ContentStatus.UNSUPPORTED },
  });
}
