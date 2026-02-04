/**
 * Inbox hooks - content to triage, count for badge
 */

import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { Content } from '../types/content';

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
  createdAt: string;
}

// Backend response structure
interface BackendInboxResponse {
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
    createdAt: item.createdAt,
  };
}

// Inbox content (status: INBOX)
export function useInbox() {
  return useQuery({
    queryKey: ['inbox'],
    queryFn: async () => {
      const { data } = await api.get<BackendInboxResponse>('/content/inbox');
      return data.contents.map(mapContent);
    },
  });
}

// Inbox count for badge
export function useInboxCount() {
  return useQuery({
    queryKey: ['inbox', 'count'],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>('/content/inbox/count');
      return data.count;
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
