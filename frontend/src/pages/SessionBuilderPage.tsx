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
  YOUTUBE: 'bg-red-100 text-red-700 border-red-200',
  SPOTIFY: 'bg-green-100 text-green-700 border-green-200',
  TIKTOK: 'bg-gray-100 text-gray-700 border-gray-200',
  INSTAGRAM: 'bg-pink-100 text-pink-700 border-pink-200',
};

export function SessionBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlContentIds = searchParams.get('contentIds');

  // Session config state
  const [questionLimit, setQuestionLimit] = useState<QuestionLimit>(null);
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
      setQuestionLimit(null);
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
      <div className="min-h-screen p-6 bg-white">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-4"
            >
              <ArrowLeft size={18} />
              <span>Retour</span>
            </Link>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                <Play size={24} className="text-gray-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Lancer la révision</h1>
                <p className="text-sm text-gray-500">Prêt à apprendre ?</p>
              </div>
            </div>
          </div>

          {/* Quick Mode Card */}
          <div className="border border-gray-200 rounded-lg p-6">
            {/* Selected Content Preview */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-500 mb-3">Contenu sélectionné</p>
              <div className="space-y-2">
                {selectedContents.map((content) => (
                  <div
                    key={content.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200"
                  >
                    {content.thumbnailUrl ? (
                      <img
                        src={content.thumbnailUrl}
                        alt=""
                        className="w-20 h-12 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-12 rounded bg-gray-200 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 font-medium truncate">{content.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium border',
                          platformColors[content.platform]
                        )}>
                          {content.platform}
                        </span>
                        <span className="text-xs text-gray-500">
                          {content._count.quizzes} quiz
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {selectedContents.length === 0 && !isPreviewLoading && (
                  <p className="text-gray-500 text-sm py-2">Chargement...</p>
                )}
              </div>
            </div>

            {/* Question Count */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-3">
                <Hash size={16} />
                Nombre de questions
              </label>
              <div className="flex gap-2">
                {questionOptions.map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => setQuestionLimit(value)}
                    className={clsx(
                      'flex-1 py-3 px-4 rounded-lg border font-medium transition-all',
                      questionLimit === value
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quiz count info */}
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Quiz disponibles</span>
                {isPreviewLoading ? (
                  <Loader2 size={18} className="text-gray-400 animate-spin" />
                ) : (
                  <span className="text-2xl font-semibold text-gray-900">{matchingCards}</span>
                )}
              </div>
              {matchingCards > 0 && questionLimit && questionLimit < matchingCards && (
                <p className="text-xs text-gray-500 mt-2">
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
              <p className="text-center text-gray-500 text-sm mt-4">
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
    <div className="min-h-screen p-6 bg-white">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-4"
          >
            <ArrowLeft size={18} />
            <span>Retour</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <Brain size={24} className="text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Configurer la session</h1>
              <p className="text-sm text-gray-500">Personnalise ton expérience de révision</p>
            </div>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="border border-gray-200 rounded-lg p-6">
          {/* Question Count */}
          <div className="mb-8">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-4">
              <Hash size={16} />
              Questions par session
            </label>
            <div className="flex gap-2">
              {questionOptions.map(({ value, label }) => (
                <button
                  key={label}
                  onClick={() => setQuestionLimit(value)}
                  className={clsx(
                    'flex-1 py-3 px-4 rounded-lg border font-medium transition-all',
                    questionLimit === value
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Platform Filter */}
          <div className="mb-8">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-4">
              <Layers size={16} />
              Filtrer par plateforme
            </label>
            <div className="flex flex-wrap gap-2">
              {platforms.map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => togglePlatform(value)}
                  className={clsx(
                    'px-4 py-2 rounded-lg border font-medium transition-all flex items-center gap-2',
                    selectedPlatforms.includes(value)
                      ? color
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
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
              <p className="text-xs text-gray-500 mt-2">Toutes les plateformes incluses</p>
            )}
          </div>

          {/* Tags Filter - Top 10 only */}
          {tags && tags.length > 0 && (
            <div className="mb-8">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-4">
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
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {tag.name}
                    <span className="ml-1 opacity-60">({tag._count.contents})</span>
                  </button>
                ))}
              </div>
              {tags.length > 10 && (
                <p className="text-xs text-gray-500 mt-2">
                  +{tags.length - 10} autres thèmes disponibles
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-500">OU</span>
            </div>
          </div>

          {/* Specific Content Selection */}
          <div className="mb-8">
            <button
              onClick={() => setShowContentPicker(!showContentPicker)}
              className="flex items-center justify-between w-full p-4 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <span className="text-gray-900 font-medium">
                {hasSpecificContent
                  ? `${selectedContentIds.length} contenu${selectedContentIds.length !== 1 ? 's' : ''} sélectionné${selectedContentIds.length !== 1 ? 's' : ''}`
                  : 'Sélectionner des contenus spécifiques...'}
              </span>
              <ChevronDown
                size={20}
                className={clsx(
                  'text-gray-400 transition-transform',
                  showContentPicker && 'rotate-180'
                )}
              />
            </button>

            {showContentPicker && (
              <div className="mt-4 max-h-64 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                {readyContent?.contents.map((content) => (
                  <button
                    key={content.id}
                    onClick={() => toggleContent(content.id)}
                    disabled={hasFilters}
                    className={clsx(
                      'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                      selectedContentIds.includes(content.id)
                        ? 'bg-gray-100 border border-gray-300'
                        : 'hover:bg-gray-100 border border-transparent',
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
                      <div className="w-16 h-10 rounded bg-gray-200 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{content.title}</p>
                      <p className="text-xs text-gray-500">
                        {content._count.quizzes} quiz
                      </p>
                    </div>
                    {selectedContentIds.includes(content.id) && (
                      <CheckSquare size={18} className="text-gray-700 flex-shrink-0" />
                    )}
                  </button>
                ))}
                {readyContent?.contents.length === 0 && (
                  <p className="text-center text-gray-500 py-4">Aucun contenu avec des quiz</p>
                )}
              </div>
            )}
            {hasFilters && showContentPicker && (
              <p className="text-xs text-gray-500 mt-2">Retire les filtres pour sélectionner des contenus spécifiques</p>
            )}
          </div>

          {/* Preview */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 mb-8">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Quiz disponibles</span>
              {isPreviewLoading ? (
                <Loader2 size={18} className="text-gray-400 animate-spin" />
              ) : (
                <span className="text-2xl font-semibold text-gray-900">{matchingCards}</span>
              )}
            </div>
            {matchingCards > 0 && questionLimit && questionLimit < matchingCards && (
              <p className="text-xs text-gray-500 mt-2">
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
            <p className="text-center text-gray-500 text-sm mt-4">
              Aucun quiz ne correspond à tes critères. Essaie d'ajuster les filtres.
            </p>
          )}
        </div>

        {/* Quick Start Option */}
        <div className="mt-6 text-center">
          <Link
            to="/review"
            className="text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            Ou lancer une session rapide avec les paramètres par défaut
          </Link>
        </div>
      </div>
    </div>
  );
}
