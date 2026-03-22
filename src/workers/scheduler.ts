// Worker Scheduler - runs on main thread, manages worker lifecycle
import type { AgentResponse } from '../types';

type WorkerCallback = (event: MessageEvent) => void;

class WorkerScheduler {
  private apiWorker: Worker | null = null;
  private computeWorker: Worker | null = null;
  private listeners: Map<string, WorkerCallback[]> = new Map();

  init() {
    this.apiWorker = new Worker(
      new URL('./api.worker.ts', import.meta.url),
      { type: 'module' }
    );
    this.computeWorker = new Worker(
      new URL('./compute.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.apiWorker.onmessage = (e) => this.dispatch(e);
    this.computeWorker.onmessage = (e) => this.dispatch(e);
  }

  private dispatch(event: MessageEvent) {
    const type = event.data?.type;
    if (type) {
      const callbacks = this.listeners.get(type) || [];
      callbacks.forEach(cb => cb(event));
      // Also fire 'all' listeners
      const allCallbacks = this.listeners.get('*') || [];
      allCallbacks.forEach(cb => cb(event));
    }
  }

  on(type: string, callback: WorkerCallback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
    return () => {
      const cbs = this.listeners.get(type);
      if (cbs) {
        const idx = cbs.indexOf(callback);
        if (idx >= 0) cbs.splice(idx, 1);
      }
    };
  }

  startRound(config: {
    agents: any[];
    policy: string;
    roundContext: string;
    round: number;
    apiKey: string;
    apiBaseUrl?: string;
    model?: string;
    maxConcurrency: number;
  }) {
    this.apiWorker?.postMessage({ type: 'START_ROUND', ...config });
  }

  computeAlliances(responses: AgentResponse[]) {
    this.computeWorker?.postMessage({ type: 'COMPUTE_ALLIANCES', responses });
  }

  computeGraphLayout(nodes: any[], edges: any[], width: number, height: number) {
    this.computeWorker?.postMessage({ type: 'COMPUTE_GRAPH_LAYOUT', nodes, edges, width, height });
  }

  abort() {
    this.apiWorker?.terminate();
    this.computeWorker?.terminate();
    this.apiWorker = null;
    this.computeWorker = null;
  }

  destroy() {
    this.abort();
    this.listeners.clear();
  }
}

export const scheduler = new WorkerScheduler();
