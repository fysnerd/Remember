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
      contentTitle: card.quiz.content?.title || null,
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
      const quiz = transformCardsToQuiz(data.cards, contentId);
      return quiz;
    },
    enabled: !!contentId,
    staleTime: 5 * 60 * 1000, // 5 min — avoid refetch during quiz session
  });
}

// Get quiz for multiple contents (practice mode - mixed questions)
export function useMultiQuiz(contentIds: string[]) {
  const key = contentIds.sort().join(',');
  return useQuery({
    queryKey: ['quiz', 'multi', key],
    queryFn: async () => {
      const { data } = await api.post<PracticeResponse>('/reviews/practice', { contentIds });
      const quiz = transformCardsToQuiz(data.cards, `multi:${key}`);
      return { ...quiz, contentCount: contentIds.length };
    },
    enabled: contentIds.length > 0,
    staleTime: 5 * 60 * 1000,
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
      const quiz = transformCardsToQuiz(data.cards, `topic:${topicName}`);
      return { ...quiz, topicName, contentCount: data.contentCount };
    },
    enabled: !!topicName,
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000, // 5 min — avoid refetch during quiz session
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
      const { data } = await api.post('/reviews', {
        cardId,
        correct: isCorrect,
        responseTime,
        sessionId,
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
  dailyProgress?: {
    completed: number;
    total: number;
    allDone: boolean;
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

// Link a quiz session to a daily recommendation
export function useLinkDailySession() {
  return useMutation({
    mutationFn: async ({ dailyRecId, sessionId }: { dailyRecId: string; sessionId: string }) => {
      const { data } = await api.post(`/home/daily/${dailyRecId}/link-session`, { sessionId });
      return data;
    },
  });
}
