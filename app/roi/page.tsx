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
  Legend,
} from 'recharts';
import type { Agent } from '@/lib/types';
import { getAllAgents } from '@/lib/storage';
import { computeAgentROI, rollupByFunction } from '@/lib/roi-engine';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StageBadge } from '@/components/agents/type-badge';
import { CheckCircle2 } from 'lucide-react';

const FN_LABELS: Record<string, string> = {
  sales: 'Sales',
  marketing: 'Marketing',
  customer_success: 'CS',
  cross_functional: 'Cross-fn',
};

export default function RoiPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'committed' | 'measured' | 'code'>('committed');

  useEffect(() => {
    getAllAgents().then((all) => { setAgents(all); setLoading(false); });
  }, []);

  const active = useMemo(
    () => agents.filter((a) => a.stage !== 'killed' && a.stage !== 'sunset'),
    [agents]
  );

  const withTargets = useMemo(
    () => active.filter((a) => a.roiTargets.length > 0),
    [active]
  );

  const roiRows = useMemo(() => {
    return withTargets.map((a) => {
      let committed = 0, measured = 0, variance = 0, variancePct = 0;
      try {
        const r = computeAgentROI(a);
        committed = r.committedValue;
        measured = r.measuredValue;
        variance = r.variance;
        variancePct = r.variancePct;
      } catch { /* */ }
      return { agent: a, committed, measured, variance, variancePct };
    }).sort((a, b) => {
      if (sort === 'committed') return b.committed - a.committed;
      if (sort === 'measured') return b.measured - a.measured;
      return a.agent.code.localeCompare(b.agent.code);
    });
  }, [withTargets, sort]);

  const fnRollup = useMemo(() => rollupByFunction(active), [active]);

  const totalCommitted = roiRows.reduce((s, r) => s + r.committed, 0);
  const totalMeasured = roiRows.reduce((s, r) => s + r.measured, 0);
  const cfoApproved = withTargets.flatMap((a) => a.roiTargets.filter((t) => t.cfoApproved)).length;
  const totalTargets = withTargets.flatMap((a) => a.roiTargets).length;

  const chartData = fnRollup.filter((f) => f.committedValue > 0 || f.measuredValue > 0).map((f) => ({
    fn: FN_LABELS[f.function] ?? f.function,
    Committed: Math.round(f.committedValue / 1000),
    Measured: Math.round(f.measuredValue / 1000),
  }));

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5 max-w-6xl">
      <PageHeader
        title="ROI Portfolio"
        subtitle={`${withTargets.length} agents with targets · ${cfoApproved}/${totalTargets} CFO-approved`}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Agents with Targets', value: String(withTargets.length), sub: `of ${active.length} active` },
          { label: 'Total Targets', value: String(totalTargets), sub: `${cfoApproved} CFO-approved` },
          { label: 'Committed Annual ROI', value: totalCommitted > 0 ? formatCurrency(totalCommitted, true) : '—' },
          {
            label: 'Measured to Date',
            value: totalMeasured > 0 ? formatCurrency(totalMeasured, true) : '—',
            valueClass: totalMeasured > 0 ? 'text-green-600' : '',
          },
        ].map(({ label, value, sub, valueClass = '' }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Committed vs Measured ROI by Function ($K)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 90%)" />
                <XAxis dataKey="fn" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="K" />
                <Tooltip
                  formatter={(v) => [`$${v}K`, '']}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Committed" fill="#2563eb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Measured" fill="#16a34a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Agent ROI table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">Agent ROI Detail</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort by:</span>
              {(['committed', 'measured', 'code'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    sort === s
                      ? 'bg-brand-accent text-white border-brand-accent'
                      : 'border-input text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {['Agent', 'Stage', 'Targets', 'CFO ✓', 'Committed', 'Measured', 'Variance', 'Last Outcome'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roiRows.map(({ agent, committed, measured, variance, variancePct }) => {
                const lastOutcome = [...agent.measuredOutcomes].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
                const cfo = agent.roiTargets.filter((t) => t.cfoApproved).length;
                return (
                  <tr key={agent.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/portfolio/${agent.id}`}
                        className="font-mono text-xs font-bold text-brand-blue hover:text-brand-accent"
                      >
                        {agent.code}
                      </Link>
                      <p className="text-[10px] text-muted-foreground max-w-[130px] truncate">{agent.name}</p>
                    </td>
                    <td className="px-3 py-2.5"><StageBadge stage={agent.stage} /></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                      {agent.roiTargets.length}
                    </td>
                    <td className="px-3 py-2.5">
                      {cfo > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />{cfo}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium tabular-nums">
                      {committed > 0 ? formatCurrency(committed, true) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium tabular-nums text-green-600">
                      {measured > 0 ? formatCurrency(measured, true) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">
                      {committed > 0 && measured > 0 ? (
                        <span className={variancePct >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {variancePct >= 0 ? '+' : ''}{variancePct.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground">
                      {lastOutcome ? formatDate(lastOutcome.measuredAt) : '—'}
                    </td>
                  </tr>
                );
              })}
              {roiRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No agents with ROI targets yet.{' '}
                    <Link href="/portfolio" className="text-brand-accent hover:underline">Go to Portfolio →</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
