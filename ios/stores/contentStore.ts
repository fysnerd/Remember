/**
 * Content store for library state and filters
 */

import { create } from 'zustand';

type ExplorerTab = 'suggestions' | 'library';
export type SourceKey = 'youtube' | 'spotify' | 'tiktok' | 'instagram';
type ViewMode = 'browse' | 'triage';

interface ContentStoreState {
  activeExplorerTab: ExplorerTab;
  setActiveExplorerTab: (tab: ExplorerTab) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Multi-select source filter (empty = all sources)
  sourceFilters: SourceKey[];
  setSourceFilters: (sources: SourceKey[]) => void;
  toggleSourceFilter: (source: SourceKey) => void;

  themeFilters: string[];
  toggleThemeFilter: (themeId: string) => void;
  clearThemeFilters: () => void;
  resetFilters: () => void;

  // Filter drawer visibility (shared between layout header button and screen modal)
  showFilterDrawer: boolean;
  setShowFilterDrawer: (show: boolean) => void;
}

export const useContentStore = create<ContentStoreState>((set) => ({
  activeExplorerTab: 'library',
  setActiveExplorerTab: (tab) => set({ activeExplorerTab: tab }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  viewMode: 'browse',
  setViewMode: (mode) => set({ viewMode: mode }),

  sourceFilters: [],
  setSourceFilters: (sources) => set({ sourceFilters: sources }),
  toggleSourceFilter: (source) => set((state) => {
    const current = state.sourceFilters;
    if (current.includes(source)) {
      return { sourceFilters: current.filter((s) => s !== source) };
    }
    return { sourceFilters: [...current, source] };
  }),

  themeFilters: [],
  toggleThemeFilter: (themeId) => set((state) => {
    const current = state.themeFilters;
    if (current.includes(themeId)) {
      return { themeFilters: current.filter((id) => id !== themeId) };
    }
    return { themeFilters: [...current, themeId] };
  }),
  clearThemeFilters: () => set({ themeFilters: [] }),
  resetFilters: () => set({ sourceFilters: [], themeFilters: [] }),

  showFilterDrawer: false,
  setShowFilterDrawer: (show) => set({ showFilterDrawer: show }),
}));
