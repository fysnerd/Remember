/**
 * Quiz Session Screen
 *
 * Supports:
 * - Single content: /quiz/[id] (uses useQuiz)
 * - Multi content: /quiz/multi?ids=id1,id2,id3 (uses useMultiQuiz)
 */

import { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Button } from '../../components/ui';
import { QuestionCard, AnswerFeedback, QuizSummary } from '../../components/quiz';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ErrorState } from '../../components/ErrorState';
import { haptics } from '../../lib/haptics';
import { useQuiz, useMultiQuiz, useSubmitAnswer, useCreateSession, useCompleteSession } from '../../hooks';
import { colors, spacing } from '../../theme';

type QuizState = 'question' | 'feedback' | 'summary';

export default function QuizScreen() {
  const { id, ids } = useLocalSearchParams<{ id: string; ids?: string }>();
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

  const submitMutation = useSubmitAnswer();
  const createSessionMutation = useCreateSession();
  const completeSessionMutation = useCompleteSession();

  const [state, setState] = useState<QuizState>('question');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Create session when quiz loads
  useEffect(() => {
    if (quiz && !sessionId && !createSessionMutation.isPending) {
      const params = isMulti
        ? { contentIds }
        : { contentId: id! };
      createSessionMutation.mutate(params, {
        onSuccess: (session) => {
          setSessionId(session.id);
        },
      });
    }
  }, [quiz, id, isMulti]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!quiz || !quiz.questions.length) {
    return <ErrorState message="Quiz introuvable" onRetry={refetch} />;
  }

  const questions = quiz.questions;
  const current = questions[currentIndex];
  const total = questions.length;

  const handleValidate = () => {
    if (!selectedAnswer || !sessionId) return;
    haptics.medium();
    const isCorrect = selectedAnswer === current.correctAnswer;
    if (isCorrect) setScore((s) => s + 1);

    submitMutation.mutate({
      cardId: current.id,
      isCorrect,
      responseTime: Date.now() - startTime,
      sessionId,
    });

    setState('feedback');
    setTimeout(() => isCorrect ? haptics.success() : haptics.error(), 300);
  };

  const handleNext = () => {
    haptics.light();
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setStartTime(Date.now());
      setState('question');
    } else {
      // Complete the session before showing summary
      if (sessionId) {
        completeSessionMutation.mutate(sessionId);
      }
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="body" weight="medium">
          Question {currentIndex + 1}/{total}
        </Text>
        <Pressable onPress={handleQuit} hitSlop={8}>
          <Text variant="body">✕ Quitter</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {state === 'question' ? (
          <>
            <QuestionCard
              question={current.question}
              options={current.options}
              selectedId={selectedAnswer}
              onSelect={(optionId) => {
                haptics.selection();
                setSelectedAnswer(optionId);
              }}
            />
            <View style={styles.buttonContainer}>
              <Button
                variant="primary"
                fullWidth
                onPress={handleValidate}
                disabled={!selectedAnswer || !sessionId}
                loading={submitMutation.isPending}
              >
                Valider
              </Button>
            </View>
          </>
        ) : (
          <>
            <AnswerFeedback
              isCorrect={selectedAnswer === current.correctAnswer}
              correctAnswer={correctOption?.text ?? ''}
              explanation={current.explanation}
            />
            <View style={styles.buttonContainer}>
              <Button variant="primary" fullWidth onPress={handleNext}>
                {currentIndex < total - 1 ? 'Question suivante' : 'Voir le resultat'}
              </Button>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  content: { flex: 1, padding: spacing.lg },
  buttonContainer: { paddingTop: spacing.lg },
});
