/**
 * Channels hook - unique channel names from user's content
 */

import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface ChannelResponse {
  name: string;
  count: number;
}

// Get unique channel names (creators) from user's content
export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data } = await api.get<ChannelResponse[]>('/content/channels');
      return data;
    },
  });
}
