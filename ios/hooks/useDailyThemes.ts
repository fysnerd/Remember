import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { ThemeListItem } from '../types/content';

export function useDailyThemes() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['themes', 'daily'],
    queryFn: async () => {
      const { data } = await api.get<{ themes: ThemeListItem[] }>('/themes/daily');
      return data.themes;
    },
    staleTime: 60 * 1000, // 1 minute -- re-fetch after reviews
  });

  return { data, isLoading, error };
}
