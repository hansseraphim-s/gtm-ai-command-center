'use client';

import { useState } from 'react';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import type {
  DataFeasibilityAssessment,
  DataSourceRequirement,
  DataAvailability,
  PiiRisk,
} from '@/lib/types';
import { generateId, isoNow, isoDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const AVAILABILITY_OPTIONS: [DataAvailability, string][] = [
  ['available', 'Available'],
  ['partial', 'Partial'],
  ['unavailable', 'Unavailable'],
  ['unknown', 'Unknown'],
];

const PII_OPTIONS: [PiiRisk, string][] = [
  ['none', 'None'],
  ['low', 'Low'],
  ['high', 'High'],
];

type Props = {
  agentId: string;
  initial?: DataFeasibilityAssessment;
  onSave: (assessment: DataFeasibilityAssessment) => Promise<void>;
};

function emptySource(): DataSourceRequirement {
  return {
    id: generateId(),
    sourceName: '',
    systemOwner: '',
    dataAvailability: 'unknown',
    dataQuality: 3,
    accessGranted: false,
    piiRisk: 'none',
  };
}

function emptyAssessment(agentId: string): DataFeasibilityAssessment {
  return {
    agentId,
    cdioPartner: '',
    assessedAt: isoNow(),
    cdioSignedOff: false,
    requiredDataSources: [emptySource()],
    overallReadiness: 3,
    gapSummary: '',
    notes: '',
  };
}

export function DataFeasibilityForm({ agentId, initial, onSave }: Props) {
  const [form, setForm] = useState<DataFeasibilityAssessment>(
    initial ?? emptyAssessment(agentId)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof DataFeasibilityAssessment>(
    key: K,
    value: DataFeasibilityAssessment[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateSource<K extends keyof DataSourceRequirement>(
    idx: number,
    key: K,
    value: DataSourceRequirement[K]
  ) {
    setForm((prev) => ({
      ...prev,
      requiredDataSources: prev.requiredDataSources.map((s, i) =>
        i === idx ? { ...s, [key]: value } : s
      ),
    }));
  }

  function addSource() {
    setForm((prev) => ({
      ...prev,
      requiredDataSources: [...prev.requiredDataSources, emptySource()],
    }));
  }

  function removeSource(idx: number) {
    setForm((prev) => ({
      ...prev,
      requiredDataSources: prev.requiredDataSources.filter((_, i) => i !== idx),
    }));
  }

  async function handleSave() {
    setSaving(true);
    await onSave({ ...form, assessedAt: isoNow() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const QUALITY_LABELS: Record<number, string> = {
    1: 'Very Poor', 2: 'Poor', 3: 'Moderate', 4: 'Good', 5: 'Excellent',
  };

  const AVAILABILITY_COLOR: Record<DataAvailability, string> = {
    available: 'text-green-600', partial: 'text-amber-600',
    unavailable: 'text-red-600', unknown: 'text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      {/* Header fields */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="CDIO Partner *">
          <input
            value={form.cdioPartner}
            onChange={(e) => update('cdioPartner', e.target.value)}
            placeholder="e.g. Raj Patel, CDIO"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>
        <Field label="Overall Readiness">
          <select
            value={form.overallReadiness}
            onChange={(e) => update('overallReadiness', parseInt(e.target.value) as 1|2|3|4|5)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {[1,2,3,4,5].map((n) => (
              <option key={n} value={n}>{n} — {QUALITY_LABELS[n]}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.cdioSignedOff}
            onChange={(e) => {
              update('cdioSignedOff', e.target.checked);
              if (e.target.checked) update('cdioSignOffDate', isoNow());
            }}
            className="h-4 w-4 rounded border-input accent-brand-accent"
          />
          <span className="text-sm font-medium">CDIO Signed Off</span>
        </label>
        {form.cdioSignedOff && (
          <Field label="Sign-off Date">
            <input
              type="date"
              value={(form.cdioSignOffDate ?? isoDate()).slice(0, 10)}
              onChange={(e) => update('cdioSignOffDate', e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
        )}
      </div>

      {/* Data sources */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Required Data Sources</h4>
          <button
            type="button"
            onClick={addSource}
            className="flex items-center gap-1 text-xs text-brand-accent hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />Add source
          </button>
        </div>

        {form.requiredDataSources.map((src, idx) => (
          <div key={src.id} className="border rounded-md p-4 space-y-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Source {idx + 1}
              </span>
              {form.requiredDataSources.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSource(idx)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Source / System Name">
                <input
                  value={src.sourceName}
                  onChange={(e) => updateSource(idx, 'sourceName', e.target.value)}
                  placeholder="e.g. Salesforce CRM"
                  className="h-8 w-full rounded border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </Field>
              <Field label="System Owner">
                <input
                  value={src.systemOwner}
                  onChange={(e) => updateSource(idx, 'systemOwner', e.target.value)}
                  placeholder="e.g. Sales Ops"
                  className="h-8 w-full rounded border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </Field>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <Field label="Availability">
                <select
                  value={src.dataAvailability}
                  onChange={(e) => updateSource(idx, 'dataAvailability', e.target.value as DataAvailability)}
                  className={`h-8 w-full rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${AVAILABILITY_COLOR[src.dataAvailability]}`}
                >
                  {AVAILABILITY_OPTIONS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Quality (1-5)">
                <select
                  value={src.dataQuality}
                  onChange={(e) => updateSource(idx, 'dataQuality', parseInt(e.target.value) as 1|2|3|4|5)}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="PII Risk">
                <select
                  value={src.piiRisk}
                  onChange={(e) => updateSource(idx, 'piiRisk', e.target.value as PiiRisk)}
                  className="h-8 w-full rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {PII_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={src.accessGranted}
                    onChange={(e) => updateSource(idx, 'accessGranted', e.target.checked)}
                    className="h-3.5 w-3.5 accent-brand-accent"
                  />
                  <span className="text-xs">Access granted</span>
                </label>
              </div>
            </div>

            {/* Gap fields — shown when not fully available */}
            {src.dataAvailability !== 'available' && (
              <div className="space-y-2 pt-1 border-t">
                <Field label="Gap Description">
                  <input
                    value={src.gapDescription ?? ''}
                    onChange={(e) => updateSource(idx, 'gapDescription', e.target.value)}
                    placeholder="Describe the data gap"
                    className="h-8 w-full rounded border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Closure Action">
                    <input
                      value={src.closureAction ?? ''}
                      onChange={(e) => updateSource(idx, 'closureAction', e.target.value)}
                      placeholder="e.g. Negotiate API access"
                      className="h-8 w-full rounded border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </Field>
                  <Field label="Closure Owner">
                    <input
                      value={src.closureOwner ?? ''}
                      onChange={(e) => updateSource(idx, 'closureOwner', e.target.value)}
                      placeholder="e.g. IT Lead"
                      className="h-8 w-full rounded border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </Field>
                  <Field label="Closure Date">
                    <input
                      type="date"
                      value={src.closureDate ?? ''}
                      onChange={(e) => updateSource(idx, 'closureDate', e.target.value)}
                      className="h-8 w-full rounded border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom fields */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Gap Summary">
          <textarea
            value={form.gapSummary}
            onChange={(e) => update('gapSummary', e.target.value)}
            placeholder="Overall summary of data gaps and closure plan"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </Field>
        <div className="space-y-3">
          <Field label="Estimated Gap Closure Date">
            <input
              type="date"
              value={(form.estimatedGapClosureDate ?? '').slice(0, 10)}
              onChange={(e) => update('estimatedGapClosureDate', e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Additional context for CDIO partnership"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t">
        <Button onClick={handleSave} disabled={saving || !form.cdioPartner.trim()}>
          {saving ? 'Saving…' : 'Save CDIO Assessment'}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />Saved
          </span>
        )}
        {!form.cdioPartner.trim() && (
          <span className="text-xs text-muted-foreground">CDIO Partner name required</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
