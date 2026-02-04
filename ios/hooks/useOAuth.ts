/**
 * OAuth hooks - platform status, refresh
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { OAuthStatus } from '../types/content';

// Get OAuth status for all platforms
export function useOAuthStatus() {
  return useQuery({
    queryKey: ['oauth', 'status'],
    queryFn: async () => {
      const { data } = await api.get<OAuthStatus>('/oauth/status');
      return data;
    },
  });
}

// Refresh content after OAuth connection
export function useRefreshContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/content/refresh');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['oauth'] });
    },
  });
}
