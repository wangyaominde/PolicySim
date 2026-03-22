import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Agent } from '../types';
import { PRESET_AGENTS } from '../data/presetAgents';

interface AgentState {
  agents: Agent[];
  selectedIds: string[];
  customAgents: Agent[];

  // Actions
  toggleAgent: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  addCustomAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeCustomAgent: (id: string) => void;
  getSelectedAgents: () => Agent[];
}

export const useAgentStore = create<AgentState>()(
  immer((set, get) => ({
    agents: PRESET_AGENTS,
    selectedIds: PRESET_AGENTS.map(a => a.id),
    customAgents: [],

    toggleAgent: (id) => set((state) => {
      const idx = state.selectedIds.indexOf(id);
      if (idx >= 0) {
        if (state.selectedIds.length > 3) state.selectedIds.splice(idx, 1);
      } else {
        if (state.selectedIds.length < 12) state.selectedIds.push(id);
      }
    }),

    selectAll: () => set((state) => {
      state.selectedIds = [...state.agents, ...state.customAgents].map(a => a.id);
    }),

    deselectAll: () => set((state) => {
      state.selectedIds = state.selectedIds.slice(0, 3);
    }),

    addCustomAgent: (agent) => set((state) => {
      state.customAgents.push(agent);
      state.selectedIds.push(agent.id);
    }),

    updateAgent: (id, updates) => set((state) => {
      const agent = [...state.agents, ...state.customAgents].find(a => a.id === id);
      if (agent) Object.assign(agent, updates);
    }),

    removeCustomAgent: (id) => set((state) => {
      state.customAgents = state.customAgents.filter(a => a.id !== id);
      state.selectedIds = state.selectedIds.filter(sid => sid !== id);
    }),

    getSelectedAgents: () => {
      const state = get();
      const all = [...state.agents, ...state.customAgents];
      return all.filter(a => state.selectedIds.includes(a.id));
    },
  }))
);
