// Worker message types for postMessage communication
export interface StreamChunkMessage {
  type: 'AGENT_STREAM_CHUNK';
  agentId: string;
  chunk: string;
}

export interface AgentCompleteMessage {
  type: 'AGENT_COMPLETE';
  agentId: string;
  response: any;
}

export interface SubAgentChunkMessage {
  type: 'SUBAGENT_STREAM_CHUNK';
  parentId: string;
  slotId: string;
  chunk: string;
}

export interface SubAgentCompleteMessage {
  type: 'SUBAGENT_COMPLETE';
  parentId: string;
  slotId: string;
  result: any;
}

export interface ErrorMessage {
  type: 'ERROR';
  agentId?: string;
  error: string;
}

export interface RoundCompleteMessage {
  type: 'ROUND_COMPLETE';
  round: number;
}

export type WorkerMessage =
  | StreamChunkMessage
  | AgentCompleteMessage
  | SubAgentChunkMessage
  | SubAgentCompleteMessage
  | ErrorMessage
  | RoundCompleteMessage;
