'use client';

import { cn } from '@/lib/utils';
import type { Agent, AgentStage } from '@/lib/types';
import { STAGE_CONFIG } from './type-badge';

const STAGES: AgentStage[] = ['idea', 'evaluation', 'design', 'pilot', 'scale', 'production'];

type Props = {
  agents: Agent[];
  activeStage: AgentStage | null;
  onStageClick: (stage: AgentStage | null) => void;
};

export function StagePipeline({ agents, activeStage, onStageClick }: Props) {
  const counts = STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = agents.filter((a) => a.stage === s).length;
    return acc;
  }, {});

  const killedCount = agents.filter((a) => a.stage === 'killed' || a.stage === 'sunset').length;

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
      {STAGES.map((stage, i) => {
        const { label, dot } = STAGE_CONFIG[stage];
        const count = counts[stage] ?? 0;
        const isActive = activeStage === stage;
        const isLast = i === STAGES.length - 1;

        return (
          <div key={stage} className="flex items-center gap-1">
            <button
              onClick={() => onStageClick(isActive ? null : stage)}
              className={cn(
                'flex flex-col items-center justify-center min-w-[80px] px-3 py-2.5 rounded border text-xs transition-all',
                isActive
                  ? 'bg-brand-accent text-white border-brand-accent shadow-sm'
                  : 'bg-white border-border hover:border-brand-accent/50 hover:bg-brand-light/30 text-foreground'
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn('w-2 h-2 rounded-full shrink-0', isActive ? 'bg-white/80' : dot)} />
                <span className="font-medium">{label}</span>
              </div>
              <span className={cn('text-xl font-bold leading-none', isActive ? 'text-white' : 'text-foreground')}>
                {count}
              </span>
            </button>
            {!isLast && (
              <svg className="h-4 w-4 text-muted-foreground/40 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        );
      })}

      {killedCount > 0 && (
        <div className="flex items-center gap-1 ml-2">
          <span className="text-muted-foreground/40 text-xs">|</span>
          <button
            onClick={() => onStageClick(activeStage === 'killed' ? null : 'killed')}
            className={cn(
              'flex flex-col items-center justify-center min-w-[70px] px-3 py-2.5 rounded border text-xs transition-all',
              activeStage === 'killed'
                ? 'bg-destructive text-white border-destructive'
                : 'bg-white border-border hover:border-destructive/30 text-muted-foreground'
            )}
          >
            <span className="font-medium mb-1">Killed/Sunset</span>
            <span className={cn('text-xl font-bold leading-none', activeStage === 'killed' ? 'text-white' : '')}>
              {killedCount}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
