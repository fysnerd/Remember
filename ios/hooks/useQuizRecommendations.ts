import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { QuizRecommendation, DailyProgress } from '../types/content';

interface RecommendationsResponse {
  recommendations: QuizRecommendation[];
  dailyProgress: DailyProgress;
}

export function useQuizRecommendations() {
  return useQuery({
    queryKey: ['home', 'recommendations'],
    queryFn: async () => {
      const { data } = await api.get<RecommendationsResponse>('/home/recommendations');
      return data;
    },
    staleTime: 5 * 60_000, // 5 min (recos are fixed for the day)
  });
}
