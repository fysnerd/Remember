/**
 * Reviews hooks - history, stats, completed items, sessions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { ReviewStats } from '../types/content';

// ============================================================================
// Quiz Session types
// ============================================================================

export interface QuizSessionTheme {
  id: string;
  name: string;
  emoji: string;
}

export interface QuizSessionContent {
  id: string;
  title: string;
  platform: string;
  thumbnailUrl: string | null;
}

export interface QuizSessionItem {
  id: string;
  completedAt: string;
  totalCount: number;
  correctCount: number;
  accuracy: number;
  hasMemo: boolean;
  contents: QuizSessionContent[];
  themes: QuizSessionTheme[];
}

// ============================================================================
// Completed sessions (new - for revisions tab)
// ============================================================================

export function useCompletedSessions() {
  return useQuery({
    queryKey: ['reviews', 'sessions'],
    queryFn: async () => {
      const { data } = await api.get<{ sessions: QuizSessionItem[] }>('/reviews/sessions');
      return data.sessions;
    },
  });
}

// ============================================================================
// Session detail
// ============================================================================

export function useSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const { data } = await api.get(`/reviews/session/${sessionId}`);
      return data;
    },
    enabled: !!sessionId,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000, // 24h
  });
}

// ============================================================================
// Generate session memo
// ============================================================================

export function useGenerateSessionMemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, force }: { sessionId: string; force?: boolean }) => {
      const { data } = await api.post(`/reviews/session/${sessionId}/memo`, { force });
      return data as { memo: string; generatedAt: string };
    },
    onSuccess: (_data, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });
}

// ============================================================================
// Legacy hooks (still used elsewhere)
// ============================================================================

interface CompletedContentItem {
  id: string;
  contentId: string;
  contentTitle: string;
  source: string;
  thumbnailUrl?: string;
  topics: string[];
}

interface CompletedTopicItem {
  id: string;
  type: 'topic';
  name: string;
  contentCount: number;
}

interface CompletedThemeItem {
  id: string;
  name: string;
  emoji: string;
  color: string;
  quizzedContentCount: number;
}

interface CompletedItemsResponse {
  items: CompletedContentItem[];
  topics: CompletedTopicItem[];
  themes: CompletedThemeItem[];
}

export function useCompletedItems() {
  return useQuery({
    queryKey: ['reviews', 'completed'],
    queryFn: async () => {
      const { data } = await api.get<CompletedItemsResponse>('/reviews');
      return data;
    },
  });
}

export function useReviewStats() {
  return useQuery({
    queryKey: ['reviews', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<ReviewStats>('/reviews/stats');
      return data;
    },
  });
}

export function useReviews() {
  return useCompletedItems();
}
