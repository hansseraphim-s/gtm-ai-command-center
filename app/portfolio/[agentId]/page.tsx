'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, CheckCircle2, AlertCircle, Clock, CircleDot } from 'lucide-react';
import type { Agent, AgentStage, PortfolioConfig, DataFeasibilityAssessment } from '@/lib/types';
import { getAgent, saveAgent, getPortfolioConfig, getDataFeasibility, saveDataFeasibility } from '@/lib/storage';
import { logActivity } from '@/lib/activity';
import { computeAgentROI } from '@/lib/roi-engine';
import { DEFAULT_WEIGHTS } from '@/lib/feasibility-engine';
import { formatCurrency, formatDate, isoNow } from '@/lib/utils';

const STAGE_ADVANCE: Partial<Record<AgentStage, AgentStage>> = {
  idea: 'evaluation', evaluation: 'design', design: 'pilot',
  pilot: 'scale', scale: 'production',
};
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/agents/tier-badge';
import { TypeBadge, FunctionBadge, StageBadge } from '@/components/agents/type-badge';
import { FeasibilityScorer } from '@/components/feasibility/feasibility-scorer';
import { DataFeasibilityForm } from '@/components/feasibility/data-feasibility-form';
import { RisksMilestonesTab } from '@/components/agents/risks-milestones-tab';
import { RoiTab } from '@/components/roi/roi-tab';
import { AdoptionTab } from '@/components/adoption/adoption-tab';
import { ActivityTab } from '@/components/adoption/activity-tab';


