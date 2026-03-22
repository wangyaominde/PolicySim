import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { Agent, AgentResponse, Action } from '../../types';
import { useSimulationStore } from '../../stores';
import { useAgentStore } from '../../stores';

// ── Types ───────────────────────────────────────────────────────────────────────
interface FlowNode {
  id: string;
  label: string;
  avatar?: string;
  side: 'left' | 'right';
  totalFlow: number; // sum of |values| of all connected links
}

interface FlowLink {
  sourceId: string;
  targetId: string;
  value: number;   // absolute magnitude (always positive)
  sign: number;    // +1 or -1
}

interface LayoutNode extends FlowNode {
  x: number;
  y: number;
  height: number;
  width: number;
}

interface LayoutLink extends FlowLink {
  sy: number;  // source y offset (center of slice)
  ty: number;  // target y offset (center of slice)
  thickness: number;
}

// ── Theme colours ───────────────────────────────────────────────────────────────
const COLORS = {
  bgSurface: '#171f33',
  textPrimary: '#dae2fd',
  textSecondary: '#bbcabf',
  positive: '#4edea3',
  negative: '#ffb2b7',
  negativeStrong: '#b50036',
  tertiary: '#ffb95f',
  surfaceVariant: '#2d3449',
};

// ── Impact categories ───────────────────────────────────────────────────────────
const IMPACT_CATEGORIES: Record<string, { label: string; actionTypes: Action['type'][] }> = {
  economic:    { label: '经济影响',     actionTypes: ['invest', 'boycott'] },
  political:   { label: '政治博弈',     actionTypes: ['lobby'] },
  opinion:     { label: '舆论影响',     actionTypes: ['observe'] },
  coercion:    { label: '法规/威慑',    actionTypes: ['threaten'] },
  alliance:    { label: '联盟构建',     actionTypes: ['ally', 'spawn_sub'] },
};

const CATEGORY_IDS = Object.keys(IMPACT_CATEGORIES);

// ── Mock data ───────────────────────────────────────────────────────────────────
function generateMockData(): { nodes: FlowNode[]; links: FlowLink[] } {
  const leftNodes: FlowNode[] = [
    { id: 'cat_economic',  label: '经济影响',  side: 'left', totalFlow: 0 },
    { id: 'cat_political', label: '政治博弈',  side: 'left', totalFlow: 0 },
    { id: 'cat_opinion',   label: '舆论影响',  side: 'left', totalFlow: 0 },
    { id: 'cat_environ',   label: '环境效应',  side: 'left', totalFlow: 0 },
    { id: 'cat_legal',     label: '法规/威慑', side: 'left', totalFlow: 0 },
  ];

  const rightNodes: FlowNode[] = [
    { id: 'capitalist_01',     label: '资本家/企业家', avatar: '🏭', side: 'right', totalFlow: 0 },
    { id: 'worker_01',         label: '工人/工会',     avatar: '👷', side: 'right', totalFlow: 0 },
    { id: 'finance_01',        label: '金融/投资者',   avatar: '🏦', side: 'right', totalFlow: 0 },
    { id: 'politician_01',     label: '政治家/官僚',   avatar: '🏛️', side: 'right', totalFlow: 0 },
    { id: 'media_01',          label: '媒体/舆论',     avatar: '📰', side: 'right', totalFlow: 0 },
    { id: 'public_01',         label: '普通民众',      avatar: '🌾', side: 'right', totalFlow: 0 },
    { id: 'environmental_01',  label: '环保组织/NGO',  avatar: '🌿', side: 'right', totalFlow: 0 },
    { id: 'scientist_01',      label: '科学家/专家',   avatar: '🔬', side: 'right', totalFlow: 0 },
  ];

  const links: FlowLink[] = [
    { sourceId: 'cat_economic',  targetId: 'capitalist_01',    value: 8, sign: 1 },
    { sourceId: 'cat_economic',  targetId: 'worker_01',        value: 5, sign: -1 },
    { sourceId: 'cat_economic',  targetId: 'finance_01',       value: 6, sign: 1 },
    { sourceId: 'cat_political', targetId: 'politician_01',    value: 3, sign: 1 },
    { sourceId: 'cat_political', targetId: 'media_01',         value: 4, sign: 1 },
    { sourceId: 'cat_opinion',   targetId: 'public_01',        value: 2, sign: -1 },
    { sourceId: 'cat_opinion',   targetId: 'media_01',         value: 5, sign: 1 },
    { sourceId: 'cat_opinion',   targetId: 'environmental_01', value: 3, sign: 1 },
    { sourceId: 'cat_environ',   targetId: 'environmental_01', value: 7, sign: 1 },
    { sourceId: 'cat_environ',   targetId: 'scientist_01',     value: 4, sign: 1 },
    { sourceId: 'cat_environ',   targetId: 'capitalist_01',    value: 6, sign: -1 },
    { sourceId: 'cat_legal',     targetId: 'politician_01',    value: 5, sign: 1 },
    { sourceId: 'cat_legal',     targetId: 'capitalist_01',    value: 3, sign: -1 },
  ];

  // Compute totalFlow
  for (const link of links) {
    const left = leftNodes.find((n) => n.id === link.sourceId);
    const right = rightNodes.find((n) => n.id === link.targetId);
    if (left) left.totalFlow += link.value;
    if (right) right.totalFlow += link.value;
  }

  return { nodes: [...leftNodes, ...rightNodes], links };
}

