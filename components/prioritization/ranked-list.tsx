'use client';

import Link from 'next/link';
import type { RankedAgent } from '@/lib/types';
import { QUADRANT_META } from '@/lib/prioritization-engine';
import { computeAgentROI } from '@/lib/roi-engine';
import { formatCurrency } from '@/lib/utils';
import { TierBadge } from '@/components/agents/tier-badge';
import { StageBadge } from '@/components/agents/type-badge';

type Props = {
  ranked: RankedAgent[];
};

function ScoreBar({
  value,
  max = 5,
  color = 'bg-brand-accent',
}: {
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function RankedList({ ranked }: Props) {
  if (ranked.length === 0) {
    return (
      <div className="rounded-md border py-12 text-center">
        <p className="text-sm text-muted-foreground">No agents to rank.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add agents and score their feasibility to see rankings.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b">
          <tr>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-8">#</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Agent</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Stage</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Quadrant</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Priority</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide min-w-[280px]">Score Breakdown</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Committed ROI</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => {
            const meta = QUADRANT_META[r.quadrant];
            let committedDisplay = '—';
            try {
              const result = computeAgentROI(r.agent);
              if (result.committedValue > 0) committedDisplay = formatCurrency(result.committedValue, true);
            } catch { /* */ }

            return (
              <tr key={r.agent.id} className="border-b hover:bg-muted/20 transition-colors">
                <td className="px-3 py-3">
                  <span className="text-xs font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-start gap-2.5">
                    <TierBadge tier={r.agent.tier} />
                    <div>
                      <Link
                        href={`/portfolio/${r.agent.id}`}
                        className="text-sm font-semibold hover:text-brand-accent transition-colors font-mono"
                      >
                        {r.agent.code}
                      </Link>
                      <p className="text-xs text-muted-foreground max-w-[180px] truncate">{r.agent.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StageBadge stage={r.agent.stage} />
                </td>
                <td className="px-3 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-lg font-bold tabular-nums">{r.priorityScore}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-1 min-w-[240px]">
                    <div className="grid grid-cols-[80px_1fr] gap-x-2 items-center">
                      <span className="text-[10px] text-muted-foreground text-right">ROI</span>
                      <ScoreBar value={r.roiScore} color="bg-green-500" />
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-x-2 items-center">
                      <span className="text-[10px] text-muted-foreground text-right">Feasibility</span>
                      <ScoreBar value={r.feasScore} color="bg-brand-accent" />
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-x-2 items-center">
                      <span className="text-[10px] text-muted-foreground text-right">Alignment</span>
                      <ScoreBar value={r.alignmentScore} color="bg-purple-500" />
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-x-2 items-center">
                      <span className="text-[10px] text-muted-foreground text-right">Time-to-Value</span>
                      <ScoreBar value={r.ttvScore} color="bg-amber-500" />
                    </div>
                    {r.riskPenalty > 0 && (
                      <div className="grid grid-cols-[80px_1fr] gap-x-2 items-center">
                        <span className="text-[10px] text-red-500 text-right">Risk ↓</span>
                        <ScoreBar value={r.riskPenalty * 5} color="bg-red-400" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-right text-sm font-medium tabular-nums">
                  {committedDisplay}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
