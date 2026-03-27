/**
 * Quiz Session Screen
 *
 * Supports:
 * - Single content: /quiz/[id] (uses useQuiz)
 * - Multi content: /quiz/multi?ids=id1,id2,id3 (uses useMultiQuiz)
 */

import { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, Button } from '../../components/ui';
import { GlassButton } from '../../components/glass/GlassButton';
import { QuestionCard, AnswerFeedback, QuizSummary } from '../../components/quiz';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { haptics } from '../../lib/haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useQuiz, useMultiQuiz, useSubmitAnswer, useCreateSession, useCompleteSession, useLinkDailySession, prefetchMemo } from '../../hooks';
import { colors, spacing, borderRadius } from '../../theme';

type QuizState = 'question' | 'feedback' | 'summary';

export default function QuizScreen() {
  const { t } = useTranslation();
  const { id, ids, dailyRecId } = useLocalSearchParams<{ id: string; ids?: string; dailyRecId?: string }>();
  const router = useRouter();

  // Parse multi-content IDs if provided
  const contentIds = useMemo(() => {
    if (ids) return ids.split(',').filter(Boolean);
    return [];
  }, [ids]);
  const isMulti = contentIds.length > 1;

  // Use appropriate hook based on mode
  const singleQuiz = useQuiz(isMulti ? '' : id!);
  const multiQuiz = useMultiQuiz(isMulti ? contentIds : []);
  const quiz = isMulti ? multiQuiz.data : singleQuiz.data;
  const isLoading = isMulti ? multiQuiz.isLoading : singleQuiz.isLoading;
  const refetch = isMulti ? multiQuiz.refetch : singleQuiz.refetch;

  const queryClient = useQueryClient();
  const submitMutation = useSubmitAnswer();
  const createSessionMutation = useCreateSession();
  const completeSessionMutation = useCompleteSession();
  const linkDailyMutation = useLinkDailySession();

  // Prefetch memo as soon as quiz loads so it's instant when user finishes
  useEffect(() => {
    if (!isMulti && id) {
      prefetchMemo(queryClient, id);
    }
  }, [id, isMulti]);

  const [state, setState] = useState<QuizState>('question');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [results, setResults] = useState<(boolean | null)[]>([]);

  // Initialize results array when quiz loads
  useEffect(() => {
    if (quiz && results.length === 0) {
      setResults(new Array(quiz.questions.length).fill(null));
    }
  }, [quiz]);

  // Create session when quiz loads
  useEffect(() => {
    if (quiz && !sessionId && !createSessionMutation.isPending) {
      const params = isMulti
        ? { contentIds }
        : { contentId: id! };
      createSessionMutation.mutate(params, {
        onSuccess: (session) => {
          setSessionId(session.id);
          // Link session to daily recommendation if applicable
          if (dailyRecId) {
            linkDailyMutation.mutate({ dailyRecId, sessionId: session.id });
          }
        },
      });
    }
  }, [quiz, id, isMulti]);


  const headerOptions = { title: '', headerBackTitle: t('common.back'), headerShadowVisible: false, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text };

  if (isLoading) {
    return (<><Stack.Screen options={headerOptions} /><LoadingScreen /></>);
  }

  if (!quiz || !quiz.questions.length) {
    return (<><Stack.Screen options={headerOptions} /><ErrorState message={t('errors.quizNotFound')} onRetry={refetch} /></>);
  }

  const questions = quiz.questions;
  const current = questions[currentIndex];
  const total = questions.length;

  const handleValidate = () => {
    if (!selectedAnswer || !sessionId) return;
    haptics.heavy();
    const isCorrect = selectedAnswer === current.correctAnswer;
    if (isCorrect) setScore((s) => s + 1);
    setResults((prev) => {
      const next = [...prev];
      next[currentIndex] = isCorrect;
      return next;
    });

    submitMutation.mutate({
      cardId: current.id,
      isCorrect,
      responseTime: Date.now() - startTime,
      sessionId,
    });

    setState('feedback');
    setTimeout(() => isCorrect ? haptics.success() : haptics.doubleError(), 250);
  };

  const handleNext = () => {
    haptics.medium();
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setStartTime(Date.now());
      setState('question');
    } else {
      // Complete the session before showing summary
      if (sessionId) {
        completeSessionMutation.mutate(sessionId, {
          onSuccess: (data) => {
            if (data.dailyProgress?.allDone) {
              haptics.celebration();
            }
          },
        });
      }
      haptics.celebration();
      setState('summary');
    }
  };

  const handleQuit = () => router.back();
  const handleViewMemo = () => {
    if (isMulti) {
      router.replace('/(tabs)');
    } else {
      router.replace(`/memo/${id}`);
    }
  };
  const handleClose = () => router.replace('/(tabs)');

  if (state === 'summary') {
    return (
      <QuizSummary score={score} total={total} onViewMemo={handleViewMemo} onClose={handleClose} />
    );
  }

  const correctOption = current.options.find((o) => o.id === current.correctAnswer);
  const isCorrect = selectedAnswer === current.correctAnswer;

  const feedbackBg = state === 'feedback'
    ? isCorrect ? '#060F09' : '#120808'
    : undefined;

  return (
    <View style={[styles.container, feedbackBg && { backgroundColor: feedbackBg }]}>
      <View style={styles.header}>
        <GlassButton size="sm" onPress={handleQuit}>
          ✕ {t('quiz.quit')}
        </GlassButton>
      </View>

      <View style={styles.progressTrack}>
        {results.map((result, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              i === 0 && styles.progressSegmentFirst,
              i === results.length - 1 && styles.progressSegmentLast,
              result === true && styles.progressCorrect,
              result === false && styles.progressIncorrect,
              result === null && i === currentIndex && styles.progressCurrent,
            ]}
          />
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
        {state === 'question' ? (
          <QuestionCard
            question={current.question}
            options={current.options}
            selectedId={selectedAnswer}
            current={currentIndex + 1}
            total={total}
            contentTitle={current.contentTitle}
            onSelect={(optionId) => {
              haptics.selection();
              setSelectedAnswer(optionId);
            }}
          />
        ) : (
          <AnswerFeedback
            isCorrect={selectedAnswer === current.correctAnswer}
            correctAnswer={correctOption?.text ?? ''}
            explanation={current.explanation}
          />
        )}
      </ScrollView>
      <View style={styles.buttonContainer}>
        {state === 'question' ? (
          <Button
            variant="primary"
            fullWidth
            onPress={handleValidate}
            disabled={!selectedAnswer || !sessionId}
            loading={submitMutation.isPending}
          >
            {t('quiz.validate')}
          </Button>
        ) : (
          <Button variant="primary" fullWidth onPress={handleNext}>
            {currentIndex < total - 1 ? t('quiz.nextQuestion') : t('quiz.seeResult')}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  progressTrack: {
    flexDirection: 'row' as const,
    height: 6,
    marginHorizontal: spacing.lg,
    gap: 3,
  },
  progressSegment: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
  },
  progressSegmentFirst: {
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  progressSegmentLast: {
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  progressCorrect: {
    backgroundColor: colors.success,
  },
  progressIncorrect: {
    backgroundColor: colors.error,
  },
  progressCurrent: {
    backgroundColor: colors.accent,
  },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  contentInner: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  buttonContainer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.md },
});
