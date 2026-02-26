/**
 * Daily Digest Session Screen
 *
 * Full-screen quiz flow: loading -> question -> feedback -> closure.
 * Uses useDigestCards mutation to fetch cards (creates QuizSession server-side).
 * Tracks score, streak, and duration client-side for cognitive closure display.
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { Text, Button } from '../components/ui';
import { QuestionCard } from '../components/quiz/QuestionCard';
import { AnswerFeedback } from '../components/quiz/AnswerFeedback';
import { ProgressBar } from '../components/digest/ProgressBar';
import { DigestClosure } from '../components/digest/DigestClosure';
import { LoadingScreen } from '../components/LoadingScreen';
import { haptics } from '../lib/haptics';
import { useDigestCards, useSubmitAnswer, useCompleteSession } from '../hooks';
import { colors, spacing } from '../theme';
import type { DigestCard } from '../hooks';

// ============================================================================
// Option normalization (same logic as quiz/[id].tsx)
// ============================================================================

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

interface NormalizedOption {
  id: string;
  text: string;
}

function normalizeOptions(options: string[] | Record<string, string>): NormalizedOption[] {
  if (Array.isArray(options)) {
    return options.map((text, index) => ({
      id: OPTION_LABELS[index] || String(index),
      text,
    }));
  }
  return Object.entries(options).map(([key, text]) => ({
    id: key,
    text: text as string,
  }));
}

// ============================================================================
// Screen
// ============================================================================

type DigestPhase = 'loading' | 'question' | 'feedback' | 'closure';

export default function DigestScreen() {
  const router = useRouter();
  const digestMutation = useDigestCards();
  const submitAnswer = useSubmitAnswer();
  const completeSession = useCompleteSession();

  // State machine
  const [phase, setPhase] = useState<DigestPhase>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  // Fetch digest cards on mount
  useEffect(() => {
    digestMutation.mutate();
  }, []);

  // Transition to question phase when data arrives
  useEffect(() => {
    if (digestMutation.data) {
      const { cards, session } = digestMutation.data;
      if (cards.length > 0 && session) {
        setPhase('question');
        setQuestionStartTime(Date.now());
      }
    }
  }, [digestMutation.data]);

  // Derived state
  const cards: DigestCard[] = digestMutation.data?.cards ?? [];
  const sessionId = digestMutation.data?.session?.id ?? null;
  const currentCard = cards[currentIndex];

  // ========================================================================
  // Handlers
  // ========================================================================

  const handleValidate = () => {
    if (!selectedAnswer || !sessionId || !currentCard) return;

    haptics.medium();

    const options = normalizeOptions(currentCard.quiz.options);
    const correctOption = options.find((o) => o.id === currentCard.quiz.correctAnswer);
    const correct = selectedAnswer === currentCard.quiz.correctAnswer;

    setIsCorrect(correct);

    // Update streak and score
    if (correct) {
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setScore((prev) => prev + 1);
    } else {
      setCurrentStreak(0);
    }

    // Submit to backend
    submitAnswer.mutate({
      cardId: currentCard.id,
      isCorrect: correct,
      responseTime: Date.now() - questionStartTime,
      sessionId,
    });

    setPhase('feedback');
    setTimeout(() => (correct ? haptics.success() : haptics.error()), 300);
  };

  const handleNext = () => {
    haptics.light();

    if (currentIndex < cards.length - 1) {
      // Next question
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setQuestionStartTime(Date.now());
      setPhase('question');
    } else {
      // Last question -> closure
      if (sessionId) {
        completeSession.mutate(sessionId);
      }
      setPhase('closure');
    }
  };

  const handleQuit = () => router.back();

  // ========================================================================
  // Render: Loading
  // ========================================================================

  if (phase === 'loading') {
    if (digestMutation.isPending) {
      return <LoadingScreen />;
    }

    // Error state
    if (digestMutation.isError) {
      return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.emptyContainer}>
            <Text variant="h3" style={styles.emptyText}>
              Erreur de chargement
            </Text>
            <Button variant="primary" onPress={() => digestMutation.mutate()}>
              Réessayer
            </Button>
            <Button variant="outline" onPress={handleQuit}>
              Retour
            </Button>
          </View>
        </SafeAreaView>
      );
    }

    // Empty state (no cards due)
    if (digestMutation.data && (cards.length === 0 || !sessionId)) {
      return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.emptyContainer}>
            <Text variant="h3" style={styles.emptyText}>
              Rien à réviser aujourd'hui !
            </Text>
            <Text variant="body" color="secondary" style={styles.emptySubtext}>
              Reviens demain pour de nouvelles questions.
            </Text>
            <Button variant="primary" onPress={handleQuit}>
              Retour
            </Button>
          </View>
        </SafeAreaView>
      );
    }

    return <LoadingScreen />;
  }

  // ========================================================================
  // Render: Closure
  // ========================================================================

  if (phase === 'closure') {
    return (
      <DigestClosure
        score={score}
        total={cards.length}
        bestStreak={bestStreak}
        durationMs={Date.now() - sessionStartTime}
        onClose={handleQuit}
      />
    );
  }

  // ========================================================================
  // Render: Question & Feedback
  // ========================================================================

  if (!currentCard) return <LoadingScreen />;

  const options = normalizeOptions(currentCard.quiz.options);
  const correctOption = options.find((o) => o.id === currentCard.quiz.correctAnswer);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header: quit button + progress */}
      <View style={styles.header}>
        <Pressable onPress={handleQuit} hitSlop={8} style={styles.quitButton}>
          <X size={20} color={colors.textSecondary} />
          <Text variant="body" color="secondary">
            Quitter
          </Text>
        </Pressable>
      </View>

      <View style={styles.progressContainer}>
        <ProgressBar current={currentIndex} total={cards.length} />
      </View>

      {/* Content area */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {phase === 'question' ? (
          <>
            <QuestionCard
              question={currentCard.quiz.question}
              options={options}
              selectedId={selectedAnswer}
              onSelect={(optionId) => {
                haptics.selection();
                setSelectedAnswer(optionId);
              }}
              isSynthesis={currentCard.quiz.isSynthesis}
            />
            <View style={styles.buttonContainer}>
              <Button
                variant="primary"
                fullWidth
                onPress={handleValidate}
                disabled={!selectedAnswer || !sessionId}
                loading={submitAnswer.isPending}
              >
                Valider
              </Button>
            </View>
          </>
        ) : (
          <>
            <AnswerFeedback
              isCorrect={isCorrect}
              correctAnswer={correctOption?.text ?? ''}
              explanation={currentCard.quiz.explanation}
            />
            <View style={styles.buttonContainer}>
              <Button variant="primary" fullWidth onPress={handleNext}>
                {currentIndex < cards.length - 1 ? 'Suivant' : 'Voir le résultat'}
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  quitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  buttonContainer: {
    paddingTop: spacing.lg,
  },
});
