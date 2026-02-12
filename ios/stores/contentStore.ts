/**
 * Content store for library state and filters
 */

import { create } from 'zustand';

type LibraryTab = 'collection' | 'triage';
type ExplorerTab = 'suggestions' | 'library';
type SourceFilter = 'all' | 'youtube' | 'spotify' | 'tiktok' | 'instagram';

interface ContentStoreState {
  // Explorer top-level tab state
  activeExplorerTab: ExplorerTab;
  setActiveExplorerTab: (tab: ExplorerTab) => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Library sub-tab state
  activeLibraryTab: LibraryTab;
  setActiveLibraryTab: (tab: LibraryTab) => void;

  // Collection filter state
  sourceFilter: SourceFilter;
  topicFilter: string | null;
  channelFilter: string | null;
  setSourceFilter: (source: SourceFilter) => void;
  setTopicFilter: (topic: string | null) => void;
  setChannelFilter: (channel: string | null) => void;
  resetFilters: () => void;

  // Inbox filter state (separate from collection)
  inboxSourceFilter: SourceFilter;
  setInboxSourceFilter: (source: SourceFilter) => void;
}

export const useContentStore = create<ContentStoreState>((set) => ({
  activeExplorerTab: 'library',
  setActiveExplorerTab: (tab) => set({ activeExplorerTab: tab }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  activeLibraryTab: 'collection',
  setActiveLibraryTab: (tab) => set({ activeLibraryTab: tab }),

  sourceFilter: 'all',
  topicFilter: null,
  channelFilter: null,
  setSourceFilter: (source) => set({ sourceFilter: source }),
  setTopicFilter: (topic) => set({ topicFilter: topic }),
  setChannelFilter: (channel) => set({ channelFilter: channel }),
  resetFilters: () => set({ sourceFilter: 'all', topicFilter: null, channelFilter: null }),

  inboxSourceFilter: 'all',
  setInboxSourceFilter: (source) => set({ inboxSourceFilter: source }),
}));
