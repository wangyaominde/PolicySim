import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  AdvisoryConfig,
  AdvisoryStatus,
  DecisionSynthesis,
  RoleReview,
  Verdict,
} from '../types';
import type { AdvisoryHistoryRun } from './historyStore';

interface AdvisoryState {
  config: AdvisoryConfig | null;
  reviews: RoleReview[];
  streamingReviews: Record<string, string>; // agentId → in-progress text
  synthesis: DecisionSynthesis | null;
  status: AdvisoryStatus;
  error: string | null;

  // Actions
  startAdvisory: (config: AdvisoryConfig) => void;
  loadRun: (run: AdvisoryHistoryRun) => void;
  setStatus: (status: AdvisoryStatus) => void;
  appendReviewChunk: (agentId: string, chunk: string) => void;
  addReview: (review: RoleReview) => void;
  setSynthesis: (synthesis: DecisionSynthesis) => void;
  setError: (error: string) => void;
  reset: () => void;
}

const initialState = {
  config: null,
  reviews: [],
  streamingReviews: {},
  synthesis: null,
  status: 'idle' as AdvisoryStatus,
  error: null,
};

export const useAdvisoryStore = create<AdvisoryState>()(
  immer((set) => ({
    ...initialState,

    startAdvisory: (config) =>
      set((state) => {
        state.config = config;
        state.reviews = [];
        state.streamingReviews = {};
        state.synthesis = null;
        state.status = 'reading';
        state.error = null;
      }),

    loadRun: (run) =>
      set((state) => {
        // Rehydrate a completed run from history for read-only viewing.
        state.config = {
          id: run.id,
          task: run.task,
          documents: run.documentMeta.map((d, i) => ({
            id: `hist-${run.id}-${i}`,
            name: d.name,
            mime: '',
            size: 0,
            content: '',
            charCount: d.charCount,
            truncated: false,
            status: 'ready' as const,
          })),
          roleIds: run.roleIds,
          createdAt: run.createdAt,
        };
        state.reviews = run.reviews;
        state.streamingReviews = {};
        state.synthesis = run.synthesis;
        state.status = 'completed';
        state.error = null;
      }),

    setStatus: (status) =>
      set((state) => {
        state.status = status;
      }),

    appendReviewChunk: (agentId, chunk) =>
      set((state) => {
        if (state.streamingReviews[agentId] === undefined) {
          state.streamingReviews[agentId] = '';
        }
        state.streamingReviews[agentId] += chunk;
      }),

    addReview: (review) =>
      set((state) => {
        const idx = state.reviews.findIndex((r) => r.agentId === review.agentId);
        if (idx >= 0) state.reviews[idx] = review;
        else state.reviews.push(review);
        delete state.streamingReviews[review.agentId];
      }),

    setSynthesis: (synthesis) =>
      set((state) => {
        state.synthesis = synthesis;
        state.status = 'completed';
      }),

    setError: (error) =>
      set((state) => {
        // Records the latest error for display. Per-role errors are non-fatal
        // (the run continues); the page decides whether to also flip status.
        state.error = error;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, initialState);
      }),
  })),
);

/** Deterministic verdict tally from a set of reviews. */
export function tallyVerdicts(reviews: RoleReview[]): Partial<Record<Verdict, number>> {
  const tally: Partial<Record<Verdict, number>> = {};
  for (const r of reviews) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
  return tally;
}