export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [config, setConfig] = useState<PortfolioConfig | null>(null);
  const [dataFeasibility, setDataFeasibility] = useState<DataFeasibilityAssessment | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [activityRefresh, setActivityRefresh] = useState('');

  function updateAgent(updated: Agent) {
    setAgent(updated);
    setActivityRefresh(updated.updatedAt);
  }

  useEffect(() => {
    Promise.all([getAgent(agentId), getPortfolioConfig(), getDataFeasibility(agentId)]).then(([a, cfg, df]) => {
      setAgent(a ?? null);
      setConfig(cfg ?? null);
      setDataFeasibility(df);
      setLoading(false);
    });
  }, [agentId]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!agent) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Agent not found.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/portfolio')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />Back to portfolio
        </Button>
      </div>
    );
  }

  const roi = (() => {
    try { return computeAgentROI(agent); }
    catch { return null; }
  })();

  const upcomingMilestones = [...agent.milestones]
    .filter((m) => m.status !== 'done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  const openRisks = agent.risks.filter((r) => r.status === 'open' || r.status === 'accepted');

  function MilestoneIcon({ status }: { status: string }) {
    if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    if (status === 'missed') return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
    if (status === 'in_progress') return <CircleDot className="h-4 w-4 text-amber-500 shrink-0" />;
    return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => router.push('/portfolio')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Portfolio
        </button>
        <div className="flex items-center gap-2">
          {STAGE_ADVANCE[agent.stage] && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const nextStage = STAGE_ADVANCE[agent.stage]!;
                const updated = { ...agent, stage: nextStage, updatedAt: isoNow() };
                await saveAgent(updated);
                await logActivity({ agentId, type: 'stage_change', summary: `Stage advanced to ${nextStage}`, previousStage: agent.stage, newStage: nextStage });
                updateAgent(updated);
              }}
            >
              Advance → {STAGE_ADVANCE[agent.stage]}
            </Button>
          )}
          <Button size="sm" onClick={() => router.push(`/portfolio/${agentId}/edit`)}>
            <Edit className="h-4 w-4 mr-1.5" />Edit
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start gap-3 flex-wrap">
          <span className="font-mono text-sm font-bold text-brand-blue bg-brand-light px-2 py-0.5 rounded">
            {agent.code}
          </span>
          <TierBadge tier={agent.tier} />
          <StageBadge stage={agent.stage} />
          <FunctionBadge fn={agent.function} />
          <TypeBadge type={agent.type} />
        </div>
        <h1 className="text-2xl font-semibold">{agent.name}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{agent.description}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-0">
          {['overview', 'risks-milestones', 'feasibility', 'roi', 'adoption', 'activity'].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-accent data-[state=active]:text-brand-accent px-4 py-2 text-sm font-medium text-muted-foreground capitalize"
            >
              {tab.replace('-', ' & ')}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Overview ────────────────────────────────────────────── */}
        <TabsContent value="overview" className="pt-5 space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Core info */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Core Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Owner" value={agent.owner} />
                <Row label="Owner Function" value={agent.ownerFunction} />
                {agent.cdioPartner && <Row label="CDIO Partner" value={agent.cdioPartner} />}
                <Row label="Build / Buy" value={agent.buildBuyDecision.toUpperCase()} />
                {agent.vendor && <Row label="Vendor" value={agent.vendor} />}
                <Row label="Start Date" value={formatDate(agent.startDate)} />
                {agent.pilotStartDate && <Row label="Pilot Start" value={formatDate(agent.pilotStartDate)} />}
                {agent.productionDate && <Row label="Production" value={formatDate(agent.productionDate)} />}
                {agent.killDate && <Row label="Kill / Sunset" value={formatDate(agent.killDate)} />}
                {agent.killReason && <Row label="Kill Reason" value={agent.killReason} />}
              </CardContent>
            </Card>

            {/* Budget + ROI summary */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Budget & ROI Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Y1 Budget" value={formatCurrency(agent.budgetYear1)} />
                {agent.budgetYear2 && <Row label="Y2 Budget" value={formatCurrency(agent.budgetYear2)} />}
                {agent.budgetYear3 && <Row label="Y3 Budget" value={formatCurrency(agent.budgetYear3)} />}
                {roi && (
                  <>
                    <div className="border-t pt-3 space-y-2">
                      <Row label="Committed Annual ROI"
                        value={roi.committedValue > 0 ? formatCurrency(roi.committedValue) : '—'} />
                      <Row label="Measured to Date"
                        value={roi.measuredValue > 0 ? formatCurrency(roi.measuredValue) : '—'}
                        valueClass={roi.measuredValue > 0 ? 'text-green-600 font-semibold' : ''} />
                      {roi.committedValue > 0 && roi.measuredValue > 0 && (
                        <Row label="ROI Multiple"
                          value={`${(roi.measuredValue / agent.budgetYear1).toFixed(1)}×`}
                          valueClass="font-semibold" />
                      )}
                    </div>
                  </>
                )}
                {agent.roiTargets.filter((t) => t.cfoApproved).length > 0 && (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    CFO-approved methodology
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feasibility score summary */}
            {agent.feasibilityScore && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Feasibility</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`text-3xl font-bold ${
                      agent.feasibilityScore.composite >= 4 ? 'text-green-600' :
                      agent.feasibilityScore.composite >= 3 ? 'text-amber-600' : 'text-red-600'
                    }`}>{agent.feasibilityScore.composite.toFixed(2)}</span>
                    <span className="text-muted-foreground text-xs">/ 5.00</span>
                  </div>
                  {[
                    ['Data Readiness', agent.feasibilityScore.dataReadiness],
                    ['Model Maturity', agent.feasibilityScore.modelMaturity],
                    ['Build Complexity', agent.feasibilityScore.buildComplexity],
                    ['Adoption Readiness', agent.feasibilityScore.adoptionReadiness],
                    ['Change Mgmt Scope', agent.feasibilityScore.changeMgmtScope],
                    ['Political Viability', agent.feasibilityScore.politicalViability],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map((n) => (
                          <span key={n} className={`w-4 h-1.5 rounded-full ${n <= (val as number) ? 'bg-brand-accent' : 'bg-muted'}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {agent.feasibilityScore.notes && (
                    <p className="text-xs text-muted-foreground pt-1 italic">{agent.feasibilityScore.notes}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Scores */}
            {(agent.strategicAlignmentScore || agent.timeToValueScore) && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Prioritization Scores</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {agent.strategicAlignmentScore && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Strategic Alignment</p>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map((n) => (
                          <span key={n} className={`flex-1 h-2 rounded-full ${n <= agent.strategicAlignmentScore! ? 'bg-brand-accent' : 'bg-muted'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-right text-muted-foreground mt-0.5">{agent.strategicAlignmentScore}/5</p>
                    </div>
                  )}
                  {agent.timeToValueScore && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Time to Value</p>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map((n) => (
                          <span key={n} className={`flex-1 h-2 rounded-full ${n <= agent.timeToValueScore! ? 'bg-brand-accent' : 'bg-muted'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-right text-muted-foreground mt-0.5">{agent.timeToValueScore}/5</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Upcoming milestones */}
          {upcomingMilestones.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Upcoming Milestones</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {upcomingMilestones.map((ms) => (
                  <div key={ms.id} className="flex items-start gap-2.5 py-1.5 border-b last:border-0">
                    <MilestoneIcon status={ms.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ms.title}</p>
                      {ms.notes && <p className="text-xs text-muted-foreground">{ms.notes}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{ms.owner}</p>
                      <p className={`text-xs font-medium ${new Date(ms.dueDate) < new Date() && ms.status !== 'done' ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {formatDate(ms.dueDate)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tags + notes */}
          {(agent.tags.length > 0 || agent.notes) && (
            <div className="grid grid-cols-2 gap-5">
              {agent.tags.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Tags</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {agent.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {agent.notes && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{agent.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Risks & Milestones ───────────────────────────────────── */}
        <TabsContent value="risks-milestones" className="pt-5">
          <RisksMilestonesTab agent={agent} onUpdate={updateAgent} />
        </TabsContent>

        {/* ── Feasibility ──────────────────────────────────────────── */}
        <TabsContent value="feasibility" className="pt-5 space-y-8">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Feasibility Scoring</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rate the agent across 6 dimensions to compute a weighted composite score.
              </p>
            </div>
            <FeasibilityScorer
              agent={agent}
              weights={config?.defaultFeasibilityWeights ?? DEFAULT_WEIGHTS}
              onSave={async (updated) => {
                await saveAgent(updated);
                await logActivity({
                  agentId,
                  type: 'feasibility_update',
                  summary: `Feasibility scored: ${updated.feasibilityScore?.composite.toFixed(2) ?? '?'}/5.00`,
                  detail: `Scored by ${updated.feasibilityScore?.scoredBy ?? 'unknown'}`,
                });
                updateAgent(updated);
              }}
            />
          </div>

          <div className="space-y-3 pt-4 border-t">
            <div>
              <h3 className="text-sm font-semibold">CDIO Data Feasibility Assessment</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Structured data readiness assessment with per-source breakdown and CDIO sign-off tracking.
              </p>
            </div>
            <DataFeasibilityForm
              agentId={agentId}
              initial={dataFeasibility}
              onSave={async (assessment) => {
                await saveDataFeasibility(assessment);
                setDataFeasibility(assessment);
                setActivityRefresh(new Date().toISOString());
              }}
            />
          </div>
        </TabsContent>

        {/* ── ROI ─────────────────────────────────────────────────── */}
        <TabsContent value="roi" className="pt-5">
          <RoiTab agent={agent} onUpdate={updateAgent} />
        </TabsContent>

        {/* ── Adoption ─────────────────────────────────────────────── */}
        <TabsContent value="adoption" className="pt-5">
          <AdoptionTab agent={agent} onUpdate={updateAgent} />
        </TabsContent>

        {/* ── Activity ─────────────────────────────────────────────── */}
        <TabsContent value="activity" className="pt-5">
          <ActivityTab agentId={agentId} refreshTrigger={activityRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right font-medium ${valueClass ?? ''}`}>{value}</span>
    </div>
  );
}
