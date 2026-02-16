/**
 * Single-item swipe triage mutation with optimistic cache removal.
 * Used by the swipe card stack for one-at-a-time triage (learn/archive).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface SwipeTriageParams {
  contentId: string;
  action: 'learn' | 'archive';
}

export function useSwipeTriage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentId, action }: SwipeTriageParams) => {
      const { data } = await api.patch(`/content/${contentId}/triage`, { action });
      return data;
    },
    onMutate: async () => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['inbox'] });
      // Snapshot previous value for rollback
      const previous = queryClient.getQueryData(['inbox']);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['inbox'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}
