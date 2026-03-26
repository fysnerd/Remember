/**
 * Digest hooks - daily digest card fetching with interleaved session modes
 */

import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';

// ============================================================================
// Types
// ============================================================================

export type DigestMode = 'quick' | 'daily' | 'deep';

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
  mode: DigestMode;
  stats: {
    dueCount: number;
    newCount: number;
    warmupCount: number;
    coreCount: number;
  };
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch digest cards via mutation.
 * Uses useMutation (not useQuery) because the endpoint creates a QuizSession
 * as a side effect. This prevents accidental re-fetches from creating duplicate sessions.
 *
 * @param mode - 'quick' (3-5 cards), 'daily' (8-12 cards), 'deep' (15-20 cards)
 */
export function useDigestCards() {
  return useMutation({
    mutationFn: async (mode: DigestMode = 'daily') => {
      const { data } = await api.post<DigestResponse>('/reviews/digest', { mode });
      return data;
    },
  });
}
