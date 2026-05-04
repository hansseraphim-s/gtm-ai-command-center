'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Agent, AdoptionMetrics } from '@/lib/types';
import { saveAgent } from '@/lib/storage';
import { logActivity } from '@/lib/activity';
import { formatDate, isoNow } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Props = {
  agent: Agent;
  onUpdate?: (updated: Agent) => void;
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function AdoptionBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-accent'
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">{pct}%</span>
    </div>
  );
}

export function AdoptionTab({ agent, onUpdate }: Props) {
  const m = agent.adoptionMetrics;
  const [showRecord, setShowRecord] = useState(false);
  const [form, setForm] = useState({
    activeUsers: String(m?.activeUsers ?? ''),
    weeklyActiveUsers: String(m?.weeklyActiveUsers ?? ''),
    targetPopulation: String(m?.targetPopulation ?? ''),
    satisfactionScore: String(m?.satisfactionScore ?? ''),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function recordSnapshot() {
    const active = parseInt(form.activeUsers, 10);
    const weekly = parseInt(form.weeklyActiveUsers, 10);
    const target = parseInt(form.targetPopulation, 10);
    const csat = parseFloat(form.satisfactionScore) || undefined;
    if (isNaN(active) || isNaN(weekly) || isNaN(target)) return;

    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const existing = agent.adoptionMetrics;
    const updatedMetrics: AdoptionMetrics = {
      agentId: agent.id,
      targetPopulation: target,
      activeUsers: active,
      weeklyActiveUsers: weekly,
      usageFrequency: existing?.usageFrequency ?? 0,
      satisfactionScore: csat,
      byFunction: existing?.byFunction ?? [],
      byRegion: existing?.byRegion ?? [],
      byRole: existing?.byRole ?? [],
      trend: [
        ...(existing?.trend ?? []),
        { weekStarting: today, activeUsers: active, weeklyActive: weekly },
      ],
      lastUpdated: isoNow(),
    };
    const updated = { ...agent, adoptionMetrics: updatedMetrics, updatedAt: isoNow() };
    await saveAgent(updated);
    await logActivity({
      agentId: agent.id,
      type: 'note',
      summary: `Adoption snapshot recorded: ${active} active users (${Math.round((active / Math.max(target, 1)) * 100)}% of target)`,
      detail: csat !== undefined ? `CSAT: ${csat.toFixed(1)}/5 · Weekly active: ${weekly}` : `Weekly active: ${weekly}`,
    });
    onUpdate?.(updated);
    setSaving(false);
    setSaved(true);
    setShowRecord(false);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!m) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border py-10 text-center bg-muted/10">
          <p className="text-sm font-medium">No adoption data yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Record the first snapshot to start tracking adoption.
          </p>
          <Button size="sm" variant="outline" onClick={() => setShowRecord(true)}>Record First Snapshot</Button>
        </div>
        {showRecord && (
          <RecordPanel form={form} setForm={setForm} onSave={recordSnapshot} onCancel={() => setShowRecord(false)} saving={saving} />
        )}
      </div>
    );
  }

  const adoptionPct = Math.round((m.activeUsers / Math.max(m.targetPopulation, 1)) * 100);
  const trendData = [...m.trend].sort((a, b) => a.weekStarting.localeCompare(b.weekStarting)).map((t) => ({
    week: t.weekStarting.slice(5), // MM-DD
    active: t.activeUsers,
    weekly: t.weeklyActive,
  }));

  const byFnData = m.byFunction.map((f) => ({
    name: f.function,
    adopted: f.activeUsers,
    target: f.targetUsers,
    pct: Math.round((f.activeUsers / Math.max(f.targetUsers, 1)) * 100),
  }));

  const byRoleData = m.byRole.map((r) => ({
    name: r.role,
    adopted: r.activeUsers,
    target: r.targetUsers,
    pct: Math.round((r.activeUsers / Math.max(r.targetUsers, 1)) * 100),
  }));

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Adoption Rate"
          value={`${adoptionPct}%`}
          sub={`${m.activeUsers} of ${m.targetPopulation} users`}
        />
        <StatCard
          label="Weekly Active"
          value={m.weeklyActiveUsers.toLocaleString()}
          sub="last 7 days"
        />
        <StatCard
          label="Usage Frequency"
          value={`${m.usageFrequency.toFixed(1)}×`}
          sub="sessions per user per week"
        />
        {m.satisfactionScore !== undefined && (
          <StatCard
            label="Satisfaction"
            value={`${m.satisfactionScore.toFixed(1)}/5`}
            sub="user satisfaction score"
          />
        )}
      </div>

      {/* Trend chart */}
      {trendData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Users Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 90%)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  formatter={(v, n) => [v, n === 'active' ? 'Cumulative Active' : 'Weekly Active']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === 'active' ? 'Cumulative Active' : 'Weekly Active'} />
                <Line type="monotone" dataKey="active" stroke="#2563eb" strokeWidth={2} dot={false} name="active" />
                <Line type="monotone" dataKey="weekly" stroke="#16a34a" strokeWidth={2} dot={false} strokeDasharray="5 3" name="weekly" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* By function */}
        {byFnData.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">By Function</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {byFnData.map((f) => (
                <div key={f.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium capitalize">{f.name.replace('_', ' ')}</span>
                    <span className="text-xs text-muted-foreground">{f.adopted}/{f.target}</span>
                  </div>
                  <AdoptionBar pct={f.pct} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* By region */}
        {m.byRegion.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">By Region</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {m.byRegion.map((r) => {
                const pct = Math.round((r.activeUsers / Math.max(r.targetUsers, 1)) * 100);
                return (
                  <div key={r.region}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{r.region}</span>
                      <span className="text-xs text-muted-foreground">{r.activeUsers}/{r.targetUsers}</span>
                    </div>
                    <AdoptionBar pct={pct} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* By role */}
        {byRoleData.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">By Role</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byRoleData} margin={{ top: 0, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 90%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Bar dataKey="adopted" name="Adopted" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="target" name="Target" fill="hsl(215 20% 88%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Last updated: {formatDate(m.lastUpdated)}</p>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-600">Snapshot recorded</span>}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRecord((v) => !v)}>
            {showRecord ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
            Record Update
          </Button>
        </div>
      </div>

      {showRecord && (
        <RecordPanel
          form={form}
          setForm={setForm}
          onSave={recordSnapshot}
          onCancel={() => setShowRecord(false)}
          saving={saving}
        />
      )}
    </div>
  );
}

type FormState = { activeUsers: string; weeklyActiveUsers: string; targetPopulation: string; satisfactionScore: string };

function RecordPanel({
  form, setForm, onSave, onCancel, saving,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const isValid = !isNaN(parseInt(form.activeUsers)) && !isNaN(parseInt(form.weeklyActiveUsers)) && !isNaN(parseInt(form.targetPopulation));
  return (
    <Card className="border-brand-accent/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Record Adoption Snapshot</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Updates live metrics and appends a weekly trend data point dated today.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { key: 'activeUsers', label: 'Active Users *', placeholder: '0' },
            { key: 'weeklyActiveUsers', label: 'Weekly Active *', placeholder: '0' },
            { key: 'targetPopulation', label: 'Target Population *', placeholder: '0' },
            { key: 'satisfactionScore', label: 'CSAT Score (1–5)', placeholder: 'e.g. 4.2' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
              <input
                type="number"
                min={0}
                step={key === 'satisfactionScore' ? 0.1 : 1}
                max={key === 'satisfactionScore' ? 5 : undefined}
                value={form[key as keyof FormState]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="h-8 w-full rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={onSave} disabled={saving || !isValid}>
            {saving ? 'Saving…' : 'Record Snapshot'}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