// ── Build from stores ───────────────────────────────────────────────────────────
function buildFromStores(
  agents: Agent[],
  responses: AgentResponse[],
): { nodes: FlowNode[]; links: FlowLink[] } | null {
  if (!agents.length || !responses.length) return null;

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  // Create left (category) nodes
  const leftNodes: FlowNode[] = CATEGORY_IDS.map((catId) => ({
    id: `cat_${catId}`,
    label: IMPACT_CATEGORIES[catId].label,
    side: 'left' as const,
    totalFlow: 0,
  }));

  // Create right (agent) nodes
  const rightNodes: FlowNode[] = [];
  const agentIdSet = new Set<string>();
  for (const r of responses) {
    if (agentIdSet.has(r.agentId)) continue;
    agentIdSet.add(r.agentId);
    const agent = agentMap.get(r.agentId);
    rightNodes.push({
      id: r.agentId,
      label: agent?.name ?? r.agentId,
      avatar: agent?.avatar,
      side: 'right',
      totalFlow: 0,
    });
  }

  // Build links by classifying each action into a category
  const linkMap = new Map<string, FlowLink>();

  for (const response of responses) {
    const { agentId, actions, impactScore } = response;
    const baseSign = impactScore >= 0 ? 1 : -1;

    for (const action of actions) {
      // Find the category that matches this action type
      let matchedCatId: string | null = null;
      for (const catId of CATEGORY_IDS) {
        if (IMPACT_CATEGORIES[catId].actionTypes.includes(action.type)) {
          matchedCatId = catId;
          break;
        }
      }
      if (!matchedCatId) continue;

      const key = `cat_${matchedCatId}::${agentId}`;
      if (linkMap.has(key)) {
        const existing = linkMap.get(key)!;
        existing.value += 1;
      } else {
        linkMap.set(key, {
          sourceId: `cat_${matchedCatId}`,
          targetId: agentId,
          value: Math.max(1, Math.abs(impactScore) / 2),
          sign: baseSign,
        });
      }
    }

    // If agent had no actions but has an impactScore, create a link from a default category
    if (actions.length === 0 && impactScore !== 0) {
      const defaultCat = impactScore > 0 ? 'economic' : 'coercion';
      const key = `cat_${defaultCat}::${agentId}`;
      if (!linkMap.has(key)) {
        linkMap.set(key, {
          sourceId: `cat_${defaultCat}`,
          targetId: agentId,
          value: Math.abs(impactScore),
          sign: baseSign,
        });
      }
    }
  }

  const links = Array.from(linkMap.values()).filter((l) => l.value > 0);

  // Compute totalFlow
  for (const link of links) {
    const left = leftNodes.find((n) => n.id === link.sourceId);
    const right = rightNodes.find((n) => n.id === link.targetId);
    if (left) left.totalFlow += link.value;
    if (right) right.totalFlow += link.value;
  }

  // Filter out nodes with zero flow
  const activeLeftIds = new Set(links.map((l) => l.sourceId));
  const activeRightIds = new Set(links.map((l) => l.targetId));

  return {
    nodes: [
      ...leftNodes.filter((n) => activeLeftIds.has(n.id)),
      ...rightNodes.filter((n) => activeRightIds.has(n.id)),
    ],
    links,
  };
}

