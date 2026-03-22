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
      state.status = 'running';
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

    completeRound: (round) => set((state) => {
      state.rounds.push(round);
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
