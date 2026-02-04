/**
 * Content store for library state and filters
 */

import { create } from 'zustand';

type LibraryTab = 'collection' | 'triage';
type SourceFilter = 'all' | 'youtube' | 'spotify' | 'tiktok' | 'instagram';

interface ContentStoreState {
  // Tab state
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
