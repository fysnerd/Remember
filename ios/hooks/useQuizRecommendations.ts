import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { QuizRecommendation } from '../types/content';

export function useQuizRecommendations() {
  return useQuery({
    queryKey: ['home', 'recommendations'],
    queryFn: async () => {
      const { data } = await api.get<{ recommendations: QuizRecommendation[] }>('/home/recommendations');
      return data.recommendations;
    },
    staleTime: 60_000,
  });
}
