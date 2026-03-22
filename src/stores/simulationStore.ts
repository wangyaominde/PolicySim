import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  SimulationConfig,
  SimulationRound,
  SimulationStatus,
  SubAgentInstance,
  SubAgentResult,
  AgentResponse,
} from '../types';

interface SimulationState {
  config: SimulationConfig | null;
  rounds: SimulationRound[];
  currentRound: number;
  status: SimulationStatus;
  subAgentInstances: SubAgentInstance[];
  streamingResponses: Record<string, string>;
  error: string | null;

  // Actions
  startSimulation: (config: SimulationConfig) => void;
  setStatus: (status: SimulationStatus) => void;
  addResponse: (response: AgentResponse) => void;
  appendStreamChunk: (agentId: string, chunk: string) => void;
  initRound: (roundNumber: number) => void;
  completeRound: (round: SimulationRound) => void;
  addSubAgentInstance: (instance: SubAgentInstance) => void;
  updateSubAgentResult: (parentId: string, slotId: string, result: SubAgentResult) => void;
  reset: () => void;
  setError: (error: string) => void;
}

const initialState = {
  config: null,
  rounds: [],
  currentRound: 0,
  status: 'idle' as SimulationStatus,
  subAgentInstances: [],
  streamingResponses: {},
  error: null,
};

export const useSimulationStore = create<SimulationState>()(
  immer((set) => ({
    ...initialState,

    startSimulation: (config) => set((state) => {
      state.config = config;
      state.rounds = [];
      state.currentRound = 1;
      state.status = 'configuring';
      state.subAgentInstances = [];
      state.streamingResponses = {};
      state.error = null;
    }),

    setStatus: (status) => set((state) => {
      state.status = status;
    }),

    addResponse: (response) => set((state) => {
      const round = state.rounds.find(r => r.roundNumber === response.round);
      if (round) {
        round.responses.push(response);
      }
      // Clear streaming text for this agent
      delete state.streamingResponses[response.agentId];
    }),

    appendStreamChunk: (agentId, chunk) => set((state) => {
      if (!state.streamingResponses[agentId]) {
        state.streamingResponses[agentId] = '';
      }
      state.streamingResponses[agentId] += chunk;
    }),

    initRound: (roundNumber) => set((state) => {
      // Create an empty round entry so addResponse can push to it incrementally
      const exists = state.rounds.find(r => r.roundNumber === roundNumber);
      if (!exists) {
        state.rounds.push({
          roundNumber,
          responses: [],
          subAgentResults: {},
          alliances: [],
          timestamp: Date.now(),
        });
      }
      state.currentRound = roundNumber;
    }),

    completeRound: (round) => set((state) => {
      const existing = state.rounds.find(r => r.roundNumber === round.roundNumber);
      if (existing) {
        // Round was pre-created via initRound; update with final data if provided
        if (round.responses.length > 0) {
          existing.responses = round.responses;
        }
        existing.timestamp = round.timestamp;
      } else {
        state.rounds.push(round);
      }
      state.currentRound = round.roundNumber + 1;
      state.streamingResponses = {};
    }),

    addSubAgentInstance: (instance) => set((state) => {
      state.subAgentInstances.push(instance);
    }),

    updateSubAgentResult: (parentId, slotId, result) => set((state) => {
      const instance = state.subAgentInstances.find(
        i => i.parentId === parentId && i.slotId === slotId
      );
      if (instance) {
        instance.result = result;
        instance.status = 'reporting';
      }
    }),

    reset: () => set((state) => {
      Object.assign(state, initialState);
    }),

    setError: (error) => set((state) => {
      state.error = error;
      state.status = 'error';
    }),
  }))
);
