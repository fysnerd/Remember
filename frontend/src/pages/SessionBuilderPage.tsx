import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Brain, ArrowLeft, Filter, Hash, Layers, Zap,
  CheckSquare, Square, ChevronDown, Loader2, Play
} from 'lucide-react';
import { api } from '../lib/api';
import clsx from 'clsx';

interface Tag {
  id: string;
  name: string;
  _count: { contents: number };
}

interface Content {
  id: string;
  title: string;
  platform: 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK' | 'INSTAGRAM';
  thumbnailUrl: string | null;
  _count: { quizzes: number };
}

type Platform = 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK' | 'INSTAGRAM';
type QuestionLimit = 5 | 10 | 20 | null;

const platformColors: Record<Platform, string> = {
  YOUTUBE: 'bg-[#FF0000]/20 text-[#FF6B6B] border-[#FF0000]/30',
  SPOTIFY: 'bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/30',
  TIKTOK: 'bg-gradient-to-r from-[#00f2ea]/20 to-[#ff0050]/20 text-[#00f2ea] border-[#00f2ea]/30',
  INSTAGRAM: 'bg-gradient-to-r from-[#833AB4]/20 via-[#FD1D1D]/20 to-[#F77737]/20 text-[#FD1D1D] border-[#FD1D1D]/30',
};

