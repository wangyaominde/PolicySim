import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { Agent, AgentResponse, Stance } from '../../types';
import { useSimulationStore } from '../../stores';
import { useAgentStore } from '../../stores';

// ── Theme colours ───────────────────────────────────────────────────────────
const COLORS = {
  bgSurface: '#171f33',
  textOnSurface: '#dae2fd',
  textOnSurfaceVariant: '#bbcabf',
  primary: '#4edea3',
  secondary: '#b50036',
  secondaryLight: '#ffb2b7',
  neutral: '#2d3449',
  tertiary: '#e29100',
} as const;

// ── Colour scales ───────────────────────────────────────────────────────────
const allianceScale = d3.interpolateRgb(COLORS.bgSurface, COLORS.primary);
const conflictScale = d3.interpolateRgb(COLORS.bgSurface, COLORS.secondary);

function cellColor(score: number): string {
  if (score > 0) return allianceScale(score);
  if (score < 0) return conflictScale(-score);
  return COLORS.neutral;
}

function scoreLabel(score: number): string {
  if (score > 0.4) return 'Alliance';
  if (score > 0.1) return 'Friendly';
  if (score < -0.4) return 'Conflict';
  if (score < -0.1) return 'Tension';
  return 'Neutral';
}

// ── Mock matrix from preset agents ──────────────────────────────────────────
function buildMockMatrix(agents: Agent[]): number[][] {
  const idxMap = new Map(agents.map((a, i) => [a.id, i]));
  const n = agents.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  agents.forEach((a, i) => {
    a.allies.forEach((allyId) => {
      const j = idxMap.get(allyId);
      if (j !== undefined) {
        matrix[i][j] = Math.min(matrix[i][j] + 0.5, 1);
        matrix[j][i] = Math.min(matrix[j][i] + 0.5, 1);
      }
    });
    a.rivals.forEach((rivalId) => {
      const j = idxMap.get(rivalId);
      if (j !== undefined) {
        matrix[i][j] = Math.max(matrix[i][j] - 0.5, -1);
        matrix[j][i] = Math.max(matrix[j][i] - 0.5, -1);
      }
    });
  });

  // Diagonal: self-stance placeholder
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 0.25;
  }

  return matrix;
}

// ── Build matrix from live simulation data ──────────────────────────────────
function buildLiveMatrix(
  agents: Agent[],
  responses: AgentResponse[],
): number[][] {
  const n = agents.length;
  const idxMap = new Map(agents.map((a, i) => [a.id, i]));
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const respMap = new Map(responses.map((r) => [r.agentId, r]));

  for (let i = 0; i < n; i++) {
    const respI = respMap.get(agents[i].id);
    for (let j = 0; j < n; j++) {
      if (i === j) {
        // Diagonal: self indicator
        matrix[i][j] = 0.25;
        continue;
      }

      let score = 0;

      // Alliance / opposition intent from i towards j
      if (respI) {
        if (respI.allianceIntent.some((intent) => intent.agentId === agents[j].id)) {
          score += 0.5;
        }
        if (respI.oppositionIntent.some((intent) => intent.agentId === agents[j].id)) {
          score -= 0.5;
        }
      }

      // Stance similarity
      const stanceI = respI?.stance;
      const respJ = respMap.get(agents[j].id);
      const stanceJ = respJ?.stance;

      if (stanceI && stanceJ) {
        if (stanceI === stanceJ) {
          score += 0.3;
        } else if (
          (stanceI === 'support' && stanceJ === 'oppose') ||
          (stanceI === 'oppose' && stanceJ === 'support')
        ) {
          score -= 0.3;
        }
      }

      matrix[i][j] = Math.max(-1, Math.min(1, score));
    }
  }

  return matrix;
}

// ── Tooltip data ────────────────────────────────────────────────────────────
interface TooltipData {
  x: number;
  y: number;
  fromAgent: Agent;
  toAgent: Agent;
  score: number;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function StanceMatrix() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Store data
  const allAgents = useAgentStore((s) => s.agents);
  const customAgents = useAgentStore((s) => s.customAgents);
  const selectedIds = useAgentStore((s) => s.selectedIds);
  const rounds = useSimulationStore((s) => s.rounds);
  const status = useSimulationStore((s) => s.status);

  // Selected agents
  const agents = [...allAgents, ...customAgents].filter((a) =>
    selectedIds.includes(a.id),
  );

  // ── ResizeObserver ──────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) setDimensions({ width: w, height: h });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Tooltip handler (stable ref) ───────────────────────────────────────
  const handleTooltip = useCallback(
    (data: TooltipData | null) => setTooltip(data),
    [],
  );

  // ── D3 render ─────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current || agents.length === 0) return;

    svg.selectAll('*').remove();

    const { width: W, height: H } = dimensions;
    const n = agents.length;

    // Compute matrix
    const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
    const hasLiveData = status !== 'idle' && latestRound && latestRound.responses.length > 0;
    const matrix = hasLiveData
      ? buildLiveMatrix(agents, latestRound.responses)
      : buildMockMatrix(agents);

    // Layout constants
    const LABEL_WIDTH = Math.min(100, W * 0.18);
    const LABEL_HEIGHT = Math.min(100, H * 0.18);
    const gridW = W - LABEL_WIDTH - 10;
    const gridH = H - LABEL_HEIGHT - 10;
    const cellW = gridW / n;
    const cellH = gridH / n;
    const gridX = LABEL_WIDTH;
    const gridY = LABEL_HEIGHT;

