// Compute Worker - handles alliance calculation and graph layout off main thread

interface AllianceInput {
  responses: any[];
}

interface GraphLayoutInput {
  nodes: { id: string; type: 'main' | 'sub'; parentId?: string; influence: number }[];
  edges: { source: string; target: string; type: string; strength: number }[];
  width: number;
  height: number;
}

function computeAlliances(responses: any[]) {
  const alliances: any[] = [];
  const matrix: number[][] = [];
  const agentIds = responses.map(r => r.agentId);

  // Build relationship matrix
  for (let i = 0; i < agentIds.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < agentIds.length; j++) {
      matrix[i][j] = 0;
    }
  }

  // Analyze alliance and opposition intents
  for (const response of responses) {
    const iIdx = agentIds.indexOf(response.agentId);

    for (const intent of response.allianceIntent || []) {
      const jIdx = agentIds.indexOf(intent.agentId);
      if (jIdx >= 0) {
        matrix[iIdx][jIdx] += 1;
        matrix[jIdx][iIdx] += 0.5; // reciprocal but weaker
      }
    }

    for (const intent of response.oppositionIntent || []) {
      const jIdx = agentIds.indexOf(intent.agentId);
      if (jIdx >= 0) {
        matrix[iIdx][jIdx] -= 1;
        matrix[jIdx][iIdx] -= 0.5;
      }
    }
  }

  // Detect alliances (mutual positive relationships)
  const visited = new Set<string>();
  for (let i = 0; i < agentIds.length; i++) {
    for (let j = i + 1; j < agentIds.length; j++) {
      const key = `${i}-${j}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (matrix[i][j] > 0 && matrix[j][i] > 0) {
        const strength = Math.min(1, (matrix[i][j] + matrix[j][i]) / 4);
        alliances.push({
          agents: [agentIds[i], agentIds[j]],
          name: `${agentIds[i]}-${agentIds[j]} 联盟`,
          strength,
          formedAtRound: responses[0]?.round || 1,
        });
      }
    }
  }

  return { alliances, matrix };
}

function computeGraphLayout(input: GraphLayoutInput) {
  const { nodes, edges, width, height } = input;
  const positions: Record<string, { x: number; y: number }> = {};

  // Simple circular layout for main nodes, satellite for sub nodes
  const mainNodes = nodes.filter(n => n.type === 'main');
  const subNodes = nodes.filter(n => n.type === 'sub');

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  if (mainNodes.length === 0) {
    // No main nodes — place sub-nodes at center as fallback
    subNodes.forEach((node) => {
      positions[node.id] = { x: centerX, y: centerY };
    });
    return positions;
  }

  mainNodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / mainNodes.length - Math.PI / 2;
    positions[node.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  // Place sub nodes as satellites around their parent
  subNodes.forEach((node, i) => {
    const parent = positions[node.parentId || ''];
    if (parent) {
      const subCount = subNodes.filter(n => n.parentId === node.parentId).length;
      const idx = subNodes.filter(n => n.parentId === node.parentId).indexOf(node);
      const subAngle = (2 * Math.PI * idx) / subCount;
      const subRadius = 40;
      positions[node.id] = {
        x: parent.x + subRadius * Math.cos(subAngle),
        y: parent.y + subRadius * Math.sin(subAngle),
      };
    } else {
      positions[node.id] = { x: centerX, y: centerY };
    }
  });

  return positions;
}

self.onmessage = (event: MessageEvent) => {
  const { type, ...data } = event.data;

  if (type === 'COMPUTE_ALLIANCES') {
    const result = computeAlliances(data.responses);
    self.postMessage({ type: 'ALLIANCES_COMPUTED', ...result });
  }

  if (type === 'COMPUTE_GRAPH_LAYOUT') {
    const positions = computeGraphLayout(data as GraphLayoutInput);
    self.postMessage({ type: 'GRAPH_LAYOUT_READY', positions });
  }
};
