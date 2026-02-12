// Podcast Transcription Service - RSS feed lookup + Whisper API
// For Spotify podcasts that aren't "Spotify Exclusive"
// Uses global TranscriptCache to avoid redundant transcription calls
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';

const log = logger.child({ service: 'podcast-transcription' });
import { ContentStatus, TranscriptSource, TranscriptCacheStatus, Platform } from '@prisma/client';
import OpenAI from 'openai';
import Parser from 'rss-parser';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import * as crypto from 'crypto';
import { groqLimiter } from '../utils/rateLimiter.js';
import pLimit from 'p-limit';
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
      log.debug({ sizeBytes: stats.size }, 'File too small');
      return false;
    }

    // If file is large enough, assume it might be valid audio
    // (some MP3s have weird headers)
    if (stats.size > 500000) {
      log.debug({ sizeMB: Math.round(stats.size / 1024 / 1024) }, 'File large enough, assuming valid audio');
      return true;
    }

    return false;
  } catch (error) {
    log.error({ err: error }, 'Error checking audio file');
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
    log.debug('Podcast Index not configured, skipping');
    return null;
  }

  try {
    log.debug({ showName }, 'Searching Podcast Index');

    // Search for the podcast by title
    const headers = getPodcastIndexHeaders();
    const searchResponse = await axios.get('https://api.podcastindex.org/api/1.0/search/byterm', {
      params: { q: showName },
      headers,
      timeout: 15000,
    });

    const feeds = searchResponse.data.feeds;
    if (!feeds || feeds.length === 0) {
      log.debug('No results from Podcast Index');
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

    log.debug({ feedTitle: bestFeed.title, score: bestScore.toFixed(2) }, 'Podcast Index best match');

    if (bestScore < 0.5) {
      log.debug({ score: bestScore.toFixed(2) }, 'Podcast Index match score too low');
      return null;
    }

    const feedUrl = bestFeed.url;
    if (!feedUrl) {
      log.debug('No RSS URL in Podcast Index result');
      return null;
    }

    log.info({ feedUrl }, 'Found RSS via Podcast Index');

    // Parse RSS to find episode
    const feed = await rssParser.parseURL(feedUrl);
    if (!feed || !feed.items || feed.items.length === 0) {
      log.debug('RSS feed empty or invalid');
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

    log.debug({ episodeTitle: bestEpisode?.title, score: bestEpisodeScore.toFixed(2) }, 'Best episode match');

    if (bestEpisode && bestEpisode.enclosure?.url && bestEpisodeScore > 0.5) {
      log.info({ episodeTitle: bestEpisode.title }, 'Found episode via Podcast Index');
      return {
        rssUrl: feedUrl,
        episodeAudioUrl: bestEpisode.enclosure.url,
        episodeTitle: bestEpisode.title,
      };
    }

    log.debug({ score: bestEpisodeScore.toFixed(2) }, 'Episode match score too low');
    return null;

  } catch (error: any) {
    log.error({ err: error }, 'Podcast Index API error');
    return null;
  }
}

/**
 * Search for podcast RSS feed - tries Podcast Index first, then iTunes
 */
async function findPodcastRSS(showName: string, episodeTitle: string): Promise<PodcastRSSResult> {
  log.debug({ showName, episodeTitle }, 'Searching for podcast RSS');

  // Method 1: Podcast Index API (4.4M+ podcasts, better coverage)
  const podcastIndexResult = await searchPodcastIndex(showName, episodeTitle);
  if (podcastIndexResult) {
    return podcastIndexResult;
  }

  // Method 2: iTunes Search API (fallback, free, no key required)
  try {
    log.debug({ showName }, 'Falling back to iTunes search');
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

      log.debug({ podcastName: bestPodcast.collectionName, score: bestScore.toFixed(2) }, 'iTunes best match');

      const feedUrl = bestPodcast.feedUrl;
      // IMPORTANT: Increased threshold from 0.3 to 0.5 to avoid false positives
      if (feedUrl && bestScore > 0.5) {
        log.info({ feedUrl }, 'Found RSS via iTunes');

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

            log.debug({ episodeTitle: bestEpisode?.title, score: bestEpisodeScore.toFixed(2) }, 'Best episode match');

            // IMPORTANT: Increased threshold from 0.4 to 0.5 to avoid false positives
            // A score of 0.5+ with Levenshtein means strings are fairly similar
            if (bestEpisode && bestEpisode.enclosure?.url && bestEpisodeScore > 0.5) {
              log.info({ episodeTitle: bestEpisode.title }, 'Found episode audio');
              return {
                rssUrl: feedUrl,
                episodeAudioUrl: bestEpisode.enclosure.url,
                episodeTitle: bestEpisode.title,
              };
            } else {
              log.warn({ score: bestEpisodeScore.toFixed(2) }, 'Episode match score too low, skipping to avoid wrong transcription');
            }
          }
        } catch (rssError) {
          log.error({ err: rssError }, 'Failed to parse RSS');
        }
      } else {
        log.warn({ score: bestScore.toFixed(2), requested: showName, found: bestPodcast.collectionName }, 'Podcast match score too low');
      }
    }
  } catch (error) {
    log.error({ err: error }, 'iTunes Search API error');
  }

  // Method 2: Listen Notes API if available
  if (config.listenNotes?.apiKey) {
    try {
      log.debug('Trying Listen Notes API');
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
        log.info({ episodeTitle: episode.title_original }, 'Listen Notes found episode');

        return {
          rssUrl: null,
          episodeAudioUrl: episode.audio,
          episodeTitle: episode.title_original,
        };
      }
    } catch (error) {
      log.error({ err: error }, 'Listen Notes API error');
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
 * No longer compresses here - chunking handles oversized files
 */
async function downloadAudio(audioUrl: string): Promise<string> {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `podcast_${Date.now()}.mp3`);

  log.debug({ audioUrl }, 'Downloading podcast audio');

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
  log.debug({ contentType, status: response.status }, 'Audio download response');

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
  log.debug({ sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100 }, 'Audio downloaded');

  if (!isValidAudioFile(tempFile)) {
    fs.unlinkSync(tempFile);
    throw new Error('Downloaded file is not a valid audio file');
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
        log.error({ stderr }, 'ffprobe error');
        reject(new Error(`ffprobe failed: ${error.message}`));
        return;
      }
      const duration = parseFloat(stdout.trim());
      resolve(isNaN(duration) ? 0 : duration);
    });
  });
}

