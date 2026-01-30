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
        // Transform to match DueCardsResponse structure
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
        // Complete session if using one
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
        // Before answer: Space/Enter to reveal, 1-4 to select option
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleRevealAnswer();
        }
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          handleSelectOption(parseInt(e.key) - 1);
        }
      } else {
        // After answer: Space/Enter to continue (auto-rating based on correctness)
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

      // Check if it's a title (ends with : or starts with #)
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
      <div className="fixed inset-0 bg-void flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber/20 flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
            <Brain size={32} className="text-amber" />
          </div>
          <p className="text-cream-muted">Préparation de ta session...</p>
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
      <div className="fixed inset-0 bg-void flex items-center justify-center p-8 overflow-auto">
        {/* Ambient glows */}
        <div className="fixed top-20 right-20 w-64 h-64 bg-amber/10 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-20 left-20 w-48 h-48 bg-sage/10 rounded-full blur-3xl pointer-events-none" />

        {/* Mistakes Modal */}
        {showMistakes && (
          <div className="modal-backdrop z-50" onClick={() => setShowMistakes(false)}>
            <div className="modal-content max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-void-200 flex items-center justify-between">
                <h3 className="text-xl font-display text-cream">Questions à revoir</h3>
                <button
                  onClick={() => setShowMistakes(false)}
                  className="p-2 text-cream-dark hover:text-cream rounded-lg hover:bg-void-100"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {isLoadingMistakes ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 text-amber animate-spin" />
                  </div>
                ) : mistakesData?.mistakes.length === 0 ? (
                  <p className="text-center text-cream-muted py-8">Aucune erreur à revoir !</p>
                ) : (
                  mistakesData?.mistakes.map((mistake, idx) => (
                    <div key={mistake.id} className="bg-void-100 border border-void-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <p className="text-cream font-medium">
                          <span className="text-amber mr-2">{idx + 1}.</span>
                          {mistake.question}
                        </p>
                        <span className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                          mistake.rating === 'AGAIN' ? 'bg-rust/20 text-rust' : 'bg-amber/20 text-amber'
                        }`}>
                          {mistake.rating}
                        </span>
                      </div>
                      <p className="text-sm text-sage mb-2">
                        Correct : {mistake.options.find(o => o.startsWith(mistake.correctAnswer))}
                      </p>
                      {mistake.explanation && (
                        <p className="text-sm text-cream-dark mb-3">{mistake.explanation}</p>
                      )}
                      <a
                        href={mistake.content.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber hover:underline flex items-center gap-1"
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
          <div className="modal-backdrop z-50" onClick={() => setShowMemo(false)}>
            <div className="modal-content max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-void-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center">
                    <BookOpen size={20} className="text-info" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display text-cream">Mémo de révision</h3>
                    <p className="text-xs text-cream-dark">Points clés à retenir</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyMemo}
                    className="p-2 text-cream-dark hover:text-info rounded-lg hover:bg-info/10 transition-colors"
                    title="Copier le mémo"
                  >
                    {memoCopied ? <Check size={20} className="text-sage" /> : <Copy size={20} />}
                  </button>
                  <button
                    onClick={() => setShowMemo(false)}
                    className="p-2 text-cream-dark hover:text-cream rounded-lg hover:bg-void-100"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {parseMemo(aiMemo).map((section, idx) => (
                  <div key={idx} className="bg-void-100 border border-void-200 rounded-xl p-4">
                    {section.title && (
                      <h4 className="text-info font-medium mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-info/20 flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        {section.title}
                      </h4>
                    )}
                    <ul className="space-y-2">
                      {section.points.map((point, pointIdx) => (
                        <li key={pointIdx} className="text-sm text-cream flex items-start gap-2">
                          <span className="text-info mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {memoCopied && (
                <div className="p-3 bg-sage/20 border-t border-sage/30 text-center">
                  <p className="text-sm text-sage">Mémo copié dans le presse-papier !</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="max-w-md w-full relative my-8">
          <div className="card animate-scale-in">
            {totalReviewed > 0 ? (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-sage to-sage-dark rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow">
                  <Target className="w-10 h-10 text-void" />
                </div>
                <h2 className="text-3xl font-display text-cream mb-2 text-center">
                  Session terminée
                </h2>
                <p className="text-cream-muted text-center mb-6">
                  {totalReviewed} question{totalReviewed !== 1 ? 's' : ''} · {accuracy}% correct
                </p>

                {/* Session Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-void-50 border border-void-200 rounded-xl p-3 text-center">
                    <Clock className="w-5 h-5 text-cream-muted mx-auto mb-1" />
                    <p className="text-xl font-display text-cream">{getSessionDuration()}</p>
                    <p className="text-xs text-cream-dark">Durée</p>
                  </div>
                  <div className="bg-void-50 border border-void-200 rounded-xl p-3 text-center">
                    <Flame className="w-5 h-5 text-amber mx-auto mb-1" />
                    <p className="text-xl font-display text-cream">{stats?.currentStreak || 0}</p>
                    <p className="text-xs text-cream-dark">Jours de streak</p>
                  </div>
                  <div className="bg-void-50 border border-void-200 rounded-xl p-3 text-center">
                    <AlertCircle className="w-5 h-5 text-rust mx-auto mb-1" />
                    <p className="text-xl font-display text-cream">{mistakesCount}</p>
                    <p className="text-xs text-cream-dark">À revoir</p>
                  </div>
                </div>

                {/* Rating breakdown */}
                <div className="flex flex-wrap justify-center gap-2 mb-6">
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

                {/* Action buttons */}
                {sessionId && (
                  <div className="space-y-3 mb-6">
                    {/* AI Memo Button */}
                    {aiMemo ? (
                      <button
                        onClick={() => setShowMemo(true)}
                        className="w-full py-3 px-4 rounded-xl bg-info/20 border border-info/30 text-info hover:bg-info/30 transition-colors flex items-center justify-center gap-2"
                      >
                        <BookOpen size={18} />
                        Voir le mémo de révision
                      </button>
                    ) : (
                      <button
                        onClick={() => generateMemo.mutate()}
                        disabled={generateMemo.isPending}
                        className="w-full py-3 px-4 rounded-xl bg-info/20 border border-info/30 text-info hover:bg-info/30 transition-colors flex items-center justify-center gap-2"
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
                        className="w-full py-3 px-4 rounded-xl bg-rust/20 border border-rust/30 text-rust hover:bg-rust/30 transition-colors flex items-center justify-center gap-2"
                      >
                        <AlertCircle size={18} />
                        Voir {mistakesCount} erreur{mistakesCount !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                )}

                <p className="text-sm text-cream-dark text-center mb-6">
                  Reviens demain pour maintenir ton streak.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-gradient-to-br from-amber to-amber-dark rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-void" />
                </div>
                <h2 className="text-3xl font-display text-cream mb-2 text-center">
                  Tout est à jour
                </h2>
                {stats && stats.newDue > 0 && stats.remainingNewToday === 0 ? (
                  <div className="mb-6 text-center">
                    <p className="text-cream-muted mb-2">
                      Tu as atteint ta limite quotidienne de {stats.newCardsLimit} nouvelles cartes.
                    </p>
                    <p className="text-sm text-cream-dark">
                      {stats.newDue} nouvelles cartes t'attendent demain.
                    </p>
                  </div>
                ) : (
                  <p className="text-cream-muted text-center mb-6">
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
                <span className="text-sm">Quitter</span>
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-sm text-cream-muted">
                  {currentIndex + 1} sur {data.cards.length}
                </span>
                {card.repetitions === 0 && (
                  <span className="px-2.5 py-1 bg-amber/20 text-amber border border-amber/30 text-xs rounded-lg font-medium">
                    Nouveau
                  </span>
                )}
                {data.stats && (
                  <span className="text-xs text-cream-dark">
                    ({data.stats.newCardsToday}/{data.stats.newCardsLimit} nouveaux aujourd'hui)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {!sessionId && (
                <Link
                  to="/review/configure"
                  className="text-cream-dark hover:text-cream transition-colors"
                  title="Configure session"
                >
                  <Settings size={18} />
                </Link>
              )}
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
            <h3 className="text-xl font-display text-cream mb-6">Raccourcis clavier</h3>
            <div className="space-y-3 text-sm">
              {[
                { action: 'Sélectionner option', key: '1-4' },
                { action: 'Voir la réponse', key: 'Espace' },
                { action: 'Continuer', key: 'Espace' },
                { action: 'Quitter la session', key: 'Échap' },
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
              Fermer
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
              {milestoneToShow} jours de streak !
            </h3>
            <p className="text-cream-muted mb-8">
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
        <div className="modal-backdrop" onClick={() => setIsNewRecord(false)}>
          <div className="modal-content max-w-sm p-8 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-20 h-20 bg-gradient-to-br from-sage to-sage-dark rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
              <Zap size={40} className="text-void" />
            </div>
            <h3 className="text-3xl font-display text-cream mb-2">
              Nouveau record personnel !
            </h3>
            <p className="text-cream-muted mb-8">
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
                Voir la réponse
                <span className="ml-2 text-xs opacity-75">(Espace)</span>
              </button>
            ) : (
              <div>
                {card.quiz.explanation && (
                  <div className="mb-6 p-4 bg-info/10 border border-info/20 rounded-xl">
                    <p className="text-sm text-cream">
                      <span className="font-medium text-info">Explication :</span> {card.quiz.explanation}
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
            <div className="mt-6 pt-4 border-t border-void-200">
              <p className="text-sm text-cream-dark">
                Source :{' '}
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
                      : card.quiz.content.platform === 'SPOTIFY'
                      ? 'bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20'
                      : card.quiz.content.platform === 'TIKTOK'
                      ? 'bg-gradient-to-r from-[#00f2ea]/10 to-[#ff0050]/10 text-[#00f2ea] border border-[#00f2ea]/20'
                      : 'bg-gradient-to-r from-[#833AB4]/10 via-[#FD1D1D]/10 to-[#F77737]/10 text-[#FD1D1D] border border-[#FD1D1D]/20'
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
