'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ROITarget, ROICategory, ROIUnit } from '@/lib/types';
import { evaluateFormula } from '@/lib/formula-parser';
import { generateId, isoDate, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const CATEGORIES: [ROICategory, string][] = [
  ['sga_efficiency', 'SG&A Efficiency'],
  ['revenue_acceleration', 'Revenue Acceleration'],
  ['capacity_creation', 'Capacity Creation'],
  ['quality_uplift', 'Quality Uplift'],
];

const UNITS: [ROIUnit, string][] = [
  ['hours', 'Hours'],
  ['usd', 'USD'],
  ['percentage', 'Percentage'],
  ['count', 'Count'],
  ['days', 'Days'],
];

type KV = { key: string; value: string };

type Props = {
  initial?: ROITarget;
  agentId: string;
  onSave: (target: ROITarget) => void;
  onCancel: () => void;
};

function kvFromRecord(r: Record<string, number>): KV[] {
  return Object.entries(r).map(([key, value]) => ({ key, value: String(value) }));
}

function kvToRecord(kvs: KV[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { key, value } of kvs) {
    if (key.trim()) out[key.trim()] = parseFloat(value) || 0;
  }
  return out;
}

export function TargetForm({ initial, agentId: _agentId, onSave, onCancel }: Props) {
  const [category, setCategory] = useState<ROICategory>(initial?.category ?? 'sga_efficiency');
  const [metric, setMetric] = useState(initial?.metric ?? '');
  const [unit, setUnit] = useState<ROIUnit>(initial?.unit ?? 'usd');
  const [baselineValue, setBaselineValue] = useState(String(initial?.baselineValue ?? '0'));
  const [targetValue, setTargetValue] = useState(String(initial?.targetValue ?? '0'));
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? isoDate());
  const [formula, setFormula] = useState(initial?.monetizationFormula ?? '');
  const [params, setParams] = useState<KV[]>(
    initial ? kvFromRecord(initial.monetizationParams) : [{ key: '', value: '' }]
  );
  const [controlCohort, setControlCohort] = useState(initial?.controlCohort ?? '');
  const [measurementMethod, setMeasurementMethod] = useState(initial?.measurementMethod ?? '');
  const [killThreshold, setKillThreshold] = useState(String(initial?.killThreshold ?? ''));
  const [cfoApproved, setCfoApproved] = useState(initial?.cfoApproved ?? false);
  const [formulaError, setFormulaError] = useState('');

  function addParam() {
    setParams((p) => [...p, { key: '', value: '' }]);
  }
  function removeParam(i: number) {
    setParams((p) => p.filter((_, idx) => idx !== i));
  }
  function setParam(i: number, field: 'key' | 'value', val: string) {
    setParams((p) => p.map((kv, idx) => (idx === i ? { ...kv, [field]: val } : kv)));
  }

  const paramRecord = kvToRecord(params);

  let formulaResult: number | null = null;
  try {
    if (formula.trim()) {
      formulaResult = evaluateFormula(formula, paramRecord, parseFloat(targetValue) || 0);
      if (formulaError) setFormulaError('');
    }
  } catch (err) {
    if (!formulaError) setFormulaError((err as Error).message);
  }

  function handleSubmit() {
    if (!metric.trim() || !formula.trim() || !measurementMethod.trim()) return;
    const target: ROITarget = {
      id: initial?.id ?? generateId(),
      category,
      metric: metric.trim(),
      unit,
      baselineValue: parseFloat(baselineValue) || 0,
      targetValue: parseFloat(targetValue) || 0,
      targetDate,
      monetizationFormula: formula.trim(),
      monetizationParams: paramRecord,
      controlCohort: controlCohort.trim() || undefined,
      measurementMethod: measurementMethod.trim(),
      killThreshold: killThreshold ? parseFloat(killThreshold) : undefined,
      cfoApproved,
      approvedDate: cfoApproved ? (initial?.approvedDate ?? new Date().toISOString()) : undefined,
    };
    onSave(target);
  }

  const canSave = metric.trim() && formula.trim() && measurementMethod.trim() && !formulaError;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ROICategory)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Unit">
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as ROIUnit)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Metric *" hint="What is being measured?">
        <input
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          placeholder="e.g. Hours saved per rep per week"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Baseline">
          <input
            type="number"
            value={baselineValue}
            onChange={(e) => setBaselineValue(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
        <Field label="Target">
          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
        <Field label="Target Date">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
      </div>

      {/* Monetization formula */}
      <div className="space-y-2 border rounded-md p-3 bg-muted/20">
        <p className="text-sm font-medium">Monetization Formula</p>
        <p className="text-xs text-muted-foreground">
          Safe expression using param variables + <code className="font-mono bg-muted px-1 rounded text-[11px]">target_value</code>.
          Supports <code className="font-mono bg-muted px-1 rounded text-[11px]">+ - * / ( )</code>.
        </p>
        <input
          value={formula}
          onChange={(e) => { setFormula(e.target.value); setFormulaError(''); }}
          placeholder="e.g. target_value * hourly_rate * 50"
          className="h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {formulaError && <p className="text-xs text-destructive">{formulaError}</p>}
        {formulaResult !== null && !formulaError && (
          <p className="text-xs text-green-600">
            Preview (using target value): {formatCurrency(formulaResult)}
          </p>
        )}

        {/* Params editor */}
        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-medium text-muted-foreground">Parameters</p>
          {params.map((kv, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={kv.key}
                onChange={(e) => setParam(i, 'key', e.target.value)}
                placeholder="variable_name"
                className="h-8 flex-1 rounded border border-input bg-background px-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-muted-foreground text-xs">=</span>
              <input
                type="number"
                value={kv.value}
                onChange={(e) => setParam(i, 'value', e.target.value)}
                placeholder="0"
                className="h-8 w-28 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => removeParam(i)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addParam}
            className="flex items-center gap-1 text-xs text-brand-accent hover:underline"
          >
            <Plus className="h-3 w-3" />Add parameter
          </button>
        </div>
      </div>

      <Field label="Measurement Method *" hint="How will this metric be measured? Data source and methodology.">
        <textarea
          value={measurementMethod}
          onChange={(e) => setMeasurementMethod(e.target.value)}
          placeholder="e.g. Weekly Salesforce report comparing rep activity before/after agent deployment"
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Control Cohort" hint="Optional: comparison group definition">
          <input
            value={controlCohort}
            onChange={(e) => setControlCohort(e.target.value)}
            placeholder="e.g. Reps in non-rollout regions"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
        <Field label="Kill Threshold ($)" hint="Optional: trigger review if measured value falls below">
          <input
            type="number"
            value={killThreshold}
            onChange={(e) => setKillThreshold(e.target.value)}
            placeholder="e.g. 500000"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={cfoApproved}
          onChange={(e) => setCfoApproved(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-brand-accent"
        />
        <span className="text-sm font-medium">CFO approved</span>
      </label>

      <div className="flex gap-3 pt-2 border-t">
        <Button onClick={handleSubmit} disabled={!canSave}>
          {initial ? 'Update Target' : 'Add Target'}
        </Button>
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
