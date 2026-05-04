'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { ActivityEntry, ActivityEntryType } from '@/lib/types';
import { getActivityLogForAgent } from '@/lib/storage';
import { logActivity } from '@/lib/activity';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const TYPE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  stage_change:       { label: 'Stage Change',  color: 'text-brand-accent',  dot: 'bg-brand-accent' },
  note:               { label: 'Note',           color: 'text-slate-600',     dot: 'bg-slate-400' },
  milestone_update:   { label: 'Milestone',      color: 'text-amber-600',     dot: 'bg-amber-500' },
  risk_update:        { label: 'Risk',           color: 'text-orange-600',    dot: 'bg-orange-500' },
  roi_update:         { label: 'ROI',            color: 'text-green-600',     dot: 'bg-green-500' },
  feasibility_update: { label: 'Feasibility',    color: 'text-purple-600',    dot: 'bg-purple-500' },
  decision:           { label: 'Decision',       color: 'text-blue-600',      dot: 'bg-blue-500' },
};

type Props = {
  agentId: string;
  refreshTrigger?: string;
};

export function ActivityTab({ agentId, refreshTrigger }: Props) {
  const [log, setLog] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [noteType, setNoteType] = useState<'note' | 'decision'>('note');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    getActivityLogForAgent(agentId).then((entries) => {
      setLog([...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
      setLoading(false);
    });
  }, [agentId, refreshTrigger]);

  async function handleLogNote() {
    if (!noteText.trim()) return;
    setSaving(true);
    await logActivity({ agentId, type: noteType as ActivityEntryType, summary: noteText.trim() });
    const entries = await getActivityLogForAgent(agentId);
    setLog([...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    setNoteText('');
    setShowForm(false);
    setSaving(false);
  }

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Log entry form */}
      {showForm ? (
        <div className="rounded-md border border-brand-accent/30 bg-muted/10 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium shrink-0">Type</label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as 'note' | 'decision')}
              className="h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="note">Note</option>
              <option value="decision">Decision</option>
            </select>
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="What happened? What was decided?"
            rows={3}
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleLogNote} disabled={saving || !noteText.trim()}>
              {saving ? 'Saving…' : 'Log Entry'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setNoteText(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Log Note / Decision
          </Button>
        </div>
      )}

      {/* Timeline */}
      {log.length === 0 ? (
        <div className="rounded-md border py-14 text-center bg-muted/10">
          <p className="text-sm font-medium">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Stage changes, ROI updates, and key decisions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {log.map((entry, idx) => {
            const cfg = TYPE_CONFIG[entry.type] ?? { label: entry.type, color: 'text-muted-foreground', dot: 'bg-muted-foreground' };
            const isLast = idx === log.length - 1;
            return (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${cfg.dot}`} />
                  {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
                </div>
                <div className="pb-5 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-0.5">
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <p className="text-sm font-medium">{entry.summary}</p>
                      {entry.detail && <p className="text-xs text-muted-foreground">{entry.detail}</p>}
                      {entry.previousStage && entry.newStage && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {entry.previousStage} → {entry.newStage}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(entry.timestamp)}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.author}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
