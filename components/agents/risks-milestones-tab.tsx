'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, CheckCircle2, AlertCircle, Clock, CircleDot } from 'lucide-react';
import type { Agent, Milestone, MilestoneStatus, Risk, RiskSeverity, RiskLikelihood, RiskStatus } from '@/lib/types';
import { saveAgent } from '@/lib/storage';
import { logActivity } from '@/lib/activity';
import { isoNow, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const RISK_SEVERITY_BG: Record<string, string> = {
  low: 'bg-slate-50 border-slate-200',
  medium: 'bg-amber-50 border-amber-200',
  high: 'bg-orange-50 border-orange-200',
  critical: 'bg-red-50 border-red-200',
};
const RISK_SEVERITY_COLOR: Record<string, string> = {
  low: 'text-slate-500', medium: 'text-amber-600', high: 'text-orange-600', critical: 'text-red-600',
};

type Props = {
  agent: Agent;
  onUpdate: (updated: Agent) => void;
};

type MilestoneForm = {
  title: string;
  dueDate: string;
  status: MilestoneStatus;
  owner: string;
  notes: string;
};

type RiskForm = {
  description: string;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  mitigation: string;
  owner: string;
  status: RiskStatus;
};

function blankMS(): MilestoneForm {
  return { title: '', dueDate: '', status: 'not_started', owner: '', notes: '' };
}

function blankRisk(): RiskForm {
  return { description: '', severity: 'medium', likelihood: 'medium', mitigation: '', owner: '', status: 'open' };
}

function MilestoneIcon({ status }: { status: string }) {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (status === 'missed') return <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />;
  if (status === 'in_progress') return <CircleDot className="h-4 w-4 text-amber-500 shrink-0" />;
  return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function FieldInput({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-7 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring ${className}`}
    />
  );
}

function FieldSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function SaveCancel({ onSave, onCancel, disabled }: {
  onSave: () => void; onCancel: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      <button
        onClick={onSave}
        disabled={disabled}
        className="inline-flex h-6 w-6 items-center justify-center rounded bg-brand-accent text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        title="Save"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-input hover:bg-muted transition-colors"
        title="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function RisksMilestonesTab({ agent, onUpdate }: Props) {
  const [editMilestoneId, setEditMilestoneId] = useState<string | null>(null);
  const [msForm, setMsForm] = useState<MilestoneForm>(blankMS());
  const [editRiskId, setEditRiskId] = useState<string | null>(null);
  const [riskForm, setRiskForm] = useState<RiskForm>(blankRisk());
  const [saving, setSaving] = useState(false);

  // ── Milestone actions ──────────────────────────────────────────

  function startAddMilestone() {
    setEditMilestoneId('new');
    setMsForm(blankMS());
  }

  function startEditMilestone(ms: Milestone) {
    setEditMilestoneId(ms.id);
    setMsForm({ title: ms.title, dueDate: ms.dueDate, status: ms.status, owner: ms.owner, notes: ms.notes });
  }

  async function saveMilestone() {
    if (!msForm.title || !msForm.dueDate) return;
    setSaving(true);
    const isNew = editMilestoneId === 'new';
    const milestones = isNew
      ? [...agent.milestones, { id: crypto.randomUUID(), ...msForm }]
      : agent.milestones.map((ms) => ms.id === editMilestoneId ? { ...ms, ...msForm } : ms);
    const updated = { ...agent, milestones, updatedAt: isoNow() };
    await saveAgent(updated);
    await logActivity({
      agentId: agent.id,
      type: 'milestone_update',
      summary: isNew ? `Milestone added: ${msForm.title}` : `Milestone updated: ${msForm.title}`,
      detail: `Status: ${msForm.status} · Due: ${msForm.dueDate}`,
    });
    onUpdate(updated);
    setEditMilestoneId(null);
    setSaving(false);
  }

  async function deleteMilestone(id: string) {
    const ms = agent.milestones.find((m) => m.id === id);
    const updated = { ...agent, milestones: agent.milestones.filter((m) => m.id !== id), updatedAt: isoNow() };
    await saveAgent(updated);
    await logActivity({ agentId: agent.id, type: 'milestone_update', summary: `Milestone removed: ${ms?.title ?? id}` });
    onUpdate(updated);
  }

  // ── Risk actions ───────────────────────────────────────────────

  function startAddRisk() {
    setEditRiskId('new');
    setRiskForm(blankRisk());
  }

  function startEditRisk(r: Risk) {
    setEditRiskId(r.id);
    setRiskForm({
      description: r.description, severity: r.severity, likelihood: r.likelihood,
      mitigation: r.mitigation, owner: r.owner, status: r.status,
    });
  }

  async function saveRisk() {
    if (!riskForm.description) return;
    setSaving(true);
    const isNew = editRiskId === 'new';
    const risks = isNew
      ? [...agent.risks, { id: crypto.randomUUID(), ...riskForm }]
      : agent.risks.map((r) => r.id === editRiskId ? { ...r, ...riskForm } : r);
    const updated = { ...agent, risks, updatedAt: isoNow() };
    await saveAgent(updated);
    await logActivity({
      agentId: agent.id,
      type: 'risk_update',
      summary: isNew ? `Risk logged: ${riskForm.description.slice(0, 60)}` : `Risk updated: ${riskForm.description.slice(0, 60)}`,
      detail: `Severity: ${riskForm.severity} · Status: ${riskForm.status}`,
    });
    onUpdate(updated);
    setEditRiskId(null);
    setSaving(false);
  }

  async function deleteRisk(id: string) {
    const r = agent.risks.find((x) => x.id === id);
    const updated = { ...agent, risks: agent.risks.filter((x) => x.id !== id), updatedAt: isoNow() };
    await saveAgent(updated);
    await logActivity({ agentId: agent.id, type: 'risk_update', summary: `Risk removed: ${r?.description.slice(0, 60) ?? id}` });
    onUpdate(updated);
  }

  const sortedMilestones = [...agent.milestones].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  function MilestoneFormRow() {
    return (
      <tr className="border-t bg-muted/10">
        <td className="px-2 py-2">
          <FieldSelect
            value={msForm.status}
            onChange={(v) => setMsForm((p) => ({ ...p, status: v as MilestoneStatus }))}
            options={[['not_started','Not Started'],['in_progress','In Progress'],['done','Done'],['missed','Missed'],['deferred','Deferred']]}
          />
        </td>
        <td className="px-2 py-2">
          <FieldInput value={msForm.title} onChange={(v) => setMsForm((p) => ({ ...p, title: v }))} placeholder="Title *" />
        </td>
        <td className="px-2 py-2">
          <input
            type="date"
            value={msForm.dueDate}
            onChange={(e) => setMsForm((p) => ({ ...p, dueDate: e.target.value }))}
            className="h-7 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </td>
        <td className="px-2 py-2">
          <FieldInput value={msForm.owner} onChange={(v) => setMsForm((p) => ({ ...p, owner: v }))} placeholder="Owner" />
        </td>
        <td className="px-2 py-2">
          <FieldInput value={msForm.notes} onChange={(v) => setMsForm((p) => ({ ...p, notes: v }))} placeholder="Notes" />
        </td>
        <td className="px-2 py-2">
          <SaveCancel
            onSave={saveMilestone}
            onCancel={() => setEditMilestoneId(null)}
            disabled={saving || !msForm.title || !msForm.dueDate}
          />
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-5">
      {/* Milestones */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">All Milestones ({agent.milestones.length})</CardTitle>
          {editMilestoneId !== 'new' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={startAddMilestone}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {['Status', 'Title', 'Due Date', 'Owner', 'Notes', ''].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedMilestones.length === 0 && editMilestoneId !== 'new' && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No milestones yet. Click Add to create one.
                  </td>
                </tr>
              )}
              {sortedMilestones.map((ms) =>
                editMilestoneId === ms.id ? (
                  <MilestoneFormRow key={ms.id} />
                ) : (
                  <tr key={ms.id} className="group border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <MilestoneIcon status={ms.status} />
                        <span className="text-xs capitalize">{ms.status.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium">{ms.title}</td>
                    <td className={`px-3 py-2 text-xs whitespace-nowrap ${
                      new Date(ms.dueDate) < new Date() && ms.status !== 'done' ? 'text-red-600 font-medium' : 'text-muted-foreground'
                    }`}>
                      {formatDate(ms.dueDate)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{ms.owner}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">{ms.notes || '—'}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditMilestone(ms)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteMilestone(ms.id)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
              {editMilestoneId === 'new' && <MilestoneFormRow key="new" />}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Risk Register */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Risk Register ({agent.risks.length})</CardTitle>
          {editRiskId !== 'new' && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={startAddRisk}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {agent.risks.length === 0 && editRiskId !== 'new' && (
            <p className="text-sm text-muted-foreground py-2 text-center">No risks yet. Click Add to log one.</p>
          )}

          {agent.risks.map((r) =>
            editRiskId === r.id ? (
              /* Inline risk edit form */
              <div key={r.id} className="p-3 rounded-md border border-brand-accent/30 bg-muted/10 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Description *</label>
                    <textarea
                      value={riskForm.description}
                      onChange={(e) => setRiskForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Describe the risk…"
                      rows={2}
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
                    <FieldSelect
                      value={riskForm.severity}
                      onChange={(v) => setRiskForm((p) => ({ ...p, severity: v as RiskSeverity }))}
                      options={[['low','Low'],['medium','Medium'],['high','High'],['critical','Critical']]}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Likelihood</label>
                    <FieldSelect
                      value={riskForm.likelihood}
                      onChange={(v) => setRiskForm((p) => ({ ...p, likelihood: v as RiskLikelihood }))}
                      options={[['low','Low'],['medium','Medium'],['high','High']]}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                    <FieldSelect
                      value={riskForm.status}
                      onChange={(v) => setRiskForm((p) => ({ ...p, status: v as RiskStatus }))}
                      options={[['open','Open'],['accepted','Accepted'],['mitigated','Mitigated'],['realized','Realized']]}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Owner</label>
                    <FieldInput
                      value={riskForm.owner}
                      onChange={(v) => setRiskForm((p) => ({ ...p, owner: v }))}
                      placeholder="Owner"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Mitigation</label>
                    <textarea
                      value={riskForm.mitigation}
                      onChange={(e) => setRiskForm((p) => ({ ...p, mitigation: e.target.value }))}
                      placeholder="Mitigation plan…"
                      rows={2}
                      className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="h-7 text-xs" onClick={saveRisk} disabled={saving || !riskForm.description}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditRiskId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* Normal risk card */
              <div key={r.id} className={`group p-3 rounded-md border ${RISK_SEVERITY_BG[r.severity]}`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-sm font-medium">{r.description}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-xs font-semibold uppercase ${RISK_SEVERITY_COLOR[r.severity]}`}>{r.severity}</span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="text-xs text-muted-foreground capitalize">{r.likelihood} likelihood</span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className={`text-xs font-medium capitalize ${
                      r.status === 'mitigated' ? 'text-green-600' : r.status === 'realized' ? 'text-red-600' : 'text-muted-foreground'
                    }`}>{r.status}</span>
                    <div className="flex gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditRisk(r)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-black/10 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => deleteRisk(r.id)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground"><strong>Mitigation:</strong> {r.mitigation || '—'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Owner: {r.owner || '—'}</p>
              </div>
            )
          )}

          {/* New risk form */}
          {editRiskId === 'new' && (
            <div className="p-3 rounded-md border border-brand-accent/30 bg-muted/10 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Description *</label>
                  <textarea
                    value={riskForm.description}
                    onChange={(e) => setRiskForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Describe the risk…"
                    rows={2}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
                  <FieldSelect
                    value={riskForm.severity}
                    onChange={(v) => setRiskForm((p) => ({ ...p, severity: v as RiskSeverity }))}
                    options={[['low','Low'],['medium','Medium'],['high','High'],['critical','Critical']]}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Likelihood</label>
                  <FieldSelect
                    value={riskForm.likelihood}
                    onChange={(v) => setRiskForm((p) => ({ ...p, likelihood: v as RiskLikelihood }))}
                    options={[['low','Low'],['medium','Medium'],['high','High']]}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                  <FieldSelect
                    value={riskForm.status}
                    onChange={(v) => setRiskForm((p) => ({ ...p, status: v as RiskStatus }))}
                    options={[['open','Open'],['accepted','Accepted'],['mitigated','Mitigated'],['realized','Realized']]}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Owner</label>
                  <FieldInput
                    value={riskForm.owner}
                    onChange={(v) => setRiskForm((p) => ({ ...p, owner: v }))}
                    placeholder="Owner"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Mitigation</label>
                  <textarea
                    value={riskForm.mitigation}
                    onChange={(e) => setRiskForm((p) => ({ ...p, mitigation: e.target.value }))}
                    placeholder="Mitigation plan…"
                    rows={2}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-7 text-xs" onClick={saveRisk} disabled={saving || !riskForm.description}>
                  Save
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditRiskId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