export function SessionBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlContentIds = searchParams.get('contentIds');

  // Session config state
  const [questionLimit, setQuestionLimit] = useState<QuestionLimit>(null); // Default to "All" for quick mode
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [showContentPicker, setShowContentPicker] = useState(false);

  // Quick mode = contentIds passed via URL
  const isQuickMode = !!urlContentIds;

  // Initialize selectedContentIds from URL params
  useEffect(() => {
    if (urlContentIds) {
      const ids = urlContentIds.split(',').filter(Boolean);
      setSelectedContentIds(ids);
      setQuestionLimit(null); // Default to all questions for specific content
    }
  }, [urlContentIds]);

  // Fetch tags (only in full mode)
  const { data: tags } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await api.get<Tag[]>('/content/tags');
      return res.data;
    },
    enabled: !isQuickMode,
  });

  // Fetch ready content for specific selection
  const { data: readyContent } = useQuery<{ contents: Content[] }>({
    queryKey: ['ready-content'],
    queryFn: async () => {
      const res = await api.get<{ contents: Content[] }>('/content?status=READY&limit=100');
      return res.data;
    },
    enabled: showContentPicker || isQuickMode,
  });

  // Preview matching cards count
  const { data: preview, isLoading: isPreviewLoading } = useQuery<{ matchingCardsCount: number }>({
    queryKey: ['session-preview', selectedPlatforms, selectedTagIds, selectedContentIds],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPlatforms.length > 0) params.set('platforms', selectedPlatforms.join(','));
      if (selectedTagIds.length > 0) params.set('tagIds', selectedTagIds.join(','));
      if (selectedContentIds.length > 0) params.set('contentIds', selectedContentIds.join(','));
      const res = await api.get<{ matchingCardsCount: number }>(`/reviews/session/preview?${params.toString()}`);
      return res.data;
    },
  });

  // Create session mutation
  const createSession = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ session: { id: string } }>('/reviews/session', {
        questionLimit,
        platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        contentIds: selectedContentIds.length > 0 ? selectedContentIds : undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      navigate(`/review?session=${data.session.id}`);
    },
  });

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
    setSelectedContentIds([]);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
    setSelectedContentIds([]);
  };

  const toggleContent = (contentId: string) => {
    setSelectedContentIds(prev =>
      prev.includes(contentId)
        ? prev.filter(id => id !== contentId)
        : [...prev, contentId]
    );
  };

  const hasFilters = selectedPlatforms.length > 0 || selectedTagIds.length > 0;
  const hasSpecificContent = selectedContentIds.length > 0;
  const matchingCards = preview?.matchingCardsCount ?? 0;
  const effectiveLimit = questionLimit ?? matchingCards;
  const cardsToReview = Math.min(effectiveLimit, matchingCards);

  const questionOptions: { value: QuestionLimit; label: string }[] = [
    { value: 5, label: '5' },
    { value: 10, label: '10' },
    { value: 20, label: '20' },
    { value: null, label: 'Tout' },
  ];

  const platforms: { value: Platform; label: string; color: string }[] = [
    { value: 'YOUTUBE', label: 'YouTube', color: platformColors.YOUTUBE },
    { value: 'SPOTIFY', label: 'Spotify', color: platformColors.SPOTIFY },
    { value: 'TIKTOK', label: 'TikTok', color: platformColors.TIKTOK },
    { value: 'INSTAGRAM', label: 'Instagram', color: platformColors.INSTAGRAM },
  ];

  // Get selected content details for quick mode
  const selectedContents = readyContent?.contents.filter(c => selectedContentIds.includes(c.id)) || [];

  // ===== QUICK MODE UI =====
  if (isQuickMode) {
    return (
      <div className="min-h-screen p-8">
        {/* Ambient glow */}
        <div className="fixed top-0 right-0 w-96 h-96 bg-amber/5 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-0 left-64 w-64 h-64 bg-sage/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-lg mx-auto relative">
          {/* Header */}
          <div className="mb-8 animate-fade-in">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-cream-muted hover:text-cream transition-colors mb-6"
            >
              <ArrowLeft size={18} />
              <span>Retour</span>
            </Link>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber/20 flex items-center justify-center">
                <Play size={28} className="text-amber" />
              </div>
              <div>
                <h1 className="text-3xl font-display text-cream">Lancer la révision</h1>
                <p className="text-cream-dark">Prêt à apprendre ?</p>
              </div>
            </div>
          </div>

          {/* Quick Mode Card */}
          <div className="card animate-slide-up">
            {/* Selected Content Preview */}
            <div className="mb-6">
              <p className="text-sm font-medium text-cream-muted mb-3">Contenu sélectionné</p>
              <div className="space-y-2">
                {selectedContents.map((content) => (
                  <div
                    key={content.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-void-100 border border-void-200"
                  >
                    {content.thumbnailUrl ? (
                      <img
                        src={content.thumbnailUrl}
                        alt=""
                        className="w-20 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-12 rounded-lg bg-void-200 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-cream font-medium truncate">{content.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium border',
                          platformColors[content.platform]
                        )}>
                          {content.platform}
                        </span>
                        <span className="text-xs text-cream-dark">
                          {content._count.quizzes} quiz
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {selectedContents.length === 0 && !isPreviewLoading && (
                  <p className="text-cream-dark text-sm py-2">Chargement...</p>
                )}
              </div>
            </div>

            {/* Question Count */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-cream-muted mb-3">
                <Hash size={16} />
                Nombre de questions
              </label>
              <div className="flex gap-2">
                {questionOptions.map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => setQuestionLimit(value)}
                    className={clsx(
                      'flex-1 py-3 px-4 rounded-xl border font-medium transition-all',
                      questionLimit === value
                        ? 'bg-amber/20 border-amber/50 text-amber'
                        : 'bg-void-100 border-void-200 text-cream-muted hover:border-void-300 hover:text-cream'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quiz count info */}
            <div className="p-4 rounded-xl bg-sage/10 border border-sage/20 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-cream-muted">Quiz disponibles</span>
                {isPreviewLoading ? (
                  <Loader2 size={18} className="text-sage animate-spin" />
                ) : (
                  <span className="text-2xl font-display text-sage">{matchingCards}</span>
                )}
              </div>
              {matchingCards > 0 && questionLimit && questionLimit < matchingCards && (
                <p className="text-xs text-cream-dark mt-2">
                  Tu vas réviser {questionLimit} sur {matchingCards} quiz
                </p>
              )}
            </div>

            {/* Start Button */}
            <button
              onClick={() => createSession.mutate()}
              disabled={matchingCards === 0 || createSession.isPending}
              className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createSession.isPending ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  Démarrage...
                </>
              ) : (
                <>
                  <Zap size={22} />
                  C'est parti !
                  {cardsToReview > 0 && (
                    <span className="text-sm opacity-75">({cardsToReview} quiz)</span>
                  )}
                </>
              )}
            </button>

            {matchingCards === 0 && !isPreviewLoading && (
              <p className="text-center text-cream-dark text-sm mt-4">
                Ce contenu n'a pas encore de quiz. Reviens plus tard !
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== FULL MODE UI (no contentIds in URL) =====
  return (
    <div className="min-h-screen p-8">
      {/* Ambient glow */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-amber/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-64 w-64 h-64 bg-sage/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto relative">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-cream-muted hover:text-cream transition-colors mb-6"
          >
            <ArrowLeft size={18} />
            <span>Retour</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber/20 flex items-center justify-center">
              <Brain size={28} className="text-amber" />
            </div>
            <div>
              <h1 className="text-3xl font-display text-cream">Configurer la session</h1>
              <p className="text-cream-dark">Personnalise ton expérience de révision</p>
            </div>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="card animate-slide-up">
          {/* Question Count */}
          <div className="mb-8">
            <label className="flex items-center gap-2 text-sm font-medium text-cream-muted mb-4">
              <Hash size={16} />
              Questions par session
            </label>
            <div className="flex gap-2">
              {questionOptions.map(({ value, label }) => (
                <button
                  key={label}
                  onClick={() => setQuestionLimit(value)}
                  className={clsx(
                    'flex-1 py-3 px-4 rounded-xl border font-medium transition-all',
                    questionLimit === value
                      ? 'bg-amber/20 border-amber/50 text-amber'
                      : 'bg-void-100 border-void-200 text-cream-muted hover:border-void-300 hover:text-cream'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Platform Filter */}
          <div className="mb-8">
            <label className="flex items-center gap-2 text-sm font-medium text-cream-muted mb-4">
              <Layers size={16} />
              Filtrer par plateforme
            </label>
            <div className="flex flex-wrap gap-2">
              {platforms.map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => togglePlatform(value)}
                  className={clsx(
                    'px-4 py-2 rounded-xl border font-medium transition-all flex items-center gap-2',
                    selectedPlatforms.includes(value)
                      ? color
                      : 'bg-void-100 border-void-200 text-cream-muted hover:border-void-300'
                  )}
                >
                  {selectedPlatforms.includes(value) ? (
                    <CheckSquare size={16} />
                  ) : (
                    <Square size={16} />
                  )}
                  {label}
                </button>
              ))}
            </div>
            {selectedPlatforms.length === 0 && (
              <p className="text-xs text-cream-dark mt-2">Toutes les plateformes incluses</p>
            )}
          </div>

          {/* Tags Filter - Top 10 only */}
          {tags && tags.length > 0 && (
            <div className="mb-8">
              <label className="flex items-center gap-2 text-sm font-medium text-cream-muted mb-4">
                <Filter size={16} />
                Filtrer par thème
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 10).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg border text-sm transition-all',
                      selectedTagIds.includes(tag.id)
                        ? 'bg-sage/20 border-sage/50 text-sage'
                        : 'bg-void-100 border-void-200 text-cream-muted hover:border-void-300'
                    )}
                  >
                    {tag.name}
                    <span className="ml-1 opacity-60">({tag._count.contents})</span>
                  </button>
                ))}
              </div>
              {tags.length > 10 && (
                <p className="text-xs text-cream-dark mt-2">
                  +{tags.length - 10} autres thèmes disponibles
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-void-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-void-50 px-4 text-sm text-cream-dark">OU</span>
            </div>
          </div>

          {/* Specific Content Selection */}
          <div className="mb-8">
            <button
              onClick={() => setShowContentPicker(!showContentPicker)}
              className="flex items-center justify-between w-full p-4 rounded-xl bg-void-100 border border-void-200 hover:border-void-300 transition-colors"
            >
              <span className="text-cream font-medium">
                {hasSpecificContent
                  ? `${selectedContentIds.length} contenu${selectedContentIds.length !== 1 ? 's' : ''} sélectionné${selectedContentIds.length !== 1 ? 's' : ''}`
                  : 'Sélectionner des contenus spécifiques...'}
              </span>
              <ChevronDown
                size={20}
                className={clsx(
                  'text-cream-muted transition-transform',
                  showContentPicker && 'rotate-180'
                )}
              />
            </button>

            {showContentPicker && (
              <div className="mt-4 max-h-64 overflow-y-auto space-y-2 p-2 bg-void-100 rounded-xl border border-void-200">
                {readyContent?.contents.map((content) => (
                  <button
                    key={content.id}
                    onClick={() => toggleContent(content.id)}
                    disabled={hasFilters}
                    className={clsx(
                      'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                      selectedContentIds.includes(content.id)
                        ? 'bg-amber/10 border border-amber/30'
                        : 'hover:bg-void-200 border border-transparent',
                      hasFilters && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {content.thumbnailUrl ? (
                      <img
                        src={content.thumbnailUrl}
                        alt=""
                        className="w-16 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-10 rounded bg-void-200 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-cream truncate">{content.title}</p>
                      <p className="text-xs text-cream-dark">
                        {content._count.quizzes} quiz
                      </p>
                    </div>
                    {selectedContentIds.includes(content.id) && (
                      <CheckSquare size={18} className="text-amber flex-shrink-0" />
                    )}
                  </button>
                ))}
                {readyContent?.contents.length === 0 && (
                  <p className="text-center text-cream-dark py-4">Aucun contenu avec des quiz</p>
                )}
              </div>
            )}
            {hasFilters && showContentPicker && (
              <p className="text-xs text-amber mt-2">Retire les filtres pour sélectionner des contenus spécifiques</p>
            )}
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl bg-void-100 border border-void-200 mb-8">
            <div className="flex items-center justify-between">
              <span className="text-cream-muted">Quiz disponibles</span>
              {isPreviewLoading ? (
                <Loader2 size={18} className="text-amber animate-spin" />
              ) : (
                <span className="text-2xl font-display text-cream">{matchingCards}</span>
              )}
            </div>
            {matchingCards > 0 && questionLimit && questionLimit < matchingCards && (
              <p className="text-xs text-cream-dark mt-2">
                Tu vas réviser {questionLimit} sur {matchingCards} quiz disponibles
              </p>
            )}
          </div>

          {/* Start Button */}
          <button
            onClick={() => createSession.mutate()}
            disabled={matchingCards === 0 || createSession.isPending}
            className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createSession.isPending ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                Démarrage...
              </>
            ) : (
              <>
                <Zap size={22} />
                Lancer la session
                {cardsToReview > 0 && (
                  <span className="text-sm opacity-75">({cardsToReview} quiz)</span>
                )}
              </>
            )}
          </button>

          {matchingCards === 0 && (
            <p className="text-center text-cream-dark text-sm mt-4">
              Aucun quiz ne correspond à tes critères. Essaie d'ajuster les filtres.
            </p>
          )}
        </div>

        {/* Quick Start Option */}
        <div className="mt-6 text-center animate-slide-up stagger-2">
          <Link
            to="/review"
            className="text-cream-muted hover:text-amber transition-colors text-sm"
          >
            Ou lancer une session rapide avec les paramètres par défaut
          </Link>
        </div>
      </div>
    </div>
  );
}
