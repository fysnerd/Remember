import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, X, Search, Play, CheckCircle2, Loader2, BookOpen, Clock,
  ExternalLink, Tag, Archive
} from 'lucide-react';
import { api } from '../lib/api';
import clsx from 'clsx';

interface TagType {
  id: string;
  name: string;
}

interface Content {
  id: string;
  platform: 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK' | 'INSTAGRAM';
  externalId: string;
  url: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  showName: string | null;
  listenProgress: number | null;
  fullyPlayed: boolean;
  authorUsername: string | null;
  viewCount: number | null;
  status: 'INBOX' | 'ARCHIVED' | 'PENDING' | 'SELECTED' | 'TRANSCRIBING' | 'GENERATING' | 'READY' | 'FAILED' | 'UNSUPPORTED';
  capturedAt: string;
  tags: TagType[];
  _count: { quizzes: number };
}

interface ContentResponse {
  contents: Content[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ContentDetailResponse extends Content {
  transcript: {
    id: string;
    text: string;
    language: string;
    source: string;
    createdAt: string;
  } | null;
  quizzes: {
    id: string;
    question: string;
    type: string;
    options: string[];
    correctAnswer: string;
  }[];
}

type PlatformFilter = 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK' | 'INSTAGRAM';
type ViewFilter = 'active' | 'passed';

export function LearnPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filters
  const [platformFilters, setPlatformFilters] = useState<Set<PlatformFilter>>(new Set());
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Detail modal
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [platformFilters, selectedTags, viewFilter, searchQuery, page]);

  // Build query params
  const queryParams = new URLSearchParams();
  queryParams.set('page', page.toString());
  queryParams.set('limit', '24');
  queryParams.set('sortBy', 'capturedAt');
  queryParams.set('sortOrder', 'desc'); // Plus récent en premier
  if (platformFilters.size > 0) {
    queryParams.set('platform', Array.from(platformFilters).join(','));
  }
  if (searchQuery) queryParams.set('search', searchQuery);
  if (selectedTags.length > 0) queryParams.set('tags', selectedTags.join(','));

  // Map view filter to backend category
  if (viewFilter === 'active') {
    queryParams.set('category', 'all');
    queryParams.set('excludeArchived', 'true');
  } else {
    queryParams.set('category', 'archived');
  }

  const { data, isLoading } = useQuery<ContentResponse>({
    queryKey: ['content', page, Array.from(platformFilters), viewFilter, searchQuery, selectedTags],
    queryFn: async () => {
      const res = await api.get<ContentResponse>(`/content?${queryParams.toString()}`);
      return res.data;
    },
  });

