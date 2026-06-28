import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AdvisoryTask,
  DecisionSynthesis,
  PolicyType,
  RoleReview,
  SimulationRound,
} from '../types';

// A saved advisory (document decision review) run.
export interface AdvisoryHistoryRun {
  id: string;
  kind: 'advisory';
  title: string;
  createdAt: number;
  task: AdvisoryTask;
  documentMeta: { name: string; charCount: number }[];
  roleIds: string[];
  reviews: RoleReview[];
  synthesis: DecisionSynthesis | null;
}

// A saved policy simulation run.
export interface PolicyHistoryRun {
  id: string;
  kind: 'policy';
  title: string;
  createdAt: number;
  policy: string;
  policyTypes: PolicyType[];
  totalRounds: number;
  selectedAgentIds: string[];
  rounds: SimulationRound[];
}

export type HistoryRun = AdvisoryHistoryRun | PolicyHistoryRun;

const MAX_RUNS = 40;

interface HistoryState {
  runs: HistoryRun[];
  saveRun: (run: HistoryRun) => void;
  removeRun: (id: string) => void;
  clear: () => void;
  getRun: (id: string) => HistoryRun | undefined;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      runs: [],

      saveRun: (run) =>
        set((state) => {
          // Upsert by id, newest first, capped.
          const without = state.runs.filter((r) => r.id !== run.id);
          return { runs: [run, ...without].slice(0, MAX_RUNS) };
        }),

      removeRun: (id) =>
        set((state) => ({ runs: state.runs.filter((r) => r.id !== id) })),

      clear: () => set({ runs: [] }),

      getRun: (id) => get().runs.find((r) => r.id === id),
    }),
    {
      name: 'policysim-history',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
