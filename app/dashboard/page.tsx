'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Agent, ActivityEntry } from '@/lib/types';
import { getAllAgents, getAllActivityEntries } from '@/lib/storage';
import { computeAgentROI, rollupByFunction } from '@/lib/roi-engine';
import { rankAgents, QUADRANT_META } from '@/lib/prioritization-engine';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StageBadge, FunctionBadge } from '@/components/agents/type-badge';
import { TierBadge } from '@/components/agents/tier-badge';

const STAGE_ORDER = ['idea','evaluation','design','pilot','scale','production','sunset','killed'];

function StatCard({
  label, value, sub, href, valueClass = '',
}: {
  label: string; value: string; sub?: string; href?: string; valueClass?: string;
}) {
  const content = (
    <Card className={href ? 'hover:border-brand-accent/50 transition-colors cursor-pointer' : ''}>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-3xl font-bold tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

const ACTIVITY_TYPE_COLOR: Record<string, string> = {
  stage_change: 'bg-brand-accent', note: 'bg-slate-400',
  milestone_update: 'bg-amber-500', risk_update: 'bg-orange-500',
  roi_update: 'bg-green-500', feasibility_update: 'bg-purple-500',
  decision: 'bg-blue-500',
};
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  stage_change: 'Stage', note: 'Note', milestone_update: 'Milestone',
  risk_update: 'Risk', roi_update: 'ROI', feasibility_update: 'Feasibility', decision: 'Decision',
};

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllAgents(), getAllActivityEntries(20)]).then(([all, acts]) => {
      setAgents(all);
      setRecentActivity(acts);
      setLoading(false);
    });
  }, []);

  const active = useMemo(() => agents.filter((a) => a.stage !== 'killed' && a.stage !== 'sunset'), [agents]);
  const production = useMemo(() => agents.filter((a) => a.stage === 'production' || a.stage === 'scale'), [agents]);

  const totalCommitted = useMemo(() => {
    return active.reduce((s, a) => {
      try { return s + computeAgentROI(a).committedValue; } catch { return s; }
    }, 0);
  }, [active]);

  const totalMeasured = useMemo(() => {
    return production.reduce((s, a) => {
      try { return s + computeAgentROI(a).measuredValue; } catch { return s; }
    }, 0);
  }, [production]);

  const fnRollup = useMemo(() => rollupByFunction(active), [active]);

  const ranked = useMemo(() => rankAgents(active).slice(0, 5), [active]);

  const byStage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of agents) counts[a.stage] = (counts[a.stage] ?? 0) + 1;
    return STAGE_ORDER.filter((s) => counts[s]).map((s) => ({
      stage: s.charAt(0).toUpperCase() + s.slice(1),
      count: counts[s],
      s,
    }));
  }, [agents]);

  const overdueMilestones = useMemo(() => {
    const now = new Date();
    return agents.flatMap((a) =>
      a.milestones
        .filter((m) => m.status === 'in_progress' && new Date(m.dueDate) < now)
        .map((m) => ({ agent: a, milestone: m }))
    ).slice(0, 5);
  }, [agents]);

  const adoptionAgents = useMemo(() =>
    active.filter((a) => a.adoptionMetrics).sort((a, b) =>
      (b.adoptionMetrics!.activeUsers / Math.max(b.adoptionMetrics!.targetPopulation, 1)) -
      (a.adoptionMetrics!.activeUsers / Math.max(a.adoptionMetrics!.targetPopulation, 1))
    ).slice(0, 5),
  [active]);

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;

  const STAGE_COLORS: Record<string, string> = {
    idea: '#94a3b8', evaluation: '#7c3aed', design: '#2563eb',
    pilot: '#d97706', scale: '#0891b2', production: '#16a34a',
    sunset: '#9ca3af', killed: '#ef4444',
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="GTM AI Command Center"
        subtitle={`${agents.length} agents · ${active.length} active · ${production.length} in production`}
      />

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total Agents"
          value={String(agents.length)}
          sub={`${active.length} active`}
          href="/portfolio"
        />
        <StatCard
          label="Committed Annual ROI"
          value={totalCommitted > 0 ? formatCurrency(totalCommitted, true) : '—'}
          sub="across active portfolio"
          href="/roi"
        />
        <StatCard
          label="Measured to Date"
          value={totalMeasured > 0 ? formatCurrency(totalMeasured, true) : '—'}
          valueClass={totalMeasured > 0 ? 'text-green-600' : ''}
          sub="production + scale agents"
        />
        <StatCard
          label="In Production"
          value={String(production.length)}
          sub="scale + production stage"
          href="/portfolio"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Pipeline by stage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byStage} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 92%)" />
                <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Bar dataKey="count" name="Agents" radius={[3, 3, 0, 0]}>
                  {byStage.map((d) => (
                    <Cell key={d.s} fill={STAGE_COLORS[d.s] ?? '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROI by function */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Committed ROI by Function</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fnRollup.filter((f) => f.committedValue > 0 || f.measuredValue > 0).map((f) => (
              <div key={f.function}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium capitalize">{f.function.replace('_', ' ')}</span>
                  <div className="text-right">
                    <span className="text-xs font-semibold">{formatCurrency(f.committedValue, true)}</span>
                    {f.measuredValue > 0 && (
                      <span className="text-[10px] text-green-600 ml-1.5">{formatCurrency(f.measuredValue, true)} measured</span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-accent"
                    style={{
                      width: `${Math.min(100, totalCommitted > 0 ? (f.committedValue / totalCommitted) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {fnRollup.every((f) => f.committedValue === 0) && (
              <p className="text-xs text-muted-foreground">No ROI targets set yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Overdue milestones */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <span className="text-red-500">⚠</span>
              Overdue Milestones ({overdueMilestones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueMilestones.length === 0 ? (
              <p className="text-xs text-muted-foreground">No overdue milestones.</p>
            ) : (
              overdueMilestones.map(({ agent, milestone }) => (
                <Link
                  key={milestone.id}
                  href={`/portfolio/${agent.id}`}
                  className="flex items-start gap-2 p-2 rounded hover:bg-muted/40 transition-colors"
                >
                  <span className="font-mono text-[11px] font-bold text-brand-blue shrink-0 mt-0.5">{agent.code}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{milestone.title}</p>
                    <p className="text-[10px] text-red-500">{formatDate(milestone.dueDate)}</p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top priority + top adoption side by side */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Top 5 by priority */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Top Priority Agents</CardTitle>
              <Link href="/prioritization" className="text-xs text-brand-accent hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranked.map((r, i) => (
              <Link
                key={r.agent.id}
                href={`/portfolio/${r.agent.id}`}
                className="flex items-center gap-2.5 p-2 rounded hover:bg-muted/40 transition-colors"
              >
                <span className="text-xs font-bold text-muted-foreground tabular-nums w-4">{i + 1}</span>
                <TierBadge tier={r.agent.tier} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold font-mono">{r.agent.code}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{r.agent.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StageBadge stage={r.agent.stage} />
                  <span className="text-xs font-bold text-brand-accent">{r.priorityScore}</span>
                </div>
              </Link>
            ))}
            {ranked.length === 0 && (
              <p className="text-xs text-muted-foreground">No active agents yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Top adoption */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Top Adoption Agents</CardTitle>
              <Link href="/adoption" className="text-xs text-brand-accent hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {adoptionAgents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No adoption data available.</p>
            ) : (
              adoptionAgents.map((a) => {
                const m = a.adoptionMetrics!;
                const p = Math.round((m.activeUsers / Math.max(m.targetPopulation, 1)) * 100);
                return (
                  <Link
                    key={a.id}
                    href={`/portfolio/${a.id}`}
                    className="flex items-center gap-2.5 p-2 rounded hover:bg-muted/40 transition-colors"
                  >
                    <FunctionBadge fn={a.function} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold font-mono">{a.code}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{a.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold tabular-nums ${p >= 75 ? 'text-green-600' : p >= 50 ? 'text-amber-600' : ''}`}>
                        {p}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">{m.activeUsers}/{m.targetPopulation}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
            <span className="text-xs text-muted-foreground">Across all agents · newest first</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentActivity.map((entry) => {
                const agentCode = agents.find((a) => a.id === entry.agentId)?.code;
                return (
                  <Link
                    key={entry.id}
                    href={`/portfolio/${entry.agentId}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ACTIVITY_TYPE_COLOR[entry.type] ?? 'bg-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {ACTIVITY_TYPE_LABEL[entry.type] ?? entry.type}
                        </span>
                        {agentCode && (
                          <span className="font-mono text-[10px] font-bold text-brand-blue">{agentCode}</span>
                        )}
                      </div>
                      <p className="text-xs font-medium truncate">{entry.summary}</p>
                      {entry.detail && <p className="text-[10px] text-muted-foreground truncate">{entry.detail}</p>}
                    </div>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                      {formatDate(entry.timestamp)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
