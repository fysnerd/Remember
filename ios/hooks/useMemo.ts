/**
 * Memo hooks - content memo/summary
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Memo } from '../types/content';

// Backend response structure
interface BackendMemoResponse {
  memo: string; // Markdown content
  generatedAt?: string;
}

interface BackendTopicMemoResponse {
  memo: string;
  topicName: string;
  contentCount: number;
  generatedAt?: string;
}

// Get memo for content — cached persistently (backend stores in DB, no need to refetch)
export function useMemo(contentId: string) {
  return useQuery({
    queryKey: ['memo', contentId],
    queryFn: async () => {
      const { data } = await api.get<BackendMemoResponse>(`/content/${contentId}/memo`);

      const memo: Memo = {
        contentId,
        title: 'Mémo',
        content: data.memo,
        generatedAt: data.generatedAt,
      };
      return memo;
    },
    enabled: !!contentId,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000, // 24h
  });
}

// Get memo for a topic (aggregated from all contents)
export function useTopicMemo(topicName: string) {
  return useQuery({
    queryKey: ['memo', 'topic', topicName],
    queryFn: async () => {
      const { data } = await api.get<BackendTopicMemoResponse>(
        `/content/topic/${encodeURIComponent(topicName)}/memo`
      );

      return {
        topicName: data.topicName,
        content: data.memo,
        contentCount: data.contentCount,
        generatedAt: data.generatedAt,
      };
    },
    enabled: !!topicName,
    staleTime: 30 * 60 * 1000, // 30min — topic memos can change as new content is added
    gcTime: 24 * 60 * 60 * 1000, // 24h
  });
}

// Backend response structure for theme memo
interface BackendThemeMemoResponse {
  memo: string;
  themeName: string;
  contentCount: number;
  generatedAt: string;
  cached: boolean;
}

// Get memo for a theme (synthesized from all content memos in theme)
export function useThemeMemo(themeId: string) {
  return useQuery({
    queryKey: ['memo', 'theme', themeId],
    queryFn: async () => {
      const { data } = await api.get<BackendThemeMemoResponse>(
        `/themes/${themeId}/memo`
      );

      return {
        themeId,
        themeName: data.themeName,
        content: data.memo,
        contentCount: data.contentCount,
        generatedAt: data.generatedAt,
        cached: data.cached,
      };
    },
    enabled: !!themeId,
    staleTime: 30 * 60 * 1000, // 30min — matches backend 24h TTL, but allow periodic refresh
    gcTime: 24 * 60 * 60 * 1000, // 24h
  });
}

// Force-refresh memo for a theme
export function useRefreshThemeMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (themeId: string) => {
      const { data } = await api.post<BackendThemeMemoResponse>(
        `/themes/${themeId}/memo/refresh`
      );
      return data;
    },
    onSuccess: (_, themeId) => {
      queryClient.invalidateQueries({ queryKey: ['memo', 'theme', themeId] });
    },
  });
}
