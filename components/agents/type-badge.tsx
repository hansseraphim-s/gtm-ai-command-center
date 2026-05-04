import { cn } from '@/lib/utils';
import type { AgentType, AgentFunction, AgentStage } from '@/lib/types';

const TYPE_CONFIG: Record<AgentType, { label: string; className: string }> = {
  predictive: { label: 'Predictive', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  generative: { label: 'Generative', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  agentic:    { label: 'Agentic',    className: 'bg-orange-50 text-orange-700 border-orange-200' },
  hybrid:     { label: 'Hybrid',     className: 'bg-teal-50 text-teal-700 border-teal-200' },
};

const FN_CONFIG: Record<AgentFunction, { label: string; className: string }> = {
  sales:            { label: 'Sales',   className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  marketing:        { label: 'Mktg',    className: 'bg-pink-50 text-pink-700 border-pink-200' },
  customer_success: { label: 'CS',      className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cross_functional: { label: 'Cross',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export const STAGE_CONFIG: Record<AgentStage, { label: string; className: string; dot: string }> = {
  idea:       { label: 'Idea',       className: 'bg-slate-50 text-slate-600 border-slate-200',   dot: 'bg-slate-400' },
  evaluation: { label: 'Evaluation', className: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-500' },
  design:     { label: 'Design',     className: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  pilot:      { label: 'Pilot',      className: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500' },
  scale:      { label: 'Scale',      className: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  production: { label: 'Production', className: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-500' },
  sunset:     { label: 'Sunset',     className: 'bg-slate-50 text-slate-500 border-slate-200',   dot: 'bg-slate-400' },
  killed:     { label: 'Killed',     className: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-500' },
};

export function TypeBadge({ type, className }: { type: AgentType; className?: string }) {
  const { label, className: c } = TYPE_CONFIG[type];
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', c, className)}>
      {label}
    </span>
  );
}

export function FunctionBadge({ fn, className }: { fn: AgentFunction; className?: string }) {
  const { label, className: c } = FN_CONFIG[fn];
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', c, className)}>
      {label}
    </span>
  );
}

export function StageBadge({ stage, className }: { stage: AgentStage; className?: string }) {
  const { label, className: c, dot } = STAGE_CONFIG[stage];
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', c, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
      {label}
    </span>
  );
}