// Chunk duration: 20 minutes (fits well within Groq per-request limits)
const CHUNK_DURATION_SEC = 20 * 60;
// Max file size for Groq Whisper
const MAX_WHISPER_SIZE = 24 * 1024 * 1024; // 24MB safe margin

/**
 * Split audio file into chunks of ~CHUNK_DURATION_SEC using ffmpeg
 * Returns list of chunk file paths
 */
async function splitAudioIntoChunks(audioPath: string): Promise<string[]> {
  const duration = await getAudioDuration(audioPath);

  // If short enough, just compress and return as single chunk
  if (duration <= CHUNK_DURATION_SEC + 60) { // +60s tolerance
    const compressed = await compressChunk(audioPath);
    return [compressed];
  }

  const numChunks = Math.ceil(duration / CHUNK_DURATION_SEC);
  log.info({ durationMin: Math.round(duration / 60), numChunks }, 'Splitting audio into chunks');

  const chunkPaths: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const startSec = i * CHUNK_DURATION_SEC;
    const chunkPath = audioPath.replace('.mp3', `_chunk${i}.mp3`);

    await new Promise<void>((resolve, reject) => {
      const cmd = `ffmpeg -y -i "${audioPath}" -ss ${startSec} -t ${CHUNK_DURATION_SEC} -ac 1 -ar 16000 -b:a 32k "${chunkPath}"`;
      exec(cmd, { timeout: 300000 }, (error, _stdout, stderr) => {
        if (error) {
          log.error({ stderr, chunk: i }, 'ffmpeg chunk split error');
          reject(new Error(`ffmpeg chunk ${i} failed: ${error.message}`));
          return;
        }
        resolve();
      });
    });

    // Verify chunk exists and is valid
    if (fs.existsSync(chunkPath)) {
      const stats = fs.statSync(chunkPath);
      if (stats.size > 1000) { // skip empty/tiny chunks
        // If still too large, re-compress with lower bitrate
        if (stats.size > MAX_WHISPER_SIZE) {
          const recompressed = await compressChunkToSize(chunkPath, MAX_WHISPER_SIZE);
          fs.unlinkSync(chunkPath);
          chunkPaths.push(recompressed);
        } else {
          chunkPaths.push(chunkPath);
        }
      } else {
        fs.unlinkSync(chunkPath);
      }
    }
  }

  // Clean up original file
  fs.unlinkSync(audioPath);

  log.info({ chunks: chunkPaths.length }, 'Audio split complete');
  return chunkPaths;
}

/**
 * Compress a single chunk to mono 16kHz 32kbps (good for speech)
 */
async function compressChunk(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace('.mp3', '_comp.mp3');

  await new Promise<void>((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${inputPath}" -ac 1 -ar 16000 -b:a 32k "${outputPath}"`;
    exec(cmd, { timeout: 300000 }, (error, _stdout, _stderr) => {
      if (error) {
        reject(new Error(`ffmpeg compress failed: ${error.message}`));
        return;
      }
      resolve();
    });
  });

  fs.unlinkSync(inputPath);

  // If still too large, use even lower bitrate
  const stats = fs.statSync(outputPath);
  if (stats.size > MAX_WHISPER_SIZE) {
    const recompressed = await compressChunkToSize(outputPath, MAX_WHISPER_SIZE);
    fs.unlinkSync(outputPath);
    return recompressed;
  }

  return outputPath;
}

