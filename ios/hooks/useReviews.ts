/**
 * Reviews hooks - history, stats, completed items
 */

import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { ReviewStats } from '../types/content';

// Completed content/topic item
interface CompletedContentItem {
  id: string;
  contentId: string;
  contentTitle: string;
  source: string;
  thumbnailUrl?: string;
  topics: string[];
}

interface CompletedTopicItem {
  id: string;
  type: 'topic';
  name: string;
  contentCount: number;
}

interface CompletedItemsResponse {
  items: CompletedContentItem[];
  topics: CompletedTopicItem[];
}

// Get contents and topics that have been quizzed
export function useCompletedItems() {
  return useQuery({
    queryKey: ['reviews', 'completed'],
    queryFn: async () => {
      const { data } = await api.get<CompletedItemsResponse>('/reviews');
      return data;
    },
  });
}

// Review stats (streak, counts)
export function useReviewStats() {
  return useQuery({
    queryKey: ['reviews', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<ReviewStats>('/reviews/stats');
      return data;
    },
  });
}

// Legacy - keep for backwards compatibility
export function useReviews() {
  return useCompletedItems();
}
