'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Agent, PrioritizationWeights, PortfolioConfig } from '@/lib/types';
import { getAllAgents, getPortfolioConfig, savePortfolioConfig } from '@/lib/storage';
import {
  rankAgents,
  DEFAULT_PRIORITIZATION_WEIGHTS,
  QUADRANT_META,
} from '@/lib/prioritization-engine';
import { PageHeader } from '@/components/layout/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PriorityChart } from '@/components/prioritization/priority-chart';
import { RankedList } from '@/components/prioritization/ranked-list';
import { CheckCircle2 } from 'lucide-react';

const WEIGHT_FIELDS: { key: keyof PrioritizationWeights; label: string; description: string }[] = [
  { key: 'expectedRoi', label: 'Expected ROI', description: 'Committed annual value vs budget' },
  { key: 'feasibility', label: 'Feasibility', description: 'Composite feasibility score' },
  { key: 'strategicAlignment', label: 'Strategic Alignment', description: 'Explicit 1–5 alignment score' },
  { key: 'timeToValue', label: 'Time to Value', description: 'How quickly returns materialize' },
  { key: 'riskAdjusted', label: 'Risk Adjustment', description: 'Open high/critical risk penalty multiplier' },
];

export default function PrioritizationPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [config, setConfig] = useState<PortfolioConfig | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(
      Object.entries(DEFAULT_PRIORITIZATION_WEIGHTS).map(([k, v]) => [k, Math.round(v * 100)])
    )
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>('active');

  useEffect(() => {
    Promise.all([getAllAgents(), getPortfolioConfig()]).then(([all, cfg]) => {
      setAgents(all);
      setConfig(cfg ?? null);
      if (cfg?.defaultPrioritizationWeights) {
        setWeights(
          Object.fromEntries(
            Object.entries(cfg.defaultPrioritizationWeights).map(([k, v]) => [k, Math.round(v * 100)])
          )
        );
      }
      setLoading(false);
    });
  }, []);

  const effectiveWeights: PrioritizationWeights = {
    expectedRoi: (weights.expectedRoi ?? 35) / 100,
    feasibility: (weights.feasibility ?? 25) / 100,
    strategicAlignment: (weights.strategicAlignment ?? 20) / 100,
    timeToValue: (weights.timeToValue ?? 15) / 100,
    riskAdjusted: (weights.riskAdjusted ?? 5) / 100,
  };

  const filteredAgents = useMemo(() => {
    if (stageFilter === 'all') return agents;
    if (stageFilter === 'active') return agents.filter((a) => a.stage !== 'killed' && a.stage !== 'sunset');
    if (stageFilter === 'pipeline') return agents.filter((a) => ['idea', 'evaluation', 'design', 'pilot'].includes(a.stage));
    if (stageFilter === 'production') return agents.filter((a) => ['scale', 'production'].includes(a.stage));
    return agents;
  }, [agents, stageFilter]);

  const ranked = useMemo(
    () => rankAgents(filteredAgents, effectiveWeights),
    [filteredAgents, effectiveWeights]
  );

  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0);
  const isValid = Math.abs(totalWeight - 100) < 1;

  async function saveWeights() {
    if (!isValid) return;
    setSaving(true);
    const base = config ?? {
      fiscalYearStart: '2025-01-01',
      functions: [],
      defaultFeasibilityWeights: {
        dataReadiness: 0.25, modelMaturity: 0.15, buildComplexity: 0.10,
        adoptionReadiness: 0.20, changeMgmtScope: 0.15, politicalViability: 0.15,
      },
      cfoApprovalRequired: true,
      totalProgramBudget: { year1: 0, year2: 0, year3: 0 },
    };
    const updated: PortfolioConfig = {
      ...base,
      defaultPrioritizationWeights: effectiveWeights,
    };
    await savePortfolioConfig(updated);
    setConfig(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;

  const scoredCount = agents.filter((a) => a.feasibilityScore).length;
  const unscoredCount = agents.length - scoredCount;

  return (
    <div className="space-y-5 max-w-7xl">
      <PageHeader
        title="Prioritization Engine"
        subtitle={`Rank agents by weighted composite score. ${scoredCount} of ${agents.length} agents have feasibility scores.`}
      />

      {unscoredCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{unscoredCount} agents</strong> have no feasibility score — they will show as 0 for the feasibility dimension.{' '}
          <a href="/feasibility" className="underline font-medium">Score them in Feasibility →</a>
        </div>
      )}

      <Tabs defaultValue="ranked">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="justify-start border-b rounded-none h-auto p-0 bg-transparent gap-0">
            {[
              { value: 'ranked', label: 'Ranked List' },
              { value: 'chart', label: 'Bubble Chart' },
              { value: 'weights', label: 'Scoring Weights' },
            ].map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-accent data-[state=active]:text-brand-accent px-4 py-2 text-sm font-medium text-muted-foreground"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Stage filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Show:</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="active">Active only</option>
              <option value="pipeline">Pipeline (idea→pilot)</option>
              <option value="production">Production (scale+)</option>
              <option value="all">All agents</option>
            </select>
            <span className="text-xs text-muted-foreground">{ranked.length} agents</span>
          </div>
        </div>

        {/* ── Ranked List ───────────────────────────────────────────── */}
        <TabsContent value="ranked" className="pt-5">
          <RankedList ranked={ranked} />
        </TabsContent>

        {/* ── Bubble Chart ──────────────────────────────────────────── */}
        <TabsContent value="chart" className="pt-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Feasibility vs ROI — bubble size = strategic alignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PriorityChart ranked={ranked} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Weights ───────────────────────────────────────────────── */}
        <TabsContent value="weights" className="pt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Prioritization Scoring Weights</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adjust how dimensions contribute to the priority score. Must sum to 100%.
                Changes take effect immediately in the ranked list.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              {WEIGHT_FIELDS.map(({ key, label, description }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={weights[key] ?? 0}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          if (!isNaN(n) && n >= 0 && n <= 100) {
                            setWeights((prev) => ({ ...prev, [key]: n }));
                          }
                        }}
                        className="w-16 h-8 rounded border border-input bg-background px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <span className="text-sm text-muted-foreground w-4">%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-accent transition-all"
                      style={{ width: `${Math.min(weights[key] ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className={`flex items-center justify-between pt-2 border-t ${isValid ? 'text-green-600' : 'text-destructive'}`}>
                <span className="text-sm font-semibold">Total</span>
                <span className="text-sm font-bold tabular-nums">{totalWeight}%</span>
              </div>
              {!isValid && (
                <p className="text-xs text-destructive">Weights must sum to 100%.</p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={saveWeights} disabled={saving || !isValid}>
                  {saving ? 'Saving…' : 'Save as Default'}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />Saved
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
