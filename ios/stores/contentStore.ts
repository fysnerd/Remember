/**
 * Content store for library state and filters
 */

import { create } from 'zustand';

type ExplorerTab = 'suggestions' | 'library';
type SourceFilter = 'all' | 'youtube' | 'spotify' | 'tiktok' | 'instagram';
type TriageMode = 'swipe' | 'bulk';

interface ContentStoreState {
  // Explorer top-level tab state
  activeExplorerTab: ExplorerTab;
  setActiveExplorerTab: (tab: ExplorerTab) => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Triage mode state (swipe card stack vs bulk select grid)
  triageMode: TriageMode;
  setTriageMode: (mode: TriageMode) => void;

  // Filter state
  sourceFilter: SourceFilter;
  themeFilter: string | null;
  setSourceFilter: (source: SourceFilter) => void;
  setThemeFilter: (theme: string | null) => void;
  resetFilters: () => void;
}

export const useContentStore = create<ContentStoreState>((set) => ({
  activeExplorerTab: 'library',
  setActiveExplorerTab: (tab) => set({ activeExplorerTab: tab }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  triageMode: 'swipe',
  setTriageMode: (mode) => set({ triageMode: mode }),

  sourceFilter: 'all',
  themeFilter: null,
  setSourceFilter: (source) => set({ sourceFilter: source }),
  setThemeFilter: (theme) => set({ themeFilter: theme }),
  resetFilters: () => set({ sourceFilter: 'all', themeFilter: null }),
}));
