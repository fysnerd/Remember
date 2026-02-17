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
