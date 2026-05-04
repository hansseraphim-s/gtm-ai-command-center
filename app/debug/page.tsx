'use client';

import { useEffect, useState, useCallback } from 'react';
import { loadSeedDataIfEmpty } from '@/lib/seed-data';
import { getAllAgents, getPortfolioConfig, clearAllData, getAgentCount,
  getAllDataFeasibilityAssessments, getAllROIAuditEntries } from '@/lib/storage';
import type { Agent, PortfolioConfig, DataFeasibilityAssessment, ROIAuditEntry } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { PageHeader } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STAGE_ORDER = ['idea','evaluation','design','pilot','scale','production','sunset','killed'];

const STAGE_COLORS: Record<string, string> = {
  idea: 'bg-muted text-muted-foreground',
  evaluation: 'bg-blue-50 text-blue-700 border-blue-200',
  design: 'bg-purple-50 text-purple-700 border-purple-200',
  pilot: 'bg-amber-50 text-amber-700 border-amber-200',
  scale: 'bg-orange-50 text-orange-700 border-orange-200',
  production: 'bg-green-50 text-green-700 border-green-200',
  sunset: 'bg-muted text-muted-foreground',
  killed: 'bg-red-50 text-red-700 border-red-200',
};

const TIER_LABELS: Record<string, string> = {
  tier_0_foundation: 'T0 Foundation',
  tier_1_quick_win: 'T1 Quick Win',
  tier_2_strategic_bet: 'T2 Strategic Bet',
  tier_3_flagship: 'T3 Flagship',
};

type LoadState = 'idle' | 'loading' | 'done' | 'error';

