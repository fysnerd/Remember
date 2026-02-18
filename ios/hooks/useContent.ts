/**
 * Content hooks - list, detail, triage
 */

import { useQuery, useQueries, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Content, ContentListResponse } from '../types/content';

interface ContentFilters {
  source?: string;
  topic?: string;
  channel?: string;
  status?: string;
  search?: string;
  themeId?: string;
  excludeArchived?: boolean;
}

// Backend content structure (from Prisma)
interface BackendContent {
  id: string;
  platform: 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK' | 'INSTAGRAM';
  externalId: string;
  title: string;
  description?: string;
  synopsis?: string;
  thumbnailUrl?: string;
  duration?: number;
  channelName?: string;
  url?: string;
  status: string;
  tags?: { name: string }[];
  themes?: { id: string; name: string; slug: string; color: string; emoji: string }[];
  quizzes?: { id: string }[];
  _count?: { quizzes: number };
  createdAt: string;
}

// Backend response structure
interface BackendContentResponse {
  contents: BackendContent[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

// Map backend content to iOS Content type
function mapContent(item: BackendContent): Content {
  return {
    id: item.id,
    title: item.title,
    source: item.platform.toLowerCase() as Content['source'],
    sourceId: item.externalId,
    thumbnailUrl: item.thumbnailUrl,
    duration: item.duration,
    description: item.description,
    synopsis: item.synopsis,
    channelName: item.channelName,
    url: item.url,
    status: item.status as Content['status'],
    quizCount: item._count?.quizzes ?? item.quizzes?.length ?? 0,
    topics: item.tags?.map((t) => t.name) ?? [],
    themes: item.themes ?? [],
    createdAt: item.createdAt,
  };
}

// List content (default: READY)
export function useContentList(filters?: ContentFilters) {
  return useQuery({
    queryKey: ['content', 'list', filters],
    queryFn: async (): Promise<ContentListResponse> => {
      const params = new URLSearchParams();
      if (filters?.source) params.append('platform', filters.source.toUpperCase());
      if (filters?.topic) params.append('tags', filters.topic);
      if (filters?.channel) params.append('channel', filters.channel);
      if (filters?.search) params.append('search', filters.search);
      params.append('status', filters?.status || 'READY');
      const { data } = await api.get<BackendContentResponse>(`/content?${params}`);
      return {
        items: data.contents.map(mapContent),
        total: data.pagination.total,
        hasMore: data.pagination.page < data.pagination.totalPages,
      };
    },
  });
}

// Library content (all non-archived) with infinite scroll
export function useLibraryContent(filters?: ContentFilters) {
  const query = useInfiniteQuery({
    queryKey: ['content', 'library', filters],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: '20' });
      if (filters?.source && filters.source !== 'all') {
        params.set('platform', filters.source.toUpperCase());
      }
      if (filters?.themeId) params.set('themeId', filters.themeId);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.excludeArchived) params.set('excludeArchived', 'true');
      const { data } = await api.get<BackendContentResponse>(`/content?${params}`);
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

  const data = query.data?.pages.flatMap((p) => p.contents.map(mapContent));
  const total = query.data?.pages[0]?.pagination.total ?? 0;

  return {
    ...query,
    data,
    total,
  };
}

// Single content detail
export function useContent(id: string) {
  return useQuery({
    queryKey: ['content', id],
    queryFn: async () => {
      const { data } = await api.get<BackendContent>(`/content/${id}`);
      return mapContent(data);
    },
    enabled: !!id,
  });
}

// Multiple content details (parallel fetch)
export function useContentsByIds(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['content', id],
      queryFn: async () => {
        const { data } = await api.get<BackendContent>(`/content/${id}`);
        return mapContent(data);
      },
      enabled: !!id,
      staleTime: 5 * 60 * 1000,
    })),
  });
}

// Selection summary (AI-generated name + description for multi-content quiz)
export function useSelectionSummary(contentIds: string[]) {
  const key = contentIds.sort().join(',');
  return useQuery({
    queryKey: ['content', 'selection-summary', key],
    queryFn: async () => {
      const { data } = await api.post<{ name: string; description: string }>(
        '/content/selection-summary',
        { contentIds }
      );
      return data;
    },
    enabled: contentIds.length >= 2,
    staleTime: 10 * 60 * 1000,
  });
}

// Triage mutation (learn/archive)
export function useTriageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contentIds,
      action,
    }: {
      contentIds: string[];
      action: 'learn' | 'archive';
    }) => {
      const { data } = await api.post('/content/triage/bulk', { contentIds, action });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}
