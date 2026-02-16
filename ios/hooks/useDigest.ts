/**
 * Digest hooks - daily digest card fetching
 */

import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';

// ============================================================================
// Types
// ============================================================================

export interface DigestCard {
  id: string; // card.id
  quiz: {
    id: string;
    question: string;
    options: string[] | Record<string, string>;
    correctAnswer: string;
    explanation: string;
    content: { id: string; title: string; url: string; platform: string } | null;
    isSynthesis?: boolean;
    theme?: { id: string; name: string };
  };
}

export interface DigestResponse {
  cards: DigestCard[];
  count: number;
  session: { id: string } | null;
  reason?: string;
  stats: { dueCount: number; newCount: number };
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch daily digest cards via mutation.
 * Uses useMutation (not useQuery) because the endpoint creates a QuizSession
 * as a side effect. This prevents accidental re-fetches from creating duplicate sessions.
 */
export function useDigestCards() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<DigestResponse>('/reviews/digest');
      return data;
    },
  });
}
