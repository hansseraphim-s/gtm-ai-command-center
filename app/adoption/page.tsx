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
import type { Agent } from '@/lib/types';
import { getAllAgents } from '@/lib/storage';
import { PageHeader } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StageBadge } from '@/components/agents/type-badge';

function pct(active: number, target: number) {
  return Math.round((active / Math.max(target, 1)) * 100);
}

function AdoptionPill({ p }: { p: number }) {
  const color = p >= 75 ? 'text-green-600 bg-green-50 border-green-200'
    : p >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-slate-600 bg-slate-50 border-slate-200';
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold border ${color}`}>
      {p}%
    </span>
  );
}

export default function AdoptionPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fnFilter, setFnFilter] = useState('');

  useEffect(() => {
    getAllAgents().then((all) => { setAgents(all); setLoading(false); });
  }, []);

  const withAdoption = useMemo(
    () => agents.filter((a) => a.adoptionMetrics),
    [agents]
  );

  const filtered = useMemo(
    () => fnFilter ? withAdoption.filter((a) => a.function === fnFilter) : withAdoption,
    [withAdoption, fnFilter]
  );

  const totalActive = withAdoption.reduce((s, a) => s + (a.adoptionMetrics?.activeUsers ?? 0), 0);
  const totalTarget = withAdoption.reduce((s, a) => s + (a.adoptionMetrics?.targetPopulation ?? 0), 0);
  const avgAdoption = totalTarget > 0 ? pct(totalActive, totalTarget) : 0;

  const chartData = [...filtered]
    .sort((a, b) => {
      const pa = pct(a.adoptionMetrics!.activeUsers, a.adoptionMetrics!.targetPopulation);
      const pb = pct(b.adoptionMetrics!.activeUsers, b.adoptionMetrics!.targetPopulation);
      return pb - pa;
    })
    .slice(0, 15)
    .map((a) => ({
      code: a.code,
      pct: pct(a.adoptionMetrics!.activeUsers, a.adoptionMetrics!.targetPopulation),
      id: a.id,
    }));

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5 max-w-6xl">
      <PageHeader
        title="Adoption Dashboard"
        subtitle={`${withAdoption.length} of ${agents.length} agents have adoption telemetry`}
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Active Users</p>
            <p className="text-3xl font-bold tabular-nums mt-0.5">{totalActive.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">across {withAdoption.length} agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Target Population</p>
            <p className="text-3xl font-bold tabular-nums mt-0.5">{totalTarget.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">total addressable users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Average Adoption Rate</p>
            <p className={`text-3xl font-bold tabular-nums mt-0.5 ${
              avgAdoption >= 75 ? 'text-green-600' : avgAdoption >= 50 ? 'text-amber-600' : ''
            }`}>{avgAdoption}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totalActive} / {totalTarget} users</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Filter by function:</label>
        <select
          value={fnFilter}
          onChange={(e) => setFnFilter(e.target.value)}
          className="h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All functions</option>
          <option value="sales">Sales</option>
          <option value="marketing">Marketing</option>
          <option value="customer_success">Customer Success</option>
          <option value="cross_functional">Cross-functional</option>
        </select>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Adoption Rate by Agent (top {chartData.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 30, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 90%)" />
                <XAxis dataKey="code" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                <Tooltip
                  formatter={(v) => [`${v}%`, 'Adoption']}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <Bar dataKey="pct" name="Adoption %" radius={[3, 3, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell
                      key={d.id}
                      fill={d.pct >= 75 ? '#16a34a' : d.pct >= 50 ? '#d97706' : '#2563eb'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Agent table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Agent Adoption Details ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">
              No agents with adoption data.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  {['Agent', 'Stage', 'Active / Target', 'Adoption', 'Weekly Active', 'Frequency', 'CSAT'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filtered]
                  .sort((a, b) => {
                    const pa = pct(a.adoptionMetrics!.activeUsers, a.adoptionMetrics!.targetPopulation);
                    const pb = pct(b.adoptionMetrics!.activeUsers, b.adoptionMetrics!.targetPopulation);
                    return pb - pa;
                  })
                  .map((a) => {
                    const m = a.adoptionMetrics!;
                    const p = pct(m.activeUsers, m.targetPopulation);
                    return (
                      <tr key={a.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/portfolio/${a.id}`}
                            className="font-mono text-xs font-bold text-brand-blue hover:text-brand-accent"
                          >
                            {a.code}
                          </Link>
                          <p className="text-xs text-muted-foreground max-w-[140px] truncate">{a.name}</p>
                        </td>
                        <td className="px-3 py-2.5"><StageBadge stage={a.stage} /></td>
                        <td className="px-3 py-2.5 text-xs font-medium tabular-nums">
                          {m.activeUsers.toLocaleString()} / {m.targetPopulation.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5"><AdoptionPill p={p} /></td>
                        <td className="px-3 py-2.5 text-xs tabular-nums">{m.weeklyActiveUsers.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-xs tabular-nums">{m.usageFrequency.toFixed(1)}×/wk</td>
                        <td className="px-3 py-2.5 text-xs">
                          {m.satisfactionScore !== undefined ? `${m.satisfactionScore.toFixed(1)}/5` : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
