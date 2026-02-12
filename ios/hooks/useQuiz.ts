/**
 * Quiz hooks - session, submit answer
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Quiz, Question } from '../types/content';

// Backend card response structure
interface BackendCard {
  id: string;
  quiz: {
    id: string;
    question: string;
    options: string[] | Record<string, string>; // Array ["A) text", ...] or Object { "A": "text", ... }
    correctAnswer: string;
    explanation: string;
    content: {
      id: string;
      title: string;
    } | null;
    isSynthesis?: boolean;
    theme?: { id: string; name: string };
  };
}

interface PracticeResponse {
  cards: BackendCard[];
  count: number;
  content: {
    id: string;
    title: string;
  };
}

interface SessionResponse {
  session: {
    id: string;
    mode: string;
  };
  matchingCardsCount: number;
}

interface SessionCardsResponse {
  cards: BackendCard[];
  count: number;
  session: {
    id: string;
  };
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

// Transform backend cards to frontend Quiz format
function transformCardsToQuiz(cards: BackendCard[], contentId: string): Quiz {
  const questions: Question[] = cards.map((card) => {
    // Handle both array and object formats for options
    let options: { id: string; text: string }[];

    if (Array.isArray(card.quiz.options)) {
      // Array format: ["A) text1", "B) text2", ...]
      options = card.quiz.options.map((text, index) => ({
        id: OPTION_LABELS[index] || String(index),
        text: text,
      }));
    } else {
      // Object format: { "A": "text1", "B": "text2", ... }
      options = Object.entries(card.quiz.options).map(([key, text]) => ({
        id: key,
        text: text as string,
      }));
    }

    return {
      id: card.id,
      question: card.quiz.question,
      options,
      correctAnswer: card.quiz.correctAnswer,
      explanation: card.quiz.explanation || '',
      isSynthesis: card.quiz.isSynthesis || false,
    };
  });

  return {
    id: contentId,
    contentId,
    questions,
  };
}

// Get quiz for content (uses practice endpoint for cards, but we'll track with session)
export function useQuiz(contentId: string) {
  return useQuery({
    queryKey: ['quiz', contentId],
    queryFn: async () => {
      const { data } = await api.post<PracticeResponse>('/reviews/practice', { contentId });
      console.log('[useQuiz] Raw backend data:', JSON.stringify(data.cards[0]?.quiz, null, 2));
      const quiz = transformCardsToQuiz(data.cards, contentId);
      console.log('[useQuiz] Transformed quiz:', JSON.stringify(quiz.questions[0], null, 2));
      return quiz;
    },
    enabled: !!contentId,
  });
}

interface TopicPracticeResponse {
  cards: BackendCard[];
  count: number;
  topic: string;
  contentCount: number;
}

// Get quiz for a topic (mixed questions from all contents with that topic)
export function useTopicQuiz(topicName: string) {
  return useQuery({
    queryKey: ['quiz', 'topic', topicName],
    queryFn: async () => {
      const { data } = await api.post<TopicPracticeResponse>('/reviews/practice/topic', { topicName });
      console.log('[useTopicQuiz] Got', data.count, 'cards from', data.contentCount, 'contents');
      const quiz = transformCardsToQuiz(data.cards, `topic:${topicName}`);
      return { ...quiz, topicName, contentCount: data.contentCount };
    },
    enabled: !!topicName,
  });
}

interface ThemePracticeResponse {
  cards: BackendCard[];
  count: number;
  theme: { id: string; name: string; emoji: string };
  contentCount: number;
  hasSynthesis?: boolean;
  synthesisCount?: number;
}

// Get quiz for a theme (mixed questions from all contents in that theme)
export function useThemeQuiz(themeId: string) {
  return useQuery({
    queryKey: ['quiz', 'theme', themeId],
    queryFn: async () => {
      const { data } = await api.post<ThemePracticeResponse>('/reviews/practice/theme', { themeId });
      console.log('[useThemeQuiz] Got', data.count, 'cards from', data.contentCount, 'contents');
      const quiz = transformCardsToQuiz(data.cards, `theme:${themeId}`);
      return {
        ...quiz,
        theme: data.theme,
        contentCount: data.contentCount,
        hasSynthesis: data.hasSynthesis || false,
        synthesisCount: data.synthesisCount || 0,
      };
    },
    enabled: !!themeId,
  });
}

interface CreateSessionParams {
  contentId?: string;
  contentIds?: string[];
  topicName?: string;
}

// Create a quiz session (for content, multiple contents, or topic)
export function useCreateSession() {
  return useMutation({
    mutationFn: async ({ contentId, contentIds, topicName }: CreateSessionParams) => {
      const payload: any = { mode: 'practice' };

      if (contentIds && contentIds.length > 0) {
        payload.contentIds = contentIds;
      } else if (contentId) {
        payload.contentIds = [contentId];
      }

      const { data } = await api.post<SessionResponse>('/reviews/session', payload);
      console.log('[useCreateSession] Created session:', data.session.id);
      return data.session;
    },
  });
}

interface SubmitAnswerParams {
  cardId: string;
  isCorrect: boolean;
  responseTime: number;
  sessionId: string;
}

// Submit quiz answer with session tracking
export function useSubmitAnswer() {
  return useMutation({
    mutationFn: async ({ cardId, isCorrect, responseTime, sessionId }: SubmitAnswerParams) => {
      const rating = isCorrect ? 'GOOD' : 'AGAIN';

      const { data } = await api.post('/reviews', {
        cardId,
        rating,
        responseTime,
        sessionId,
        // Note: no isPractice flag, so it gets tracked
      });
      return data;
    },
  });
}

interface CompleteSessionResponse {
  session: {
    id: string;
    completedAt: string;
    totalCount: number;
    correctCount: number;
  };
  stats: {
    totalCount: number;
    correctCount: number;
    accuracy: number;
  };
}

// Complete a quiz session
export function useCompleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await api.post<CompleteSessionResponse>(
        `/reviews/session/${sessionId}/complete`
      );
      console.log('[useCompleteSession] Session completed:', data.stats);
      return data;
    },
    onSuccess: () => {
      // Invalidate reviews to refresh history
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      // Refresh daily themes so due card counts update after quiz session
      queryClient.invalidateQueries({ queryKey: ['themes', 'daily'] });
      // Refresh home recommendations after quiz completion
      queryClient.invalidateQueries({ queryKey: ['home', 'recommendations'] });
    },
  });
}
