import type {
  Agent,
  AgentQuadrant,
  PrioritizationWeights,
  RankedAgent,
  RiskSeverity,
} from './types';
import { computeAgentROI } from './roi-engine';

export const DEFAULT_PRIORITIZATION_WEIGHTS: PrioritizationWeights = {
  expectedRoi: 0.35,
  feasibility: 0.25,
  strategicAlignment: 0.20,
  timeToValue: 0.15,
  riskAdjusted: 0.05,
};

// Normalize committed ROI to a 0-5 score using a soft cap at $5M annual
function roiToScore(committedValue: number, budget: number): number {
  if (committedValue <= 0) return 0;
  const multiple = budget > 0 ? committedValue / budget : committedValue / 1_000_000;
  // Score 5 = 10× ROI multiple or $5M+; score 2.5 = 3× or $1.5M
  const raw = Math.min(5, Math.log10(Math.max(1, multiple + 1)) * 5);
  return Math.round(raw * 10) / 10;
}

const RISK_WEIGHTS: Record<RiskSeverity, number> = {
  critical: 0.30,
  high: 0.15,
  medium: 0.05,
  low: 0.01,
};

function computeRiskPenalty(agent: Agent): number {
  const openRisks = agent.risks.filter(
    (r) => r.status === 'open' || r.status === 'accepted'
  );
  const raw = openRisks.reduce((sum, r) => sum + RISK_WEIGHTS[r.severity], 0);
  return Math.min(1, raw);
}

function quadrantFromScores(
  feasScore: number,
  roiScore: number
): AgentQuadrant {
  const highFeas = feasScore >= 3;
  const highRoi = roiScore >= 2.5;
  if (highFeas && highRoi) return 'fund_now';
  if (highFeas && !highRoi) return 'quick_win';
  if (!highFeas && highRoi) return 'sequence';
  return 'defer';
}

export const QUADRANT_META: Record<
  AgentQuadrant,
  { label: string; color: string; description: string }
> = {
  fund_now: {
    label: 'Fund Now',
    color: '#16a34a',
    description: 'High feasibility + high ROI — prioritize immediately',
  },
  quick_win: {
    label: 'Quick Win',
    color: '#2563eb',
    description: 'Feasible but lower ROI — good for momentum and learning',
  },
  sequence: {
    label: 'Sequence',
    color: '#d97706',
    description: 'High ROI potential but feasibility needs work — plan gap closure',
  },
  defer: {
    label: 'Defer',
    color: '#6b7280',
    description: 'Low feasibility and ROI — revisit when blockers are resolved',
  },
};

export function rankAgents(
  agents: Agent[],
  weights: PrioritizationWeights = DEFAULT_PRIORITIZATION_WEIGHTS
): RankedAgent[] {
  const active = agents.filter(
    (a) => a.stage !== 'killed' && a.stage !== 'sunset'
  );

  const ranked = active.map((agent): RankedAgent => {
    const budget = agent.budgetYear1 || 1_000_000;

    let committedValue = 0;
    try {
      committedValue = computeAgentROI(agent).committedValue;
    } catch {
      // ignore
    }

    const roiScore = roiToScore(committedValue, budget);
    const feasScore = agent.feasibilityScore?.composite ?? 0;
    const alignmentScore = agent.strategicAlignmentScore ?? 0;
    const ttvScore = agent.timeToValueScore ?? 0;
    const riskPenalty = computeRiskPenalty(agent);

    // Weighted composite, then apply risk penalty via riskAdjusted weight
    const baseScore =
      roiScore * weights.expectedRoi +
      feasScore * weights.feasibility +
      alignmentScore * weights.strategicAlignment +
      ttvScore * weights.timeToValue;

    const maxBase =
      5 * (weights.expectedRoi + weights.feasibility + weights.strategicAlignment + weights.timeToValue);

    // Normalize to 0-100 then apply risk penalty
    const normalized = maxBase > 0 ? (baseScore / maxBase) * 100 : 0;
    const priorityScore =
      normalized * (1 - riskPenalty * weights.riskAdjusted * 10);

    const quadrant = quadrantFromScores(feasScore, roiScore);

    return {
      agent,
      priorityScore: Math.round(priorityScore * 10) / 10,
      roiScore,
      feasScore,
      alignmentScore,
      ttvScore,
      riskPenalty,
      quadrant,
    };
  });

  return ranked.sort((a, b) => b.priorityScore - a.priorityScore);
}
