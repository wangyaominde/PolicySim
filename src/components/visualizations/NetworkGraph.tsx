import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, Stance } from '../../types';
import { useSimulationStore } from '../../stores';
import { useAgentStore } from '../../stores';

// ── Props ──────────────────────────────────────────────────────────────────────
interface NetworkGraphProps {
  width?: number;
  height?: number;
}

// ── D3-compatible node / link (mutable) ────────────────────────────────────────
interface SimNode extends d3.SimulationNodeDatum, GraphNode {}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  type: GraphEdge['type'];
  strength: number;
}

// ── Colour helpers ─────────────────────────────────────────────────────────────
const STANCE_COLORS: Record<Stance | 'default', string> = {
  support: '#4edea3',
  oppose: '#b50036',
  neutral: '#2d3449',
  conditional: '#e29100',
  default: '#2d3449',
};

const EDGE_STYLES: Record<
  GraphEdge['type'],
  { stroke: string; width: number; dasharray: string }
> = {
  alliance: { stroke: '#4edea3', width: 2, dasharray: '' },
  conflict: { stroke: '#b50036', width: 2, dasharray: '' },
  'parent-child': { stroke: '#a855f7', width: 1, dasharray: '4,4' },
  'cross-family': { stroke: '#e29100', width: 1, dasharray: '4,4' },
};

// ── Node radius helper ─────────────────────────────────────────────────────────
function nodeRadius(d: SimNode): number {
  return d.type === 'main' ? 8 + d.influence * 3 : 6;
}

// ── Mock demo data ─────────────────────────────────────────────────────────────
function generateMockData(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const mainNodes: GraphNode[] = [
    { id: 'capitalist_01', name: '资本家/企业家', avatar: '🏭', type: 'main', influence: 9 },
    { id: 'worker_01', name: '工人/工会', avatar: '👷', type: 'main', influence: 7 },
    { id: 'politician_01', name: '政治家/官僚', avatar: '🏛️', type: 'main', influence: 8 },
    { id: 'media_01', name: '媒体/舆论', avatar: '📰', type: 'main', influence: 6 },
    { id: 'environmental_01', name: '环保组织/NGO', avatar: '🌿', type: 'main', influence: 5 },
    { id: 'scientist_01', name: '科学家/专家', avatar: '🔬', type: 'main', influence: 4 },
    { id: 'public_01', name: '普通民众', avatar: '🌾', type: 'main', influence: 3 },
    { id: 'finance_01', name: '金融/投资者', avatar: '🏦', type: 'main', influence: 8 },
  ];

  // Assign demo stances
  const stanceMap: Record<string, Stance> = {
    capitalist_01: 'oppose',
    worker_01: 'support',
    politician_01: 'conditional',
    media_01: 'neutral',
    environmental_01: 'support',
    scientist_01: 'support',
    public_01: 'neutral',
    finance_01: 'oppose',
  };
  mainNodes.forEach((n) => {
    n.stance = stanceMap[n.id];
  });

  // SubAgent satellites
  const subNodes: GraphNode[] = [
    {
      id: 'capitalist_01_sub_lobbyist',
      name: '游说专家',
      avatar: '🤵',
      type: 'sub',
      parentId: 'capitalist_01',
      influence: 2,
    },
    {
      id: 'capitalist_01_sub_legal',
      name: '法律顾问',
      avatar: '⚖️',
      type: 'sub',
      parentId: 'capitalist_01',
      influence: 2,
    },
    {
      id: 'politician_01_sub_thinktank',
      name: '智库',
      avatar: '🧠',
      type: 'sub',
      parentId: 'politician_01',
      influence: 2,
    },
    {
      id: 'politician_01_sub_media',
      name: '媒体顾问',
      avatar: '🎙️',
      type: 'sub',
      parentId: 'politician_01',
      influence: 2,
    },
  ];

  const parentChildEdges: GraphEdge[] = subNodes.map((s) => ({
    source: s.parentId!,
    target: s.id,
    type: 'parent-child' as const,
    strength: 0.8,
  }));

  const edges: GraphEdge[] = [
    // Alliances
    { source: 'capitalist_01', target: 'finance_01', type: 'alliance', strength: 0.9 },
    { source: 'capitalist_01', target: 'politician_01', type: 'alliance', strength: 0.7 },
    { source: 'politician_01', target: 'media_01', type: 'alliance', strength: 0.5 },
    { source: 'worker_01', target: 'public_01', type: 'alliance', strength: 0.8 },
    { source: 'environmental_01', target: 'scientist_01', type: 'alliance', strength: 0.7 },
    { source: 'media_01', target: 'public_01', type: 'alliance', strength: 0.6 },
    // Conflicts
    { source: 'environmental_01', target: 'capitalist_01', type: 'conflict', strength: 0.9 },
    { source: 'worker_01', target: 'finance_01', type: 'conflict', strength: 0.8 },
    { source: 'worker_01', target: 'capitalist_01', type: 'conflict', strength: 0.7 },
    { source: 'public_01', target: 'finance_01', type: 'conflict', strength: 0.6 },
    // Cross-family
    { source: 'capitalist_01_sub_lobbyist', target: 'politician_01', type: 'cross-family', strength: 0.5 },
    // Parent-child
    ...parentChildEdges,
  ];

  return { nodes: [...mainNodes, ...subNodes], edges };
}

