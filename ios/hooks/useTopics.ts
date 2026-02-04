/**
 * Topics hook - user's content topics/tags with mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface TagResponse {
  id: string;
  name: string;
  _count: { contents: number };
}

interface TagWithCount {
  name: string;
  contentCount: number;
}

// Get user's topics from content
// Backend returns array of { id, name, _count: { contents } }
export function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn: async () => {
      const { data } = await api.get<TagResponse[]>('/content/tags');
      return data.map((tag) => tag.name);
    },
  });
}

// Get topics with content count
export function useTopicsWithCount() {
  return useQuery({
    queryKey: ['topics', 'withCount'],
    queryFn: async () => {
      const { data } = await api.get<TagResponse[]>('/content/tags');
      return data.map((tag): TagWithCount => ({
        name: tag.name,
        contentCount: tag._count.contents,
      }));
    },
  });
}

// Update tags for a specific content
export function useUpdateContentTopics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentId, tags }: { contentId: string; tags: string[] }) => {
      const { data } = await api.put(`/content/${contentId}/tags`, { tags });
      return data;
    },
    onSuccess: (_, { contentId }) => {
      // Invalidate content detail
      queryClient.invalidateQueries({ queryKey: ['content', contentId] });
      // Invalidate topics list (content count may have changed)
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      // Invalidate content lists
      queryClient.invalidateQueries({ queryKey: ['contentList'] });
    },
  });
}

// Rename a topic for user's content
export function useRenameUserTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const { data } = await api.patch(`/content/tags/${encodeURIComponent(oldName)}`, { newName });
      return data;
    },
    onSuccess: () => {
      // Invalidate all topic-related queries
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['contentList'] });
      // Individual content queries will be stale but will update on next fetch
    },
  });
}

// Delete a topic from all user's content
export function useDeleteUserTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagName: string) => {
      const { data } = await api.delete(`/content/tags/${encodeURIComponent(tagName)}`);
      return data;
    },
    onSuccess: () => {
      // Invalidate all topic-related queries
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['contentList'] });
    },
  });
}
