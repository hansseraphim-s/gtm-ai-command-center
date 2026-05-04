// ─── Enumerations ────────────────────────────────────────────────────────────

export type AgentFunction =
  | 'sales'
  | 'marketing'
  | 'customer_success'
  | 'cross_functional';

export type AgentType = 'predictive' | 'generative' | 'agentic' | 'hybrid';

export type AgentTier =
  | 'tier_0_foundation'
  | 'tier_1_quick_win'
  | 'tier_2_strategic_bet'
  | 'tier_3_flagship';

export type AgentStage =
  | 'idea'
  | 'evaluation'
  | 'design'
  | 'pilot'
  | 'scale'
  | 'production'
  | 'sunset'
  | 'killed';

export type BuildBuyDecision = 'build' | 'buy' | 'partner' | 'hybrid' | 'tbd';

export type ROICategory =
  | 'sga_efficiency'
  | 'revenue_acceleration'
  | 'capacity_creation'
  | 'quality_uplift';

export type ROIUnit = 'hours' | 'usd' | 'percentage' | 'count' | 'days';

export type DataAvailability =
  | 'available'
  | 'partial'
  | 'unavailable'
  | 'unknown';

export type PiiRisk = 'none' | 'low' | 'high';

export type MilestoneStatus =
  | 'not_started'
  | 'in_progress'
  | 'done'
  | 'missed'
  | 'deferred';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskLikelihood = 'low' | 'medium' | 'high';
export type RiskStatus = 'open' | 'mitigated' | 'realized' | 'accepted';

// ─── Feasibility ─────────────────────────────────────────────────────────────

export type FeasibilityWeights = {
  dataReadiness: number;
  modelMaturity: number;
  buildComplexity: number;
  adoptionReadiness: number;
  changeMgmtScope: number;
  politicalViability: number;
};

export type FeasibilityScore = {
  // 5 = best; buildComplexity: 5 = simple, 1 = highly complex
  dataReadiness: 1 | 2 | 3 | 4 | 5;
  modelMaturity: 1 | 2 | 3 | 4 | 5;
  buildComplexity: 1 | 2 | 3 | 4 | 5;
  adoptionReadiness: 1 | 2 | 3 | 4 | 5;
  changeMgmtScope: 1 | 2 | 3 | 4 | 5;
  politicalViability: 1 | 2 | 3 | 4 | 5;
  composite: number;
  weights: FeasibilityWeights;
  scoredAt: string;
  scoredBy: string;
  notes: string;
};

// ─── Data Feasibility / CDIO Assessment ──────────────────────────────────────

export type DataSourceRequirement = {
  id: string;
  sourceName: string;
  systemOwner: string;
  dataAvailability: DataAvailability;
  dataQuality: 1 | 2 | 3 | 4 | 5;
  accessGranted: boolean;
  piiRisk: PiiRisk;
  gapDescription?: string;
  closureAction?: string;
  closureOwner?: string;
  closureDate?: string;
};

export type DataFeasibilityAssessment = {
  agentId: string;
  cdioPartner: string;
  assessedAt: string;
  cdioSignedOff: boolean;
  cdioSignOffDate?: string;
  requiredDataSources: DataSourceRequirement[];
  // Derives from sources; also drives FeasibilityScore.dataReadiness
  overallReadiness: 1 | 2 | 3 | 4 | 5;
  gapSummary: string;
  estimatedGapClosureDate?: string;
  notes: string;
};

// ─── ROI Targets & Measured Outcomes ─────────────────────────────────────────

export type ROITarget = {
  id: string;
  category: ROICategory;
  metric: string;
  unit: ROIUnit;
  baselineValue: number;
  targetValue: number;
  targetDate: string;
  // Safe expression string evaluated against monetizationParams + measured_value
  monetizationFormula: string;
  monetizationParams: Record<string, number>;
  controlCohort?: string;
  measurementMethod: string;
  cfoApproved: boolean;
  approvedDate?: string;
  // Kill the agent if measured value < killThreshold by targetDate
  killThreshold?: number;
};

export type MeasuredOutcome = {
  id: string;
  roiTargetId: string;
  measuredAt: string;
  measuredValue: number;
  monetizedValue: number;
  source: string;
  // Date/version of the source system export used
  dataExportVersion?: string;
  notes: string;
  validatedBy?: string;
  validatedAt?: string;
  // CFO can challenge without deleting
  challengedBy?: string;
  challengeNote?: string;
};

// ─── ROI Methodology (auditable, versioned) ───────────────────────────────────

export type ROIMethodologySignOff = {
  role: string;
  name: string;
  signedOffAt: string;
  notes?: string;
};

export type ROIMethodology = {
  id: string;
  agentId: string;
  roiTargetId: string;
  // Increments on every substantive update — previous versions remain in audit log
  version: number;
  baselineMeasurementApproach: string;
  comparatorGroupDefinition: string;
  keyAssumptions: string[];
  knownLimitations: string[];
  // Human-readable step-by-step walk-through for the CFO
  calculationWalkthrough: string;
  signOffChain: ROIMethodologySignOff[];
  createdAt: string;
  updatedAt: string;
};

// ─── ROI Audit Log (append-only) ─────────────────────────────────────────────

