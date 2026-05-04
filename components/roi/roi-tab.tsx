'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import type {
  Agent,
  ROITarget,
  MeasuredOutcome,
  ROIAuditEntry,
  ROIMethodology,
} from '@/lib/types';
import {
  saveAgent,
  appendROIAuditEntry,
  getROIAuditLogForAgent,
  getROIMethodologiesForAgent,
  saveROIMethodology,
} from '@/lib/storage';
import { logActivity } from '@/lib/activity';
import { computeAgentROI, computeCommittedValue } from '@/lib/roi-engine';
import { generateId, isoNow, formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TargetForm } from './target-form';
import { OutcomeForm } from './outcome-form';
import { AuditLogView } from './audit-log-view';

const CATEGORY_LABELS: Record<string, string> = {
  sga_efficiency: 'SG&A Efficiency',
  revenue_acceleration: 'Revenue Acceleration',
  capacity_creation: 'Capacity Creation',
  quality_uplift: 'Quality Uplift',
};

type Panel = 'target-form' | 'outcome-form' | null;

type Props = {
  agent: Agent;
  onUpdate: (updated: Agent) => void;
};

export function RoiTab({ agent, onUpdate }: Props) {
  const [auditLog, setAuditLog] = useState<ROIAuditEntry[]>([]);
  const [methodologies, setMethodologies] = useState<ROIMethodology[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [editingTarget, setEditingTarget] = useState<ROITarget | null>(null);
  const [outcomeTargetId, setOutcomeTargetId] = useState<string | null>(null);
  const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());
  const [showAudit, setShowAudit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getROIAuditLogForAgent(agent.id),
      getROIMethodologiesForAgent(agent.id),
    ]).then(([log, methods]) => {
      setAuditLog(log);
      setMethodologies(methods);
    });
  }, [agent.id]);

  const roi = (() => {
    try { return computeAgentROI(agent); } catch { return null; }
  })();

  async function appendAudit(entry: Omit<ROIAuditEntry, 'id' | 'changedAt'>) {
    const e: ROIAuditEntry = { ...entry, id: generateId(), changedAt: isoNow() };
    await appendROIAuditEntry(e);
    setAuditLog((prev) => [...prev, e]);
  }

  async function updateAgent(updated: Agent) {
    await saveAgent(updated);
    onUpdate(updated);
  }

  // ── Target actions ────────────────────────────────────────────

  function openAddTarget() {
    setEditingTarget(null);
    setPanel('target-form');
  }

  function openEditTarget(t: ROITarget) {
    setEditingTarget(t);
    setPanel('target-form');
  }

  async function handleTargetSave(target: ROITarget) {
    const isEdit = agent.roiTargets.some((t) => t.id === target.id);
    const updated: Agent = {
      ...agent,
      roiTargets: isEdit
        ? agent.roiTargets.map((t) => (t.id === target.id ? target : t))
        : [...agent.roiTargets, target],
      updatedAt: isoNow(),
    };
    await updateAgent(updated);
    await appendAudit({
      agentId: agent.id,
      roiTargetId: target.id,
      changedBy: 'User',
      changeType: isEdit ? 'target_updated' : 'target_created',
      rationale: isEdit ? `Updated target: ${target.metric}` : `Created target: ${target.metric}`,
    });
    await logActivity({
      agentId: agent.id,
      type: 'roi_update',
      summary: isEdit ? `ROI target updated: ${target.metric}` : `ROI target created: ${target.metric}`,
      detail: target.cfoApproved ? 'CFO approved' : undefined,
    });
    if (target.cfoApproved && (!editingTarget?.cfoApproved)) {
      await appendAudit({
        agentId: agent.id,
        roiTargetId: target.id,
        changedBy: 'User',
        changeType: 'cfo_approved',
        rationale: `CFO approval marked for ${target.metric}`,
      });
    }
    setPanel(null);
    setEditingTarget(null);
  }

  async function handleDeleteTarget(targetId: string) {
    const updated: Agent = {
      ...agent,
      roiTargets: agent.roiTargets.filter((t) => t.id !== targetId),
      measuredOutcomes: agent.measuredOutcomes.filter((o) => o.roiTargetId !== targetId),
      updatedAt: isoNow(),
    };
    await updateAgent(updated);
    await appendAudit({
      agentId: agent.id,
      roiTargetId: targetId,
      changedBy: 'User',
      changeType: 'target_updated',
      rationale: 'Target deleted',
    });
    setDeleteConfirm(null);
  }

  async function toggleCfoApproval(target: ROITarget) {
    const next = !target.cfoApproved;
    const updated: Agent = {
      ...agent,
      roiTargets: agent.roiTargets.map((t) =>
        t.id === target.id
          ? { ...t, cfoApproved: next, approvedDate: next ? isoNow() : undefined }
          : t
      ),
      updatedAt: isoNow(),
    };
    await updateAgent(updated);
    if (next) {
      await appendAudit({
        agentId: agent.id,
        roiTargetId: target.id,
        changedBy: 'User',
        changeType: 'cfo_approved',
        rationale: `CFO approval granted for: ${target.metric}`,
      });
      await logActivity({
        agentId: agent.id,
        type: 'roi_update',
        summary: `CFO approval granted: ${target.metric}`,
        detail: 'ROI methodology marked as CFO-approved',
      });
    }
  }

  // ── Outcome actions ───────────────────────────────────────────

  function openRecordOutcome(targetId: string) {
    setOutcomeTargetId(targetId);
    setPanel('outcome-form');
    setExpandedTargets((prev) => new Set([...prev, targetId]));
  }

  async function handleOutcomeSave(outcome: MeasuredOutcome) {
    const updated: Agent = {
      ...agent,
      measuredOutcomes: [...agent.measuredOutcomes, outcome],
      updatedAt: isoNow(),
    };
    await updateAgent(updated);
    await appendAudit({
      agentId: agent.id,
      roiTargetId: outcome.roiTargetId,
      measuredOutcomeId: outcome.id,
      changedBy: outcome.validatedBy ?? 'User',
      changeType: 'outcome_recorded',
      newValue: formatCurrency(outcome.monetizedValue),
      rationale: `Outcome recorded from ${outcome.source}`,
    });
    await logActivity({
      agentId: agent.id,
      type: 'roi_update',
      summary: `Outcome recorded: ${formatCurrency(outcome.monetizedValue, true)} monetized value`,
      detail: `Source: ${outcome.source}${outcome.validatedBy ? ` · Validated by ${outcome.validatedBy}` : ''}`,
    });
    setPanel(null);
    setOutcomeTargetId(null);
  }

  async function handleChallengeOutcome(outcome: MeasuredOutcome, note: string) {
    const updated: Agent = {
      ...agent,
      measuredOutcomes: agent.measuredOutcomes.map((o) =>
        o.id === outcome.id
          ? { ...o, challengedBy: 'CFO', challengeNote: note }
          : o
      ),
      updatedAt: isoNow(),
    };
    await updateAgent(updated);
    await appendAudit({
      agentId: agent.id,
      measuredOutcomeId: outcome.id,
      changedBy: 'CFO',
      changeType: 'outcome_challenged',
      rationale: note,
    });
  }

  function toggleTarget(id: string) {
    setExpandedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const outcomeTarget = outcomeTargetId
    ? agent.roiTargets.find((t) => t.id === outcomeTargetId) ?? null
    : null;

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      {roi && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Committed Annual" value={roi.committedValue > 0 ? formatCurrency(roi.committedValue) : '—'} />
          <StatCard
            label="Measured to Date"
            value={roi.measuredValue > 0 ? formatCurrency(roi.measuredValue) : '—'}
            valueClass={roi.measuredValue > 0 ? 'text-green-600' : ''}
          />
          <StatCard
            label="Variance"
            value={roi.committedValue > 0 && roi.measuredValue > 0
              ? `${roi.variancePct >= 0 ? '+' : ''}${roi.variancePct.toFixed(1)}%`
              : '—'}
            valueClass={roi.variancePct >= 0 ? 'text-green-600' : 'text-red-600'}
          />
          <StatCard
            label="YE Trajectory"
            value={roi.trajectoryProjection > 0 ? formatCurrency(roi.trajectoryProjection) : '—'}
            icon={<TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />}
          />
        </div>
      )}

      {/* Inline panel: target form */}
      {panel === 'target-form' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{editingTarget ? 'Edit ROI Target' : 'New ROI Target'}</CardTitle>
          </CardHeader>
          <CardContent>
            <TargetForm
              initial={editingTarget ?? undefined}
              agentId={agent.id}
              onSave={handleTargetSave}
              onCancel={() => { setPanel(null); setEditingTarget(null); }}
            />
          </CardContent>
        </Card>
      )}

      {/* Inline panel: outcome form */}
      {panel === 'outcome-form' && outcomeTarget && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Record Measured Outcome</CardTitle>
          </CardHeader>
          <CardContent>
            <OutcomeForm
              target={outcomeTarget}
              onSave={handleOutcomeSave}
              onCancel={() => { setPanel(null); setOutcomeTargetId(null); }}
            />
          </CardContent>
        </Card>
      )}

      {/* Targets section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            ROI Targets ({agent.roiTargets.length})
          </h3>
          {panel !== 'target-form' && (
            <Button size="sm" onClick={openAddTarget}>
              <Plus className="h-4 w-4 mr-1.5" />Add Target
            </Button>
          )}
        </div>

        {agent.roiTargets.length === 0 ? (
          <div className="border rounded-md py-10 text-center">
            <p className="text-sm text-muted-foreground">No ROI targets defined yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a target to track committed and measured value.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {agent.roiTargets.map((target) => {
              const outcomes = agent.measuredOutcomes.filter((o) => o.roiTargetId === target.id);
              const expanded = expandedTargets.has(target.id);
              let committedVal = 0;
              try { committedVal = computeCommittedValue(target); } catch { /* */ }
              const measuredSum = outcomes.reduce((s, o) => s + o.monetizedValue, 0);
              const isKillBreached =
                target.killThreshold !== undefined && measuredSum > 0 && measuredSum < target.killThreshold;

              return (
                <Card
                  key={target.id}
                  className={isKillBreached ? 'border-red-300' : ''}
                >
                  {/* Target header */}
                  <div
                    className="flex items-start gap-2 px-4 pt-4 pb-3 cursor-pointer"
                    onClick={() => toggleTarget(target.id)}
                  >
                    <button type="button" className="mt-0.5 shrink-0">
                      {expanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {CATEGORY_LABELS[target.category] ?? target.category}
                        </span>
                        {target.cfoApproved && (
                          <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />CFO Approved
                          </span>
                        )}
                        {isKillBreached && (
                          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                            <AlertCircle className="h-3.5 w-3.5" />Below kill threshold
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold mt-1">{target.metric}</p>
                      <p className="text-xs text-muted-foreground">
                        Target: {target.targetValue} {target.unit} by {formatDate(target.targetDate)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Committed</p>
                      <p className="text-sm font-bold">{committedVal > 0 ? formatCurrency(committedVal) : '—'}</p>
                      {measuredSum > 0 && (
                        <p className="text-xs text-green-600 font-medium">{formatCurrency(measuredSum)} measured</p>
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expanded && (
                    <div className="border-t px-4 pb-4 space-y-4 pt-3">
                      {/* Target details */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <Row label="Baseline" value={`${target.baselineValue} ${target.unit}`} />
                        <Row label="Target" value={`${target.targetValue} ${target.unit}`} />
                        <Row label="Measurement" value={target.measurementMethod} />
                        {target.controlCohort && <Row label="Control Cohort" value={target.controlCohort} />}
                        {target.killThreshold && (
                          <Row label="Kill Threshold" value={formatCurrency(target.killThreshold)} />
                        )}
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Formula: </span>
                          <code className="font-mono text-[11px] bg-muted px-1 rounded">
                            {target.monetizationFormula}
                          </code>
                        </div>
                        {Object.entries(target.monetizationParams).length > 0 && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Params: </span>
                            <span className="font-mono text-[11px]">
                              {Object.entries(target.monetizationParams)
                                .map(([k, v]) => `${k}=${v}`)
                                .join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Measured outcomes */}
                      {outcomes.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Measured Outcomes ({outcomes.length})
                          </p>
                          <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/30 border-b">
                                <tr>
                                  {['Date', 'Value', 'Monetized', 'Source', 'Validated By', ''].map((h) => (
                                    <th key={h} className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[...outcomes]
                                  .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
                                  .map((o) => (
                                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/20">
                                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(o.measuredAt)}</td>
                                      <td className="px-3 py-2">{o.measuredValue} {target.unit}</td>
                                      <td className="px-3 py-2 font-medium text-green-600">{formatCurrency(o.monetizedValue)}</td>
                                      <td className="px-3 py-2 max-w-[120px] truncate" title={o.source}>{o.source}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{o.validatedBy ?? '—'}</td>
                                      <td className="px-3 py-2">
                                        {o.challengedBy ? (
                                          <span className="text-orange-600 font-medium">Challenged</span>
                                        ) : (
                                          <button
                                            className="text-muted-foreground hover:text-orange-600 text-[10px] underline"
                                            onClick={() => {
                                              const note = prompt('Challenge reason (will be logged):');
                                              if (note) handleChallengeOutcome(o, note);
                                            }}
                                          >
                                            Challenge
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRecordOutcome(target.id)}
                          disabled={panel !== null}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />Record Outcome
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleCfoApproval(target)}
                        >
                          {target.cfoApproved ? 'Revoke CFO Approval' : 'Mark CFO Approved'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditTarget(target)}
                          disabled={panel !== null}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />Edit
                        </Button>
                        {deleteConfirm === target.id ? (
                          <>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteTarget(target.id)}>
                              Confirm Delete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <button
                            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteConfirm(target.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Methodology section */}
      {methodologies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Methodologies ({methodologies.length})</h3>
          <div className="space-y-2">
            {methodologies.map((m) => (
              <Card key={m.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs">
                      v{m.version} · {agent.roiTargets.find((t) => t.id === m.roiTargetId)?.metric ?? m.roiTargetId}
                    </CardTitle>
                    <span className="text-[10px] text-muted-foreground">{formatDate(m.updatedAt)}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Baseline: </span>
                    {m.baselineMeasurementApproach}
                  </div>
                  {m.keyAssumptions.length > 0 && (
                    <div>
                      <span className="text-muted-foreground font-medium">Assumptions: </span>
                      <ul className="list-disc list-inside space-y-0.5 mt-0.5">
                        {m.keyAssumptions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                  {m.signOffChain.length > 0 && (
                    <div>
                      <span className="text-muted-foreground font-medium">Sign-offs: </span>
                      {m.signOffChain.map((s) => (
                        <span key={s.name} className="inline-flex items-center gap-1 ml-1.5 text-blue-600">
                          <CheckCircle2 className="h-3 w-3" />{s.name} ({s.role})
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Audit log */}
      <div className="space-y-2">
        <button
          className="flex items-center gap-2 text-sm font-semibold hover:text-brand-accent transition-colors"
          onClick={() => setShowAudit((v) => !v)}
        >
          {showAudit ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Audit Log ({auditLog.length} entries)
        </button>
        {showAudit && (
          <Card>
            <CardContent className="pt-4">
              <AuditLogView entries={auditLog} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass = '',
  icon,
}: {
  label: string;
  value: string;
  valueClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-1.5 mb-1">
          {icon}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p className={`text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
