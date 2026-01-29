import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Inbox, CheckCircle2, Archive, Trash2, Loader2, BookOpen,
  ChevronLeft, ChevronRight, CheckSquare, Square
} from 'lucide-react';
import { api } from '../lib/api';
import clsx from 'clsx';

interface Content {
  id: string;
  platform: 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK';
  externalId: string;
  url: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  authorUsername: string | null;
  capturedAt: string;
}

interface InboxResponse {
  contents: Content[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function InboxPage() {
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<InboxResponse>({
    queryKey: ['inbox', page],
    queryFn: async () => {
      const res = await api.get<InboxResponse>(`/content/inbox?page=${page}&limit=20`);
      return res.data;
    },
  });

  const triageMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'learn' | 'archive' }) =>
      api.patch(`/content/${id}/triage`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-count'] });
    },
  });

  const bulkTriageMutation = useMutation({
    mutationFn: ({ contentIds, action }: { contentIds: string[]; action: 'learn' | 'archive' | 'delete' }) =>
      api.post('/content/triage/bulk', { contentIds, action }),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-count'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/content/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-count'] });
    },
  });

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selectedIds.size === data.contents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.contents.map(c => c.id)));
    }
  };

  const handleBulkAction = (action: 'learn' | 'archive' | 'delete') => {
    if (selectedIds.size === 0) return;
    bulkTriageMutation.mutate({
      contentIds: Array.from(selectedIds),
      action,
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case 'YOUTUBE':
        return { label: 'YT', class: 'bg-[#FF0000]/20 text-[#FF6B6B]' };
      case 'SPOTIFY':
        return { label: 'SP', class: 'bg-[#1DB954]/20 text-[#1DB954]' };
      case 'TIKTOK':
        return { label: 'TT', class: 'bg-gradient-to-br from-[#00f2ea]/20 to-[#ff0050]/20 text-[#00f2ea]' };
      default:
        return { label: '?', class: 'bg-void-200 text-cream-dark' };
    }
  };

  const contents = data?.contents || [];
  const pagination = data?.pagination;
  const isAllSelected = contents.length > 0 && selectedIds.size === contents.length;
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="min-h-screen p-8">
      {/* Ambient glow */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-amber/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-amber/20 flex items-center justify-center">
              <Inbox size={24} className="text-amber" />
            </div>
            <div>
              <h1 className="text-3xl font-display text-cream">Inbox</h1>
              <p className="text-cream-dark">
                {pagination?.total || 0} items to review
              </p>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {hasSelection && (
          <div className="mb-6 p-4 rounded-xl bg-void-100 border border-void-200 flex items-center justify-between animate-slide-up">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="p-2 hover:bg-void-200 rounded-lg transition-colors"
              >
                {isAllSelected ? (
                  <CheckSquare size={20} className="text-amber" />
                ) : (
                  <Square size={20} className="text-cream-dark" />
                )}
              </button>
              <span className="text-cream font-medium">{selectedIds.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction('learn')}
                disabled={bulkTriageMutation.isPending}
                className="px-4 py-2 rounded-lg bg-sage/20 text-sage hover:bg-sage/30 transition-colors flex items-center gap-2"
              >
                <BookOpen size={16} />
                Learn All
              </button>
              <button
                onClick={() => handleBulkAction('archive')}
                disabled={bulkTriageMutation.isPending}
                className="px-4 py-2 rounded-lg bg-void-200 text-cream-muted hover:bg-void-300 transition-colors flex items-center gap-2"
              >
                <Archive size={16} />
                Archive All
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                disabled={bulkTriageMutation.isPending}
                className="px-4 py-2 rounded-lg bg-rust/20 text-rust hover:bg-rust/30 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber animate-spin" />
          </div>
        ) : contents.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-sage/20 flex items-center justify-center">
              <CheckCircle2 size={40} className="text-sage" />
            </div>
            <h3 className="text-xl font-display text-cream mb-2">All caught up!</h3>
            <p className="text-cream-dark">
              No new content to review. Your learning queue is ready.
            </p>
          </div>
        ) : (
          <>
            {/* Select All */}
            {!hasSelection && (
              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-cream-dark hover:text-cream transition-colors"
                >
                  <Square size={18} />
                  <span className="text-sm">Select all</span>
                </button>
              </div>
            )}

            {/* Content List */}
            <div className="space-y-3">
              {contents.map((content, index) => {
                const platform = getPlatformBadge(content.platform);
                const isSelected = selectedIds.has(content.id);

                return (
                  <div
                    key={content.id}
                    className={clsx(
                      'group p-4 rounded-xl border transition-all animate-slide-up',
                      isSelected
                        ? 'bg-amber/5 border-amber/30'
                        : 'bg-void-50 border-void-200 hover:border-void-300'
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleSelect(content.id)}
                        className="mt-1 flex-shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare size={20} className="text-amber" />
                        ) : (
                          <Square size={20} className="text-cream-dark group-hover:text-cream transition-colors" />
                        )}
                      </button>

                      {/* Thumbnail */}
                      <div className="relative w-32 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-void-200">
                        {content.thumbnailUrl ? (
                          <img
                            src={content.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Inbox size={24} className="text-cream-dark" />
                          </div>
                        )}
                        <span className={clsx(
                          'absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-bold',
                          platform.class
                        )}>
                          {platform.label}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-cream line-clamp-2 mb-1">
                          {content.title}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-cream-dark">
                          {content.authorUsername && (
                            <span>@{content.authorUsername}</span>
                          )}
                          {content.duration && (
                            <span>{formatDuration(content.duration)}</span>
                          )}
                          <span>{new Date(content.capturedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => deleteMutation.mutate(content.id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 text-cream-dark hover:text-rust hover:bg-rust/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button
                          onClick={() => triageMutation.mutate({ id: content.id, action: 'archive' })}
                          disabled={triageMutation.isPending}
                          className="p-2 text-cream-dark hover:text-cream hover:bg-void-200 rounded-lg transition-colors"
                          title="Archive"
                        >
                          <Archive size={18} />
                        </button>
                        <button
                          onClick={() => triageMutation.mutate({ id: content.id, action: 'learn' })}
                          disabled={triageMutation.isPending}
                          className="px-4 py-2 rounded-lg bg-sage/20 text-sage hover:bg-sage/30 transition-colors flex items-center gap-2"
                        >
                          <BookOpen size={16} />
                          Learn
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-void-100 text-cream-dark hover:text-cream hover:bg-void-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="px-4 py-2 text-cream-muted">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="p-2 rounded-lg bg-void-100 text-cream-dark hover:text-cream hover:bg-void-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
