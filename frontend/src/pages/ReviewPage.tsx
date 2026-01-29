import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Flame, Target, Clock, ArrowLeft, Keyboard, Brain, Sparkles, Trophy, Star, Zap } from 'lucide-react';
import { api } from '../lib/api';

interface Quiz {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  content: {
    title: string;
    url: string;
    platform: string;
  };
}

interface Card {
  id: string;
  quiz: Quiz;
  interval: number;
  repetitions: number;
}

interface DueCardsResponse {
  cards: Card[];
  count: number;
  stats: {
    reviewDue: number;
    newDue: number;
    newCardsToday: number;
    newCardsLimit: number;
    remainingNewToday: number;
  };
}

interface ReviewStats {
  dueToday: number;
  reviewDue: number;
  newDue: number;
  newCardsToday: number;
  newCardsLimit: number;
  remainingNewToday: number;
  totalCards: number;
  currentStreak: number;
  longestStreak: number;
  reviewsLast7Days: number;
}

type Rating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

interface SessionStats {
  again: number;
  hard: number;
  good: number;
  easy: number;
  startTime: number;
}

interface StreakInfo {
  current: number;
  longest: number;
  milestone: number | null;
  isNewRecord: boolean;
}

export function ReviewPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    startTime: Date.now(),
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [milestoneToShow, setMilestoneToShow] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<DueCardsResponse>({
    queryKey: ['due-cards'],
    queryFn: async () => {
      const res = await api.get<DueCardsResponse>('/reviews/due');
      return res.data;
    },
  });

  const { data: stats } = useQuery<ReviewStats>({
    queryKey: ['review-stats'],
    queryFn: async () => {
      const res = await api.get<ReviewStats>('/reviews/stats');
      return res.data;
    },
  });

  const submitReview = useMutation({
    mutationFn: async ({ cardId, rating }: { cardId: string; rating: Rating }) => {
      return api.post<{ streak: StreakInfo }>('/reviews', { cardId, rating });
    },
    onSuccess: (response, variables) => {
      setSessionStats((prev) => ({
        ...prev,
        [variables.rating.toLowerCase()]: prev[variables.rating.toLowerCase() as keyof SessionStats] + 1,
      }));

      const streak = response.data.streak;
      if (streak?.milestone) {
        setMilestoneToShow(streak.milestone);
      } else if (streak?.isNewRecord && streak.current > 1) {
        setIsNewRecord(true);
      }

      setShowAnswer(false);
      setSelectedOption(null);

      if (data && currentIndex < data.cards.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setSessionComplete(true);
        queryClient.invalidateQueries({ queryKey: ['due-cards'] });
        queryClient.invalidateQueries({ queryKey: ['review-stats'] });
      }
    },
  });

  const handleRating = useCallback((rating: Rating) => {
    if (!data || submitReview.isPending) return;
    const card = data.cards[currentIndex];
    submitReview.mutate({ cardId: card.id, rating });
  }, [data, currentIndex, submitReview]);

  const handleRevealAnswer = useCallback(() => {
    setShowAnswer(true);
  }, []);

  const handleSelectOption = useCallback((index: number) => {
    if (!showAnswer) {
      setSelectedOption(index);
    }
  }, [showAnswer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (!showAnswer) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleRevealAnswer();
        }
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          handleSelectOption(parseInt(e.key) - 1);
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          handleRating('AGAIN');
        } else if (e.key === '2') {
          e.preventDefault();
          handleRating('HARD');
        } else if (e.key === '3') {
          e.preventDefault();
          handleRating('GOOD');
        } else if (e.key === '4') {
          e.preventDefault();
          handleRating('EASY');
        }
      }

      if (e.code === 'Escape') {
        setSessionComplete(true);
      }

      if (e.key === '?') {
        setShowShortcuts((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAnswer, handleRating, handleRevealAnswer, handleSelectOption]);

  const getSessionDuration = () => {
    const ms = Date.now() - sessionStats.startTime;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const totalReviewed = sessionStats.again + sessionStats.hard + sessionStats.good + sessionStats.easy;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-void flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber/20 flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
            <Brain size={32} className="text-amber" />
          </div>
          <p className="text-cream-muted">Preparing your neural training...</p>
        </div>
      </div>
    );
  }

  // Session complete - show summary
  if (sessionComplete || !data?.cards.length) {
    return (
      <div className="fixed inset-0 bg-void flex items-center justify-center p-8">
        {/* Ambient glows */}
        <div className="fixed top-20 right-20 w-64 h-64 bg-amber/10 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-20 left-20 w-48 h-48 bg-sage/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full relative">
          <div className="card animate-scale-in">
            {totalReviewed > 0 ? (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-sage to-sage-dark rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow">
                  <Target className="w-10 h-10 text-void" />
                </div>
                <h2 className="text-3xl font-display text-cream mb-2 text-center">
                  Session Complete
                </h2>
                <p className="text-cream-muted text-center mb-8">
                  Neural pathways strengthened. You reviewed {totalReviewed} card{totalReviewed !== 1 ? 's' : ''}.
                </p>

                {/* Session Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-void-50 border border-void-200 rounded-xl p-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-cream-muted" />
                      <span className="text-sm text-cream-muted">Duration</span>
                    </div>
                    <p className="text-2xl font-display text-cream text-center">{getSessionDuration()}</p>
                  </div>
                  <div className="bg-void-50 border border-void-200 rounded-xl p-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Flame className="w-4 h-4 text-amber" />
                      <span className="text-sm text-cream-muted">Streak</span>
                    </div>
                    <p className="text-2xl font-display text-cream text-center">{stats?.currentStreak || 0} days</p>
                  </div>
                </div>

                {/* Rating breakdown */}
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  {sessionStats.again > 0 && (
                    <span className="px-3 py-1.5 bg-rust/20 text-rust border border-rust/30 rounded-lg text-sm">
                      Again: {sessionStats.again}
                    </span>
                  )}
                  {sessionStats.hard > 0 && (
                    <span className="px-3 py-1.5 bg-amber/20 text-amber border border-amber/30 rounded-lg text-sm">
                      Hard: {sessionStats.hard}
                    </span>
                  )}
                  {sessionStats.good > 0 && (
                    <span className="px-3 py-1.5 bg-sage/20 text-sage border border-sage/30 rounded-lg text-sm">
                      Good: {sessionStats.good}
                    </span>
                  )}
                  {sessionStats.easy > 0 && (
                    <span className="px-3 py-1.5 bg-info/20 text-info border border-info/30 rounded-lg text-sm">
                      Easy: {sessionStats.easy}
                    </span>
                  )}
                </div>

                <p className="text-sm text-cream-dark text-center mb-6">
                  Return tomorrow to maintain your streak.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-amber to-amber-dark rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-void" />
                </div>
                <h2 className="text-3xl font-display text-cream mb-2 text-center">
                  All Caught Up
                </h2>
                {stats && stats.newDue > 0 && stats.remainingNewToday === 0 ? (
                  <div className="mb-6 text-center">
                    <p className="text-cream-muted mb-2">
                      You've reached your daily limit of {stats.newCardsLimit} new cards.
                    </p>
                    <p className="text-sm text-cream-dark">
                      {stats.newDue} new cards waiting for tomorrow.
                    </p>
                  </div>
                ) : (
                  <p className="text-cream-muted text-center mb-6">
                    No cards due right now. Your neural archive is up to date.
                  </p>
                )}
              </>
            )}

            <Link to="/" className="btn-primary w-full flex items-center justify-center gap-2">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const card = data.cards[currentIndex];
  const progress = ((currentIndex + 1) / data.cards.length) * 100;

  return (
    <div className="fixed inset-0 bg-void flex flex-col">
      {/* Header */}
      <div className="bg-void-50 border-b border-void-200 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-cream-muted hover:text-cream flex items-center gap-2 transition-colors"
              >
                <ArrowLeft size={18} />
                <span className="text-sm">Exit</span>
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-sm text-cream-muted">
                  {currentIndex + 1} of {data.cards.length}
                </span>
                {card.repetitions === 0 && (
                  <span className="px-2.5 py-1 bg-amber/20 text-amber border border-amber/30 text-xs rounded-lg font-medium">
                    New
                  </span>
                )}
                {data.stats && (
                  <span className="text-xs text-cream-dark">
                    ({data.stats.newCardsToday}/{data.stats.newCardsLimit} new today)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowShortcuts((prev) => !prev)}
                className="text-cream-dark hover:text-cream transition-colors"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard size={18} />
              </button>
              {stats && (
                <div className="flex items-center gap-1.5 text-amber">
                  <Flame size={18} />
                  <span className="text-sm font-medium">{stats.currentStreak}</span>
                </div>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="modal-backdrop" onClick={() => setShowShortcuts(false)}>
          <div className="modal-content max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-display text-cream mb-6">Keyboard Shortcuts</h3>
            <div className="space-y-3 text-sm">
              {[
                { action: 'Reveal answer', key: 'Space' },
                { action: 'Rate: Again', key: '1' },
                { action: 'Rate: Hard', key: '2' },
                { action: 'Rate: Good', key: '3' },
                { action: 'Rate: Easy', key: '4' },
                { action: 'Exit session', key: 'Esc' },
              ].map(({ action, key }) => (
                <div key={action} className="flex justify-between items-center">
                  <span className="text-cream-muted">{action}</span>
                  <kbd className="px-3 py-1.5 bg-void-200 border border-void-300 rounded-lg text-xs text-cream font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="mt-6 w-full btn-secondary text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Milestone celebration modal */}
      {milestoneToShow && (
        <div className="modal-backdrop" onClick={() => setMilestoneToShow(null)}>
          <div className="modal-content max-w-sm p-8 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-20 h-20 bg-gradient-to-br from-amber to-amber-dark rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
              {milestoneToShow >= 100 ? (
                <Trophy size={40} className="text-void" />
              ) : milestoneToShow >= 30 ? (
                <Star size={40} className="text-void" />
              ) : (
                <Flame size={40} className="text-void" />
              )}
            </div>
            <h3 className="text-3xl font-display text-cream mb-2">
              {milestoneToShow} Day Streak!
            </h3>
            <p className="text-cream-muted mb-8">
              {milestoneToShow >= 100
                ? 'Legendary dedication! Your neural archive is unmatched.'
                : milestoneToShow >= 30
                ? 'Remarkable consistency! Knowledge is becoming wisdom.'
                : 'Building strong neural pathways. Keep going!'}
            </p>
            <button
              onClick={() => setMilestoneToShow(null)}
              className="btn-primary"
            >
              Continue Training
            </button>
          </div>
        </div>
      )}

      {/* New record celebration */}
      {isNewRecord && !milestoneToShow && (
        <div className="modal-backdrop" onClick={() => setIsNewRecord(false)}>
          <div className="modal-content max-w-sm p-8 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-20 h-20 bg-gradient-to-br from-sage to-sage-dark rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
              <Zap size={40} className="text-void" />
            </div>
            <h3 className="text-3xl font-display text-cream mb-2">
              New Personal Best!
            </h3>
            <p className="text-cream-muted mb-8">
              You've surpassed your previous record. The archive grows stronger.
            </p>
            <button
              onClick={() => setIsNewRecord(false)}
              className="btn-primary"
            >
              Outstanding!
            </button>
          </div>
        </div>
      )}

      {/* Card content */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
        <div className="max-w-2xl w-full">
          <div className="card animate-fade-in">
            {/* Question */}
            <h2 className="text-xl font-display text-cream mb-8 text-center leading-relaxed">
              {card.quiz.question}
            </h2>

            {/* Options */}
            <div className="space-y-3 mb-8">
              {card.quiz.options.map((option, idx) => {
                const optionLetter = option.charAt(0);
                const isCorrect = showAnswer && optionLetter === card.quiz.correctAnswer;
                const isSelected = selectedOption === idx;
                const isWrong = showAnswer && isSelected && !isCorrect;

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    disabled={showAnswer}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                      showAnswer
                        ? isCorrect
                          ? 'border-sage bg-sage/10'
                          : isWrong
                          ? 'border-rust bg-rust/10'
                          : 'border-void-200 opacity-50'
                        : isSelected
                        ? 'border-amber bg-amber/10'
                        : 'border-void-200 hover:border-void-300 hover:bg-void-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium transition-colors ${
                          showAnswer
                            ? isCorrect
                              ? 'bg-sage text-void'
                              : isWrong
                              ? 'bg-rust text-cream'
                              : 'bg-void-200 text-cream-dark'
                            : isSelected
                            ? 'bg-amber text-void'
                            : 'bg-void-200 text-cream-muted'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className={`flex-1 ${showAnswer && !isCorrect && !isWrong ? 'text-cream-dark' : 'text-cream'}`}>
                        {option.substring(3)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            {!showAnswer ? (
              <button
                onClick={handleRevealAnswer}
                className="btn-primary w-full"
              >
                Reveal Answer
                <span className="ml-2 text-xs opacity-75">(Space)</span>
              </button>
            ) : (
              <div>
                {card.quiz.explanation && (
                  <div className="mb-6 p-4 bg-info/10 border border-info/20 rounded-xl">
                    <p className="text-sm text-cream">
                      <span className="font-medium text-info">Explanation:</span> {card.quiz.explanation}
                    </p>
                  </div>
                )}

                <p className="text-center text-sm text-cream-muted mb-4">
                  How well did you recall this?
                </p>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleRating('AGAIN')}
                    disabled={submitReview.isPending}
                    className="py-3 px-2 bg-rust/20 text-rust border border-rust/30 rounded-xl hover:bg-rust/30 font-medium transition-all disabled:opacity-50"
                  >
                    <span className="block text-sm">Again</span>
                    <span className="text-xs opacity-75">1</span>
                  </button>
                  <button
                    onClick={() => handleRating('HARD')}
                    disabled={submitReview.isPending}
                    className="py-3 px-2 bg-amber/20 text-amber border border-amber/30 rounded-xl hover:bg-amber/30 font-medium transition-all disabled:opacity-50"
                  >
                    <span className="block text-sm">Hard</span>
                    <span className="text-xs opacity-75">2</span>
                  </button>
                  <button
                    onClick={() => handleRating('GOOD')}
                    disabled={submitReview.isPending}
                    className="py-3 px-2 bg-sage/20 text-sage border border-sage/30 rounded-xl hover:bg-sage/30 font-medium transition-all disabled:opacity-50"
                  >
                    <span className="block text-sm">Good</span>
                    <span className="text-xs opacity-75">3</span>
                  </button>
                  <button
                    onClick={() => handleRating('EASY')}
                    disabled={submitReview.isPending}
                    className="py-3 px-2 bg-info/20 text-info border border-info/30 rounded-xl hover:bg-info/30 font-medium transition-all disabled:opacity-50"
                  >
                    <span className="block text-sm">Easy</span>
                    <span className="text-xs opacity-75">4</span>
                  </button>
                </div>
              </div>
            )}

            {/* Source */}
            <div className="mt-6 pt-4 border-t border-void-200">
              <p className="text-sm text-cream-dark">
                From:{' '}
                <a
                  href={card.quiz.content.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-amber hover:text-amber-light transition-colors"
                >
                  {card.quiz.content.title}
                </a>
                <span
                  className={`ml-2 px-2 py-0.5 rounded-lg text-xs font-medium ${
                    card.quiz.content.platform === 'YOUTUBE'
                      ? 'bg-[#FF0000]/10 text-[#FF6B6B] border border-[#FF0000]/20'
                      : 'bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20'
                  }`}
                >
                  {card.quiz.content.platform}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