export default function DebugPage() {
  const [state, setState] = useState<LoadState>('idle');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [config, setConfig] = useState<PortfolioConfig | null>(null);
  const [feasibility, setFeasibility] = useState<DataFeasibilityAssessment[]>([]);
  const [auditLog, setAuditLog] = useState<ROIAuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (forceSeed = false) => {
    setState('loading');
    setError(null);
    try {
      if (forceSeed) await clearAllData();
      await loadSeedDataIfEmpty();
      const [a, c, f, audit] = await Promise.all([
        getAllAgents(),
        getPortfolioConfig(),
        getAllDataFeasibilityAssessments(),
        getAllROIAuditEntries(),
      ]);
      a.sort((x, y) => x.code.localeCompare(y.code));
      setAgents(a);
      setConfig(c ?? null);
      setFeasibility(f);
      setAuditLog(audit);
      setState('done');
    } catch (e) {
      setError(String(e));
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stageCounts = STAGE_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = agents.filter(a => a.stage === s).length;
    return acc;
  }, {});

  const totalY1Budget = agents.reduce((sum, a) => sum + a.budgetYear1, 0);
  const measuredTotal = agents.reduce((sum, a) =>
    sum + a.measuredOutcomes.reduce((s2, o) => s2 + o.monetizedValue, 0), 0);

  return (
    <div>
      <PageHeader
        title="Phase 1 — Data Layer Debug"
        subtitle="Confirms IndexedDB storage, seed data load, and CRUD operations."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => load(false)} disabled={state === 'loading'}>
              Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={() => load(true)} disabled={state === 'loading'}>
              Reset to Seed Data
            </Button>
          </div>
        }
      />

      {state === 'loading' && (
        <p className="text-sm text-muted-foreground">Loading from IndexedDB…</p>
      )}
      {state === 'error' && (
        <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {state === 'done' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Agents</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{agents.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">In Production</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold text-health-green">{stageCounts.production}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Y1 Budget</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{formatCurrency(totalY1Budget, true)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Measured Impact</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-semibold text-health-green">{formatCurrency(measuredTotal, true)}</p></CardContent>
            </Card>
          </div>

          {/* Stage pipeline counts */}
          <div className="flex flex-wrap gap-2">
            {STAGE_ORDER.filter(s => stageCounts[s] > 0).map(s => (
              <span key={s} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STAGE_COLORS[s]}`}>
                {s} <span className="font-bold">{stageCounts[s]}</span>
              </span>
            ))}
          </div>

          {/* Agent table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">All Agents ({agents.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {['Code','Name','Function','Type','Tier','Stage','Owner','Feasibility','Y1 Budget','ROI Targets','Measured $'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map(a => (
                      <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-mono font-semibold">{a.code}</td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <p className="font-medium truncate" title={a.name}>{a.name}</p>
                        </td>
                        <td className="px-3 py-2 capitalize text-muted-foreground">{a.function.replace('_',' ')}</td>
                        <td className="px-3 py-2 capitalize">{a.type}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{TIER_LABELS[a.tier]}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] ${STAGE_COLORS[a.stage]}`}>
                            {a.stage}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{a.owner}</td>
                        <td className="px-3 py-2 text-center">
                          {a.feasibilityScore ? (
                            <span className={`font-semibold ${a.feasibilityScore.composite >= 4 ? 'text-health-green' : a.feasibilityScore.composite >= 3 ? 'text-health-amber' : 'text-health-red'}`}>
                              {a.feasibilityScore.composite.toFixed(2)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">{formatCurrency(a.budgetYear1, true)}</td>
                        <td className="px-3 py-2 text-center">{a.roiTargets.length}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {a.measuredOutcomes.length > 0
                            ? formatCurrency(a.measuredOutcomes.reduce((s,o) => s + o.monetizedValue, 0), true)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Data Feasibility Assessments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Data Feasibility Assessments ({feasibility.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {['Agent','CDIO Partner','Overall Readiness','Sources','Gaps','CDIO Sign-off'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {feasibility.map(f => {
                    const agent = agents.find(a => a.id === f.agentId);
                    const gaps = f.requiredDataSources.filter(s => s.dataAvailability !== 'available').length;
                    return (
                      <tr key={f.agentId} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{agent?.code} — {agent?.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{f.cdioPartner}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`font-semibold ${f.overallReadiness >= 4 ? 'text-health-green' : f.overallReadiness >= 3 ? 'text-health-amber' : 'text-health-red'}`}>
                            {f.overallReadiness}/5
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">{f.requiredDataSources.length}</td>
                        <td className="px-3 py-2 text-center">{gaps > 0 ? <span className="text-health-amber font-medium">{gaps} gaps</span> : <span className="text-health-green">None</span>}</td>
                        <td className="px-3 py-2">
                          {f.cdioSignedOff
                            ? <span className="text-health-green font-medium">✓ {f.cdioSignOffDate}</span>
                            : <span className="text-health-amber">Pending</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* ROI Audit Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">ROI Audit Log ({auditLog.length} entries)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {['Timestamp','Agent','Change Type','Changed By','Rationale'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(e => {
                    const agent = agents.find(a => a.id === e.agentId);
                    return (
                      <tr key={e.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{e.changedAt.slice(0, 10)}</td>
                        <td className="px-3 py-2 font-medium">{agent?.code}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">{e.changeType.replace(/_/g,' ')}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{e.changedBy}</td>
                        <td className="px-3 py-2 max-w-xs truncate" title={e.rationale}>{e.rationale}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Portfolio config */}
          {config && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Portfolio Config</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-2">
                <p><span className="text-muted-foreground">Fiscal year start:</span> {config.fiscalYearStart}</p>
                <p><span className="text-muted-foreground">Total budget:</span> Y1 {formatCurrency(config.totalProgramBudget.year1, true)} · Y2 {formatCurrency(config.totalProgramBudget.year2, true)} · Y3 {formatCurrency(config.totalProgramBudget.year3, true)}</p>
                <p><span className="text-muted-foreground">CFO approval required:</span> {config.cfoApprovalRequired ? 'Yes' : 'No'}</p>
                <div>
                  <p className="text-muted-foreground mb-1">Functions:</p>
                  {config.functions.map(f => (
                    <p key={f.id} className="ml-4">{f.name} — leader: {f.leader} · {f.affectedPopulation} headcount · ${f.defaultHourlyRate}/hr · {f.budgetAllocation}% budget</p>
                  ))}
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Default feasibility weights:</p>
                  {Object.entries(config.defaultFeasibilityWeights).map(([k, v]) => (
                    <span key={k} className="mr-3">{k}: {v}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            Phase 1 acceptance criteria: ✓ App boots · ✓ Seed data loads · ✓ {agents.length} agents readable · ✓ {feasibility.length} data feasibility assessments · ✓ {auditLog.length} audit entries · ✓ Portfolio config present
          </p>
        </div>
      )}
    </div>
  );
}
