// Stance and Strategy enums
export type Stance = 'support' | 'oppose' | 'neutral' | 'conditional';
export type Strategy = 'aggressive' | 'conservative' | 'opportunistic' | 'pragmatic';
export type PolicyType = 'economic' | 'tech' | 'social' | 'environment' | 'geopolitical';

// Value weights
export interface ValueWeights {
  economy: number;    // 0-1
  stability: number;  // 0-1
  environment: number;// 0-1
  innovation: number; // 0-1
  equality: number;   // 0-1
}

// SubAgent types
export interface SubAgentSlot {
  slotId: string;
  name: string;
  avatar: string;
  specialty: string;
  autonomy: number;       // 0-1
  costPerRound: number;
}

export interface SubAgentInstance extends SubAgentSlot {
  parentId: string;
  task: string;
  status: 'spawning' | 'active' | 'reporting' | 'dismissed';
  result: SubAgentResult | null;
  spawnedAtRound: number;
}

export interface SubAgentResult {
  success: boolean;
  report: string;
  influence_delta: number;
  side_effects: SideEffect[];
  intelligence: string;
}

export interface SideEffect {
  targetAgentId: string;
  effect: string;
  stanceShift?: Stance;
}

// Agent types
export interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
  values: ValueWeights;
  resources: string[];
  influence: number;      // 1-10
  strategy: Strategy;
  allies: string[];
  rivals: string[];
  parentId: string | null;
  subAgentSlots: SubAgentSlot[];
  enabled: boolean;
}

// Action types
export interface Action {
  type: 'lobby' | 'threaten' | 'ally' | 'invest' | 'boycott' | 'observe' | 'spawn_sub';
  target: string;
  description: string;
}

export interface Intent {
  agentId: string;
  reason: string;
}

export interface SpawnRequest {
  slotId: string;
  task: string;
  priority: 'high' | 'normal' | 'low';
}

// Agent Response
export interface AgentResponse {
  agentId: string;
  round: number;
  stance: Stance;
  impactScore: number;       // -10 to +10
  publicStatement: string;
  privateThought: string;
  actions: Action[];
  allianceIntent: Intent[];
  oppositionIntent: Intent[];
  ruleExploitation: string;
  spawnSubAgents: SpawnRequest[];
  streamingText?: string;    // for streaming display
  isStreaming?: boolean;
}

// Simulation types
export interface Alliance {
  agents: string[];
  name: string;
  strength: number;         // 0-1
  formedAtRound: number;
}

export interface SimulationRound {
  roundNumber: number;
  responses: AgentResponse[];
  subAgentResults: Record<string, SubAgentResult[]>;  // parentId → results
  alliances: Alliance[];
  timestamp: number;
}

export interface SimulationConfig {
  id: string;
  policy: string;
  policyTypes: PolicyType[];
  totalRounds: number;
  selectedAgentIds: string[];
  workerConcurrency: 'low' | 'medium' | 'high';
  consensusRuns: number;       // 1 = single run, 3-5 = consensus mode
  createdAt: number;
}

// Consensus analysis result
export interface ConsensusResult {
  agentId: string;
  stanceDistribution: Record<Stance, number>;  // stance → count across runs
  dominantStance: Stance;
  stanceConsistency: number;   // 0-1, how often the dominant stance appeared
  avgImpactScore: number;
  impactScoreRange: [number, number];
  commonActions: { type: string; frequency: number }[];
  commonAllies: { agentId: string; frequency: number }[];
  commonRivals: { agentId: string; frequency: number }[];
  representativeStatement: string;  // from the most "median" run
}

export interface ConsensusReport {
  totalRuns: number;
  overallConsistency: number;  // average consistency across all agents
  results: ConsensusResult[];
  stableConclusions: string[];   // conclusions that appeared in >80% of runs
  volatileFactors: string[];     // conclusions that varied significantly
}

export type SimulationStatus = 'idle' | 'configuring' | 'running' | 'paused' | 'completed' | 'error';

// Graph types for D3
export interface GraphNode {
  id: string;
  name: string;
  avatar: string;
  type: 'main' | 'sub';
  parentId?: string;
  stance?: Stance;
  influence: number;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'alliance' | 'conflict' | 'parent-child' | 'cross-family';
  strength: number;
}

// Worker communication protocol
export type WorkerCommand =
  | { type: 'START_ROUND'; agents: Agent[]; policy: string; roundContext: string; round: number; apiKey: string }
  | { type: 'SPAWN_SUBAGENT'; parentId: string; slot: SubAgentSlot; task: string; context: string; apiKey: string }
  | { type: 'COMPUTE_ALLIANCES'; responses: AgentResponse[] }
  | { type: 'COMPUTE_GRAPH_LAYOUT'; nodes: GraphNode[]; edges: GraphEdge[] }
  | { type: 'ABORT'; reason: string };

export type WorkerEvent =
  | { type: 'AGENT_STREAM_CHUNK'; agentId: string; chunk: string }
  | { type: 'AGENT_COMPLETE'; agentId: string; response: AgentResponse }
  | { type: 'SUBAGENT_SPAWNED'; parentId: string; instance: SubAgentInstance }
  | { type: 'SUBAGENT_STREAM_CHUNK'; parentId: string; slotId: string; chunk: string }
  | { type: 'SUBAGENT_COMPLETE'; parentId: string; slotId: string; result: SubAgentResult }
  | { type: 'ALLIANCES_COMPUTED'; alliances: Alliance[]; matrix: number[][] }
  | { type: 'GRAPH_LAYOUT_READY'; positions: Record<string, { x: number; y: number }> }
  | { type: 'ROUND_COMPLETE'; round: number }
  | { type: 'ERROR'; agentId?: string; error: string };

// View types for the right panel
export type VisualizationView = 'graph' | 'matrix' | 'flow';
