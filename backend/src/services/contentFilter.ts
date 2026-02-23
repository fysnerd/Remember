// Content quality filter for TikTok/Instagram
// Filters out entertainment content that's not useful for learning

// Hashtags that indicate non-educational content
const BLOCKED_HASHTAGS = [
  // Memes & humor
  'meme', 'memes', 'humour', 'humor', 'funny', 'prank', 'blague', 'lol', 'mdr',
  // Music clips
  'rapfr', 'clip', 'musique', 'electronicmusic', 'dnb', 'newgen', 'clipofficiel',
  'rap', 'hiphop', 'drill', 'afrobeat',
];

const BLOCKED_REGEX = new RegExp(
  `#(${BLOCKED_HASHTAGS.join('|')})\\b`,
  'i'
);

const MIN_DURATION_SECONDS = 10;

/**
 * Clean a TikTok/Instagram caption for use as title:
 * 1. Keep only the first line
 * 2. Remove any #hashtag words
 * 3. Trim whitespace
 */
export function cleanTitle(rawText: string | null, fallback: string): string {
  if (!rawText) return fallback;

  // Take only the first line
  const firstLine = rawText.split('\n')[0].trim();
  if (!firstLine) return fallback;

  // Remove hashtag words (#something)
  const cleaned = firstLine.replace(/#\S+/g, '').trim();

  // If nothing left after removing hashtags, use fallback
  if (!cleaned) return fallback;

  return cleaned.substring(0, 255);
}

/**
 * Check if a TikTok/Instagram content should be skipped during sync.
 * Returns a reason string if filtered, null if OK to import.
 */
export function shouldFilterContent(description: string | null, duration: number | null): string | null {
  // Filter very short videos (<10s)
  if (duration !== null && duration < MIN_DURATION_SECONDS) {
    return `too_short (${duration}s)`;
  }

  if (!description) return null;

  // Check for blocked hashtags
  if (BLOCKED_REGEX.test(description)) {
    const match = description.match(BLOCKED_REGEX);
    return `blocked_hashtag (${match?.[0]})`;
  }

  return null;
}