export type ROIAuditChangeType =
  | 'target_created'
  | 'target_updated'
  | 'outcome_recorded'
  | 'outcome_challenged'
  | 'cfo_approved'
  | 'methodology_created'
  | 'methodology_updated'
  | 'kill_threshold_breached';

export type ROIAuditEntry = {
  id: string;
  agentId: string;
  roiTargetId?: string;
  measuredOutcomeId?: string;
  methodologyId?: string;
  changedAt: string;
  changedBy: string;
  changeType: ROIAuditChangeType;
  fieldChanged?: string;
  previousValue?: string;
  newValue?: string;
  rationale: string;
};

// ─── Adoption ────────────────────────────────────────────────────────────────

export type FunctionAdoption = {
  function: string;
  activeUsers: number;
  targetUsers: number;
};

export type RegionAdoption = {
  region: string;
  activeUsers: number;
  targetUsers: number;
};

export type RoleAdoption = {
  role: string;
  activeUsers: number;
  targetUsers: number;
};

export type AdoptionTrend = {
  weekStarting: string;
  activeUsers: number;
  weeklyActive: number;
};

export type AdoptionMetrics = {
  agentId: string;
  targetPopulation: number;
  activeUsers: number;
  weeklyActiveUsers: number;
  usageFrequency: number;
  satisfactionScore?: number;
  byFunction: FunctionAdoption[];
  byRegion: RegionAdoption[];
  byRole: RoleAdoption[];
  trend: AdoptionTrend[];
  lastUpdated: string;
};

// ─── Milestones & Risks ───────────────────────────────────────────────────────

export type Milestone = {
  id: string;
  title: string;
  dueDate: string;
  status: MilestoneStatus;
  owner: string;
  notes: string;
  completedDate?: string;
};

export type Risk = {
  id: string;
  description: string;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  mitigation: string;
  owner: string;
  status: RiskStatus;
};

// ─── Activity Log (append-only per agent) ────────────────────────────────────

export type ActivityEntryType =
  | 'stage_change'
  | 'note'
  | 'milestone_update'
  | 'risk_update'
  | 'roi_update'
  | 'feasibility_update'
  | 'decision';

export type ActivityEntry = {
  id: string;
  agentId: string;
  timestamp: string;
  author: string;
  type: ActivityEntryType;
  summary: string;
  detail?: string;
  previousStage?: AgentStage;
  newStage?: AgentStage;
};

// ─── Core Agent ───────────────────────────────────────────────────────────────

export type Agent = {
  id: string;
  code: string;
  name: string;
  description: string;
  function: AgentFunction;
  type: AgentType;
  tier: AgentTier;
  stage: AgentStage;
  buildBuyDecision: BuildBuyDecision;
  vendor?: string;
  owner: string;
  ownerFunction: string;
  cdioPartner?: string;
  startDate: string;
  pilotStartDate?: string;
  productionDate?: string;
  killDate?: string;
  killReason?: string;
  budgetYear1: number;
  budgetYear2?: number;
  budgetYear3?: number;
  feasibilityScore?: FeasibilityScore;
  // Strategic alignment + time-to-value as explicit scores (1–5) for prioritization engine
  strategicAlignmentScore?: 1 | 2 | 3 | 4 | 5;
  timeToValueScore?: 1 | 2 | 3 | 4 | 5;
  roiTargets: ROITarget[];
  measuredOutcomes: MeasuredOutcome[];
  adoptionMetrics?: AdoptionMetrics;
  risks: Risk[];
  milestones: Milestone[];
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

// ─── Portfolio Config ─────────────────────────────────────────────────────────

export type FunctionConfig = {
  id: string;
  name: string;
  leader: string;
  defaultHourlyRate: number;
  affectedPopulation: number;
  budgetAllocation: number;
};

export type PrioritizationWeights = {
  expectedRoi: number;
  feasibility: number;
  strategicAlignment: number;
  timeToValue: number;
  riskAdjusted: number;
};

export type PortfolioConfig = {
  fiscalYearStart: string;
  functions: FunctionConfig[];
  defaultFeasibilityWeights: FeasibilityWeights;
  defaultPrioritizationWeights: PrioritizationWeights;
  cfoApprovalRequired: boolean;
  totalProgramBudget: { year1: number; year2: number; year3: number };
};

// ─── Computed / Engine Output ─────────────────────────────────────────────────

export type AgentQuadrant = 'fund_now' | 'sequence' | 'quick_win' | 'defer';

export type RankedAgent = {
  agent: Agent;
  priorityScore: number;
  roiScore: number;
  feasScore: number;
  alignmentScore: number;
  ttvScore: number;
  riskPenalty: number;
  quadrant: AgentQuadrant;
};

export type FunctionROIRollup = {
  function: AgentFunction;
  committedValue: number;
  measuredValue: number;
  variance: number;
  variancePct: number;
  agentCount: number;
};

export type CategoryROIRollup = {
  category: ROICategory;
  committedValue: number;
  measuredValue: number;
  variance: number;
  variancePct: number;
};

export type AgentROIResult = {
  committedValue: number;
  measuredValue: number;
  variance: number;
  variancePct: number;
  trajectoryProjection: number;
};
