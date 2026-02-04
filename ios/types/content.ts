/**
 * Shared content types
 */

export type ContentSource = 'youtube' | 'spotify' | 'tiktok' | 'instagram';

export type ContentStatus =
  | 'INBOX'
  | 'SELECTED'
  | 'TRANSCRIBING'
  | 'GENERATING'
  | 'READY'
  | 'ARCHIVED';

export interface Content {
  id: string;
  title: string;
  source: ContentSource;
  sourceId: string;
  thumbnailUrl?: string;
  duration?: number; // seconds
  description?: string;
  channelName?: string; // YouTube channel, Spotify show, @username for TikTok/Instagram
  url?: string; // Link to original content
  status: ContentStatus;
  topics: string[];
  createdAt: string;
}

export interface ContentListResponse {
  items: Content[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface Question {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correctAnswer: string;
  explanation: string;
}

export interface Quiz {
  id: string;
  contentId: string;
  questions: Question[];
}

export interface Review {
  id: string;
  contentId: string;
  contentTitle: string;
  source: ContentSource;
  score: number;
  total: number;
  completedAt: string;
}

export interface ReviewStats {
  streak: number;
  todayCount: number;
  totalCount: number;
}

export interface Memo {
  contentId: string;
  title: string;
  content: string; // Markdown content from backend
  generatedAt?: string;
}

export interface PlatformStatus {
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

export interface OAuthStatus {
  youtube: PlatformStatus | null;
  spotify: PlatformStatus | null;
  tiktok: PlatformStatus | null;
  instagram: PlatformStatus | null;
}