/**
 * Re-compress a chunk with calculated bitrate to fit target size
 */
async function compressChunkToSize(inputPath: string, targetBytes: number): Promise<string> {
  const outputPath = inputPath.replace('.mp3', '_fit.mp3');
  const duration = await getAudioDuration(inputPath);
  // Calculate bitrate: targetBytes * 8 / duration / 1000 = kbps
  const bitrate = Math.max(16, Math.floor((targetBytes * 8) / duration / 1000));

  log.debug({ bitrateKbps: bitrate, durationSec: Math.round(duration) }, 'Re-compressing chunk to fit size');

  await new Promise<void>((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${inputPath}" -ac 1 -ar 16000 -b:a ${bitrate}k "${outputPath}"`;
    exec(cmd, { timeout: 300000 }, (error) => {
      if (error) {
        reject(new Error(`ffmpeg re-compress failed: ${error.message}`));
        return;
      }
      resolve();
    });
  });

  return outputPath;
}

/**
 * Transcribe a single audio file using Whisper API (Groq free or OpenAI)
 * Does NOT clean up the file - caller handles cleanup
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

  log.debug({ provider: isGroq ? 'Groq' : 'OpenAI' }, 'Using Whisper for transcription');

  // Use verbose_json for timestamped segments
  const transcription = await whisperClient.audio.transcriptions.create({
    file: audioFile,
    model,
    response_format: 'verbose_json',
    ...(isGroq ? {} : { timestamp_granularities: ['segment'] }),
  });

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
 * Transcribe audio with automatic chunking for long files
 * Splits into ~20min chunks, transcribes each, merges results
 */
