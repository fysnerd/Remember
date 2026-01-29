// Input Validation Tests
import { describe, it, expect } from 'vitest';

// Validation helpers
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
  ];
  return patterns.some((pattern) => pattern.test(url));
}

function isValidSpotifyUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/open\.spotify\.com\/(track|episode|show)\/[\w]+/,
    /^spotify:(track|episode|show):[\w]+/,
  ];
  return patterns.some((pattern) => pattern.test(url));
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([\w-]+)/,
    /youtu\.be\/([\w-]+)/,
    /\/shorts\/([\w-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

describe('Email Validation', () => {
  it('should accept valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.org')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
  });
});

describe('Password Validation', () => {
  it('should accept valid passwords', () => {
    expect(isValidPassword('password123').valid).toBe(true);
    expect(isValidPassword('verysecurepassword').valid).toBe(true);
    expect(isValidPassword('12345678').valid).toBe(true);
  });

  it('should reject short passwords', () => {
    const result = isValidPassword('short');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
  });

  it('should reject empty passwords', () => {
    const result = isValidPassword('');
    expect(result.valid).toBe(false);
  });
});

describe('URL Validation', () => {
  describe('General URL', () => {
    it('should accept valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://sub.domain.com/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
    });
  });

  describe('YouTube URL', () => {
    it('should accept valid YouTube URLs', () => {
      expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
      expect(isValidYouTubeUrl('https://www.youtube.com/shorts/abc123')).toBe(true);
    });

    it('should reject invalid YouTube URLs', () => {
      expect(isValidYouTubeUrl('https://example.com')).toBe(false);
      expect(isValidYouTubeUrl('https://youtube.com/channel/123')).toBe(false);
      expect(isValidYouTubeUrl('not-a-url')).toBe(false);
    });
  });

  describe('Spotify URL', () => {
    it('should accept valid Spotify URLs', () => {
      expect(isValidSpotifyUrl('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe(true);
      expect(isValidSpotifyUrl('https://open.spotify.com/episode/abc123')).toBe(true);
      expect(isValidSpotifyUrl('https://open.spotify.com/show/xyz789')).toBe(true);
      expect(isValidSpotifyUrl('spotify:track:4iV5W9uYEdYUVa79Axb7Rh')).toBe(true);
    });

    it('should reject invalid Spotify URLs', () => {
      expect(isValidSpotifyUrl('https://example.com')).toBe(false);
      expect(isValidSpotifyUrl('https://spotify.com/playlist/123')).toBe(false);
      expect(isValidSpotifyUrl('not-a-url')).toBe(false);
    });
  });
});

describe('YouTube ID Extraction', () => {
  it('should extract ID from standard URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('should extract ID from short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('should extract ID from shorts URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/shorts/abc123')).toBe('abc123');
  });

  it('should extract ID with additional query params', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  it('should return null for invalid URLs', () => {
    expect(extractYouTubeId('https://example.com')).toBeNull();
    expect(extractYouTubeId('')).toBeNull();
  });
});