// ── Layout computation ──────────────────────────────────────────────────────────
function computeLayout(
  nodes: FlowNode[],
  links: FlowLink[],
  width: number,
  height: number,
): { layoutNodes: LayoutNode[]; layoutLinks: LayoutLink[] } {
  const padding = 24;
  const nodeWidth = 14;
  const nodePadding = 10;
  const leftX = 60;
  const rightX = width - 110;

  const leftNodes = nodes.filter((n) => n.side === 'left');
  const rightNodes = nodes.filter((n) => n.side === 'right');

  // Available vertical space
  const availableH = height - padding * 2;

  // Scale node heights
  const computeColumn = (
    col: FlowNode[],
    x: number,
  ): LayoutNode[] => {
    const totalFlow = col.reduce((s, n) => s + Math.max(n.totalFlow, 1), 0);
    const totalPadding = (col.length - 1) * nodePadding;
    const flowHeight = availableH - totalPadding;
    const minNodeH = 18;

    let yOffset = padding;
    return col.map((node) => {
      const rawH = (Math.max(node.totalFlow, 1) / totalFlow) * flowHeight;
      const h = Math.max(rawH, minNodeH);
      const layoutNode: LayoutNode = {
        ...node,
        x,
        y: yOffset,
        height: h,
        width: nodeWidth,
      };
      yOffset += h + nodePadding;
      return layoutNode;
    });
  };

  const lNodes = computeColumn(leftNodes, leftX);
  const rNodes = computeColumn(rightNodes, rightX);
  const layoutNodes = [...lNodes, ...rNodes];

  // Build a map for fast lookup
  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  // For each node, track how much vertical space has been "consumed" by links
  const sourceOffsets = new Map<string, number>();
  const targetOffsets = new Map<string, number>();

  // Sort links by source then target for consistent ordering
  const sortedLinks = [...links].sort((a, b) => {
    if (a.sourceId !== b.sourceId) return a.sourceId.localeCompare(b.sourceId);
    return a.targetId.localeCompare(b.targetId);
  });

  const maxVal = Math.max(...links.map((l) => l.value), 1);
  const maxThickness = 20;
  const minThickness = 2;

  const layoutLinks: LayoutLink[] = sortedLinks.map((link) => {
    const sNode = nodeMap.get(link.sourceId)!;
    const tNode = nodeMap.get(link.targetId)!;

    const thickness = minThickness + ((link.value / maxVal) * (maxThickness - minThickness));

    // Source y: stack within the source node
    const sOff = sourceOffsets.get(link.sourceId) ?? 0;
    const sy = sNode.y + sOff + thickness / 2;
    sourceOffsets.set(link.sourceId, sOff + thickness + 2);

    // Target y: stack within the target node
    const tOff = targetOffsets.get(link.targetId) ?? 0;
    const ty = tNode.y + tOff + thickness / 2;
    targetOffsets.set(link.targetId, tOff + thickness + 2);

    return {
      ...link,
      sy,
      ty,
      thickness,
    };
  });

  return { layoutNodes, layoutLinks };
}

// ── Bezier path generator ───────────────────────────────────────────────────────
function sankeyPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness: number,
): string {
  const halfT = thickness / 2;
  const mx = (x0 + x1) / 2;

  // Top edge
  const topPath = `M${x0},${y0 - halfT} C${mx},${y0 - halfT} ${mx},${y1 - halfT} ${x1},${y1 - halfT}`;
  // Bottom edge (reversed)
  const botPath = `L${x1},${y1 + halfT} C${mx},${y1 + halfT} ${mx},${y0 + halfT} ${x0},${y0 + halfT}`;

  return `${topPath} ${botPath} Z`;
}

