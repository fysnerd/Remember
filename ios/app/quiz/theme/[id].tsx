/**
 * Theme Quiz Screen - Mixed questions from all contents of a theme
 */

import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Button } from '../../../components/ui';
import { QuestionCard, AnswerFeedback, QuizSummary } from '../../../components/quiz';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorState } from '../../../components/ErrorState';
import { useThemeQuiz, useSubmitAnswer, useCreateSession, useCompleteSession } from '../../../hooks';
import { colors, spacing, borderRadius } from '../../../theme';

type QuizState = 'question' | 'feedback' | 'summary';

export default function ThemeQuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: quiz, isLoading, error, refetch } = useThemeQuiz(id || '');
  const submitMutation = useSubmitAnswer();
  const createSessionMutation = useCreateSession();
  const completeSessionMutation = useCompleteSession();

  const [state, setState] = useState<QuizState>('question');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Create session when quiz loads
  useEffect(() => {
    if (quiz && !sessionId && !createSessionMutation.isPending) {
      createSessionMutation.mutate({}, {
        onSuccess: (session) => {
          setSessionId(session.id);
        },
      });
    }
  }, [quiz]);

  const answeredCount = state === 'feedback' ? currentIndex + 1 : currentIndex;

  useEffect(() => {
    if (!quiz) return;
    const target = answeredCount / quiz.questions.length;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [answeredCount, quiz?.questions.length]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!quiz || !quiz.questions.length) {
    return <ErrorState message="Aucun quiz pour ce theme" onRetry={refetch} />;
  }

  const questions = quiz.questions;
  const current = questions[currentIndex];
  const total = questions.length;

  const handleValidate = () => {
    if (!selectedAnswer || !sessionId) return;
    const isCorrect = selectedAnswer === current.correctAnswer;
    if (isCorrect) setScore((s) => s + 1);

    submitMutation.mutate({
      cardId: current.id,
      isCorrect,
      responseTime: Date.now() - startTime,
      sessionId,
    });

    setState('feedback');
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setStartTime(Date.now());
      setState('question');
    } else {
      if (sessionId) {
        completeSessionMutation.mutate(sessionId);
      }
      setState('summary');
    }
  };

  const handleQuit = () => router.back();
  const handleViewMemo = () => {
    router.replace({ pathname: '/theme/[id]' as any, params: { id: id! } });
  };
  const handleClose = () => router.replace('/(tabs)');

  if (state === 'summary') {
    return (
      <QuizSummary
        score={score}
        total={total}
        onViewMemo={handleViewMemo}
        onClose={handleClose}
      />
    );
  }

  const correctOption = current.options.find((o) => o.id === current.correctAnswer);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text variant="caption" color="secondary">
            {quiz.theme?.emoji} {quiz.theme?.name}
          </Text>
          <Text variant="body" weight="medium">
            Question {currentIndex + 1}/{total}
          </Text>
        </View>
        <Pressable onPress={handleQuit} hitSlop={8}>
          <Text variant="body">✕ Quitter</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>

      <View style={styles.content}>
        {state === 'question' ? (
          <>
            <QuestionCard
              question={current.question}
              options={current.options}
              selectedId={selectedAnswer}
              onSelect={(optionId) => {
                setSelectedAnswer(optionId);
              }}
              isSynthesis={current.isSynthesis}
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
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceElevated,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
  },
  content: { flex: 1, padding: spacing.lg },
  buttonContainer: { paddingTop: spacing.lg },
});
