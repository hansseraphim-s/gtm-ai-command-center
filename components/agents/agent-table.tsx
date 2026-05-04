'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal } from 'lucide-react';
import type { Agent, AgentFunction, AgentStage, AgentTier, AgentType } from '@/lib/types';
import { computeAgentROI } from '@/lib/roi-engine';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TierBadge } from './tier-badge';
import { TypeBadge, FunctionBadge, StageBadge } from './type-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SortKey = 'code' | 'name' | 'function' | 'stage' | 'tier' | 'feasibility' | 'committed' | 'measured' | 'adoption';
type SortDir = 'asc' | 'desc';

type Filters = {
  function: AgentFunction | '';
  stage: AgentStage | '';
  tier: AgentTier | '';
  type: AgentType | '';
  search: string;
};

type Props = {
  agents: Agent[];
  stageFilter: AgentStage | null;
  onStageChange: (stage: AgentStage, agentId: string) => Promise<void>;
  onDelete: (agentId: string) => Promise<void>;
  initialFunctionFilter?: AgentFunction;
};

const STAGE_ORDER: AgentStage[] = ['idea','evaluation','design','pilot','scale','production','sunset','killed'];
const STAGE_ADVANCE: Record<AgentStage, AgentStage | null> = {
  idea: 'evaluation', evaluation: 'design', design: 'pilot', pilot: 'scale',
  scale: 'production', production: null, sunset: null, killed: null,
};

