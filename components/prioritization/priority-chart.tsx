'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { RankedAgent, AgentQuadrant } from '@/lib/types';
import { QUADRANT_META } from '@/lib/prioritization-engine';

type ChartPoint = {
  x: number;
  y: number;
  z: number;
  code: string;
  name: string;
  quadrant: AgentQuadrant;
  score: number;
};

type Props = {
  ranked: RankedAgent[];
};

const QUADRANTS: AgentQuadrant[] = ['fund_now', 'quick_win', 'sequence', 'defer'];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload?: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-background border rounded-md shadow-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold">{d.code} — {d.name}</p>
      <p>Priority: <span className="font-bold">{d.score}</span></p>
      <p>Feasibility: <span className="font-medium">{d.x.toFixed(2)}</span></p>
      <p>ROI Score: <span className="font-medium">{d.y.toFixed(2)}</span></p>
      <p>
        Quadrant:{' '}
        <span style={{ color: QUADRANT_META[d.quadrant].color }} className="font-medium">
          {QUADRANT_META[d.quadrant].label}
        </span>
      </p>
    </div>
  );
}

export function PriorityChart({ ranked }: Props) {
  const byQuadrant: Record<AgentQuadrant, ChartPoint[]> = {
    fund_now: [],
    quick_win: [],
    sequence: [],
    defer: [],
  };

  for (const r of ranked) {
    byQuadrant[r.quadrant].push({
      x: r.feasScore,
      y: r.roiScore,
      z: Math.max(1, r.alignmentScore) * 20 + 40,
      code: r.agent.code,
      name: r.agent.name,
      quadrant: r.quadrant,
      score: r.priorityScore,
    });
  }

  return (
    <div className="space-y-2">
      {/* Quadrant labels overlay */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 90%)" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 5]}
              name="Feasibility"
              label={{ value: 'Feasibility Score →', position: 'insideBottom', offset: -10, fontSize: 11 }}
              tick={{ fontSize: 11 }}
              tickCount={6}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[0, 5]}
              name="ROI Score"
              label={{ value: 'ROI Score →', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11 }}
              tick={{ fontSize: 11 }}
              tickCount={6}
            />
            <ZAxis dataKey="z" range={[40, 400]} />
            <ReferenceLine x={3} stroke="hsl(215 20% 70%)" strokeDasharray="5 3" strokeWidth={1.5} />
            <ReferenceLine y={2.5} stroke="hsl(215 20% 70%)" strokeDasharray="5 3" strokeWidth={1.5} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              formatter={(value: string) => QUADRANT_META[value as AgentQuadrant]?.label ?? value}
            />
            {QUADRANTS.map((q) => (
              <Scatter
                key={q}
                name={q}
                data={byQuadrant[q]}
                fill={QUADRANT_META[q].color}
                fillOpacity={0.8}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>

        {/* Quadrant label overlays — positioned as absolute labels */}
        <div className="absolute inset-0 pointer-events-none" style={{ top: 20, right: 30, bottom: 60, left: 50 }}>
          <div className="absolute top-1 right-4 text-[10px] font-semibold" style={{ color: QUADRANT_META.sequence.color }}>
            Sequence
          </div>
          <div className="absolute top-1 left-4 text-[10px] font-semibold" style={{ color: QUADRANT_META.defer.color }}>
            Defer
          </div>
          <div className="absolute bottom-4 right-4 text-[10px] font-semibold" style={{ color: QUADRANT_META.fund_now.color }}>
            Fund Now
          </div>
          <div className="absolute bottom-4 left-4 text-[10px] font-semibold" style={{ color: QUADRANT_META.quick_win.color }}>
            Quick Win
          </div>
        </div>
      </div>

      {/* Quadrant summary */}
      <div className="grid grid-cols-4 gap-2">
        {QUADRANTS.map((q) => (
          <div key={q} className="rounded-md border p-2.5 text-center">
            <p
              className="text-xs font-semibold"
              style={{ color: QUADRANT_META[q].color }}
            >
              {QUADRANT_META[q].label}
            </p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">
              {byQuadrant[q].length}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
              {QUADRANT_META[q].description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
