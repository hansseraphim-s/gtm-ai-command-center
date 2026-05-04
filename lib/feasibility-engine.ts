import type { FeasibilityScore, FeasibilityWeights } from './types';

export const DEFAULT_WEIGHTS: FeasibilityWeights = {
  dataReadiness: 0.25,
  modelMaturity: 0.15,
  buildComplexity: 0.10,
  adoptionReadiness: 0.20,
  changeMgmtScope: 0.15,
  politicalViability: 0.15,
};

export type FeasibilityDimension = keyof FeasibilityWeights;

export const DIMENSIONS: FeasibilityDimension[] = [
  'dataReadiness',
  'modelMaturity',
  'buildComplexity',
  'adoptionReadiness',
  'changeMgmtScope',
  'politicalViability',
];

export type DimensionMeta = {
  label: string;
  description: string;
  lowLabel: string;
  highLabel: string;
};

export const DIMENSION_META: Record<FeasibilityDimension, DimensionMeta> = {
  dataReadiness: {
    label: 'Data Readiness',
    description: 'Quality, availability, and access to required data sources',
    lowLabel: 'Major gaps / unavailable',
    highLabel: 'Fully available & clean',
  },
  modelMaturity: {
    label: 'Model Maturity',
    description: 'Maturity of the underlying AI/ML models and techniques required',
    lowLabel: 'Research-stage / experimental',
    highLabel: 'Production-proven',
  },
  buildComplexity: {
    label: 'Build Complexity',
    description: 'Engineering effort required — 5 = simple, 1 = highly complex',
    lowLabel: 'Highly complex',
    highLabel: 'Simple / off-the-shelf',
  },
  adoptionReadiness: {
    label: 'Adoption Readiness',
    description: 'User readiness and appetite to adopt the agent',
    lowLabel: 'High resistance',
    highLabel: 'High demand & readiness',
  },
  changeMgmtScope: {
    label: 'Change Mgmt Scope',
    description: 'Process/org change required — 5 = minimal change needed',
    lowLabel: 'Massive org change',
    highLabel: 'Minimal change',
  },
  politicalViability: {
    label: 'Political Viability',
    description: 'Stakeholder alignment and executive support',
    lowLabel: 'Strong opposition',
    highLabel: 'Full sponsorship',
  },
};

export function computeFeasibilityComposite(
  scores: Pick<
    FeasibilityScore,
    'dataReadiness' | 'modelMaturity' | 'buildComplexity' | 'adoptionReadiness' | 'changeMgmtScope' | 'politicalViability'
  >,
  weights: FeasibilityWeights = DEFAULT_WEIGHTS
): number {
  const raw =
    scores.dataReadiness * weights.dataReadiness +
    scores.modelMaturity * weights.modelMaturity +
    scores.buildComplexity * weights.buildComplexity +
    scores.adoptionReadiness * weights.adoptionReadiness +
    scores.changeMgmtScope * weights.changeMgmtScope +
    scores.politicalViability * weights.politicalViability;

  const totalWeight = DIMENSIONS.reduce((sum, d) => sum + weights[d], 0);
  return totalWeight > 0 ? raw / totalWeight : raw;
}

export type FeasibilityBand = 'green' | 'amber' | 'red';

export function feasibilityHealthBand(composite: number): FeasibilityBand {
  if (composite >= 4) return 'green';
  if (composite >= 3) return 'amber';
  return 'red';
}

export const BAND_COLORS: Record<FeasibilityBand, string> = {
  green: 'text-green-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
};

export const BAND_LABELS: Record<FeasibilityBand, string> = {
  green: 'High feasibility',
  amber: 'Moderate feasibility',
  red: 'Low feasibility — review blockers',
};
