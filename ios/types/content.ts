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
  | 'FAILED'
  | 'UNSUPPORTED'
  | 'ARCHIVED';

export interface PipelineItem {
  id: string;
  status: ContentStatus;
  title: string;
  updatedAt: string;
}

export interface PipelineReadyItem {
  id: string;
  title: string;
  updatedAt: string;
}

export interface PipelineStatusResponse {
  processing: PipelineItem[];
  recentlyReady: PipelineReadyItem[];
}

export interface Content {
  id: string;
  title: string;
  source: ContentSource;
  sourceId: string;
  thumbnailUrl?: string;
  duration?: number; // seconds
  description?: string;
  synopsis?: string; // AI-generated summary from transcription
  channelName?: string; // YouTube channel, Spotify show, @username for TikTok/Instagram
  url?: string; // Link to original content
  status: ContentStatus;
  quizCount?: number;
  topics: string[];
  themes?: ThemeRef[];
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
  isSynthesis?: boolean;
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
  // Due counts
  dueToday: number;
  reviewDue: number;
  newDue: number;
  // New cards limit
  newCardsToday: number;
  newCardsLimit: number;
  remainingNewToday: number;
  // Totals
  totalCards: number;
  // Streak
  currentStreak: number;
  longestStreak: number;
  // Activity
  reviewsLast7Days: number;
  // Legacy (kept for backward compat)
  streak?: number;
  todayCount?: number;
  totalCount?: number;
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

export interface ThemeListItem {
  id: string;
  name: string;
  slug: string;
  color: string;       // hex e.g. "#6366F1"
  emoji: string;       // e.g. "📚"
  contentCount: number;
  quizReadyCount: number; // content items with generated quizzes
  canQuiz: boolean;       // quizReadyCount >= 3
  tags: { id: string; name: string }[];
  // Progress fields (from 11-01 backend)
  totalCards: number;
  masteredCards: number;
  dueCards: number;
  masteryPercent: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DiscoverAction =
  | { type: 'confirm'; themeId: string }
  | { type: 'rename'; themeId: string; newName: string }
  | { type: 'merge'; sourceThemeId: string; targetThemeId: string }
  | { type: 'dismiss'; themeId: string };

export interface QuizRecommendation {
  id: string;
  type: 'content' | 'theme';
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  emoji: string | null;
  color: string | null;
  questionCount: number;
  dueCount: number;
  platform: string | null;
  channelName: string | null;
  capturedAt: string | null;
  reason: string;
  completed?: boolean;
  dailyRecId?: string;
}

export interface DailyProgress {
  completed: number;
  total: number;
  allDone: boolean;
}

export interface ThemeRef {
  id: string;
  name: string;
  slug: string;
  color: string;
  emoji: string;
}
