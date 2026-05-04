'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { FeasibilityWeights, PortfolioConfig } from '@/lib/types';
import { getPortfolioConfig, savePortfolioConfig } from '@/lib/storage';
import { DEFAULT_WEIGHTS, DIMENSION_META, DIMENSIONS } from '@/lib/feasibility-engine';
import { PageHeader } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const DEFAULT_CONFIG: PortfolioConfig = {
  fiscalYearStart: '2025-01-01',
  functions: [],
  defaultFeasibilityWeights: DEFAULT_WEIGHTS,
  defaultPrioritizationWeights: {
    expectedRoi: 0.35,
    feasibility: 0.25,
    strategicAlignment: 0.20,
    timeToValue: 0.15,
    riskAdjusted: 0.05,
  },
  cfoApprovalRequired: true,
  totalProgramBudget: { year1: 0, year2: 0, year3: 0 },
};

export default function SettingsPage() {
  const [config, setConfig] = useState<PortfolioConfig>(DEFAULT_CONFIG);
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(
      DIMENSIONS.map((d) => [d, Math.round(DEFAULT_WEIGHTS[d] * 100)])
    )
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSection, setSavedSection] = useState<'weights' | 'budget' | 'governance' | null>(null);

  function flashSaved(section: 'weights' | 'budget' | 'governance') {
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 2500);
  }

  useEffect(() => {
    getPortfolioConfig().then((cfg) => {
      if (cfg) {
        setConfig(cfg);
        setWeights(
          Object.fromEntries(
            DIMENSIONS.map((d) => [d, Math.round(cfg.defaultFeasibilityWeights[d] * 100)])
          )
        );
      }
      setLoading(false);
    });
  }, []);

  const total = DIMENSIONS.reduce((sum, d) => sum + (weights[d] ?? 0), 0);
  const isValid = Math.abs(total - 100) < 1;

  function setWeight(dim: string, val: string) {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0 || n > 100) return;
    setWeights((prev) => ({ ...prev, [dim]: n }));
  }

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);

    const feasWeights: FeasibilityWeights = Object.fromEntries(
      DIMENSIONS.map((d) => [d, (weights[d] ?? 0) / 100])
    ) as FeasibilityWeights;

    const updated: PortfolioConfig = {
      ...config,
      defaultFeasibilityWeights: feasWeights,
    };
    await savePortfolioConfig(updated);
    setConfig(updated);
    setSaving(false);
    flashSaved('weights');
  }

  function handleReset() {
    setWeights(
      Object.fromEntries(
        DIMENSIONS.map((d) => [d, Math.round(DEFAULT_WEIGHTS[d] * 100)])
      )
    );
  }

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Settings" subtitle="Configure portfolio-wide defaults and scoring weights" />

      {/* Feasibility Weights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Feasibility Scoring Weights</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weights determine how the 6 dimension scores are combined into the composite score.
            They must sum to 100%.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {DIMENSIONS.map((dim) => {
            const meta = DIMENSION_META[dim];
            const val = weights[dim] ?? 0;
            return (
              <div key={dim} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) => setWeight(dim, e.target.value)}
                      className="w-16 h-8 rounded border border-input bg-background px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-accent transition-all"
                    style={{ width: `${Math.min(val, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}

          <div className={`flex items-center justify-between pt-2 border-t ${isValid ? 'text-green-600' : 'text-destructive'}`}>
            <span className="text-sm font-semibold">Total</span>
            <span className="text-sm font-bold tabular-nums">{total}%</span>
          </div>
          {!isValid && (
            <p className="text-xs text-destructive">
              Weights must sum to 100% (currently {total}%). Adjust values before saving.
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || !isValid}>
              {saving ? 'Saving…' : 'Save Weights'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset to defaults
            </Button>
            {savedSection === 'weights' && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />Saved
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Program Budget */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Program Budget</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Total AI program budget across all agents. Used for portfolio-level ROI and burn metrics.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(['year1', 'year2', 'year3'] as const).map((yr) => (
            <div key={yr} className="flex items-center gap-3">
              <label className="text-sm font-medium w-16 shrink-0">
                {yr === 'year1' ? 'Year 1' : yr === 'year2' ? 'Year 2' : 'Year 3'}
              </label>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  value={config.totalProgramBudget[yr]}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value) || 0;
                    setConfig((prev) => ({
                      ...prev,
                      totalProgramBudget: { ...prev.totalProgramBudget, [yr]: n },
                    }));
                  }}
                  className="w-full h-9 rounded border border-input bg-background pl-6 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => { await savePortfolioConfig(config); flashSaved('budget'); }}
            >
              Save Budget
            </Button>
            {savedSection === 'budget' && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />Saved
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CFO Approval Setting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Governance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.cfoApprovalRequired}
              onChange={(e) => setConfig((prev) => ({ ...prev, cfoApprovalRequired: e.target.checked }))}
              className="h-4 w-4 rounded border-input accent-brand-accent"
            />
            <div>
              <p className="text-sm font-medium">CFO approval required for ROI targets</p>
              <p className="text-xs text-muted-foreground">
                When enabled, ROI targets must be marked CFO-approved before appearing in committed value totals.
              </p>
            </div>
          </label>
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => { await savePortfolioConfig(config); flashSaved('governance'); }}
            >
              Save Governance
            </Button>
            {savedSection === 'governance' && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />Saved
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
