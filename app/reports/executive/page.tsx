'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Agent, DataFeasibilityAssessment } from '@/lib/types';
import { getAllAgents, getAllDataFeasibilityAssessments } from '@/lib/storage';
import { computeAgentROI, rollupByFunction } from '@/lib/roi-engine';
import { rankAgents, QUADRANT_META } from '@/lib/prioritization-engine';
import { formatCurrency, formatDate, isoDate } from '@/lib/utils';
import { PageHeader } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/agents/tier-badge';
import { StageBadge } from '@/components/agents/type-badge';
import { Printer } from 'lucide-react';

const STAGE_ORDER = ['idea','evaluation','design','pilot','scale','production','sunset','killed'];

const FN_LABELS: Record<string, string> = {
  sales: 'Sales',
  marketing: 'Marketing',
  customer_success: 'Customer Success',
  cross_functional: 'Cross-functional',
};

export default function ExecutiveReportPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assessments, setAssessments] = useState<DataFeasibilityAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getAllAgents(), getAllDataFeasibilityAssessments()]).then(([all, dfas]) => {
      setAgents(all);
      setAssessments(dfas);
      setLoading(false);
    });
  }, []);

  const active = useMemo(
    () => agents.filter((a) => a.stage !== 'killed' && a.stage !== 'sunset'),
    [agents]
  );
  const production = useMemo(
    () => agents.filter((a) => a.stage === 'production' || a.stage === 'scale'),
    [agents]
  );

  const totalCommitted = useMemo(
    () => active.reduce((s, a) => { try { return s + computeAgentROI(a).committedValue; } catch { return s; } }, 0),
    [active]
  );
  const totalMeasured = useMemo(
    () => production.reduce((s, a) => { try { return s + computeAgentROI(a).measuredValue; } catch { return s; } }, 0),
    [production]
  );

  const fnRollup = useMemo(() => rollupByFunction(active), [active]);
  const ranked = useMemo(() => rankAgents(active), [active]);

  const byStage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of agents) m[a.stage] = (m[a.stage] ?? 0) + 1;
    return STAGE_ORDER.filter((s) => m[s]).map((s) => ({ stage: s, count: m[s] }));
  }, [agents]);

  const now = new Date();
  const allMilestones = useMemo(
    () => active.flatMap((a) => a.milestones.map((m) => ({ ...m, agentCode: a.code, agentId: a.id }))),
    [active]
  );
  const doneMilestones = allMilestones.filter((m) => m.status === 'done').length;
  const overdueMilestones = allMilestones.filter(
    (m) => m.status === 'in_progress' && new Date(m.dueDate) < now
  );
  const upcomingMilestones = allMilestones
    .filter((m) => m.status !== 'done' && m.status !== 'missed' && new Date(m.dueDate) >= now)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);

  const allRisks = useMemo(
    () => active.flatMap((a) => a.risks.filter((r) => r.status === 'open').map((r) => ({ ...r, agentCode: a.code }))),
    [active]
  );
  const riskBySeverity = {
    critical: allRisks.filter((r) => r.severity === 'critical'),
    high: allRisks.filter((r) => r.severity === 'high'),
    medium: allRisks.filter((r) => r.severity === 'medium'),
    low: allRisks.filter((r) => r.severity === 'low'),
  };

  const topAdoption = useMemo(
    () => active
      .filter((a) => a.adoptionMetrics)
      .sort((a, b) =>
        (b.adoptionMetrics!.activeUsers / Math.max(b.adoptionMetrics!.targetPopulation, 1)) -
        (a.adoptionMetrics!.activeUsers / Math.max(a.adoptionMetrics!.targetPopulation, 1))
      )
      .slice(0, 6),
    [active]
  );

  const cfoApprovedTargets = useMemo(
    () => active.flatMap((a) => a.roiTargets.filter((t) => t.cfoApproved)).length,
    [active]
  );
  const totalTargets = useMemo(
    () => active.flatMap((a) => a.roiTargets).length,
    [active]
  );

  function handlePrint() {
    window.print();
  }

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Executive Report"
          subtitle={`GTM AI Portfolio · As of ${formatDate(isoDate())}`}
        />
        <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden shrink-0 mt-1">
          <Printer className="h-4 w-4 mr-1.5" />Print / PDF
        </Button>
      </div>

      <div ref={reportRef} className="space-y-6">
        {/* ── Portfolio Snapshot ──────────────────────────────────── */}
        <Section title="Portfolio Snapshot">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total Agents" value={String(agents.length)} sub={`${active.length} active`} />
            <KpiCard label="In Production" value={String(production.length)} sub="scale + production" />
            <KpiCard
              label="Committed Annual ROI"
              value={totalCommitted > 0 ? formatCurrency(totalCommitted, true) : '—'}
            />
            <KpiCard
              label="Measured to Date"
              value={totalMeasured > 0 ? formatCurrency(totalMeasured, true) : '—'}
              valueClass={totalMeasured > 0 ? 'text-green-600' : ''}
            />
          </div>

          {/* Stage distribution */}
          <div className="mt-4 flex flex-wrap gap-2">
            {byStage.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-background text-xs">
                <span className="font-medium capitalize">{stage}</span>
                <span className="font-bold text-brand-accent">{count}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── ROI by Function ─────────────────────────────────────── */}
        <Section title="ROI by Function">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {['Function', 'Agents', 'Committed Annual', 'Measured to Date', 'Variance', 'CFO-Approved Targets'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fnRollup.map((f) => {
                const fnAgents = active.filter((a) => a.function === f.function);
                const cfoApproved = fnAgents.flatMap((a) => a.roiTargets.filter((t) => t.cfoApproved)).length;
                const totalFnTargets = fnAgents.flatMap((a) => a.roiTargets).length;
                return (
                  <tr key={f.function} className="border-b last:border-0">
                    <td className="px-3 py-2.5 font-medium">{FN_LABELS[f.function] ?? f.function}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{f.agentCount}</td>
                    <td className="px-3 py-2.5 font-medium">
                      {f.committedValue > 0 ? formatCurrency(f.committedValue, true) : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-green-600">
                      {f.measuredValue > 0 ? formatCurrency(f.measuredValue, true) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {f.committedValue > 0 && f.measuredValue > 0 ? (
                        <span className={f.variancePct >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {f.variancePct >= 0 ? '+' : ''}{f.variancePct.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {totalFnTargets > 0 ? `${cfoApproved}/${totalFnTargets}` : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t bg-muted/20 font-semibold">
                <td className="px-3 py-2.5">Total</td>
                <td className="px-3 py-2.5 text-muted-foreground">{active.length}</td>
                <td className="px-3 py-2.5">{totalCommitted > 0 ? formatCurrency(totalCommitted, true) : '—'}</td>
                <td className="px-3 py-2.5 text-green-600">{totalMeasured > 0 ? formatCurrency(totalMeasured, true) : '—'}</td>
                <td className="px-3 py-2.5">
                  {totalCommitted > 0 && totalMeasured > 0 ? (
                    <span className={totalMeasured >= totalCommitted ? 'text-green-600' : 'text-red-600'}>
                      {((totalMeasured - totalCommitted) / totalCommitted * 100).toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{cfoApprovedTargets}/{totalTargets}</td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* ── Priority Ranking ────────────────────────────────────── */}
        <Section title="Portfolio Priority Ranking (top 10)">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {['#', 'Agent', 'Tier', 'Stage', 'Quadrant', 'Priority Score', 'Committed ROI'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 10).map((r, i) => {
                let committed = 0;
                try { committed = computeAgentROI(r.agent).committedValue; } catch { /* */ }
                return (
                  <tr key={r.agent.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-xs font-bold text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs font-bold text-brand-blue">{r.agent.code}</span>
                      <span className="text-xs text-muted-foreground ml-1.5">{r.agent.name}</span>
                    </td>
                    <td className="px-3 py-2"><TierBadge tier={r.agent.tier} /></td>
                    <td className="px-3 py-2"><StageBadge stage={r.agent.stage} /></td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[11px] font-medium px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: QUADRANT_META[r.quadrant].color }}
                      >
                        {QUADRANT_META[r.quadrant].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-bold tabular-nums">{r.priorityScore}</td>
                    <td className="px-3 py-2 text-xs font-medium">
                      {committed > 0 ? formatCurrency(committed, true) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        {/* ── Milestone Health ────────────────────────────────────── */}
        <Section title="Milestone Health">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <KpiCard label="Total Milestones" value={String(allMilestones.length)} />
            <KpiCard label="Completed" value={String(doneMilestones)} valueClass="text-green-600" />
            <KpiCard label="Overdue" value={String(overdueMilestones.length)} valueClass={overdueMilestones.length > 0 ? 'text-red-600' : ''} />
          </div>

          {overdueMilestones.length > 0 && (
            <>
              <p className="text-xs font-semibold text-red-600 mb-2">Overdue ({overdueMilestones.length})</p>
              <table className="w-full text-xs mb-4">
                <thead className="border-b bg-muted/30">
                  <tr>
                    {['Agent', 'Milestone', 'Due Date', 'Owner'].map((h) => (
                      <th key={h} className="px-3 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overdueMilestones.slice(0, 8).map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-mono font-bold text-brand-blue">{m.agentCode}</td>
                      <td className="px-3 py-1.5">{m.title}</td>
                      <td className="px-3 py-1.5 text-red-600">{formatDate(m.dueDate)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{m.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {upcomingMilestones.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Upcoming (next {upcomingMilestones.length})</p>
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/30">
                  <tr>
                    {['Agent', 'Milestone', 'Due Date', 'Owner'].map((h) => (
                      <th key={h} className="px-3 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {upcomingMilestones.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-mono font-bold text-brand-blue">{m.agentCode}</td>
                      <td className="px-3 py-1.5">{m.title}</td>
                      <td className="px-3 py-1.5">{formatDate(m.dueDate)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{m.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Section>

        {/* ── Risk Summary ────────────────────────────────────────── */}
        <Section title="Open Risk Summary">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
              <div key={sev} className="text-center p-3 rounded-md border">
                <p className={`text-2xl font-bold ${
                  sev === 'critical' ? 'text-red-600' : sev === 'high' ? 'text-orange-600'
                  : sev === 'medium' ? 'text-amber-600' : 'text-slate-500'
                }`}>{riskBySeverity[sev].length}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{sev}</p>
              </div>
            ))}
          </div>

          {(riskBySeverity.critical.length > 0 || riskBySeverity.high.length > 0) && (
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/30">
                <tr>
                  {['Severity', 'Agent', 'Risk', 'Mitigation', 'Owner'].map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...riskBySeverity.critical, ...riskBySeverity.high].map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className={`px-3 py-1.5 font-bold uppercase text-[10px] ${r.severity === 'critical' ? 'text-red-600' : 'text-orange-600'}`}>
                      {r.severity}
                    </td>
                    <td className="px-3 py-1.5 font-mono font-bold text-brand-blue">{r.agentCode}</td>
                    <td className="px-3 py-1.5 max-w-[200px] truncate">{r.description}</td>
                    <td className="px-3 py-1.5 text-muted-foreground max-w-[180px] truncate">{r.mitigation}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{r.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* ── Data Readiness (CDIO) ───────────────────────────────── */}
        {assessments.length > 0 && (() => {
          const dfaMap = new Map(assessments.map((a) => [a.agentId, a]));
          const assessed = assessments.length;
          const signedOff = assessments.filter((a) => a.cdioSignedOff).length;
          const withGaps = assessments.filter((a) =>
            a.requiredDataSources.some((s) => s.dataAvailability !== 'available')
          ).length;
          const atRisk = assessments
            .filter((a) => a.overallReadiness <= 2)
            .map((a) => ({ dfa: a, agent: agents.find((ag) => ag.id === a.agentId) }))
            .filter((x) => x.agent)
            .sort((a, b) => a.dfa.overallReadiness - b.dfa.overallReadiness);
          return (
            <Section title="Data Readiness (CDIO Partnership)">
              <div className="grid grid-cols-4 gap-3 mb-4">
                <KpiCard label="Agents Assessed" value={`${assessed}/${agents.filter(a => a.stage !== 'killed' && a.stage !== 'sunset').length}`} />
                <KpiCard label="CDIO Signed-Off" value={String(signedOff)} valueClass={signedOff === assessed ? 'text-green-600' : 'text-amber-600'} />
                <KpiCard label="With Data Gaps" value={String(withGaps)} valueClass={withGaps > 0 ? 'text-red-600' : 'text-green-600'} />
                <KpiCard label="Critical Readiness (≤2)" value={String(atRisk.length)} valueClass={atRisk.length > 0 ? 'text-red-600' : 'text-green-600'} />
              </div>
              {atRisk.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-red-600 mb-2">Agents Requiring Data Intervention</p>
                  <table className="w-full text-xs">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        {['Agent', 'Readiness', 'CDIO Partner', 'Gap Summary', 'Est. Closure'].map((h) => (
                          <th key={h} className="px-3 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {atRisk.map(({ dfa, agent }) => (
                        <tr key={dfa.agentId} className="border-b last:border-0">
                          <td className="px-3 py-1.5">
                            <span className="font-mono font-bold text-brand-blue">{agent!.code}</span>
                            <span className="text-muted-foreground ml-1.5 truncate">{agent!.name}</span>
                          </td>
                          <td className="px-3 py-1.5 font-bold text-red-600">{dfa.overallReadiness}/5</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{dfa.cdioPartner || '—'}</td>
                          <td className="px-3 py-1.5 max-w-[220px] truncate">{dfa.gapSummary || '—'}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {dfa.estimatedGapClosureDate ? formatDate(dfa.estimatedGapClosureDate) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </Section>
          );
        })()}

        {/* ── Adoption Summary ────────────────────────────────────── */}
        {topAdoption.length > 0 && (
          <Section title="Adoption Highlights">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  {['Agent', 'Stage', 'Active Users', 'Target', 'Rate', 'Weekly Active', 'CSAT'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topAdoption.map((a) => {
                  const m = a.adoptionMetrics!;
                  const p = Math.round((m.activeUsers / Math.max(m.targetPopulation, 1)) * 100);
                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-xs font-bold text-brand-blue">{a.code}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{a.name}</span>
                      </td>
                      <td className="px-3 py-2.5"><StageBadge stage={a.stage} /></td>
                      <td className="px-3 py-2.5 font-medium tabular-nums">{m.activeUsers.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{m.targetPopulation.toLocaleString()}</td>
                      <td className="px-3 py-2.5">
                        <span className={`font-bold ${p >= 75 ? 'text-green-600' : p >= 50 ? 'text-amber-600' : ''}`}>
                          {p}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{m.weeklyActiveUsers.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {m.satisfactionScore !== undefined ? `${m.satisfactionScore.toFixed(1)}/5` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        )}

        {/* Footer */}
        <div className="border-t pt-4 text-xs text-muted-foreground">
          <p>Generated {formatDate(new Date().toISOString())} · GTM AI Command Center · Equinix GTM AI Business Transformation</p>
          <p className="mt-0.5">This report reflects data stored locally and is confidential.</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

function KpiCard({
  label, value, sub, valueClass = '',
}: {
  label: string; value: string; sub?: string; valueClass?: string;
}) {
  return (
    <div className="text-center p-3 rounded-md border bg-muted/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
