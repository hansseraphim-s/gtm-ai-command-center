import { cn } from '@/lib/utils';
import type { AgentTier } from '@/lib/types';

const CONFIG: Record<AgentTier, { label: string; className: string }> = {
  tier_0_foundation: { label: 'T0 Foundation', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  tier_1_quick_win:  { label: 'T1 Quick Win',  className: 'bg-green-50 text-green-700 border-green-200' },
  tier_2_strategic_bet: { label: 'T2 Strategic', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  tier_3_flagship:   { label: 'T3 Flagship',   className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export function TierBadge({ tier, className }: { tier: AgentTier; className?: string }) {
  const { label, className: tierClass } = CONFIG[tier];
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', tierClass, className)}>
      {label}
    </span>
  );
}
