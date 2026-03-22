import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { VisualizationView } from '../types';

interface UIState {
  activeView: VisualizationView;
  expandedCards: string[];
  timelinePosition: number;
  sidebarCollapsed: boolean;
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  apiKeyModalOpen: boolean;

  // Actions
  setActiveView: (view: VisualizationView) => void;
  toggleCardExpansion: (cardId: string) => void;
  setTimelinePosition: (position: number) => void;
  toggleSidebar: () => void;
  setApiKey: (key: string) => void;
  setApiKeyModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  immer((set) => ({
    activeView: 'graph',
    expandedCards: [],
    timelinePosition: 0,
    sidebarCollapsed: false,
    apiKey: import.meta.env.VITE_API_KEY || localStorage.getItem('policysim_api_key') || '',
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.anthropic.com',
    model: import.meta.env.VITE_MODEL || 'claude-sonnet-4-20250514',
    apiKeyModalOpen: false,

    setActiveView: (view) => set((state) => {
      state.activeView = view;
    }),

    toggleCardExpansion: (cardId) => set((state) => {
      const idx = state.expandedCards.indexOf(cardId);
      if (idx >= 0) {
        state.expandedCards.splice(idx, 1);
      } else {
        state.expandedCards.push(cardId);
      }
    }),

    setTimelinePosition: (position) => set((state) => {
      state.timelinePosition = position;
    }),

    toggleSidebar: () => set((state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    }),

    setApiKey: (key) => set((state) => {
      state.apiKey = key;
    }),

    setApiKeyModalOpen: (open) => set((state) => {
      state.apiKeyModalOpen = open;
    }),
  }))
);
