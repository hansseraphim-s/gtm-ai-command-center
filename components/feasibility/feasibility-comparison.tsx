'use client';

import { useState } from 'react';
import type { Agent } from '@/lib/types';
import {
  DIMENSION_META,
  DIMENSIONS,
  feasibilityHealthBand,
  BAND_COLORS,
} from '@/lib/feasibility-engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeasibilityRadar, RADAR_COLORS, type RadarAgent } from './feasibility-radar';

type Props = {
  agents: Agent[];
};

const MAX_COMPARE = 5;

export function FeasibilityComparison({ agents }: Props) {
  const scoredAgents = agents.filter((a) => a.feasibilityScore);
  const [selected, setSelected] = useState<string[]>(
    scoredAgents.slice(0, 2).map((a) => a.id)
  );

  function toggleAgent(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < MAX_COMPARE
        ? [...prev, id]
        : prev
    );
  }

  const comparedAgents = scoredAgents.filter((a) => selected.includes(a.id));

  const radarAgents: RadarAgent[] = comparedAgents.map((a, i) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    score: a.feasibilityScore!,
    color: RADAR_COLORS[i % RADAR_COLORS.length],
  }));

  return (
    <div className="space-y-5">
      {/* Agent selector */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Select agents to compare
          <span className="text-muted-foreground font-normal ml-1.5">(up to {MAX_COMPARE})</span>
        </p>
        {scoredAgents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agents have feasibility scores yet. Score agents first using the Score tab.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {scoredAgents.map((a, i) => {
              const isSelected = selected.includes(a.id);
              const color = RADAR_COLORS[selected.indexOf(a.id) % RADAR_COLORS.length];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAgent(a.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    isSelected
                      ? 'text-white border-transparent'
                      : 'bg-background border-input text-muted-foreground hover:border-foreground/30'
                  }`}
                  style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
                >
                  <span className="font-mono">{a.code}</span>
                  <span className="hidden sm:inline">{a.name}</span>
                  <span className="text-[10px] opacity-75">
                    {a.feasibilityScore!.composite.toFixed(1)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {comparedAgents.length >= 1 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Radar chart */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Radar Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <FeasibilityRadar agents={radarAgents} />
              </CardContent>
            </Card>
          </div>

          {/* Score table */}
          <div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Dimension</th>
                      {comparedAgents.map((a, i) => (
                        <th
                          key={a.id}
                          className="px-2 py-2 text-center font-medium"
                          style={{ color: RADAR_COLORS[i % RADAR_COLORS.length] }}
                        >
                          {a.code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DIMENSIONS.map((dim) => (
                      <tr key={dim} className="border-b last:border-0">
                        <td className="px-3 py-2 text-muted-foreground">
                          {DIMENSION_META[dim].label}
                        </td>
                        {comparedAgents.map((a) => (
                          <td key={a.id} className="px-2 py-2 text-center font-semibold">
                            {a.feasibilityScore![dim]}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/20 font-semibold">
                      <td className="px-3 py-2 text-xs">Composite</td>
                      {comparedAgents.map((a, i) => {
                        const band = feasibilityHealthBand(a.feasibilityScore!.composite);
                        return (
                          <td
                            key={a.id}
                            className={`px-2 py-2 text-center ${BAND_COLORS[band]}`}
                          >
                            {a.feasibilityScore!.composite.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Per-agent composite cards */}
            <div className="mt-3 space-y-2">
              {comparedAgents.map((a, i) => {
                const fs = a.feasibilityScore!;
                const band = feasibilityHealthBand(fs.composite);
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-md border bg-background"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: RADAR_COLORS[i % RADAR_COLORS.length] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{a.code} — {a.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Scored by {fs.scoredBy}
                      </p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${BAND_COLORS[band]}`}>
                      {fs.composite.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
