// Shared rate limiters for all workers
// Uses p-limit to control concurrency per external service
import pLimit from 'p-limit';

// --- Concurrency limiters (shared singletons) ---

/** Groq Whisper API — max 3 concurrent calls */
export const groqLimiter = pLimit(3);

/** Mistral LLM — max 5 concurrent calls (quiz + tagging) */
export const llmLimiter = pLimit(5);

/** YouTube Data API — max 10 concurrent user syncs */
export const youtubeLimiter = pLimit(10);

/** Spotify API — max 10 concurrent user syncs */
export const spotifyLimiter = pLimit(10);

/** Instagram private API — max 5 concurrent user syncs */
export const instagramLimiter = pLimit(5);

/** TikTok Playwright — max 2 concurrent browsers */
export const tiktokLimiter = pLimit(2);

// --- Retry with exponential backoff ---

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: (error: unknown) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryOn: (error: unknown) => {
    // Retry on 429 (rate limit) and 5xx (server errors)
    if (error instanceof Error) {
      const msg = error.message;
      return msg.includes('429') || msg.includes('500') || msg.includes('502') || msg.includes('503');
    }
    return false;
  },
};

/**
 * Retry a function with exponential backoff.
 * Useful for wrapping API calls that may return 429.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions
): Promise<T> {
  const options = { ...DEFAULT_RETRY_OPTIONS, ...opts };
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === options.maxRetries || !options.retryOn(error)) {
        throw error;
      }

      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt),
        options.maxDelayMs
      );
      const jitter = delay * 0.2 * Math.random();
      console.log(`[Retry] Attempt ${attempt + 1}/${options.maxRetries} failed, retrying in ${Math.round(delay + jitter)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}
