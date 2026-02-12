/**
 * Content hooks - list, detail, triage
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Content, ContentListResponse } from '../types/content';

interface ContentFilters {
  source?: string;
  topic?: string;
  channel?: string;
  status?: string;
  search?: string;
}

// Backend content structure (from Prisma)
interface BackendContent {
  id: string;
  platform: 'YOUTUBE' | 'SPOTIFY' | 'TIKTOK' | 'INSTAGRAM';
  externalId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  duration?: number;
  channelName?: string;
  url?: string;
  status: string;
  tags?: { name: string }[];
  themes?: { id: string; name: string; slug: string; color: string; emoji: string }[];
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
    channelName: item.channelName,
    url: item.url,
    status: item.status as Content['status'],
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
