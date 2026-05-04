import { evaluateFormula } from './formula-parser';
import type { Agent, AgentROIResult, ROITarget, FunctionROIRollup, AgentFunction } from './types';

export function computeCommittedValue(target: ROITarget): number {
  return evaluateFormula(
    target.monetizationFormula,
    target.monetizationParams,
    target.targetValue
  );
}

export function computeMeasuredValue(agent: Agent): number {
  return agent.measuredOutcomes.reduce((sum, o) => sum + o.monetizedValue, 0);
}

export function computeAgentROI(agent: Agent): AgentROIResult {
  const committedValue = agent.roiTargets.reduce((sum, t) => {
    try { return sum + computeCommittedValue(t); }
    catch { return sum; }
  }, 0);

  const measuredValue = computeMeasuredValue(agent);
  const variance = measuredValue - committedValue;
  const variancePct = committedValue > 0 ? (variance / committedValue) * 100 : 0;
  const trajectoryProjection = projectToYearEnd(agent);

  return { committedValue, measuredValue, variance, variancePct, trajectoryProjection };
}

function projectToYearEnd(agent: Agent): number {
  const outcomes = agent.measuredOutcomes;
  if (outcomes.length < 2) {
    return outcomes.length === 1 ? outcomes[0].monetizedValue : 0;
  }
  // Linear extrapolation from the last two measurements to Dec 31 of current year
  const sorted = [...outcomes].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const latest = sorted[sorted.length - 1];
  const prior = sorted[sorted.length - 2];

  const t1 = new Date(prior.measuredAt).getTime();
  const t2 = new Date(latest.measuredAt).getTime();
  const tEnd = new Date(`${new Date().getFullYear()}-12-31`).getTime();

  if (t2 === t1) return latest.monetizedValue;

  const slope = (latest.monetizedValue - prior.monetizedValue) / (t2 - t1);
  return Math.max(0, latest.monetizedValue + slope * (tEnd - t2));
}

export function rollupByFunction(agents: Agent[]): FunctionROIRollup[] {
  const fns: AgentFunction[] = ['sales', 'marketing', 'customer_success', 'cross_functional'];
  return fns.map((fn) => {
    const fnAgents = agents.filter((a) => a.function === fn);
    const committed = fnAgents.reduce((sum, a) => {
      try { return sum + computeAgentROI(a).committedValue; } catch { return sum; }
    }, 0);
    const measured = fnAgents.reduce((sum, a) => sum + computeMeasuredValue(a), 0);
    return {
      function: fn,
      committedValue: committed,
      measuredValue: measured,
      variance: measured - committed,
      variancePct: committed > 0 ? ((measured - committed) / committed) * 100 : 0,
      agentCount: fnAgents.length,
    };
  });
}
