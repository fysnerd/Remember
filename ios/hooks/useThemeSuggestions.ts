import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export interface ThemeSuggestion {
  name: string;
  emoji: string;
  description: string;
}

interface SuggestionsResponse {
  suggestions: ThemeSuggestion[];
  fallback: boolean;
}

export function useThemeSuggestions() {
  return useQuery({
    queryKey: ['themes', 'suggestions'],
    queryFn: async () => {
      const { data } = await api.get<SuggestionsResponse>('/themes/suggestions');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes -- suggestions don't change fast
  });
}
