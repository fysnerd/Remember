import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Grid, List, Filter, ChevronLeft, ChevronRight, Play, RefreshCw, X, Search,
  Download, Tag, ExternalLink, Clock, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { api } from '../lib/api';
import clsx from 'clsx';

interface Tag {
  id: string;
  name: string;
}

interface Content {
  id: string;
  platform: 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK';
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
  status: 'PENDING' | 'SELECTED' | 'TRANSCRIBING' | 'GENERATING' | 'READY' | 'FAILED' | 'UNSUPPORTED';
  capturedAt: string;
  tags: Tag[];
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

type ViewMode = 'grid' | 'list';
type PlatformFilter = 'all' | 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK';
type StatusFilter = 'all' | 'PENDING' | 'READY' | 'FAILED';

export function LibraryPage() {
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const queryClient = useQueryClient();

  // Build query params
  const queryParams = new URLSearchParams();
  queryParams.set('page', page.toString());
  queryParams.set('limit', '20');
  if (platformFilter !== 'all') queryParams.set('platform', platformFilter);
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (searchQuery) queryParams.set('search', searchQuery);
  if (selectedTags.length > 0) queryParams.set('tags', selectedTags.join(','));

  const { data, isLoading } = useQuery<ContentResponse>({
    queryKey: ['content', page, platformFilter, statusFilter, searchQuery, selectedTags],
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const { data: contentDetail, isLoading: isLoadingDetail } = useQuery<ContentDetailResponse>({
    queryKey: ['content', selectedContentId],
    queryFn: async () => {
      const res = await api.get<ContentDetailResponse>(`/content/${selectedContentId}`);
      return res.data;
    },
    enabled: !!selectedContentId,
  });

  const generateQuiz = useMutation({
    mutationFn: async (contentId: string) => {
      return api.post(`/content/${contentId}/generate-quiz`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });

  const retryContent = useMutation({
    mutationFn: async (contentId: string) => {
      return api.post(`/content/${contentId}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusConfig = (status: Content['status']) => {
    const configs = {
      PENDING: { class: 'status-pending', label: 'Pending', icon: Clock },
      SELECTED: { class: 'status-processing', label: 'Processing', icon: Loader2 },
      TRANSCRIBING: { class: 'status-processing', label: 'Transcribing', icon: Loader2 },
      GENERATING: { class: 'status-processing', label: 'Generating', icon: Loader2 },
      READY: { class: 'status-ready', label: 'Ready', icon: CheckCircle2 },
      FAILED: { class: 'status-failed', label: 'Failed', icon: AlertCircle },
      UNSUPPORTED: { class: 'badge-muted', label: 'Unsupported', icon: AlertCircle },
    };
    return configs[status];
  };

  const activeFilters = (platformFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (selectedTags.length > 0 ? 1 : 0);

  const handleExportAll = async () => {
    try {
      const response = await api.post<Blob>('/export/bulk', {}, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `remember-archive-${new Date().toISOString().split('T')[0]}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleExportSingle = async (contentId: string) => {
    try {
      const response = await api.get<Blob>(`/export/${contentId}`, { responseType: 'blob' });
      const contentDisposition = response.headers?.get('content-disposition');
      const filename = contentDisposition
        ? decodeURIComponent(contentDisposition.split('filename="')[1]?.split('"')[0] || 'export.md')
        : 'export.md';
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="min-h-screen p-8">
      {/* Ambient effects */}
      <div className="fixed top-20 right-20 w-72 h-72 bg-amber/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="animate-fade-in">
            <h1 className="text-3xl font-display text-cream mb-1">Archive</h1>
            <p className="text-cream-dark">
              {data ? (
                <span>{data.pagination.total} memories captured</span>
              ) : (
                'Loading your archive...'
              )}
            </p>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3 animate-slide-down">
            <form onSubmit={handleSearch} className="flex-1 lg:w-80">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cream-dark" size={18} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search archive..."
                  className="input-search w-full"
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
              </div>
            </form>

            <button
              onClick={handleExportAll}
              className="btn-ghost p-3"
              title="Export all as ZIP"
            >
              <Download size={20} />
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                'btn-ghost p-3 relative',
                (showFilters || activeFilters > 0) && 'text-amber'
              )}
            >
              <Filter size={20} />
              {activeFilters > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber text-void text-xs font-bold rounded-full flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>

            <div className="flex bg-void-100 border border-void-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'p-3 transition-colors',
                  viewMode === 'grid' ? 'bg-amber/20 text-amber' : 'text-cream-muted hover:text-cream'
                )}
              >
                <Grid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  'p-3 transition-colors',
                  viewMode === 'list' ? 'bg-amber/20 text-amber' : 'text-cream-muted hover:text-cream'
                )}
              >
                <List size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-8 p-6 bg-void-50 border border-void-200 rounded-2xl animate-slide-down">
            <div className="flex flex-wrap gap-6">
              <div>
                <label className="block text-sm font-medium text-cream-muted mb-2">Platform</label>
                <select
                  value={platformFilter}
                  onChange={(e) => { setPlatformFilter(e.target.value as PlatformFilter); setPage(1); }}
                  className="input text-sm bg-void-100"
                >
                  <option value="all">All platforms</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="SPOTIFY">Spotify</option>
                  <option value="TIKTOK">TikTok</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-cream-muted mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
                  className="input text-sm bg-void-100"
                >
                  <option value="all">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="READY">Ready</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
              {activeFilters > 0 && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setPlatformFilter('all');
                      setStatusFilter('all');
                      setSelectedTags([]);
                      setPage(1);
                    }}
                    className="btn-ghost text-sm text-rust"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            {allTags && allTags.length > 0 && (
              <div className="mt-6 pt-6 border-t border-void-200">
                <label className="flex items-center gap-2 text-sm font-medium text-cream-muted mb-3">
                  <Tag size={14} />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        setSelectedTags((prev) =>
                          prev.includes(tag.name)
                            ? prev.filter((t) => t !== tag.name)
                            : [...prev, tag.name]
                        );
                        setPage(1);
                      }}
                      className={clsx(
                        'badge transition-all',
                        selectedTags.includes(tag.name)
                          ? 'badge-amber'
                          : 'badge-muted hover:border-amber/50'
                      )}
                    >
                      {tag.name}
                      <span className="ml-1 opacity-60">({tag._count.contents})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Grid/List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber animate-spin mb-4" />
            <p className="text-cream-dark">Loading archive...</p>
          </div>
        ) : !data?.contents.length ? (
          <div className="card text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-void-200 flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-cream-dark" />
            </div>
            <h3 className="text-xl font-display text-cream mb-2">No memories found</h3>
            <p className="text-cream-dark max-w-md mx-auto">
              {activeFilters > 0
                ? 'Try adjusting your filters to find what you\'re looking for.'
                : 'Connect YouTube, Spotify, or TikTok in Settings to start capturing content.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.contents.map((content, index) => (
              <div
                key={content.id}
                onClick={() => setSelectedContentId(content.id)}
                className="archive-card animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Thumbnail */}
                <div className="archive-card-thumbnail">
                  {content.thumbnailUrl ? (
                    <img
                      src={content.thumbnailUrl}
                      alt={content.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-void-200">
                      <Play size={32} className="text-cream-dark" />
                    </div>
                  )}

                  {/* Duration badge */}
                  {content.duration && (
                    <span className="absolute bottom-2 right-2 px-2 py-1 bg-void/80 backdrop-blur text-cream text-xs rounded-lg">
                      {formatDuration(content.duration)}
                    </span>
                  )}

                  {/* Progress bar for Spotify */}
                  {content.platform === 'SPOTIFY' && (content.fullyPlayed || (content.listenProgress && content.listenProgress > 0)) && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-void/50">
                      <div
                        className="h-full bg-gradient-to-r from-sage-dark to-sage transition-all"
                        style={{ width: `${content.fullyPlayed ? 100 : content.listenProgress}%` }}
                      />
                    </div>
                  )}

                  {/* Completed badge */}
                  {content.fullyPlayed && (
                    <span className="absolute top-2 left-2 w-7 h-7 bg-sage text-void rounded-full flex items-center justify-center">
                      <CheckCircle2 size={16} />
                    </span>
                  )}

                  {/* Platform indicator */}
                  <span className={clsx(
                    'absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                    content.platform === 'YOUTUBE' && 'bg-[#FF0000]/90 text-white',
                    content.platform === 'SPOTIFY' && 'bg-[#1DB954]/90 text-white',
                    content.platform === 'TIKTOK' && 'bg-gradient-to-br from-[#00f2ea] to-[#ff0050] text-white'
                  )}>
                    {content.platform === 'YOUTUBE' ? 'YT' : content.platform === 'SPOTIFY' ? 'SP' : 'TT'}
                  </span>
                </div>

                {/* Body */}
                <div className="archive-card-body">
                  <h3 className="font-medium text-cream line-clamp-2 mb-2 text-sm group-hover:text-amber transition-colors">
                    {content.title}
                  </h3>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const config = getStatusConfig(content.status);
                      return (
                        <span className={config.class}>
                          {config.label}
                        </span>
                      );
                    })()}

                    {content._count.quizzes > 0 && (
                      <span className="badge-sage">
                        {content._count.quizzes} cards
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-void-200 flex items-center justify-between text-xs text-cream-dark">
                    <span>{new Date(content.capturedAt).toLocaleDateString()}</span>
                    {content.showName && (
                      <span className="truncate ml-2">{content.showName}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {data.contents.map((content, index) => (
              <div
                key={content.id}
                onClick={() => setSelectedContentId(content.id)}
                className="card-interactive flex gap-4 p-4 animate-slide-up"
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                {/* Thumbnail */}
                <div className="w-40 h-24 rounded-xl bg-void-200 overflow-hidden flex-shrink-0 relative">
                  {content.thumbnailUrl ? (
                    <img
                      src={content.thumbnailUrl}
                      alt={content.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play size={24} className="text-cream-dark" />
                    </div>
                  )}
                  {content.duration && (
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-void/80 text-cream text-xs rounded">
                      {formatDuration(content.duration)}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className="font-medium text-cream line-clamp-1 mb-2">
                    {content.title}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx(
                      content.platform === 'YOUTUBE' && 'badge-youtube',
                      content.platform === 'SPOTIFY' && 'badge-spotify',
                      content.platform === 'TIKTOK' && 'badge-tiktok'
                    )}>
                      {content.platform}
                    </span>
                    {(() => {
                      const config = getStatusConfig(content.status);
                      return <span className={config.class}>{config.label}</span>;
                    })()}
                    <span className="text-xs text-cream-dark">
                      {new Date(content.capturedAt).toLocaleDateString()}
                    </span>
                    {content._count.quizzes > 0 && (
                      <span className="text-xs text-sage">{content._count.quizzes} cards</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary p-3 disabled:opacity-30"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                let pageNum;
                if (data.pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= data.pagination.totalPages - 2) {
                  pageNum = data.pagination.totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={clsx(
                      'w-10 h-10 rounded-xl font-medium transition-all',
                      page === pageNum
                        ? 'bg-amber text-void'
                        : 'bg-void-100 text-cream-muted hover:text-cream hover:bg-void-200'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
              className="btn-secondary p-3 disabled:opacity-30"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

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
                          contentDetail.platform === 'YOUTUBE' && 'badge-youtube',
                          contentDetail.platform === 'SPOTIFY' && 'badge-spotify',
                          contentDetail.platform === 'TIKTOK' && 'badge-tiktok'
                        )}>
                          {contentDetail.platform}
                        </span>
                        {(() => {
                          const config = getStatusConfig(contentDetail.status);
                          return <span className={config.class}>{config.label}</span>;
                        })()}
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
                  {/* Thumbnail */}
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
                      <p className="text-sm text-cream-dark">Quiz Cards</p>
                    </div>
                    <div className="bg-void-100 rounded-xl p-4 text-center border border-void-200">
                      <p className="text-2xl font-display text-cream">
                        {contentDetail.transcript ? 'Yes' : 'No'}
                      </p>
                      <p className="text-sm text-cream-dark">Transcript</p>
                    </div>
                    <div className="bg-void-100 rounded-xl p-4 text-center border border-void-200">
                      <p className="text-sm font-medium text-cream">
                        {new Date(contentDetail.capturedAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-cream-dark">Captured</p>
                    </div>
                  </div>

                  {/* Tags */}
                  {contentDetail.tags.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-cream-muted mb-2 flex items-center gap-2">
                        <Tag size={14} /> Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {contentDetail.tags.map((tag) => (
                          <span key={tag.id} className="badge-muted">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {contentDetail.description && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-cream-muted mb-2">Description</h4>
                      <p className="text-sm text-cream-dark whitespace-pre-wrap line-clamp-3">
                        {contentDetail.description}
                      </p>
                    </div>
                  )}

                  {/* Quiz Preview */}
                  {contentDetail.quizzes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-cream-muted mb-3">
                        Quiz Questions ({contentDetail.quizzes.length})
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
                            +{contentDetail.quizzes.length - 3} more questions
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
                    Open Original
                  </a>
                  <button
                    onClick={() => handleExportSingle(contentDetail.id)}
                    className="btn-ghost p-3"
                    title="Export as Markdown"
                  >
                    <Download size={18} />
                  </button>
                  {contentDetail.status === 'PENDING' && (
                    <button
                      onClick={() => generateQuiz.mutate(contentDetail.id)}
                      disabled={generateQuiz.isPending}
                      className="btn-primary flex-1"
                    >
                      {generateQuiz.isPending ? 'Starting...' : 'Generate Quiz'}
                    </button>
                  )}
                  {contentDetail.status === 'FAILED' && (
                    <button
                      onClick={() => retryContent.mutate(contentDetail.id)}
                      disabled={retryContent.isPending}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={16} className={retryContent.isPending ? 'animate-spin' : ''} />
                      {retryContent.isPending ? 'Retrying...' : 'Retry'}
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
