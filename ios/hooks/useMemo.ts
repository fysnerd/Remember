/**
 * Memo hooks - content memo/summary
 */

import { useQuery } from '@tanstack/react-query';
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

// Get memo for content
export function useMemo(contentId: string) {
  return useQuery({
    queryKey: ['memo', contentId],
    queryFn: async () => {
      const { data } = await api.get<BackendMemoResponse>(`/content/${contentId}/memo`);
      console.log('[useMemo] Raw backend data:', data);

      // Transform backend response to frontend Memo type
      const memo: Memo = {
        contentId,
        title: 'Mémo',
        content: data.memo,
        generatedAt: data.generatedAt,
      };
      return memo;
    },
    enabled: !!contentId,
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
      console.log('[useTopicMemo] Got memo for topic:', topicName, 'from', data.contentCount, 'contents');

      return {
        topicName: data.topicName,
        content: data.memo,
        contentCount: data.contentCount,
        generatedAt: data.generatedAt,
      };
    },
    enabled: !!topicName,
  });
}
