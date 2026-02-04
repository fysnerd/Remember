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
  queryParams.set('sortOrder', 'desc');
  if (platformFilters.size > 0) {
    queryParams.set('platform', Array.from(platformFilters).join(','));
  }
  if (searchQuery) queryParams.set('search', searchQuery);
  if (selectedTags.length > 0) queryParams.set('tags', selectedTags.join(','));

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

  const bulkArchive = useMutation({
    mutationFn: async (contentIds: string[]) => {
      return api.post('/content/triage/bulk', { contentIds, action: 'archive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-count'] });
      setSelectedIds(new Set());
    },
  });

  const bulkUnarchive = useMutation({
    mutationFn: async (contentIds: string[]) => {
      return api.post('/content/triage/bulk', { contentIds, action: 'learn' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-count'] });
      setSelectedIds(new Set());
    },
  });

  const bulkRetry = useMutation({
    mutationFn: async (contentIds: string[]) => {
      return api.post('/content/bulk-retry', { contentIds });
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

    const selectedContent = data?.contents.filter(c => selectedIds.has(c.id)) || [];
    const readyContent = selectedContent.filter(c => c._count.quizzes > 0);
    const newContent = selectedContent.filter(c => c.status === 'INBOX');
    const failedContent = selectedContent.filter(c => c.status === 'FAILED');

    // Générer des quiz pour les nouveaux contenus
    if (newContent.length > 0) {
      bulkGenerateQuiz.mutate(newContent.map(c => c.id));
    }

    // Relancer le pipeline pour les contenus en échec
    if (failedContent.length > 0) {
      bulkRetry.mutate(failedContent.map(c => c.id));
    }

    if (readyContent.length > 0) {
      const contentIds = readyContent.map(c => c.id).join(',');
      navigate(`/review/configure?contentIds=${contentIds}`);
    } else if (newContent.length > 0 || failedContent.length > 0) {
      const messages: string[] = [];
      if (newContent.length > 0) messages.push(`${newContent.length} nouveau(x)`);
      if (failedContent.length > 0) messages.push(`${failedContent.length} relancé(s)`);
      alert(`${messages.join(' + ')} en cours de traitement. Reviens plus tard !`);
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
  const selectedContentForBar = data?.contents.filter(c => selectedIds.has(c.id)) || [];
  const totalQuizzes = selectedContentForBar.reduce((acc, c) => acc + c._count.quizzes, 0);
  const newContentCount = selectedContentForBar.filter(c => c.status === 'INBOX').length;
  const failedContentCount = selectedContentForBar.filter(c => c.status === 'FAILED').length;

  // Get badge config for content
  const getBadge = (content: Content) => {
    if (content.status === 'INBOX') {
      return { label: 'Nouveau', class: 'bg-blue-100 text-blue-700' };
    }
    if (content.status === 'ARCHIVED') {
      return { label: 'Passé', class: 'bg-gray-100 text-gray-500' };
    }
    if (content._count.quizzes > 0) {
      return { label: `${content._count.quizzes} quiz`, class: 'bg-green-100 text-green-700' };
    }
    if (content.status === 'TRANSCRIBING' || content.status === 'GENERATING') {
      return { label: 'En cours...', class: 'bg-yellow-100 text-yellow-700' };
    }
    if (content.status === 'FAILED') {
      return { label: 'Échec', class: 'bg-red-100 text-red-700' };
    }
    return { label: 'En attente', class: 'bg-gray-100 text-gray-500' };
  };

  const platforms: { key: PlatformFilter; label: string }[] = [
    { key: 'YOUTUBE', label: 'YouTube' },
    { key: 'SPOTIFY', label: 'Spotify' },
    { key: 'TIKTOK', label: 'TikTok' },
    { key: 'INSTAGRAM', label: 'Instagram' },
  ];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">
                Qu'est-ce que tu veux réviser ?
              </h1>
              <p className="text-sm text-gray-500">
                Sélectionne les contenus que tu veux apprendre
              </p>
            </div>

            <div className="flex items-center gap-2">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rechercher..."
                  className="input-search w-56"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </form>

              <button
                onClick={() => refreshContent.mutate()}
                disabled={refreshContent.isPending}
                className="btn-ghost p-2"
                title="Synchroniser"
              >
                <RefreshCw size={18} className={refreshContent.isPending ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Platform Filters */}
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Plateformes</p>
            <div className="flex flex-wrap gap-2">
              {platforms.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => togglePlatform(key)}
                  className={clsx(
                    'px-3 py-1.5 rounded text-sm border',
                    platformFilters.has(key)
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag Filters */}
          {allTags && allTags.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Tag size={12} /> Thèmes
              </p>
              <div className="flex flex-wrap gap-2">
                {allTags.slice(0, 10).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.name)}
                    className={clsx(
                      'px-2 py-1 rounded text-xs border',
                      selectedTags.includes(tag.name)
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {tag.name} ({tag._count.contents})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* View Filter */}
          <div className="flex items-center gap-3">
            <p className="text-xs font-medium text-gray-500">Afficher</p>
            <div className="flex border border-gray-200 rounded overflow-hidden">
              <button
                onClick={() => { setViewFilter('active'); setPage(1); }}
                className={clsx(
                  'px-3 py-1.5 text-sm',
                  viewFilter === 'active'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                Actifs
              </button>
              <button
                onClick={() => { setViewFilter('passed'); setPage(1); }}
                className={clsx(
                  'px-3 py-1.5 text-sm border-l border-gray-200',
                  viewFilter === 'passed'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                Archives
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin mb-3" />
            <p className="text-gray-500 text-sm">Chargement...</p>
          </div>
        ) : !data?.contents.length ? (
          <div className="border border-gray-200 rounded-lg text-center py-12">
            <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">
              {viewFilter === 'passed' ? 'Aucun contenu archivé' : 'Prêt à apprendre ?'}
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {viewFilter === 'passed'
                ? 'Tu n\'as pas encore archivé de contenu.'
                : 'Connecte YouTube, Spotify ou TikTok dans les paramètres.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {data.contents.map((content) => {
              const badge = getBadge(content);
              const isSelected = selectedIds.has(content.id);
              const isNew = content.status === 'INBOX';
              const isPassed = content.status === 'ARCHIVED';

              return (
                <div
                  key={content.id}
                  onClick={() => toggleSelection(content.id)}
                  className={clsx(
                    'group relative cursor-pointer rounded border overflow-hidden',
                    isSelected
                      ? 'border-gray-900 ring-1 ring-gray-900'
                      : 'border-gray-200 hover:border-gray-300',
                    isPassed && 'opacity-60'
                  )}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-100">
                    {content.thumbnailUrl ? (
                      <img
                        src={content.thumbnailUrl}
                        alt={content.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play size={20} className="text-gray-400" />
                      </div>
                    )}

                    {/* Badge */}
                    <span className={clsx(
                      'absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium',
                      badge.class
                    )}>
                      {badge.label}
                    </span>

                    {/* Platform */}
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 text-white rounded text-[10px] font-medium">
                      {content.platform === 'YOUTUBE' ? 'YT' : content.platform === 'SPOTIFY' ? 'SP' : content.platform === 'TIKTOK' ? 'TT' : 'IG'}
                    </span>

                    {/* Duration */}
                    {content.duration && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[10px] rounded">
                        {formatDuration(content.duration)}
                      </span>
                    )}

                    {/* Selection checkbox */}
                    <div className={clsx(
                      'absolute bottom-1.5 left-1.5',
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}>
                      <div className={clsx(
                        'w-5 h-5 rounded border flex items-center justify-center',
                        isSelected
                          ? 'bg-gray-900 border-gray-900 text-white'
                          : 'bg-white/80 border-gray-300'
                      )}>
                        {isSelected && <CheckCircle2 size={12} />}
                      </div>
                    </div>

                    {/* Skip/Reactivate buttons */}
                    {isNew && (
                      <button
                        onClick={(e) => handleSkip(e, content.id)}
                        className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-white/90 text-gray-600 hover:text-red-600 text-[10px] rounded opacity-0 group-hover:opacity-100"
                      >
                        Passer
                      </button>
                    )}
                    {isPassed && (
                      <button
                        onClick={(e) => handleReactivate(e, content.id)}
                        className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-white/90 text-gray-600 hover:text-green-600 text-[10px] rounded opacity-0 group-hover:opacity-100"
                      >
                        Réactiver
                      </button>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-2">
                    <h3 className="text-xs font-medium text-gray-900 line-clamp-2">
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
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary text-sm disabled:opacity-30"
            >
              Précédent
            </button>
            <span className="text-sm text-gray-500">
              Page {page} sur {data.pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
              className="btn-secondary text-sm disabled:opacity-30"
            >
              Suivant
            </button>
          </div>
        )}
      </div>

      {/* Sticky Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-56 right-0 bg-white border-t border-gray-200 p-3 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
              <span className="text-sm text-gray-500">
                • {totalQuizzes} quiz
                {newContentCount > 0 && ` • ${newContentCount} nouveau${newContentCount > 1 ? 'x' : ''}`}
                {failedContentCount > 0 && ` • ${failedContentCount} en échec`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="btn-ghost text-sm">
                Tout sélectionner
              </button>
              <button onClick={clearSelection} className="btn-ghost text-sm text-gray-500">
                Annuler
              </button>
              {viewFilter === 'passed' ? (
                <button
                  onClick={() => bulkUnarchive.mutate(Array.from(selectedIds))}
                  disabled={bulkUnarchive.isPending}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  <BookOpen size={14} />
                  {bulkUnarchive.isPending ? 'Réactivation...' : 'Désarchiver'}
                </button>
              ) : (
                <button
                  onClick={() => bulkArchive.mutate(Array.from(selectedIds))}
                  disabled={bulkArchive.isPending}
                  className="btn-secondary flex items-center gap-1.5"
                >
                  <Archive size={14} />
                  {bulkArchive.isPending ? 'Archivage...' : 'Archiver'}
                </button>
              )}
              <button
                onClick={handleStartReview}
                disabled={bulkGenerateQuiz.isPending}
                className="btn-primary"
              >
                {bulkGenerateQuiz.isPending ? 'Traitement...' : 'Réviser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedContentId && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedContentId(null)}
        >
          <div
            className="modal-content flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : contentDetail ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 mb-2">
                        {contentDetail.title}
                      </h2>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          getBadge(contentDetail).class
                        )}>
                          {getBadge(contentDetail).label}
                        </span>
                        {contentDetail.duration && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={12} />
                            {formatDuration(contentDetail.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedContentId(null)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {contentDetail.thumbnailUrl && (
                    <div className="aspect-video bg-gray-100 rounded overflow-hidden mb-4">
                      <img
                        src={contentDetail.thumbnailUrl}
                        alt={contentDetail.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="border border-gray-200 rounded p-3 text-center">
                      <p className="text-xl font-semibold text-gray-900">{contentDetail.quizzes.length}</p>
                      <p className="text-xs text-gray-500">Quiz</p>
                    </div>
                    <div className="border border-gray-200 rounded p-3 text-center">
                      <p className="text-xl font-semibold text-gray-900">
                        {contentDetail.transcript ? 'Oui' : 'Non'}
                      </p>
                      <p className="text-xs text-gray-500">Transcrit</p>
                    </div>
                    <div className="border border-gray-200 rounded p-3 text-center">
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(contentDetail.capturedAt).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-xs text-gray-500">Capturé</p>
                    </div>
                  </div>

                  {/* Quiz Preview */}
                  {contentDetail.quizzes.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">
                        Quiz ({contentDetail.quizzes.length})
                      </h4>
                      <div className="space-y-2">
                        {contentDetail.quizzes.slice(0, 3).map((quiz, idx) => (
                          <div key={quiz.id} className="border border-gray-200 rounded p-3">
                            <p className="text-sm text-gray-900">
                              <span className="font-medium text-gray-400 mr-2">{idx + 1}.</span>
                              {quiz.question}
                            </p>
                          </div>
                        ))}
                        {contentDetail.quizzes.length > 3 && (
                          <p className="text-xs text-gray-500">
                            +{contentDetail.quizzes.length - 3} autres questions
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 flex gap-2">
                  <a
                    href={contentDetail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} />
                    Voir l'original
                  </a>
                  {contentDetail.status === 'ARCHIVED' && (
                    <button
                      onClick={() => reactivateContent.mutate(contentDetail.id)}
                      disabled={reactivateContent.isPending}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      <BookOpen size={14} />
                      {reactivateContent.isPending ? 'Réactivation...' : 'Réactiver'}
                    </button>
                  )}
                  {contentDetail.status === 'INBOX' && (
                    <button
                      onClick={() => skipContent.mutate(contentDetail.id)}
                      disabled={skipContent.isPending}
                      className="btn-ghost flex items-center justify-center gap-2"
                    >
                      <Archive size={14} />
                      {skipContent.isPending ? 'Archivage...' : 'Passer'}
                    </button>
                  )}
                  {contentDetail.status !== 'INBOX' && contentDetail.status !== 'ARCHIVED' && (
                    <button
                      onClick={() => skipContent.mutate(contentDetail.id)}
                      disabled={skipContent.isPending}
                      className="btn-ghost flex items-center justify-center gap-2"
                    >
                      <Archive size={14} />
                      {skipContent.isPending ? 'Archivage...' : 'Archiver'}
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
