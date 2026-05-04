'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle, Circle } from 'lucide-react';
import type { Agent, DataFeasibilityAssessment, FeasibilityWeights } from '@/lib/types';
import { getAllAgents, getAgent, saveAgent, getPortfolioConfig, getAllDataFeasibilityAssessments } from '@/lib/storage';
import { DEFAULT_WEIGHTS } from '@/lib/feasibility-engine';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/layout/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { FeasibilityScorer } from '@/components/feasibility/feasibility-scorer';
import { FeasibilityComparison } from '@/components/feasibility/feasibility-comparison';

const READINESS_COLOR = ['', 'text-red-600', 'text-red-500', 'text-amber-600', 'text-green-500', 'text-green-600'];
const READINESS_LABEL = ['', 'Critical', 'Poor', 'Fair', 'Good', 'Excellent'];

export default function FeasibilityPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assessments, setAssessments] = useState<DataFeasibilityAssessment[]>([]);
  const [weights, setWeights] = useState<FeasibilityWeights>(DEFAULT_WEIGHTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [all, config, dfas] = await Promise.all([
        getAllAgents(), getPortfolioConfig(), getAllDataFeasibilityAssessments(),
      ]);
      const sorted = [...all].sort((a, b) => a.code.localeCompare(b.code));
      setAgents(sorted);
      setAssessments(dfas);
      if (config?.defaultFeasibilityWeights) setWeights(config.defaultFeasibilityWeights);
      if (sorted.length > 0) {
        const first = sorted[0];
        setSelectedAgentId(first.id);
        setSelectedAgent(first);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function onAgentChange(id: string) {
    setSelectedAgentId(id);
    const agent = await getAgent(id);
    setSelectedAgent(agent ?? null);
  }

  async function handleSave(updated: Agent) {
    await saveAgent(updated);
    setSelectedAgent(updated);
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <PageHeader
        title="Feasibility Engine"
        subtitle="Score agents on 6 dimensions. Composite weighted by portfolio configuration."
      />

      <Tabs defaultValue="score">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-0">
          {[
            { value: 'score', label: 'Score Agent' },
            { value: 'compare', label: 'Compare' },
            { value: 'cdio', label: 'CDIO Status' },
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

        {/* ── Score Agent ───────────────────────────────────────────── */}
        <TabsContent value="score" className="pt-5 space-y-5">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium shrink-0">Agent</label>
            <select
              value={selectedAgentId}
              onChange={(e) => onAgentChange(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring max-w-sm w-full"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                  {a.feasibilityScore ? ` (${a.feasibilityScore.composite.toFixed(2)})` : ''}
                </option>
              ))}
            </select>
            {selectedAgent?.feasibilityScore && (
              <span className="text-xs text-muted-foreground">
                Last scored by {selectedAgent.feasibilityScore.scoredBy}
              </span>
            )}
          </div>

          {selectedAgent ? (
            <FeasibilityScorer agent={selectedAgent} weights={weights} onSave={handleSave} />
          ) : (
            <p className="text-sm text-muted-foreground">No agents available.</p>
          )}
        </TabsContent>

        {/* ── Compare ───────────────────────────────────────────────── */}
        <TabsContent value="compare" className="pt-5">
          <FeasibilityComparison agents={agents} />
        </TabsContent>

        {/* ── CDIO Status ───────────────────────────────────────────── */}
        <TabsContent value="cdio" className="pt-5 space-y-5">
          <CdioStatusPanel agents={agents} assessments={assessments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CdioStatusPanel({
  agents,
  assessments,
}: {
  agents: Agent[];
  assessments: DataFeasibilityAssessment[];
}) {
  const dfaMap = new Map(assessments.map((a) => [a.agentId, a]));

  const assessed = assessments.length;
  const signedOff = assessments.filter((a) => a.cdioSignedOff).length;
  const withGaps = assessments.filter((a) =>
    a.requiredDataSources.some((s) => s.dataAvailability !== 'available')
  ).length;
  const unassessed = agents.length - assessed;

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Agents', value: agents.length, sub: 'in portfolio' },
          { label: 'Assessed', value: assessed, sub: `${unassessed} not yet assessed`, color: assessed > 0 ? 'text-brand-accent' : '' },
          { label: 'CDIO Signed-Off', value: signedOff, sub: `of ${assessed} assessed`, color: signedOff === assessed && assessed > 0 ? 'text-green-600' : signedOff > 0 ? 'text-amber-600' : '' },
          { label: 'Data Gaps', value: withGaps, sub: 'agents with gaps', color: withGaps > 0 ? 'text-red-600' : 'text-green-600' },
        ].map(({ label, value, sub, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${color ?? ''}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent grid */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              {['Agent', 'CDIO Partner', 'Readiness', 'Signed-Off', 'Sources', 'Gaps', 'Gap Closure', 'Assessed'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const dfa = dfaMap.get(agent.id);
              if (!dfa) {
                return (
                  <tr key={agent.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <Link href={`/portfolio/${agent.id}?tab=feasibility`} className="font-mono text-xs font-bold text-brand-blue hover:text-brand-accent">
                        {agent.code}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{agent.name}</p>
                    </td>
                    <td colSpan={7} className="px-3 py-2.5 text-xs text-muted-foreground italic">
                      No assessment —{' '}
                      <Link href={`/portfolio/${agent.id}`} className="text-brand-accent hover:underline">
                        Open agent to assess
                      </Link>
                    </td>
                  </tr>
                );
              }

              const gaps = dfa.requiredDataSources.filter((s) => s.dataAvailability !== 'available');
              const isOverdue = dfa.estimatedGapClosureDate && new Date(dfa.estimatedGapClosureDate) < new Date();

              return (
                <tr key={agent.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <Link href={`/portfolio/${agent.id}`} className="font-mono text-xs font-bold text-brand-blue hover:text-brand-accent">
                      {agent.code}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">{agent.name}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{dfa.cdioPartner || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-semibold ${READINESS_COLOR[dfa.overallReadiness]}`}>
                      {dfa.overallReadiness}/5
                    </span>
                    <p className={`text-[10px] ${READINESS_COLOR[dfa.overallReadiness]}`}>
                      {READINESS_LABEL[dfa.overallReadiness]}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    {dfa.cdioSignedOff ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs">{dfa.cdioSignOffDate ? formatDate(dfa.cdioSignOffDate) : 'Yes'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Circle className="h-3.5 w-3.5" />
                        <span className="text-xs">Pending</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-center">{dfa.requiredDataSources.length}</td>
                  <td className="px-3 py-2.5">
                    {gaps.length > 0 ? (
                      <div className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{gaps.length} gap{gaps.length > 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs">Clean</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {dfa.estimatedGapClosureDate ? (
                      <span className={isOverdue ? 'text-red-600 font-medium flex items-center gap-1' : 'text-muted-foreground'}>
                        {isOverdue && <AlertTriangle className="h-3 w-3" />}
                        {formatDate(dfa.estimatedGapClosureDate)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(dfa.assessedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