async function transcribeChunked(audioPath: string): Promise<{
  text: string;
  segments: TranscriptSegment[];
  language: string;
}> {
  // Split into chunks (may return single chunk for short files)
  const chunkPaths = await splitAudioIntoChunks(audioPath);

  log.info({ chunks: chunkPaths.length }, 'Starting chunked transcription');

  const allTexts: string[] = [];
  const allSegments: TranscriptSegment[] = [];
  let detectedLanguage = 'fr';

  for (let i = 0; i < chunkPaths.length; i++) {
    const chunkPath = chunkPaths[i];
    const chunkOffset = i * CHUNK_DURATION_SEC;

    log.debug({ chunk: i + 1, total: chunkPaths.length, offsetMin: Math.round(chunkOffset / 60) }, 'Transcribing chunk');

    try {
      const result = await groqLimiter(() => transcribeWithWhisper(chunkPath));

      allTexts.push(result.text);
      detectedLanguage = result.language;

      // Adjust segment timestamps with chunk offset
      for (const seg of result.segments) {
        allSegments.push({
          start: seg.start + chunkOffset,
          duration: seg.duration,
          text: seg.text,
        });
      }
    } finally {
      // Always clean up chunk file
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
    }
  }

  const mergedText = allTexts.join(' ');
  log.info({ chunks: chunkPaths.length, totalChars: mergedText.length, segments: allSegments.length }, 'Chunked transcription complete');

  return {
    text: mergedText,
    segments: allSegments,
    language: detectedLanguage,
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
    log.error({ contentId }, 'Content not found');
    return false;
  }

  // Skip if already has transcript
  if (content.transcript) {
    log.debug({ contentId }, 'Content already has transcript');
    return true;
  }

  // Only process Spotify content
  if (content.platform !== Platform.SPOTIFY) {
    log.debug({ contentId, platform: content.platform }, 'Not Spotify content, skipping');
    return false;
  }

  // Update status to transcribing
  await prisma.content.update({
    where: { id: contentId },
    data: { status: ContentStatus.TRANSCRIBING },
  });

  try {
    // Step 1: Find RSS feed and audio URL
    log.debug({ showName: content.showName, episodeTitle: content.title }, 'Looking up RSS feed');
    const rssResult = await findPodcastRSS(content.showName || '', content.title);

    if (!rssResult.episodeAudioUrl) {
      // Mark as unsupported (likely Spotify Exclusive)
      await prisma.content.update({
        where: { id: contentId },
        data: { status: ContentStatus.UNSUPPORTED },
      });
      log.warn({ reason: rssResult.error || 'No audio found' }, 'Marking as unsupported');
      return false;
    }

    // Step 2: Download audio
    log.debug('Downloading audio');
    const audioPath = await downloadAudio(rssResult.episodeAudioUrl);

    // Step 3: Transcribe with chunking (splits long audio, handles rate limits)
    log.debug('Transcribing with chunked Whisper');
    const result = await transcribeChunked(audioPath);

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

    log.info({ episodeTitle: content.title, chars: result.text.length, language: result.language }, 'Podcast transcription completed');
    return true;

  } catch (error: any) {
    log.error({ err: error, episodeTitle: content.title }, 'Podcast transcription failed');
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
  log.info('Starting podcast transcription worker');

  const workerId = generateWorkerId();

  // Clean up any expired locks
  await cleanupExpiredLocks();

  // Get Spotify content items that need transcription (SELECTED priority, then INBOX)
  // Exclude items already linked to a cache entry in backoff (nextRetryAt in the future)
  const now = new Date();
  const pendingContent = await prisma.content.findMany({
    where: {
      AND: [
        { OR: [
          { status: ContentStatus.SELECTED },
          { status: ContentStatus.INBOX },
        ]},
        { platform: Platform.SPOTIFY },
        { transcript: null },
        { OR: [
          { transcriptCacheId: null },
          { transcriptCache: { status: TranscriptCacheStatus.PENDING } },
          { transcriptCache: { nextRetryAt: null } },
          { transcriptCache: { nextRetryAt: { lte: now } } },
        ]},
      ],
    },
    take: 20,
    orderBy: { createdAt: 'asc' },
  });

  if (pendingContent.length === 0) {
    log.debug('No pending podcasts to process');
    return;
  }

  // Deduplicate by externalId (multiple users may have the same episode)
  const uniqueEpisodes = new Map<string, typeof pendingContent[0]>();
  for (const content of pendingContent) {
    if (!uniqueEpisodes.has(content.externalId)) {
      uniqueEpisodes.set(content.externalId, content);
    }
  }

  log.info({ total: pendingContent.length, unique: uniqueEpisodes.size }, 'Found pending podcasts');

  let success = 0;
  let cacheHits = 0;
  let failed = 0;

  const limit = pLimit(1); // Sequential: chunked transcription is heavy + Groq rate limits

  const results = await Promise.allSettled(
    Array.from(uniqueEpisodes.values()).map(content =>
      limit(() => processPodcastWithCache(workerId, content))
    )
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value === 'success') success++;
      else if (result.value === 'cache_hit') cacheHits++;
      else failed++;
    } else {
      failed++;
    }
  }

  log.info({ success, cacheHits, failed }, 'Podcast transcription worker completed');
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

  // Always link content to cache so future queries can filter by cache state
  await linkCacheToContent(content.platform, content.externalId, cache.id);

  // If cache already has transcript (SUCCESS), just copy
  if (cache.status === TranscriptCacheStatus.SUCCESS && cache.text) {
    await copyTranscriptToAllSpotifyContent(content.externalId, cache);
    log.debug({ externalId: content.externalId, cacheHit: true }, 'Cache hit for podcast');
    return 'cache_hit';
  }

  // If cache is UNAVAILABLE and not retrying, mark content as unsupported
  if (cache.status === TranscriptCacheStatus.UNAVAILABLE && !acquired) {
    await markSpotifyContentUnsupported(content.externalId);
    return 'failed';
  }

  // If cache is FAILED and waiting for backoff, skip silently (query should exclude these)
  if (cache.status === TranscriptCacheStatus.FAILED && !acquired) {
    return 'failed';
  }

  // We acquired the lock, need to fetch transcript
  if (!acquired) {
    return 'failed';
  }

  try {
    // Step 1: Find RSS feed and audio URL
    log.debug({ showName: content.showName, episodeTitle: content.title }, 'Looking up RSS feed');
    const rssResult = await findPodcastRSS(content.showName || '', content.title);

    if (!rssResult.episodeAudioUrl) {
      // Mark as unsupported (likely Spotify Exclusive)
      await markCacheUnavailable(cache.id, rssResult.error || 'No audio found', workerId);
      await markSpotifyContentUnsupported(content.externalId);
      log.warn({ reason: rssResult.error || 'No audio found' }, 'Marking as unsupported');
      return 'failed';
    }

    // Step 2: Download audio
    log.debug('Downloading audio');
    const audioPath = await downloadAudio(rssResult.episodeAudioUrl);

    // Step 3: Transcribe with chunking (splits long audio, handles rate limits)
    log.debug('Transcribing with chunked Whisper');
    const transcript = await transcribeChunked(audioPath);

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

    log.info({ externalId: content.externalId, chars: transcript.text.length, language: transcript.language }, 'Podcast transcription completed successfully');
    return 'success';

  } catch (error: any) {
    await markCacheFailed(cache.id, error, workerId);
    log.error({ err: error, externalId: content.externalId }, 'Podcast transcription error');
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