// ── Build graph data from live simulation stores ───────────────────────────────
function buildFromStores(
  agents: ReturnType<typeof useAgentStore.getState>['agents'],
  rounds: ReturnType<typeof useSimulationStore.getState>['rounds'],
): { nodes: GraphNode[]; edges: GraphEdge[] } | null {
  if (!agents.length) return null;

  // Latest round for stances
  const latestRound = rounds.length ? rounds[rounds.length - 1] : null;
  const responseMap = new Map(
    latestRound?.responses.map((r) => [r.agentId, r]) ?? [],
  );

  const nodes: GraphNode[] = agents.map((a) => ({
    id: a.id,
    name: a.name,
    avatar: a.avatar,
    type: 'main' as const,
    influence: a.influence,
    stance: responseMap.get(a.id)?.stance,
  }));

  const edges: GraphEdge[] = [];
  const addedEdges = new Set<string>();

  const addEdge = (src: string, tgt: string, type: GraphEdge['type'], strength: number) => {
    const key = [src, tgt].sort().join('::') + '::' + type;
    if (!addedEdges.has(key)) {
      addedEdges.add(key);
      edges.push({ source: src, target: tgt, type, strength });
    }
  };

  // Alliance / rival edges from preset agent data
  agents.forEach((a) => {
    a.allies.forEach((allyId) => {
      if (agents.find((x) => x.id === allyId)) {
        addEdge(a.id, allyId, 'alliance', 0.7);
      }
    });
    a.rivals.forEach((rivalId) => {
      if (agents.find((x) => x.id === rivalId)) {
        addEdge(a.id, rivalId, 'conflict', 0.7);
      }
    });
  });

  // Alliances from latest round
  latestRound?.alliances.forEach((al) => {
    for (let i = 0; i < al.agents.length; i++) {
      for (let j = i + 1; j < al.agents.length; j++) {
        addEdge(al.agents[i], al.agents[j], 'alliance', al.strength);
      }
    }
  });

  return { nodes, edges };
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function NetworkGraph({ width: propWidth, height: propHeight }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const [dimensions, setDimensions] = useState({ width: propWidth ?? 800, height: propHeight ?? 600 });

  // Store data
  const agents = useAgentStore((s) => s.agents);
  const rounds = useSimulationStore((s) => s.rounds);
  const status = useSimulationStore((s) => s.status);

  // ── Responsive sizing via ResizeObserver ───────────────────────────────────
  useEffect(() => {
    if (propWidth && propHeight) {
      setDimensions({ width: propWidth, height: propHeight });
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          setDimensions({ width: w, height: h });
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [propWidth, propHeight]);

  // ── Tooltip state ──────────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    node: SimNode;
  } | null>(null);

  // ── Drag behaviour factory ─────────────────────────────────────────────────
  const makeDrag = useCallback(
    (sim: d3.Simulation<SimNode, SimLink>) => {
      return d3
        .drag<SVGCircleElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });
    },
    [],
  );

  // ── Main D3 render ─────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current) return;

    const { width: W, height: H } = dimensions;

    // Decide data source
    const liveData =
      status !== 'idle' ? buildFromStores(agents, rounds) : null;
    const { nodes: rawNodes, edges: rawEdges } = liveData ?? generateMockData();

    // Clone into mutable SimNode / SimLink
    const nodes: SimNode[] = rawNodes.map((n) => ({ ...n }));
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = rawEdges
      .filter((e) => nodeMap.has(e.source as string) && nodeMap.has(e.target as string))
      .map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        strength: e.strength,
      }));

    // ── Clean previous render ──────────────────────────────────────────────
    svg.selectAll('*').remove();

    // ── Defs: glow filter ──────────────────────────────────────────────────
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'glow');
    filter
      .append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'coloredBlur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    // ── Root group (zoom / pan target) ─────────────────────────────────────
    const g = svg.append('g');

    // ── Zoom behaviour ─────────────────────────────────────────────────────
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // ── Force simulation ───────────────────────────────────────────────────
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(120),
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force(
        'collide',
        d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 4),
      );

    simulationRef.current = simulation;

    // ── Edge groups ────────────────────────────────────────────────────────
    const linkGroup = g.append('g').attr('class', 'links');
    const linkSel = linkGroup
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => EDGE_STYLES[d.type].stroke)
      .attr('stroke-width', (d) => EDGE_STYLES[d.type].width)
      .attr('stroke-dasharray', (d) => EDGE_STYLES[d.type].dasharray)
      .attr('stroke-opacity', 0.6);

    // Animate new edges growing in
    linkSel
      .attr('stroke-dashoffset', function () {
        return (this as SVGLineElement).getTotalLength?.() || 200;
      })
      .transition()
      .duration(800)
      .attr('stroke-dashoffset', 0);

    // ── Node groups ────────────────────────────────────────────────────────
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const nodeSel = nodeGroup
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('cursor', 'grab');

    // Circles
    nodeSel
      .append('circle')
      .attr('r', 0)
      .attr('fill', (d) => STANCE_COLORS[d.stance ?? 'default'])
      .attr('stroke', (d) => (d.type === 'main' ? 'rgba(218,226,253,0.3)' : 'none'))
      .attr('stroke-width', (d) => (d.type === 'main' ? 1.5 : 0))
      .style('filter', (d) => (d.type === 'main' ? 'url(#glow)' : 'none'))
      .transition()
      .duration(600)
      .attr('r', (d) => nodeRadius(d));

    // Labels
    nodeSel
      .append('text')
      .text((d) => d.name)
      .attr('font-size', 10)
      .attr('fill', '#dae2fd')
      .attr('dx', (d) => nodeRadius(d) + 4)
      .attr('dy', 3)
      .attr('pointer-events', 'none')
      .attr('opacity', 0)
      .transition()
      .delay(300)
      .duration(400)
      .attr('opacity', 1);

    // ── Drag ───────────────────────────────────────────────────────────────
    nodeSel.select<SVGCircleElement>('circle').call(makeDrag(simulation));

    // ── Hover interactions ─────────────────────────────────────────────────
    nodeSel
      .on('mouseenter', (event, d) => {
        // Highlight connected edges
        linkSel
          .transition()
          .duration(200)
          .attr('stroke-opacity', (l) => {
            const src = typeof l.source === 'object' ? (l.source as SimNode).id : l.source;
            const tgt = typeof l.target === 'object' ? (l.target as SimNode).id : l.target;
            return src === d.id || tgt === d.id ? 1 : 0.1;
          })
          .attr('stroke-width', (l) => {
            const src = typeof l.source === 'object' ? (l.source as SimNode).id : l.source;
            const tgt = typeof l.target === 'object' ? (l.target as SimNode).id : l.target;
            return src === d.id || tgt === d.id
              ? EDGE_STYLES[l.type].width + 1
              : EDGE_STYLES[l.type].width;
          });

        // Dim unconnected nodes
        const connectedIds = new Set<string>();
        connectedIds.add(d.id);
        links.forEach((l) => {
          const src = typeof l.source === 'object' ? (l.source as SimNode).id : (l.source as string);
          const tgt = typeof l.target === 'object' ? (l.target as SimNode).id : (l.target as string);
          if (src === d.id) connectedIds.add(tgt);
          if (tgt === d.id) connectedIds.add(src);
        });
        nodeSel
          .select('circle')
          .transition()
          .duration(200)
          .attr('opacity', (n) => (connectedIds.has((n as SimNode).id) ? 1 : 0.25));
        nodeSel
          .select('text')
          .transition()
          .duration(200)
          .attr('opacity', (n) => (connectedIds.has((n as SimNode).id) ? 1 : 0.15));

        // Show tooltip
        const [mx, my] = d3.pointer(event, containerRef.current);
        setTooltip({ x: mx, y: my, node: d });
      })
      .on('mouseleave', () => {
        linkSel
          .transition()
          .duration(300)
          .attr('stroke-opacity', 0.6)
          .attr('stroke-width', (l) => EDGE_STYLES[l.type].width);
        nodeSel.select('circle').transition().duration(300).attr('opacity', 1);
        nodeSel.select('text').transition().duration(300).attr('opacity', 1);
        setTooltip(null);
      });

    // ── Tick ───────────────────────────────────────────────────────────────
    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d) => (d.source as SimNode).x!)
        .attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!)
        .attr('y2', (d) => (d.target as SimNode).y!);

      nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [dimensions, agents, rounds, status, makeDrag]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative h-full w-full bg-surface-container rounded-lg overflow-hidden"
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block"
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-md border border-outline/30 bg-surface-container-high px-3 py-2 text-xs shadow-lg"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 10,
          }}
        >
          <p className="font-semibold text-on-surface">
            {tooltip.node.avatar} {tooltip.node.name}
          </p>
          <p className="mt-0.5 text-on-surface-variant">
            Stance:{' '}
            <span
              style={{
                color: STANCE_COLORS[tooltip.node.stance ?? 'default'],
              }}
            >
              {tooltip.node.stance ?? 'unknown'}
            </span>
          </p>
          <p className="text-on-surface-variant">
            Influence: {tooltip.node.influence}
          </p>
        </div>
      )}
    </div>
  );
}
