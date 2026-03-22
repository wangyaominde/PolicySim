import type { AgentResponse, Stance, ConsensusResult, ConsensusReport } from '../types';

const STANCES: Stance[] = ['support', 'oppose', 'neutral', 'conditional'];

/**
 * Analyze multiple simulation runs to extract stable conclusions.
 * Takes an array of "runs", where each run is an array of AgentResponses (one per agent).
 */
export function analyzeConsensus(
  runs: AgentResponse[][],
  agentNames: Record<string, string>,
): ConsensusReport {
  const totalRuns = runs.length;
  if (totalRuns === 0) {
    return { totalRuns: 0, overallConsistency: 0, results: [], stableConclusions: [], volatileFactors: [] };
  }

  // Collect all unique agent IDs
  const agentIds = [...new Set(runs.flatMap(run => run.map(r => r.agentId)))];

  const results: ConsensusResult[] = agentIds.map(agentId => {
    // Gather all responses for this agent across runs
    const responses = runs.map(run => run.find(r => r.agentId === agentId)).filter(Boolean) as AgentResponse[];

    // Stance distribution
    const stanceDistribution: Record<Stance, number> = { support: 0, oppose: 0, neutral: 0, conditional: 0 };
    for (const r of responses) {
      stanceDistribution[r.stance] = (stanceDistribution[r.stance] || 0) + 1;
    }

    // Dominant stance
    const dominantStance = STANCES.reduce((a, b) =>
      stanceDistribution[a] >= stanceDistribution[b] ? a : b
    );
    const stanceConsistency = responses.length > 0
      ? stanceDistribution[dominantStance] / responses.length
      : 0;

    // Impact score stats
    const scores = responses.map(r => r.impactScore);
    const avgImpactScore = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0;
    const impactScoreRange: [number, number] = scores.length > 0
      ? [Math.min(...scores), Math.max(...scores)]
      : [0, 0];

    // Common actions
    const actionCounts: Record<string, number> = {};
    for (const r of responses) {
      for (const a of r.actions) {
        actionCounts[a.type] = (actionCounts[a.type] || 0) + 1;
      }
    }
    const commonActions = Object.entries(actionCounts)
      .map(([type, count]) => ({ type, frequency: Math.round((count / responses.length) * 100) / 100 }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    // Common alliance targets
    const allyCounts: Record<string, number> = {};
    for (const r of responses) {
      for (const a of r.allianceIntent) {
        allyCounts[a.agentId] = (allyCounts[a.agentId] || 0) + 1;
      }
    }
    const commonAllies = Object.entries(allyCounts)
      .map(([agentId, count]) => ({ agentId, frequency: Math.round((count / responses.length) * 100) / 100 }))
      .sort((a, b) => b.frequency - a.frequency);

    // Common opposition targets
    const rivalCounts: Record<string, number> = {};
    for (const r of responses) {
      for (const a of r.oppositionIntent) {
        rivalCounts[a.agentId] = (rivalCounts[a.agentId] || 0) + 1;
      }
    }
    const commonRivals = Object.entries(rivalCounts)
      .map(([agentId, count]) => ({ agentId, frequency: Math.round((count / responses.length) * 100) / 100 }))
      .sort((a, b) => b.frequency - a.frequency);

    // Pick the most "median" statement (closest to average impact score)
    const sortedByScore = [...responses].sort((a, b) =>
      Math.abs(a.impactScore - avgImpactScore) - Math.abs(b.impactScore - avgImpactScore)
    );
    const representativeStatement = sortedByScore[0]?.publicStatement || '';

    return {
      agentId,
      stanceDistribution,
      dominantStance,
      stanceConsistency,
      avgImpactScore,
      impactScoreRange,
      commonActions,
      commonAllies,
      commonRivals,
      representativeStatement,
    };
  });

  // Overall consistency
  const overallConsistency = results.length > 0
    ? Math.round((results.reduce((sum, r) => sum + r.stanceConsistency, 0) / results.length) * 100) / 100
    : 0;

  // Stable conclusions (consistency > 80%)
  const stableConclusions: string[] = [];
  const volatileFactors: string[] = [];

  for (const r of results) {
    const name = agentNames[r.agentId] || r.agentId;
    const stanceLabel = { support: '支持', oppose: '反对', neutral: '中立', conditional: '有条件支持' }[r.dominantStance];

    if (r.stanceConsistency >= 0.8) {
      stableConclusions.push(
        `${name} 立场稳定为「${stanceLabel}」(${Math.round(r.stanceConsistency * 100)}% 一致性，影响分 ${r.avgImpactScore})`
      );
    } else {
      const dist = STANCES
        .filter(s => r.stanceDistribution[s] > 0)
        .map(s => `${({ support: '支持', oppose: '反对', neutral: '中立', conditional: '有条件' })[s]} ${Math.round((r.stanceDistribution[s] / totalRuns) * 100)}%`)
        .join('、');
      volatileFactors.push(
        `${name} 立场不稳定：${dist}`
      );
    }

    // Stable alliances
    for (const ally of r.commonAllies) {
      if (ally.frequency >= 0.8) {
        const allyName = agentNames[ally.agentId] || ally.agentId;
        stableConclusions.push(
          `${name} → ${allyName} 联盟关系高度稳定 (${Math.round(ally.frequency * 100)}%)`
        );
      }
    }

    // Stable oppositions
    for (const rival of r.commonRivals) {
      if (rival.frequency >= 0.8) {
        const rivalName = agentNames[rival.agentId] || rival.agentId;
        stableConclusions.push(
          `${name} ↔ ${rivalName} 对抗关系高度稳定 (${Math.round(rival.frequency * 100)}%)`
        );
      }
    }
  }

  return {
    totalRuns,
    overallConsistency,
    results,
    stableConclusions: [...new Set(stableConclusions)],
    volatileFactors,
  };
}
