'use client';

import { useState } from 'react';
import type { MeasuredOutcome, ROITarget } from '@/lib/types';
import { evaluateFormula } from '@/lib/formula-parser';
import { generateId, isoDate, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Props = {
  target: ROITarget;
  onSave: (outcome: MeasuredOutcome) => void;
  onCancel: () => void;
};

export function OutcomeForm({ target, onSave, onCancel }: Props) {
  const [measuredAt, setMeasuredAt] = useState(isoDate());
  const [measuredValue, setMeasuredValue] = useState('');
  const [overrideMonetized, setOverrideMonetized] = useState(false);
  const [manualMonetized, setManualMonetized] = useState('');
  const [source, setSource] = useState('');
  const [dataExportVersion, setDataExportVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [validatedBy, setValidatedBy] = useState('');

  const mv = parseFloat(measuredValue) || 0;

  let computedMonetized: number | null = null;
  let formulaError = '';
  try {
    if (target.monetizationFormula && measuredValue) {
      computedMonetized = evaluateFormula(
        target.monetizationFormula,
        target.monetizationParams,
        mv
      );
    }
  } catch (e) {
    formulaError = (e as Error).message;
  }

  const effectiveMonetized = overrideMonetized
    ? parseFloat(manualMonetized) || 0
    : (computedMonetized ?? 0);

  function handleSave() {
    if (!measuredValue || !source.trim()) return;
    const outcome: MeasuredOutcome = {
      id: generateId(),
      roiTargetId: target.id,
      measuredAt,
      measuredValue: mv,
      monetizedValue: effectiveMonetized,
      source: source.trim(),
      dataExportVersion: dataExportVersion.trim() || undefined,
      notes: notes.trim(),
      validatedBy: validatedBy.trim() || undefined,
    };
    onSave(outcome);
  }

  const canSave = measuredValue && source.trim() && !formulaError;

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium">Target:</span> {target.metric}{' '}
        <span className="ml-2 font-medium">Unit:</span> {target.unit}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Measured Date">
          <input
            type="date"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
        <Field label={`Measured Value (${target.unit})`}>
          <input
            type="number"
            value={measuredValue}
            onChange={(e) => setMeasuredValue(e.target.value)}
            placeholder="0"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
      </div>

      {/* Monetized value */}
      <div className="space-y-2 border rounded-md p-3 bg-muted/10">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Monetized Value</p>
          {computedMonetized !== null && !formulaError && (
            <span className="text-xs text-green-600 font-medium">
              Formula: {formatCurrency(computedMonetized)}
            </span>
          )}
          {formulaError && (
            <span className="text-xs text-destructive">{formulaError}</span>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={overrideMonetized}
            onChange={(e) => setOverrideMonetized(e.target.checked)}
            className="h-4 w-4 accent-brand-accent"
          />
          <span className="text-xs text-muted-foreground">Override computed value</span>
        </label>
        {overrideMonetized && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              type="number"
              value={manualMonetized}
              onChange={(e) => setManualMonetized(e.target.value)}
              placeholder="0"
              className="h-9 w-full rounded-md border border-input bg-background pl-6 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}
        <p className="text-xs font-medium">
          Recording: <span className="text-green-600">{formatCurrency(effectiveMonetized)}</span>
        </p>
      </div>

      <Field label="Source *" hint="Data source or report this measurement came from">
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. Salesforce Weekly Activity Report Q2-2025"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Data Export Version" hint="Optional: version/date stamp of source data">
          <input
            value={dataExportVersion}
            onChange={(e) => setDataExportVersion(e.target.value)}
            placeholder="e.g. 2025-05-01"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
        <Field label="Validated By" hint="Optional: who validated this measurement">
          <input
            value={validatedBy}
            onChange={(e) => setValidatedBy(e.target.value)}
            placeholder="e.g. Sarah Chen, Finance"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any caveats, methodology notes, or context for this measurement…"
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </Field>

      <div className="flex gap-3 pt-2 border-t">
        <Button onClick={handleSave} disabled={!canSave}>Record Outcome</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