export function AgentTable({ agents, stageFilter, onStageChange, onDelete, initialFunctionFilter }: Props) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'code', dir: 'asc' });
  const [filters, setFilters] = useState<Filters>({
    function: initialFunctionFilter ?? '', stage: '', tier: '', type: '', search: '',
  });

  const setFilter = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );

  const roiMap = useMemo(() => {
    const m = new Map<string, { committed: number; measured: number }>();
    for (const a of agents) {
      try {
        const r = computeAgentROI(a);
        m.set(a.id, { committed: r.committedValue, measured: r.measuredValue });
      } catch {
        m.set(a.id, { committed: 0, measured: 0 });
      }
    }
    return m;
  }, [agents]);

  const filtered = useMemo(() => {
    let list = stageFilter
      ? agents.filter((a) => a.stage === stageFilter || (stageFilter === 'killed' && (a.stage === 'killed' || a.stage === 'sunset')))
      : agents;

    if (filters.function) list = list.filter((a) => a.function === filters.function);
    if (filters.stage) list = list.filter((a) => a.stage === filters.stage);
    if (filters.tier) list = list.filter((a) => a.tier === filters.tier);
    if (filters.type) list = list.filter((a) => a.type === filters.type);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q) ||
          a.owner.toLowerCase().includes(q) ||
          a.tags.some((t) => t.includes(q))
      );
    }
    return list;
  }, [agents, stageFilter, filters]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sort.key) {
        case 'code':        av = a.code; bv = b.code; break;
        case 'name':        av = a.name; bv = b.name; break;
        case 'function':    av = a.function; bv = b.function; break;
        case 'stage':       av = STAGE_ORDER.indexOf(a.stage); bv = STAGE_ORDER.indexOf(b.stage); break;
        case 'tier':        av = a.tier; bv = b.tier; break;
        case 'feasibility': av = a.feasibilityScore?.composite ?? 0; bv = b.feasibilityScore?.composite ?? 0; break;
        case 'committed':   av = roiMap.get(a.id)?.committed ?? 0; bv = roiMap.get(b.id)?.committed ?? 0; break;
        case 'measured':    av = roiMap.get(a.id)?.measured ?? 0; bv = roiMap.get(b.id)?.measured ?? 0; break;
        case 'adoption': {
          const aAdopt = a.adoptionMetrics ? a.adoptionMetrics.activeUsers / Math.max(a.adoptionMetrics.targetPopulation, 1) : 0;
          const bAdopt = b.adoptionMetrics ? b.adoptionMetrics.activeUsers / Math.max(b.adoptionMetrics.targetPopulation, 1) : 0;
          av = aAdopt; bv = bAdopt; break;
        }
      }
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sort, roiMap]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <ChevronsUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 inline" />;
    return sort.dir === 'asc'
      ? <ChevronUp className="ml-1 h-3 w-3 inline" />
      : <ChevronDown className="ml-1 h-3 w-3 inline" />;
  }

  function Th({ col, label, right }: { col: SortKey; label: string; right?: boolean }) {
    return (
      <th
        className={`px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-foreground ${right ? 'text-right' : ''}`}
        onClick={() => toggleSort(col)}
      >
        {label}<SortIcon col={col} />
      </th>
    );
  }

  const nextMilestone = (a: Agent) =>
    [...a.milestones]
      .filter((m) => m.status !== 'done' && m.status !== 'missed')
      .sort((x, y) => x.dueDate.localeCompare(y.dueDate))[0];

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search code, name, owner, tags…"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="h-8 w-56 text-sm"
        />
        <FilterSelect label="Function" value={filters.function}
          onChange={(v) => setFilter('function', v as AgentFunction | '')}
          options={[['sales','Sales'],['marketing','Marketing'],['customer_success','Customer Success'],['cross_functional','Cross-functional']]}
        />
        <FilterSelect label="Stage" value={filters.stage}
          onChange={(v) => setFilter('stage', v as AgentStage | '')}
          options={STAGE_ORDER.map((s) => [s, s.charAt(0).toUpperCase() + s.slice(1)])}
        />
        <FilterSelect label="Tier" value={filters.tier}
          onChange={(v) => setFilter('tier', v as AgentTier | '')}
          options={[['tier_0_foundation','T0 Foundation'],['tier_1_quick_win','T1 Quick Win'],['tier_2_strategic_bet','T2 Strategic'],['tier_3_flagship','T3 Flagship']]}
        />
        <FilterSelect label="Type" value={filters.type}
          onChange={(v) => setFilter('type', v as AgentType | '')}
          options={[['predictive','Predictive'],['generative','Generative'],['agentic','Agentic'],['hybrid','Hybrid']]}
        />
        {Object.values(filters).some(Boolean) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs"
            onClick={() => setFilters({ function:'', stage:'', tier:'', type:'', search:'' })}>
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {sorted.length} of {agents.length} agents
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <Th col="code" label="Code" />
              <Th col="name" label="Name" />
              <Th col="function" label="Fn" />
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Type</th>
              <Th col="tier" label="Tier" />
              <Th col="stage" label="Stage" />
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Owner</th>
              <Th col="feasibility" label="Feas." right />
              <Th col="committed" label="Committed" right />
              <Th col="measured" label="Measured" right />
              <Th col="adoption" label="Adoption" right />
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Next Milestone</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No agents match the current filters.
                </td>
              </tr>
            )}
            {sorted.map((a) => {
              const roi = roiMap.get(a.id) ?? { committed: 0, measured: 0 };
              const feas = a.feasibilityScore?.composite;
              const adoption = a.adoptionMetrics
                ? Math.round((a.adoptionMetrics.activeUsers / Math.max(a.adoptionMetrics.targetPopulation, 1)) * 100)
                : null;
              const ms = nextMilestone(a);
              const isMissed = ms && new Date(ms.dueDate) < new Date() && ms.status === 'in_progress';

              return (
                <tr
                  key={a.id}
                  className="border-b hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => router.push(`/portfolio/${a.id}`)}
                >
                  <td className="px-3 py-2.5 font-mono font-bold text-xs text-brand-blue">{a.code}</td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <Link
                      href={`/portfolio/${a.id}`}
                      className="font-medium hover:text-brand-accent truncate block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5"><FunctionBadge fn={a.function} /></td>
                  <td className="px-3 py-2.5"><TypeBadge type={a.type} /></td>
                  <td className="px-3 py-2.5"><TierBadge tier={a.tier} /></td>
                  <td className="px-3 py-2.5"><StageBadge stage={a.stage} /></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{a.owner}</td>
                  <td className="px-3 py-2.5 text-right text-xs">
                    {feas !== undefined ? (
                      <span className={
                        feas >= 4 ? 'text-green-600 font-semibold' :
                        feas >= 3 ? 'text-amber-600 font-semibold' : 'text-red-600 font-semibold'
                      }>{feas.toFixed(1)}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-medium">
                    {roi.committed > 0 ? formatCurrency(roi.committed, true) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-medium">
                    {roi.measured > 0
                      ? <span className="text-green-600">{formatCurrency(roi.measured, true)}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs">
                    {adoption !== null
                      ? <span className={adoption >= 75 ? 'text-green-600' : adoption >= 50 ? 'text-amber-600' : 'text-muted-foreground'}>
                          {adoption}%
                        </span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px]">
                    {ms ? (
                      <div>
                        <p className={`text-xs truncate ${isMissed ? 'text-red-600' : ''}`} title={ms.title}>{ms.title}</p>
                        <p className={`text-[10px] ${isMissed ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {isMissed ? '⚠ ' : ''}{formatDate(ms.dueDate)}
                        </p>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted transition-colors">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => router.push(`/portfolio/${a.id}`)}>
                          View detail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/portfolio/${a.id}/edit`)}>
                          Edit
                        </DropdownMenuItem>
                        {STAGE_ADVANCE[a.stage] && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onStageChange(STAGE_ADVANCE[a.stage]!, a.id)}>
                              Advance → {STAGE_ADVANCE[a.stage]}
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(a.id)}
                        >
                          Delete agent
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="">All {label}s</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}