    // ── Root group ────────────────────────────────────────────────────────
    const g = svg.append('g');

    // ── Grid cells ────────────────────────────────────────────────────────
    const cellsGroup = g.append('g').attr('class', 'cells');

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const score = matrix[i][j];
        const isDiag = i === j;

        cellsGroup
          .append('rect')
          .attr('x', gridX + j * cellW)
          .attr('y', gridY + i * cellH)
          .attr('width', cellW - 1)
          .attr('height', cellH - 1)
          .attr('rx', 2)
          .attr('ry', 2)
          .attr('fill', isDiag ? COLORS.primary : cellColor(score))
          .attr('fill-opacity', isDiag ? 0.2 : 1)
          .attr('stroke', 'none')
          .attr('data-row', i)
          .attr('data-col', j)
          .style('cursor', 'pointer')
          .on('mouseenter', function (event) {
            const row = i;
            const col = j;

            // Highlight row + column, dim others
            cellsGroup.selectAll('rect').each(function () {
              const el = d3.select(this);
              const r = Number(el.attr('data-row'));
              const c = Number(el.attr('data-col'));
              if (r === row || c === col) {
                el.attr('fill-opacity', r === row && c === col ? 1 : 0.85);
              } else {
                el.attr('fill-opacity', 0.3);
              }
            });

            // Highlight labels
            g.selectAll('.label-left text').attr('fill-opacity', (_d, idx) =>
              idx === row ? 1 : 0.3,
            );
            g.selectAll('.label-top text').attr('fill-opacity', (_d, idx) =>
              idx === col ? 1 : 0.3,
            );

            // Show tooltip
            const [mx, my] = d3.pointer(event, containerRef.current);
            handleTooltip({
              x: mx,
              y: my,
              fromAgent: agents[row],
              toAgent: agents[col],
              score: matrix[row][col],
            });
          })
          .on('mouseleave', function () {
            // Reset all opacities
            cellsGroup.selectAll('rect').each(function () {
              const el = d3.select(this);
              const r = Number(el.attr('data-row'));
              const c = Number(el.attr('data-col'));
              el.attr('fill-opacity', r === c ? 0.2 : 1);
            });
            g.selectAll('.label-left text').attr('fill-opacity', 1);
            g.selectAll('.label-top text').attr('fill-opacity', 1);
            handleTooltip(null);
          });
      }
    }

    // ── Left labels (agent rows) ──────────────────────────────────────────
    const leftLabels = g.append('g').attr('class', 'label-left');
    agents.forEach((agent, i) => {
      const truncName =
        agent.name.length > 6 ? agent.name.slice(0, 6) + '..' : agent.name;
      leftLabels
        .append('text')
        .attr('x', gridX - 6)
        .attr('y', gridY + i * cellH + cellH / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', COLORS.textOnSurface)
        .attr('font-size', Math.min(12, cellH * 0.5))
        .text(`${agent.avatar} ${truncName}`);
    });

    // ── Top labels (agent columns) ────────────────────────────────────────
    const topLabels = g.append('g').attr('class', 'label-top');
    agents.forEach((agent, j) => {
      const truncName =
        agent.name.length > 6 ? agent.name.slice(0, 6) + '..' : agent.name;
      topLabels
        .append('text')
        .attr('x', gridX + j * cellW + cellW / 2)
        .attr('y', gridY - 6)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .attr('fill', COLORS.textOnSurface)
        .attr('font-size', Math.min(12, cellW * 0.5))
        .attr(
          'transform',
          `rotate(-45, ${gridX + j * cellW + cellW / 2}, ${gridY - 6})`,
        )
        .text(`${agent.avatar} ${truncName}`);
    });

    // ── Entry animation ───────────────────────────────────────────────────
    cellsGroup
      .selectAll('rect')
      .attr('opacity', 0)
      .transition()
      .duration(400)
      .delay((_d, i) => i * 8)
      .attr('opacity', 1);
  }, [dimensions, agents, rounds, status, handleTooltip]);

  // ── Render ────────────────────────────────────────────────────────────────
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
            left: Math.min(tooltip.x + 14, dimensions.width - 200),
            top: Math.max(tooltip.y - 10, 4),
          }}
        >
          {tooltip.fromAgent.id === tooltip.toAgent.id ? (
            <p className="font-semibold text-on-surface">
              {tooltip.fromAgent.avatar} {tooltip.fromAgent.name} (self)
            </p>
          ) : (
            <>
              <p className="font-semibold text-on-surface">
                {tooltip.fromAgent.avatar} {tooltip.fromAgent.name}{' '}
                <span className="text-on-surface-variant">&rarr;</span>{' '}
                {tooltip.toAgent.avatar} {tooltip.toAgent.name}
              </p>
              <p className="mt-0.5 text-on-surface-variant">
                Score:{' '}
                <span
                  style={{
                    color:
                      tooltip.score > 0
                        ? COLORS.primary
                        : tooltip.score < 0
                          ? COLORS.secondaryLight
                          : COLORS.textOnSurfaceVariant,
                  }}
                >
                  {tooltip.score > 0 ? '+' : ''}
                  {tooltip.score.toFixed(1)}
                </span>{' '}
                ({scoreLabel(tooltip.score)})
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
