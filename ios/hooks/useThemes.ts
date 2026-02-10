/**
 * Themes hooks - CRUD operations for user themes
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { ThemeListItem, Content } from '../types/content';

interface ThemeDetailResponse {
  theme: ThemeListItem;
  contents: Content[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Get all themes for the current user
export function useThemes() {
  return useQuery({
    queryKey: ['themes'],
    queryFn: async () => {
      const { data } = await api.get<ThemeListItem[]>('/themes');
      return data;
    },
  });
}

// Get theme detail with its content items
export function useThemeDetail(id: string | undefined, page?: number, platform?: string) {
  return useQuery({
    queryKey: ['themes', id, page, platform],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (page) params.set('page', String(page));
      params.set('limit', '20');
      if (platform) params.set('platform', platform);
      const query = params.toString();
      const { data } = await api.get<ThemeDetailResponse>(`/themes/${id}${query ? `?${query}` : ''}`);
      return data;
    },
    enabled: !!id,
  });
}

// Create a new theme
export function useCreateTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { name: string; color?: string; emoji?: string }) => {
      const { data } = await api.post<ThemeListItem>('/themes', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

// Update an existing theme
export function useUpdateTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; color?: string; emoji?: string }) => {
      const { data } = await api.put<ThemeListItem>(`/themes/${id}`, body);
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['themes', id] });
    },
  });
}

// Delete a theme
export function useDeleteTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/themes/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

// Add content to a theme
export function useAddContentToTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ themeId, contentIds }: { themeId: string; contentIds: string[] }) => {
      const { data } = await api.post(`/themes/${themeId}/content`, { contentIds });
      return data;
    },
    onSuccess: (_, { themeId }) => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['themes', themeId] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

// Remove content from a theme
export function useRemoveContentFromTheme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ themeId, contentId }: { themeId: string; contentId: string }) => {
      const { data } = await api.delete(`/themes/${themeId}/content/${contentId}`);
      return data;
    },
    onSuccess: (_, { themeId }) => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['themes', themeId] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}
