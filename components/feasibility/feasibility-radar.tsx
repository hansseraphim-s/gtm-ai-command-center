'use client';

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { FeasibilityScore } from '@/lib/types';
import { DIMENSION_META, DIMENSIONS } from '@/lib/feasibility-engine';

export type RadarAgent = {
  id: string;
  name: string;
  code: string;
  score: FeasibilityScore;
  color: string;
};

export const RADAR_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
];

type Props = {
  agents: RadarAgent[];
  compact?: boolean;
};

export function FeasibilityRadar({ agents, compact = false }: Props) {
  const data = DIMENSIONS.map((dim) => ({
    dimension: DIMENSION_META[dim].label,
    fullMark: 5,
    ...Object.fromEntries(agents.map((a) => [a.id, a.score[dim]])),
  }));

  const height = compact ? 260 : 380;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="hsl(215 20% 65% / 0.3)" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: compact ? 10 : 11, fill: 'hsl(215 20% 55%)' }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 5]}
          tickCount={6}
          tick={{ fontSize: 9, fill: 'hsl(215 20% 55%)' }}
        />
        {agents.map((a) => (
          <Radar
            key={a.id}
            name={agents.length > 1 ? `${a.code} — ${a.name}` : a.name}
            dataKey={a.id}
            stroke={a.color}
            fill={a.color}
            fillOpacity={agents.length === 1 ? 0.2 : 0.12}
            strokeWidth={2}
          />
        ))}
        <Tooltip
          formatter={(value, name) => [
            typeof value === 'number' ? value.toFixed(1) : String(value ?? ''),
            String(name ?? ''),
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid hsl(215 20% 85%)',
          }}
        />
        {agents.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        )}
      </RadarChart>
    </ResponsiveContainer>
  );
}
