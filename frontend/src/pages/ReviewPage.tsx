import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Flame, Target, Clock, ArrowLeft, Keyboard, Brain, Sparkles, Trophy, Star, Zap, Settings, AlertCircle, FileText, X, Loader2, ExternalLink, Copy, Check, BookOpen } from 'lucide-react';
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

interface Mistake {
  id: string;
  rating: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  content: {
    id: string;
    title: string;
    platform: string;
    url: string;
  };
}

interface MistakesResponse {
  mistakes: Mistake[];
  count: number;
}

interface MemoResponse {
  memo: string;
  generatedAt: string;
}

interface SessionCardsResponse {
  cards: Card[];
  count: number;
  session: {
    id: string;
    questionLimit: number | null;
    platforms: string[];
    tagIds: string[];
    contentIds: string[];
  };
}

const platformColors: Record<string, string> = {
  YOUTUBE: 'bg-red-100 text-red-700 border-red-200',
  SPOTIFY: 'bg-green-100 text-green-700 border-green-200',
  TIKTOK: 'bg-gray-100 text-gray-700 border-gray-200',
  INSTAGRAM: 'bg-pink-100 text-pink-700 border-pink-200',
};

export function ReviewPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

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
  const [showMistakes, setShowMistakes] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [aiMemo, setAiMemo] = useState<string | null>(null);
  const [memoCopied, setMemoCopied] = useState(false);

  const queryClient = useQueryClient();

  // Fetch cards - either from session or default due cards
  const { data, isLoading } = useQuery<DueCardsResponse>({
    queryKey: sessionId ? ['session-cards', sessionId] : ['due-cards'],
    queryFn: async (): Promise<DueCardsResponse> => {
      if (sessionId) {
        const res = await api.get<SessionCardsResponse>(`/reviews/session/${sessionId}/cards`);
        return {
          cards: res.data.cards,
          count: res.data.count,
          stats: {
            reviewDue: res.data.count,
            newDue: 0,
            newCardsToday: 0,
            newCardsLimit: 20,
            remainingNewToday: 0,
          },
        };
      }
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

  // Complete session mutation
  const completeSession = useMutation({
    mutationFn: async () => {
      if (!sessionId) return null;
      return api.post(`/reviews/session/${sessionId}/complete`);
    },
  });

  // Fetch mistakes for session
  const { data: mistakesData, isLoading: isLoadingMistakes } = useQuery<MistakesResponse>({
    queryKey: ['session-mistakes', sessionId],
    queryFn: async () => {
      const res = await api.get<MistakesResponse>(`/reviews/session/${sessionId}/mistakes`);
      return res.data;
    },
    enabled: !!sessionId && sessionComplete,
  });

  // Generate AI memo mutation
  const generateMemo = useMutation({
    mutationFn: async () => {
      const res = await api.post<MemoResponse>(`/reviews/session/${sessionId}/memo`);
      return res.data;
    },
    onSuccess: (data) => {
      setAiMemo(data.memo);
    },
  });

  const submitReview = useMutation({
    mutationFn: async ({ cardId, rating }: { cardId: string; rating: Rating }) => {
      return api.post<{ streak: StreakInfo }>('/reviews', { cardId, rating, sessionId });
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
        if (sessionId) {
          completeSession.mutate();
        }
        setSessionComplete(true);
        queryClient.invalidateQueries({ queryKey: ['due-cards'] });
        queryClient.invalidateQueries({ queryKey: ['session-cards'] });
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
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          if (data) {
            const card = data.cards[currentIndex];
            const optionLetter = selectedOption !== null ? card.quiz.options[selectedOption]?.charAt(0) : null;
            const isCorrect = optionLetter === card.quiz.correctAnswer;
            handleRating(isCorrect ? 'GOOD' : 'AGAIN');
          }
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
  }, [showAnswer, handleRating, handleRevealAnswer, handleSelectOption, data, currentIndex, selectedOption]);

  const getSessionDuration = () => {
    const ms = Date.now() - sessionStats.startTime;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Parse memo into structured sections
  const parseMemo = (memo: string) => {
    const lines = memo.split('\n').filter(line => line.trim());
    const sections: { title?: string; points: string[] }[] = [];
    let currentSection: { title?: string; points: string[] } = { points: [] };

    for (const line of lines) {
      const cleaned = line
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .trim();

      if (/^#+\s*/.test(line) || (cleaned.endsWith(':') && !cleaned.startsWith('-'))) {
        if (currentSection.points.length > 0 || currentSection.title) {
          sections.push(currentSection);
        }
        currentSection = { title: cleaned.replace(/^#+\s*/, '').replace(/:$/, ''), points: [] };
      } else if (/^[-•]\s/.test(cleaned)) {
        currentSection.points.push(cleaned.replace(/^[-•]\s*/, ''));
      } else if (cleaned) {
        currentSection.points.push(cleaned);
      }
    }

    if (currentSection.points.length > 0 || currentSection.title) {
      sections.push(currentSection);
    }

    return sections;
  };

  // Copy memo to clipboard
  const copyMemo = async () => {
    if (!aiMemo) return;
    try {
      await navigator.clipboard.writeText(aiMemo);
      setMemoCopied(true);
      setTimeout(() => setMemoCopied(false), 2000);
    } catch {
      console.error('Failed to copy memo');
    }
  };

  const totalReviewed = sessionStats.again + sessionStats.hard + sessionStats.good + sessionStats.easy;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Brain size={32} className="text-gray-400" />
          </div>
          <p className="text-gray-500">Préparation de ta session...</p>
        </div>
      </div>
    );
  }

  const mistakesCount = sessionStats.again + sessionStats.hard;
  const correctCount = sessionStats.good + sessionStats.easy;
  const accuracy = totalReviewed > 0 ? Math.round((correctCount / totalReviewed) * 100) : 0;

  // Session complete - show summary
  if (sessionComplete || !data?.cards.length) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center p-6 overflow-auto">
        {/* Mistakes Modal */}
        {showMistakes && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMistakes(false)}>
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Questions à revoir</h3>
                <button
                  onClick={() => setShowMistakes(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoadingMistakes ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                  </div>
                ) : mistakesData?.mistakes.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Aucune erreur à revoir !</p>
                ) : (
                  mistakesData?.mistakes.map((mistake, idx) => (
                    <div key={mistake.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <p className="text-gray-900 font-medium">
                          <span className="text-gray-500 mr-2">{idx + 1}.</span>
                          {mistake.question}
                        </p>
                        <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                          mistake.rating === 'AGAIN' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {mistake.rating}
                        </span>
                      </div>
                      <p className="text-sm text-green-600 mb-2">
                        Correct : {mistake.options.find(o => o.startsWith(mistake.correctAnswer))}
                      </p>
                      {mistake.explanation && (
                        <p className="text-sm text-gray-500 mb-3">{mistake.explanation}</p>
                      )}
                      <a
                        href={mistake.content.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:underline flex items-center gap-1"
                      >
                        {mistake.content.title}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Memo Modal */}
        {showMemo && aiMemo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowMemo(false)}>
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <BookOpen size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Mémo de révision</h3>
                    <p className="text-xs text-gray-500">Points clés à retenir</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyMemo}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Copier le mémo"
                  >
                    {memoCopied ? <Check size={20} className="text-green-600" /> : <Copy size={20} />}
                  </button>
                  <button
                    onClick={() => setShowMemo(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {parseMemo(aiMemo).map((section, idx) => (
                  <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    {section.title && (
                      <h4 className="text-gray-900 font-medium mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                          {idx + 1}
                        </span>
                        {section.title}
                      </h4>
                    )}
                    <ul className="space-y-2">
                      {section.points.map((point, pointIdx) => (
                        <li key={pointIdx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-gray-400 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {memoCopied && (
                <div className="p-3 bg-green-50 border-t border-green-200 text-center">
                  <p className="text-sm text-green-600">Mémo copié dans le presse-papier !</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="max-w-md w-full">
          <div className="border border-gray-200 rounded-lg p-6">
            {totalReviewed > 0 ? (
              <>
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                  <Target className="w-8 h-8 text-gray-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2 text-center">
                  Session terminée
                </h2>
                <p className="text-gray-500 text-center mb-6">
                  {totalReviewed} question{totalReviewed !== 1 ? 's' : ''} · {accuracy}% correct
                </p>

                {/* Session Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <Clock className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-gray-900">{getSessionDuration()}</p>
                    <p className="text-xs text-gray-500">Durée</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-gray-900">{stats?.currentStreak || 0}</p>
                    <p className="text-xs text-gray-500">Streak</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-gray-900">{mistakesCount}</p>
                    <p className="text-xs text-gray-500">À revoir</p>
                  </div>
                </div>

                {/* Rating breakdown */}
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {sessionStats.again > 0 && (
                    <span className="px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm">
                      Again: {sessionStats.again}
                    </span>
                  )}
                  {sessionStats.hard > 0 && (
                    <span className="px-3 py-1.5 bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-lg text-sm">
                      Hard: {sessionStats.hard}
                    </span>
                  )}
                  {sessionStats.good > 0 && (
                    <span className="px-3 py-1.5 bg-green-100 text-green-700 border border-green-200 rounded-lg text-sm">
                      Good: {sessionStats.good}
                    </span>
                  )}
                  {sessionStats.easy > 0 && (
                    <span className="px-3 py-1.5 bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-sm">
                      Easy: {sessionStats.easy}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                {sessionId && (
                  <div className="space-y-3 mb-6">
                    {/* AI Memo Button */}
                    {aiMemo ? (
                      <button
                        onClick={() => setShowMemo(true)}
                        className="w-full py-3 px-4 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <BookOpen size={18} />
                        Voir le mémo de révision
                      </button>
                    ) : (
                      <button
                        onClick={() => generateMemo.mutate()}
                        disabled={generateMemo.isPending}
                        className="w-full py-3 px-4 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        {generateMemo.isPending ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Génération du mémo...
                          </>
                        ) : (
                          <>
                            <FileText size={18} />
                            Générer un mémo IA
                          </>
                        )}
                      </button>
                    )}

                    {/* Mistakes Button */}
                    {mistakesCount > 0 && (
                      <button
                        onClick={() => setShowMistakes(true)}
                        className="w-full py-3 px-4 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <AlertCircle size={18} />
                        Voir {mistakesCount} erreur{mistakesCount !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                )}

                <p className="text-sm text-gray-500 text-center mb-6">
                  Reviens demain pour maintenir ton streak.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-8 h-8 text-gray-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2 text-center">
                  Tout est à jour
                </h2>
                {stats && stats.newDue > 0 && stats.remainingNewToday === 0 ? (
                  <div className="mb-6 text-center">
                    <p className="text-gray-500 mb-2">
                      Tu as atteint ta limite quotidienne de {stats.newCardsLimit} nouvelles cartes.
                    </p>
                    <p className="text-sm text-gray-400">
                      {stats.newDue} nouvelles cartes t'attendent demain.
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center mb-6">
                    Aucune carte à réviser pour l'instant. Ton archive est à jour.
                  </p>
                )}
              </>
            )}

            <Link to="/" className="btn-primary w-full flex items-center justify-center gap-2">
              Retour à Apprendre
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const card = data.cards[currentIndex];
  const progress = ((currentIndex + 1) / data.cards.length) * 100;

  return (
    <div className="fixed inset-0 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-gray-500 hover:text-gray-700 flex items-center gap-2 transition-colors"
              >
                <ArrowLeft size={18} />
                <span className="text-sm">Quitter</span>
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {currentIndex + 1} sur {data.cards.length}
                </span>
                {card.repetitions === 0 && (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 border border-blue-200 text-xs rounded-lg font-medium">
                    Nouveau
                  </span>
                )}
                {data.stats && (
                  <span className="text-xs text-gray-400">
                    ({data.stats.newCardsToday}/{data.stats.newCardsLimit} nouveaux aujourd'hui)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {!sessionId && (
                <Link
                  to="/review/configure"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Configure session"
                >
                  <Settings size={18} />
                </Link>
              )}
              <button
                onClick={() => setShowShortcuts((prev) => !prev)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard size={18} />
              </button>
              {stats && (
                <div className="flex items-center gap-1.5 text-orange-500">
                  <Flame size={18} />
                  <span className="text-sm font-medium">{stats.currentStreak}</span>
                </div>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-900 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-lg max-w-sm w-full p-6 border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Raccourcis clavier</h3>
            <div className="space-y-3 text-sm">
              {[
                { action: 'Sélectionner option', key: '1-4' },
                { action: 'Voir la réponse', key: 'Espace' },
                { action: 'Continuer', key: 'Espace' },
                { action: 'Quitter la session', key: 'Échap' },
              ].map(({ action, key }) => (
                <div key={action} className="flex justify-between items-center">
                  <span className="text-gray-500">{action}</span>
                  <kbd className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-700 font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="mt-6 w-full btn-secondary text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Milestone celebration modal */}
      {milestoneToShow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setMilestoneToShow(null)}>
          <div className="bg-white rounded-lg max-w-sm w-full p-8 text-center border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-6">
              {milestoneToShow >= 100 ? (
                <Trophy size={32} className="text-yellow-500" />
              ) : milestoneToShow >= 30 ? (
                <Star size={32} className="text-yellow-500" />
              ) : (
                <Flame size={32} className="text-orange-500" />
              )}
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">
              {milestoneToShow} jours de streak !
            </h3>
            <p className="text-gray-500 mb-8">
              {milestoneToShow >= 100
                ? 'Incroyable ! Ta constance est légendaire.'
                : milestoneToShow >= 30
                ? 'Impressionnant ! Ta connaissance devient sagesse.'
                : 'Tu construis de solides habitudes. Continue !'}
            </p>
            <button
              onClick={() => setMilestoneToShow(null)}
              className="btn-primary"
            >
              Continuer
            </button>
          </div>
        </div>
      )}

      {/* New record celebration */}
      {isNewRecord && !milestoneToShow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsNewRecord(false)}>
          <div className="bg-white rounded-lg max-w-sm w-full p-8 text-center border border-gray-200" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-6">
              <Zap size={32} className="text-yellow-500" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">
              Nouveau record personnel !
            </h3>
            <p className="text-gray-500 mb-8">
              Tu as dépassé ton précédent record. Continue comme ça !
            </p>
            <button
              onClick={() => setIsNewRecord(false)}
              className="btn-primary"
            >
              Super !
            </button>
          </div>
        </div>
      )}

      {/* Card content */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
        <div className="max-w-2xl w-full">
          <div className="border border-gray-200 rounded-lg p-6">
            {/* Question */}
            <h2 className="text-lg font-semibold text-gray-900 mb-8 text-center leading-relaxed">
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
                    className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                      showAnswer
                        ? isCorrect
                          ? 'border-green-500 bg-green-50'
                          : isWrong
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 opacity-50'
                        : isSelected
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                          showAnswer
                            ? isCorrect
                              ? 'bg-green-500 text-white'
                              : isWrong
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-400'
                            : isSelected
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className={`flex-1 ${showAnswer && !isCorrect && !isWrong ? 'text-gray-400' : 'text-gray-900'}`}>
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
                Voir la réponse
                <span className="ml-2 text-xs opacity-75">(Espace)</span>
              </button>
            ) : (
              <div>
                {card.quiz.explanation && (
                  <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-gray-900">Explication :</span> {card.quiz.explanation}
                    </p>
                  </div>
                )}

                {/* Auto-rating: correct = GOOD, wrong = AGAIN */}
                <button
                  onClick={() => {
                    const optionLetter = selectedOption !== null ? card.quiz.options[selectedOption]?.charAt(0) : null;
                    const isCorrect = optionLetter === card.quiz.correctAnswer;
                    handleRating(isCorrect ? 'GOOD' : 'AGAIN');
                  }}
                  disabled={submitReview.isPending}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {submitReview.isPending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Chargement...
                    </>
                  ) : (
                    <>
                      Continuer
                      <span className="text-xs opacity-75">(Espace)</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Source */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Source :{' '}
                <a
                  href={card.quiz.content.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  {card.quiz.content.title}
                </a>
                <span
                  className={`ml-2 px-2 py-0.5 rounded-lg text-xs font-medium border ${
                    platformColors[card.quiz.content.platform] || 'bg-gray-100 text-gray-600 border-gray-200'
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