// ── Component ───────────────────────────────────────────────────────────────────
export default function InterestFlow() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Store data
  const agents = useAgentStore((s) => [...s.agents, ...s.customAgents]);
  const rounds = useSimulationStore((s) => s.rounds);
  const status = useSimulationStore((s) => s.status);

  // ── Responsive sizing ───────────────────────────────────────────────────────
  useEffect(() => {
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
  }, []);

  // ── Tooltip state ─────────────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
    subtext?: string;
  } | null>(null);

  // ── Hover state (which element is hovered) ────────────────────────────────────
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredType, setHoveredType] = useState<'node' | 'link' | null>(null);

  // ── Compute data & layout ─────────────────────────────────────────────────────
  const latestRound = rounds.length ? rounds[rounds.length - 1] : null;
  const liveData =
    status !== 'idle' && latestRound
      ? buildFromStores(agents, latestRound.responses)
      : null;
  const { nodes: flowNodes, links: flowLinks } = liveData ?? generateMockData();
  const { layoutNodes, layoutLinks } = computeLayout(
    flowNodes,
    flowLinks,
    dimensions.width,
    dimensions.height,
  );

  // Determine which links are "connected" to hovered element
  const getConnectedLinkIds = useCallback((): Set<string> => {
    if (!hoveredId || !hoveredType) return new Set();
    if (hoveredType === 'link') return new Set([hoveredId]);
    // Node hover: highlight all links connected to that node
    const connected = new Set<string>();
    for (const l of layoutLinks) {
      const lid = `${l.sourceId}::${l.targetId}`;
      if (l.sourceId === hoveredId || l.targetId === hoveredId) {
        connected.add(lid);
      }
    }
    return connected;
  }, [hoveredId, hoveredType, layoutLinks]);

  const connectedLinks = getConnectedLinkIds();
  const hasHover = hoveredId !== null;

  // ── D3 render (gradients only — rest is React SVG) ────────────────────────────
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current) return;

    // Remove old defs, recreate
    svg.select('defs.flow-defs').remove();
    const defs = svg.append('defs').attr('class', 'flow-defs');

    // Create gradients for each link
    for (const link of layoutLinks) {
      const gradId = `grad-${link.sourceId}-${link.targetId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const grad = defs
        .append('linearGradient')
        .attr('id', gradId)
        .attr('x1', '0%')
        .attr('x2', '100%')
        .attr('y1', '0%')
        .attr('y2', '0%');

      const color = link.sign >= 0 ? COLORS.positive : COLORS.negative;
      grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.6);
      grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.3);
    }
  }, [layoutLinks]);

  // ── Event handlers ────────────────────────────────────────────────────────────
  const handleNodeEnter = useCallback(
    (e: React.MouseEvent, node: LayoutNode) => {
      setHoveredId(node.id);
      setHoveredType('node');
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          text: `${node.avatar ?? ''} ${node.label}`.trim(),
          subtext: `总流量: ${node.totalFlow.toFixed(1)}`,
        });
      }
    },
    [],
  );

  const handleLinkEnter = useCallback(
    (e: React.MouseEvent, link: LayoutLink) => {
      const lid = `${link.sourceId}::${link.targetId}`;
      setHoveredId(lid);
      setHoveredType('link');

      const sNode = layoutNodes.find((n) => n.id === link.sourceId);
      const tNode = layoutNodes.find((n) => n.id === link.targetId);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const signLabel = link.sign >= 0 ? '+' : '-';
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          text: `${sNode?.label ?? link.sourceId} → ${tNode?.avatar ?? ''} ${tNode?.label ?? link.targetId}`,
          subtext: `影响值: ${signLabel}${link.value.toFixed(1)}`,
        });
      }
    },
    [layoutNodes],
  );

  const handleLeave = useCallback(() => {
    setHoveredId(null);
    setHoveredType(null);
    setTooltip(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────
  const leftNodes = layoutNodes.filter((n) => n.side === 'left');
  const rightNodes = layoutNodes.filter((n) => n.side === 'right');

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg"
      style={{ backgroundColor: COLORS.bgSurface, fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block"
      >
        {/* ── Flow paths ─────────────────────────────────────────────────────── */}
        <g className="flow-links">
          {layoutLinks.map((link) => {
            const sNode = layoutNodes.find((n) => n.id === link.sourceId)!;
            const tNode = layoutNodes.find((n) => n.id === link.targetId)!;
            const x0 = sNode.x + sNode.width;
            const x1 = tNode.x;
            const lid = `${link.sourceId}::${link.targetId}`;
            const gradId = `grad-${link.sourceId}-${link.targetId}`.replace(/[^a-zA-Z0-9_-]/g, '_');

            const isHighlighted = !hasHover || connectedLinks.has(lid);
            const opacity = hasHover ? (isHighlighted ? 0.75 : 0.08) : 0.45;

            return (
              <path
                key={lid}
                d={sankeyPath(x0, link.sy, x1, link.ty, link.thickness)}
                fill={`url(#${gradId})`}
                opacity={opacity}
                style={{ transition: 'opacity 0.2s ease' }}
                onMouseEnter={(e) => handleLinkEnter(e, link)}
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect && tooltip) {
                    setTooltip((prev) =>
                      prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev,
                    );
                  }
                }}
                onMouseLeave={handleLeave}
              />
            );
          })}
        </g>

        {/* ── Left nodes (impact categories) ─────────────────────────────────── */}
        <g className="left-nodes">
          {leftNodes.map((node) => {
            const isHighlighted = !hasHover || hoveredId === node.id || connectedLinks.size > 0 &&
              layoutLinks.some(
                (l) => (l.sourceId === node.id || l.targetId === node.id) && connectedLinks.has(`${l.sourceId}::${l.targetId}`),
              );
            const opacity = hasHover ? (isHighlighted ? 1 : 0.3) : 1;

            return (
              <g
                key={node.id}
                style={{ transition: 'opacity 0.2s ease' }}
                opacity={opacity}
                onMouseEnter={(e) => handleNodeEnter(e, node)}
                onMouseLeave={handleLeave}
                cursor="pointer"
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={4}
                  ry={4}
                  fill={COLORS.surfaceVariant}
                  stroke="rgba(218,226,253,0.15)"
                  strokeWidth={1}
                />
                <text
                  x={node.x - 6}
                  y={node.y + node.height / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  fill={COLORS.textPrimary}
                  fontSize={11}
                  fontWeight={500}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Right nodes (agents) ───────────────────────────────────────────── */}
        <g className="right-nodes">
          {rightNodes.map((node) => {
            const isHighlighted = !hasHover || hoveredId === node.id || connectedLinks.size > 0 &&
              layoutLinks.some(
                (l) => (l.sourceId === node.id || l.targetId === node.id) && connectedLinks.has(`${l.sourceId}::${l.targetId}`),
              );
            const opacity = hasHover ? (isHighlighted ? 1 : 0.3) : 1;

            return (
              <g
                key={node.id}
                style={{ transition: 'opacity 0.2s ease' }}
                opacity={opacity}
                onMouseEnter={(e) => handleNodeEnter(e, node)}
                onMouseLeave={handleLeave}
                cursor="pointer"
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={4}
                  ry={4}
                  fill={COLORS.surfaceVariant}
                  stroke="rgba(218,226,253,0.15)"
                  strokeWidth={1}
                />
                <text
                  x={node.x + node.width + 8}
                  y={node.y + node.height / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  fill={COLORS.textPrimary}
                  fontSize={10}
                  fontWeight={500}
                >
                  {node.avatar ? `${node.avatar} ` : ''}{node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Tooltip ────────────────────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-md border px-3 py-2 text-xs shadow-lg"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 10,
            backgroundColor: COLORS.surfaceVariant,
            borderColor: 'rgba(218,226,253,0.2)',
            maxWidth: 220,
          }}
        >
          <p style={{ color: COLORS.textPrimary, fontWeight: 600, margin: 0 }}>
            {tooltip.text}
          </p>
          {tooltip.subtext && (
            <p style={{ color: COLORS.textSecondary, marginTop: 2, margin: 0 }}>
              {tooltip.subtext}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