  type TagWithCount = { id: string; name: string; _count: { contents: number } };
  const { data: allTags } = useQuery<TagWithCount[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await api.get<TagWithCount[]>('/content/tags');
      return res.data;
    },
  });

  const { data: contentDetail, isLoading: isLoadingDetail } = useQuery<ContentDetailResponse>({
    queryKey: ['content', selectedContentId],
    queryFn: async () => {
      const res = await api.get<ContentDetailResponse>(`/content/${selectedContentId}`);
      return res.data;
    },
    enabled: !!selectedContentId,
  });

  // Mutations
  const refreshContent = useMutation({
    mutationFn: async () => {
      return api.post<{ message: string; totalNewItems: number }>('/content/refresh');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-count'] });
    },
  });

  const skipContent = useMutation({
    mutationFn: async (contentId: string) => {
      return api.patch(`/content/${contentId}/triage`, { action: 'archive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });

  const reactivateContent = useMutation({
    mutationFn: async (contentId: string) => {
      return api.patch(`/content/${contentId}/triage`, { action: 'learn' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      setSelectedContentId(null);
    },
  });

  interface BulkGenerateResponse {
    success: boolean;
    message: string;
    results: {
      queued: string[];
      skipped: { id: string; reason: string }[];
      needsTranscript: string[];
    };
  }

  const bulkGenerateQuiz = useMutation({
    mutationFn: async (contentIds: string[]) => {
      return api.post<BulkGenerateResponse>('/content/bulk-generate-quiz', { contentIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      setSelectedIds(new Set());
    },
  });

  // Handlers
  const togglePlatform = (platform: PlatformFilter) => {
    const newFilters = new Set(platformFilters);
    if (newFilters.has(platform)) {
      newFilters.delete(platform);
    } else {
      newFilters.add(platform);
    }
    setPlatformFilters(newFilters);
    setPage(1);
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
    setPage(1);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const handleSkip = (e: React.MouseEvent, contentId: string) => {
    e.stopPropagation();
    skipContent.mutate(contentId);
  };

  const handleReactivate = (e: React.MouseEvent, contentId: string) => {
    e.stopPropagation();
    reactivateContent.mutate(contentId);
  };

  const handleStartReview = () => {
    if (selectedIds.size === 0) return;

    // Get selected content that has quizzes (READY status)
    const selectedContent = data?.contents.filter(c => selectedIds.has(c.id)) || [];
    const readyContent = selectedContent.filter(c => c._count.quizzes > 0);
    const newContent = selectedContent.filter(c => c.status === 'INBOX');

    if (newContent.length > 0) {
      // Trigger transcription for new content
      bulkGenerateQuiz.mutate(newContent.map(c => c.id));
    }

    if (readyContent.length > 0) {
      // Navigate to review with selected content IDs
      const contentIds = readyContent.map(c => c.id).join(',');
      navigate(`/review/configure?contentIds=${contentIds}`);
    } else if (newContent.length > 0) {
      alert(`${newContent.length} contenu(s) en cours de traitement. Reviens plus tard !`);
    }
  };

  const selectAll = () => {
    if (data?.contents) {
      setSelectedIds(new Set(data.contents.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate quiz count from selection
  const selectedContent = data?.contents.filter(c => selectedIds.has(c.id)) || [];
  const totalQuizzes = selectedContent.reduce((acc, c) => acc + c._count.quizzes, 0);
  const newContentCount = selectedContent.filter(c => c.status === 'INBOX').length;

  // Get badge config for content
  const getBadge = (content: Content) => {
    if (content.status === 'INBOX') {
      return { label: '🆕 Nouveau', class: 'bg-info text-white' };
    }
    if (content.status === 'ARCHIVED') {
      return { label: 'passé', class: 'bg-void-300 text-cream-dark' };
    }
    if (content._count.quizzes > 0) {
      return { label: `${content._count.quizzes} quiz`, class: 'bg-sage text-void' };
    }
    if (content.status === 'TRANSCRIBING' || content.status === 'GENERATING') {
      return { label: 'En cours...', class: 'bg-amber text-void' };
    }
    if (content.status === 'FAILED') {
      return { label: 'Échec', class: 'bg-rust text-white' };
    }
    return { label: 'En attente', class: 'bg-void-200 text-cream-dark' };
  };

  const platforms: { key: PlatformFilter; label: string; icon: string; color: string }[] = [
    { key: 'YOUTUBE', label: 'YouTube', icon: 'YT', color: 'bg-[#FF0000]/20 text-[#FF6B6B] border-[#FF0000]/30' },
    { key: 'SPOTIFY', label: 'Spotify', icon: 'SP', color: 'bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/30' },
    { key: 'TIKTOK', label: 'TikTok', icon: 'TT', color: 'bg-[#00f2ea]/20 text-[#00f2ea] border-[#00f2ea]/30' },
    { key: 'INSTAGRAM', label: 'Instagram', icon: 'IG', color: 'bg-[#FD1D1D]/20 text-[#FD1D1D] border-[#FD1D1D]/30' },
  ];

  return (
    <div className="min-h-screen p-8">
      {/* Ambient effects */}
      <div className="fixed top-20 right-20 w-72 h-72 bg-amber/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 left-80 w-48 h-48 bg-sage/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-display text-cream mb-2">
                Qu'est-ce que tu veux réviser ?
              </h1>
              <p className="text-cream-dark">
                Sélectionne les contenus que tu veux apprendre
              </p>
            </div>

            <div className="flex items-center gap-3">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cream-dark" size={18} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher..."
                  className="input-search w-64 pl-11"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-cream-dark hover:text-cream"
                  >
                    <X size={16} />
                  </button>
                )}
              </form>

              <button
                onClick={() => refreshContent.mutate()}
                disabled={refreshContent.isPending}
                className="btn-ghost p-3"
                title="Synchroniser"
              >
                <RefreshCw size={20} className={refreshContent.isPending ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Platform Filters */}
          <div className="mb-4">
            <p className="text-sm font-medium text-cream-muted mb-3">Plateformes</p>
            <div className="flex flex-wrap gap-2">
              {platforms.map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => togglePlatform(key)}
                  className={clsx(
                    'px-4 py-2 rounded-full text-sm font-medium border transition-all',
                    platformFilters.has(key)
                      ? color
                      : 'bg-void-100 text-cream-muted border-void-200 hover:border-void-300'
                  )}
                >
                  {label}
                  {platformFilters.has(key) && ' ✓'}
                </button>
              ))}
            </div>
          </div>

          {/* Tag Filters */}
          {allTags && allTags.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-cream-muted mb-3 flex items-center gap-2">
                <Tag size={14} /> Thèmes
              </p>
              <div className="flex flex-wrap gap-2">
                {allTags.slice(0, 10).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.name)}
                    className={clsx(
                      'px-3 py-1.5 rounded-full text-sm border transition-all',
                      selectedTags.includes(tag.name)
                        ? 'bg-amber/20 text-amber border-amber/30'
                        : 'bg-void-100 text-cream-muted border-void-200 hover:border-void-300'
                    )}
                  >
                    {tag.name}
                    <span className="ml-1 opacity-60">({tag._count.contents})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* View Filter */}
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium text-cream-muted">Afficher</p>
            <div className="flex bg-void-100 border border-void-200 rounded-xl overflow-hidden">
              <button
                onClick={() => { setViewFilter('active'); setPage(1); }}
                className={clsx(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  viewFilter === 'active'
                    ? 'bg-amber/20 text-amber'
                    : 'text-cream-muted hover:text-cream'
                )}
              >
                ● Actifs
              </button>
              <button
                onClick={() => { setViewFilter('passed'); setPage(1); }}
                className={clsx(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  viewFilter === 'passed'
                    ? 'bg-amber/20 text-amber'
                    : 'text-cream-muted hover:text-cream'
                )}
              >
                ○ Passés
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber animate-spin mb-4" />
            <p className="text-cream-dark">Chargement...</p>
          </div>
        ) : !data?.contents.length ? (
          <div className="card text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-void-200 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={32} className="text-cream-dark" />
            </div>
            <h3 className="text-xl font-display text-cream mb-2">
              {viewFilter === 'passed' ? 'Aucun contenu passé' : 'Prêt à apprendre ?'}
            </h3>
            <p className="text-cream-dark max-w-md mx-auto">
              {viewFilter === 'passed'
                ? 'Tu n\'as pas encore passé de contenu. Utilise le bouton "Passer" sur les contenus que tu ne veux pas apprendre.'
                : 'Connecte YouTube, Spotify ou TikTok dans les paramètres pour commencer à capturer du contenu.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {data.contents.map((content, index) => {
              const badge = getBadge(content);
              const isSelected = selectedIds.has(content.id);
              const isNew = content.status === 'INBOX';
              const isPassed = content.status === 'ARCHIVED';

              return (
                <div
                  key={content.id}
                  onClick={() => toggleSelection(content.id)}
                  className={clsx(
                    'group relative cursor-pointer rounded-xl overflow-hidden border transition-all animate-slide-up',
                    isSelected
                      ? 'border-amber ring-2 ring-amber/50 bg-amber/5'
                      : 'border-void-200 hover:border-void-300 bg-void-50',
                    isPassed && 'opacity-60'
                  )}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-void-200">
                    {content.thumbnailUrl ? (
                      <img
                        src={content.thumbnailUrl}
                        alt={content.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play size={24} className="text-cream-dark" />
                      </div>
                    )}

                    {/* Badge */}
                    <span className={clsx(
                      'absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-semibold',
                      badge.class
                    )}>
                      {badge.label}
                    </span>

                    {/* Platform indicator */}
                    <span className={clsx(
                      'absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold',
                      content.platform === 'YOUTUBE' && 'bg-[#FF0000]/90 text-white',
                      content.platform === 'SPOTIFY' && 'bg-[#1DB954]/90 text-white',
                      content.platform === 'TIKTOK' && 'bg-gradient-to-br from-[#00f2ea] to-[#ff0050] text-white',
                      content.platform === 'INSTAGRAM' && 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white'
                    )}>
                      {content.platform === 'YOUTUBE' ? 'YT' : content.platform === 'SPOTIFY' ? 'SP' : content.platform === 'TIKTOK' ? 'TT' : 'IG'}
                    </span>

                    {/* Duration */}
                    {content.duration && (
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-void/80 backdrop-blur text-cream text-xs rounded">
                        {formatDuration(content.duration)}
                      </span>
                    )}

                    {/* Selection checkbox */}
                    <div className={clsx(
                      'absolute bottom-2 left-2 transition-opacity',
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}>
                      <div className={clsx(
                        'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all',
                        isSelected
                          ? 'bg-amber border-amber text-void'
                          : 'bg-void/80 border-cream/30'
                      )}>
                        {isSelected && <CheckCircle2 size={14} />}
                      </div>
                    </div>

                    {/* Skip button for new content */}
                    {isNew && (
                      <button
                        onClick={(e) => handleSkip(e, content.id)}
                        className="absolute bottom-2 right-2 px-2 py-1 bg-void/80 backdrop-blur text-cream-dark hover:text-rust text-xs rounded transition-all opacity-0 group-hover:opacity-100"
                      >
                        ✗ Passer
                      </button>
                    )}

                    {/* Reactivate button for passed content */}
                    {isPassed && (
                      <button
                        onClick={(e) => handleReactivate(e, content.id)}
                        className="absolute bottom-2 right-2 px-2 py-1 bg-sage/80 backdrop-blur text-void text-xs rounded transition-all opacity-0 group-hover:opacity-100"
                      >
                        Réactiver
                      </button>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-cream line-clamp-2 group-hover:text-amber transition-colors">
                      {content.title}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary px-4 py-2 disabled:opacity-30"
            >
              ← Précédent
            </button>
            <span className="text-cream-muted">
              Page {page} sur {data.pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
              className="btn-secondary px-4 py-2 disabled:opacity-30"
            >
              Suivant →
            </button>
          </div>
        )}
      </div>

      {/* Sticky Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-64 right-0 bg-void-50 border-t border-void-200 p-4 animate-slide-up z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-cream font-medium">
                ☑ {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
              <span className="text-cream-dark">
                • {totalQuizzes} quiz prêt{totalQuizzes > 1 ? 's' : ''}
                {newContentCount > 0 && ` • ${newContentCount} nouveau${newContentCount > 1 ? 'x' : ''}`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={selectAll}
                className="btn-ghost text-sm"
              >
                Tout sélectionner
              </button>
              <button
                onClick={clearSelection}
                className="btn-ghost text-sm text-cream-dark"
              >
                Annuler
              </button>
              <button
                onClick={handleStartReview}
                disabled={bulkGenerateQuiz.isPending}
                className="btn-primary flex items-center gap-2"
              >
                {bulkGenerateQuiz.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    Réviser →
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedContentId && (
        <div
          className="modal-backdrop animate-fade-in"
          onClick={() => setSelectedContentId(null)}
        >
          <div
            className="modal-content flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-amber animate-spin" />
              </div>
            ) : contentDetail ? (
              <>
                {/* Header */}
                <div className="p-6 border-b border-void-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-display text-cream mb-3">
                        {contentDetail.title}
                      </h2>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx(
                          'px-2 py-1 rounded-lg text-xs font-semibold',
                          getBadge(contentDetail).class
                        )}>
                          {getBadge(contentDetail).label}
                        </span>
                        {contentDetail.duration && (
                          <span className="text-sm text-cream-dark flex items-center gap-1">
                            <Clock size={14} />
                            {formatDuration(contentDetail.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedContentId(null)}
                      className="p-2 text-cream-dark hover:text-cream rounded-lg hover:bg-void-100 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {contentDetail.thumbnailUrl && (
                    <div className="aspect-video bg-void-200 rounded-xl overflow-hidden mb-6">
                      <img
                        src={contentDetail.thumbnailUrl}
                        alt={contentDetail.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-void-100 rounded-xl p-4 text-center border border-void-200">
                      <p className="text-2xl font-display text-cream">{contentDetail.quizzes.length}</p>
                      <p className="text-sm text-cream-dark">Quiz</p>
                    </div>
                    <div className="bg-void-100 rounded-xl p-4 text-center border border-void-200">
                      <p className="text-2xl font-display text-cream">
                        {contentDetail.transcript ? 'Oui' : 'Non'}
                      </p>
                      <p className="text-sm text-cream-dark">Transcrit</p>
                    </div>
                    <div className="bg-void-100 rounded-xl p-4 text-center border border-void-200">
                      <p className="text-sm font-medium text-cream">
                        {new Date(contentDetail.capturedAt).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-sm text-cream-dark">Capturé</p>
                    </div>
                  </div>

                  {/* Quiz Preview */}
                  {contentDetail.quizzes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-cream-muted mb-3">
                        Quiz ({contentDetail.quizzes.length})
                      </h4>
                      <div className="space-y-2">
                        {contentDetail.quizzes.slice(0, 3).map((quiz, idx) => (
                          <div key={quiz.id} className="bg-void-100 border border-void-200 rounded-xl p-4">
                            <p className="text-sm text-cream">
                              <span className="text-amber font-medium mr-2">{idx + 1}.</span>
                              {quiz.question}
                            </p>
                          </div>
                        ))}
                        {contentDetail.quizzes.length > 3 && (
                          <p className="text-sm text-cream-dark">
                            +{contentDetail.quizzes.length - 3} autres questions
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-void-200 flex gap-3">
                  <a
                    href={contentDetail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} />
                    Voir l'original
                  </a>
                  {contentDetail.status === 'ARCHIVED' && (
                    <button
                      onClick={() => reactivateContent.mutate(contentDetail.id)}
                      disabled={reactivateContent.isPending}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      <BookOpen size={16} />
                      {reactivateContent.isPending ? 'Réactivation...' : 'Réactiver'}
                    </button>
                  )}
                  {contentDetail.status === 'INBOX' && (
                    <button
                      onClick={() => skipContent.mutate(contentDetail.id)}
                      disabled={skipContent.isPending}
                      className="btn-ghost flex items-center justify-center gap-2"
                    >
                      <Archive size={16} />
                      {skipContent.isPending ? 'Passage...' : 'Passer'}
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
