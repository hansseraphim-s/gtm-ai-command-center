'use client';

import type { ROIAuditEntry } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CHANGE_TYPE_LABELS: Record<string, string> = {
  target_created: 'Target created',
  target_updated: 'Target updated',
  outcome_recorded: 'Outcome recorded',
  outcome_challenged: 'Outcome challenged',
  cfo_approved: 'CFO approved',
  methodology_created: 'Methodology created',
  methodology_updated: 'Methodology updated',
  kill_threshold_breached: 'Kill threshold breached',
};

const CHANGE_TYPE_COLOR: Record<string, string> = {
  target_created: 'text-brand-accent',
  target_updated: 'text-amber-600',
  outcome_recorded: 'text-green-600',
  outcome_challenged: 'text-orange-600',
  cfo_approved: 'text-blue-600',
  methodology_created: 'text-purple-600',
  methodology_updated: 'text-purple-500',
  kill_threshold_breached: 'text-red-600',
};

type Props = {
  entries: ROIAuditEntry[];
};

export function AuditLogView({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No audit entries yet. Actions on targets and outcomes will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {[...entries].reverse().map((e) => (
        <div key={e.id} className="flex gap-3 py-2.5 border-b last:border-0">
          <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-current shrink-0 mt-2" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <span className={`text-xs font-semibold ${CHANGE_TYPE_COLOR[e.changeType] ?? 'text-foreground'}`}>
                {CHANGE_TYPE_LABELS[e.changeType] ?? e.changeType}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                {formatDate(e.changedAt)} · {e.changedBy}
              </span>
            </div>
            {e.rationale && (
              <p className="text-xs text-muted-foreground mt-0.5">{e.rationale}</p>
            )}
            {e.fieldChanged && (
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                {e.fieldChanged}
                {e.previousValue !== undefined && ` : ${e.previousValue} → ${e.newValue}`}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
