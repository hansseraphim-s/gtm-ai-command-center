'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Agent, FeasibilityScore, FeasibilityWeights } from '@/lib/types';
import {
  computeFeasibilityComposite,
  feasibilityHealthBand,
  DIMENSION_META,
  DIMENSIONS,
  BAND_COLORS,
  BAND_LABELS,
} from '@/lib/feasibility-engine';
import { isoNow } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeasibilityRadar, RADAR_COLORS } from './feasibility-radar';

type DimScores = {
  dataReadiness: 1 | 2 | 3 | 4 | 5;
  modelMaturity: 1 | 2 | 3 | 4 | 5;
  buildComplexity: 1 | 2 | 3 | 4 | 5;
  adoptionReadiness: 1 | 2 | 3 | 4 | 5;
  changeMgmtScope: 1 | 2 | 3 | 4 | 5;
  politicalViability: 1 | 2 | 3 | 4 | 5;
};

type Props = {
  agent: Agent;
  weights: FeasibilityWeights;
  onSave: (updated: Agent) => Promise<void>;
};

const SCORE_LABELS: Record<number, string> = {
  1: '1 — Very Low',
  2: '2 — Low',
  3: '3 — Moderate',
  4: '4 — High',
  5: '5 — Very High',
};

function initScores(existing?: FeasibilityScore): DimScores {
  return {
    dataReadiness: existing?.dataReadiness ?? 3,
    modelMaturity: existing?.modelMaturity ?? 3,
    buildComplexity: existing?.buildComplexity ?? 3,
    adoptionReadiness: existing?.adoptionReadiness ?? 3,
    changeMgmtScope: existing?.changeMgmtScope ?? 3,
    politicalViability: existing?.politicalViability ?? 3,
  };
}

export function FeasibilityScorer({ agent, weights, onSave }: Props) {
  const existing = agent.feasibilityScore;
  const [scores, setScores] = useState<DimScores>(initScores(existing));
  const [scoredBy, setScoredBy] = useState(existing?.scoredBy ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setScore = (dim: keyof DimScores, val: number) =>
    setScores((prev) => ({ ...prev, [dim]: val as 1 | 2 | 3 | 4 | 5 }));

  const composite = computeFeasibilityComposite(scores, weights);
  const band = feasibilityHealthBand(composite);

  const liveScore: FeasibilityScore = {
    ...scores,
    composite,
    weights,
    scoredAt: isoNow(),
    scoredBy: scoredBy || 'Unknown',
    notes,
  };

  async function handleSave() {
    if (!scoredBy.trim()) return;
    setSaving(true);
    const updated: Agent = {
      ...agent,
      feasibilityScore: {
        ...scores,
        composite,
        weights,
        scoredAt: isoNow(),
        scoredBy: scoredBy.trim(),
        notes: notes.trim(),
      },
      updatedAt: isoNow(),
    };
    await onSave(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Dimension scores */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Dimension Scores</h3>
          {DIMENSIONS.map((dim) => {
            const meta = DIMENSION_META[dim];
            const val = scores[dim];
            return (
              <div key={dim} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-brand-accent shrink-0">
                    {val}/5
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {([1, 2, 3, 4, 5] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScore(dim, n)}
                      className={`flex-1 py-2 rounded text-xs font-medium border transition-all ${
                        n === val
                          ? 'bg-brand-accent text-white border-brand-accent'
                          : 'bg-background border-input text-muted-foreground hover:border-brand-accent/50 hover:text-foreground'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{meta.lowLabel}</span>
                  <span>{meta.highLabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live radar preview */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Live Preview</h3>
          <Card>
            <CardContent className="pt-4 pb-2">
              <FeasibilityRadar
                agents={[{ id: agent.id, name: agent.name, code: agent.code, score: liveScore, color: RADAR_COLORS[0] }]}
                compact
              />
            </CardContent>
          </Card>

          {/* Composite readout */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold tabular-nums ${BAND_COLORS[band]}`}>
                  {composite.toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground mb-1">/ 5.00</span>
              </div>
              <p className={`text-sm font-medium ${BAND_COLORS[band]}`}>{BAND_LABELS[band]}</p>
              <div className="space-y-1 pt-1">
                {DIMENSIONS.map((dim) => {
                  const w = weights[dim];
                  return (
                    <div key={dim} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{DIMENSION_META[dim].label}</span>
                      <span className="font-medium">{scores[dim]} × {(w * 100).toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 border-t pt-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Scored by <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={scoredBy}
            onChange={(e) => setScoredBy(e.target.value)}
            placeholder="Your name / role"
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key assumptions, blockers, or caveats…"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !scoredBy.trim()}
        >
          {saving ? 'Saving…' : 'Save Feasibility Score'}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        )}
        {!scoredBy.trim() && (
          <span className="text-xs text-muted-foreground">Scored by is required</span>
        )}
      </div>
    </div>
  );
}
