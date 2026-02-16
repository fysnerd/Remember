/**
 * Pipeline status polling hook
 *
 * Polls GET /content/pipeline-status every 5s when processing items exist.
 * Detects ready transitions and triggers haptic + content query invalidation.
 * Stops polling when idle (no processing items).
 */

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import api from '../lib/api';
import type { PipelineStatusResponse, ContentStatus } from '../types/content';

export function usePipelineStatus() {
  const previousProcessingRef = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pipeline', 'status'],
    queryFn: async (): Promise<PipelineStatusResponse> => {
      const { data } = await api.get<PipelineStatusResponse>('/content/pipeline-status');
      return data;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.processing && data.processing.length > 0) return 5000;
      return false;
    },
    refetchOnWindowFocus: true,
  });

  // Detect ready transitions
  useEffect(() => {
    if (!query.data) return;
    const currentIds = new Set(query.data.processing.map((p) => p.id));
    const readyIds = new Set(query.data.recentlyReady.map((r) => r.id));

    const newlyReady: string[] = [];
    for (const id of previousProcessingRef.current) {
      if (!currentIds.has(id) && readyIds.has(id)) {
        newlyReady.push(id);
      }
    }

    if (newlyReady.length > 0) {
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Invalidate content queries so cards refresh
      queryClient.invalidateQueries({ queryKey: ['content'] });
    }

    previousProcessingRef.current = currentIds;
  }, [query.data, queryClient]);

  // Build a map for quick lookup: contentId -> status
  const processingMap = new Map<string, ContentStatus>();
  if (query.data?.processing) {
    for (const item of query.data.processing) {
      processingMap.set(item.id, item.status as ContentStatus);
    }
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    processingCount: query.data?.processing?.length ?? 0,
    processingMap,
  };
}
