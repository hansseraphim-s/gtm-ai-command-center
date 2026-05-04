'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { Agent, AgentFunction } from '@/lib/types';
import { computeAgentROI } from '@/lib/roi-engine';
import { rankAgents } from '@/lib/prioritization-engine';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TierBadge } from '@/components/agents/tier-badge';
import { StageBadge } from '@/components/agents/type-badge';

const STAGE_ORDER = ['idea','evaluation','design','pilot','scale','production','sunset','killed'];

type Props = {
  agents: Agent[];
  fn: AgentFunction;
  fnLabel: string;
  leader?: string;
};

export function FunctionView({ agents, fn, fnLabel, leader }: Props) {
  const fnAgents = useMemo(() => agents.filter((a) => a.function === fn), [agents, fn]);
  const active = useMemo(() => fnAgents.filter((a) => a.stage !== 'killed' && a.stage !== 'sunset'), [fnAgents]);

  const committed = useMemo(() => active.reduce((s, a) => {
    try { return s + computeAgentROI(a).committedValue; } catch { return s; }
  }, 0), [active]);

  const measured = useMemo(() => active.reduce((s, a) => {
    try { return s + computeAgentROI(a).measuredValue; } catch { return s; }
  }, 0), [active]);

  const ranked = useMemo(() => rankAgents(active).slice(0, 5), [active]);

  const byStage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of fnAgents) m[a.stage] = (m[a.stage] ?? 0) + 1;
    return STAGE_ORDER.filter((s) => m[s]).map((s) => ({ stage: s, count: m[s] }));
  }, [fnAgents]);

  const overdue = useMemo(() => {
    const now = new Date();
    return fnAgents.flatMap((a) =>
      a.milestones
        .filter((m) => m.status === 'in_progress' && new Date(m.dueDate) < now)
        .map((m) => ({ agent: a, milestone: m }))
    ).slice(0, 5);
  }, [fnAgents]);

  const openRisks = useMemo(() =>
    fnAgents.flatMap((a) =>
      a.risks
        .filter((r) => (r.status === 'open') && (r.severity === 'critical' || r.severity === 'high'))
        .map((r) => ({ agent: a, risk: r }))
    ).slice(0, 5),
  [fnAgents]);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">{fnLabel}</h1>
        {leader && <p className="text-sm text-muted-foreground mt-0.5">Leader: {leader}</p>}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Total Agents', value: String(fnAgents.length) },
          { label: 'Active', value: String(active.length) },
          { label: 'Committed ROI', value: committed > 0 ? formatCurrency(committed, true) : '—' },
          { label: 'Measured', value: measured > 0 ? formatCurrency(measured, true) : '—', cls: measured > 0 ? 'text-green-600' : '' },
        ].map(({ label, value, cls = '' }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${cls}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Stage breakdown */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline by Stage</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byStage.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground capitalize w-24 shrink-0">{stage}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-accent"
                    style={{ width: `${(count / Math.max(fnAgents.length, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums w-4">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top priority */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Top Priority</CardTitle>
              <Link href="/prioritization" className="text-xs text-brand-accent hover:underline">Full ranking →</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {ranked.map((r, i) => (
              <Link
                key={r.agent.id}
                href={`/portfolio/${r.agent.id}`}
                className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 transition-colors"
              >
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <TierBadge tier={r.agent.tier} />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs font-bold">{r.agent.code}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5 truncate">{r.agent.name}</span>
                </div>
                <StageBadge stage={r.agent.stage} />
                <span className="text-xs font-bold text-brand-accent shrink-0">{r.priorityScore}</span>
              </Link>
            ))}
            {ranked.length === 0 && <p className="text-xs text-muted-foreground">No active agents.</p>}
          </CardContent>
        </Card>

        {/* Overdue milestones */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {overdue.length > 0 && <span className="text-red-500 mr-1">⚠</span>}
              Overdue Milestones ({overdue.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {overdue.length === 0 ? (
              <p className="text-xs text-muted-foreground">No overdue milestones.</p>
            ) : (
              overdue.map(({ agent, milestone }) => (
                <Link
                  key={milestone.id}
                  href={`/portfolio/${agent.id}`}
                  className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/40 transition-colors"
                >
                  <span className="font-mono text-[11px] font-bold text-brand-blue shrink-0">{agent.code}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{milestone.title}</p>
                    <p className="text-[10px] text-red-500">{formatDate(milestone.dueDate)}</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* High/critical open risks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Open High / Critical Risks ({openRisks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {openRisks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No high or critical open risks.</p>
            ) : (
              openRisks.map(({ agent, risk }) => (
                <Link
                  key={risk.id}
                  href={`/portfolio/${agent.id}`}
                  className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/40 transition-colors"
                >
                  <span className={`text-[10px] font-bold uppercase shrink-0 mt-0.5 ${risk.severity === 'critical' ? 'text-red-600' : 'text-orange-600'}`}>
                    {risk.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold">{agent.code}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{risk.description}</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* All agents table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">All {fnLabel} Agents ({fnAgents.length})</CardTitle>
            <Link href={`/portfolio?fn=${fn}`} className="text-xs text-brand-accent hover:underline">Portfolio view →</Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {['Code', 'Name', 'Tier', 'Stage', 'Committed ROI', 'Owner'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fnAgents.map((a) => {
                let committedVal = 0;
                try { committedVal = computeAgentROI(a).committedValue; } catch { /* */ }
                return (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <Link href={`/portfolio/${a.id}`} className="font-mono font-bold text-xs text-brand-blue hover:text-brand-accent">
                        {a.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-sm">{a.name}</td>
                    <td className="px-3 py-2.5"><TierBadge tier={a.tier} /></td>
                    <td className="px-3 py-2.5"><StageBadge stage={a.stage} /></td>
                    <td className="px-3 py-2.5 text-xs font-medium">
                      {committedVal > 0 ? formatCurrency(committedVal, true) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.owner}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
