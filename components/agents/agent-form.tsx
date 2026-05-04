'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import type {
  Agent, AgentFunction, AgentType, AgentTier, AgentStage, BuildBuyDecision,
} from '@/lib/types';
import { generateId, isoNow } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type FormState = {
  code: string;
  name: string;
  description: string;
  function: AgentFunction;
  type: AgentType;
  tier: AgentTier;
  stage: AgentStage;
  buildBuyDecision: BuildBuyDecision;
  vendor: string;
  owner: string;
  ownerFunction: string;
  cdioPartner: string;
  startDate: string;
  pilotStartDate: string;
  productionDate: string;
  killDate: string;
  killReason: string;
  budgetYear1: string;
  budgetYear2: string;
  budgetYear3: string;
  strategicAlignmentScore: string;
  timeToValueScore: string;
  tags: string;
  notes: string;
};

type Props = {
  initial?: Agent;
  onSave: (agent: Agent) => Promise<void>;
  onCancel: () => void;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

function toFormState(a?: Agent): FormState {
  return {
    code: a?.code ?? '',
    name: a?.name ?? '',
    description: a?.description ?? '',
    function: a?.function ?? 'sales',
    type: a?.type ?? 'predictive',
    tier: a?.tier ?? 'tier_1_quick_win',
    stage: a?.stage ?? 'idea',
    buildBuyDecision: a?.buildBuyDecision ?? 'tbd',
    vendor: a?.vendor ?? '',
    owner: a?.owner ?? '',
    ownerFunction: a?.ownerFunction ?? '',
    cdioPartner: a?.cdioPartner ?? '',
    startDate: a?.startDate ?? '',
    pilotStartDate: a?.pilotStartDate ?? '',
    productionDate: a?.productionDate ?? '',
    killDate: a?.killDate ?? '',
    killReason: a?.killReason ?? '',
    budgetYear1: a?.budgetYear1 ? String(a.budgetYear1) : '',
    budgetYear2: a?.budgetYear2 ? String(a.budgetYear2) : '',
    budgetYear3: a?.budgetYear3 ? String(a.budgetYear3) : '',
    strategicAlignmentScore: a?.strategicAlignmentScore ? String(a.strategicAlignmentScore) : '',
    timeToValueScore: a?.timeToValueScore ? String(a.timeToValueScore) : '',
    tags: a?.tags.join(', ') ?? '',
    notes: a?.notes ?? '',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, required, children, hint, className }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string; className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SelectField({ label, required, value, onChange, options, hint }: {
  label: string; required?: boolean; value: string;
  onChange: (v: string) => void; options: [string, string][]; hint?: string;
}) {
  return (
    <Field label={label} required={required} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  );
}

function ScoreSelect({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <SelectField label={label} value={value} onChange={onChange} hint={hint}
      options={[['','Not scored'],['1','1 — Low'],['2','2'],['3','3 — Medium'],['4','4'],['5','5 — High']]}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentForm({ initial, onSave, onCancel }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(toFormState(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormState) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  function validateStep(s: number): boolean {
    const errs: typeof errors = {};
    if (s === 1) {
      if (!form.code.trim()) errs.code = 'Required';
      if (!form.name.trim()) errs.name = 'Required';
      if (!form.description.trim()) errs.description = 'Required';
    }
    if (s === 2) {
      if (!form.owner.trim()) errs.owner = 'Required';
      if (!form.startDate) errs.startDate = 'Required';
    }
    if (s === 3) {
      if (!form.budgetYear1 || isNaN(Number(form.budgetYear1)) || Number(form.budgetYear1) < 0)
        errs.budgetYear1 = 'Must be a non-negative number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() { if (validateStep(step)) setStep((s) => Math.min(s + 1, 3)); }
  function back() { setStep((s) => Math.max(s - 1, 1)); }

  async function handleSave() {
    if (!validateStep(3)) return;
    const now = isoNow();
    const agent: Agent = {
      id: initial?.id ?? generateId(),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim(),
      function: form.function,
      type: form.type,
      tier: form.tier,
      stage: form.stage,
      buildBuyDecision: form.buildBuyDecision,
      vendor: form.vendor.trim() || undefined,
      owner: form.owner.trim(),
      ownerFunction: form.ownerFunction.trim(),
      cdioPartner: form.cdioPartner.trim() || undefined,
      startDate: form.startDate,
      pilotStartDate: form.pilotStartDate || undefined,
      productionDate: form.productionDate || undefined,
      killDate: form.killDate || undefined,
      killReason: form.killReason.trim() || undefined,
      budgetYear1: Number(form.budgetYear1) || 0,
      budgetYear2: form.budgetYear2 ? Number(form.budgetYear2) : undefined,
      budgetYear3: form.budgetYear3 ? Number(form.budgetYear3) : undefined,
      strategicAlignmentScore: form.strategicAlignmentScore
        ? (Number(form.strategicAlignmentScore) as 1|2|3|4|5) : undefined,
      timeToValueScore: form.timeToValueScore
        ? (Number(form.timeToValueScore) as 1|2|3|4|5) : undefined,
      roiTargets: initial?.roiTargets ?? [],
      measuredOutcomes: initial?.measuredOutcomes ?? [],
      adoptionMetrics: initial?.adoptionMetrics,
      risks: initial?.risks ?? [],
      milestones: initial?.milestones ?? [],
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes: form.notes.trim(),
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    setSaving(true);
    try { await onSave(agent); } finally { setSaving(false); }
  }

  const needsVendor = ['buy','partner','hybrid'].includes(form.buildBuyDecision);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => s < step && setStep(s)}
              className={cn(
                'w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors',
                s === step ? 'bg-brand-accent text-white' :
                s < step ? 'bg-green-500 text-white cursor-pointer' :
                'bg-muted text-muted-foreground'
              )}
            >
              {s < step ? '✓' : s}
            </button>
            <span className={cn('text-xs', s === step ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              {s === 1 ? 'Identity' : s === 2 ? 'Ownership' : 'Budget'}
            </span>
            {s < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Identity */}
      {step === 1 && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Code" required hint="Short code, e.g. S1, M3, C2">
            <Input value={form.code} onChange={(e) => set('code')(e.target.value)}
              placeholder="S1" className={errors.code ? 'border-destructive' : ''} />
            {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
          </Field>

          <SelectField label="Function" required value={form.function} onChange={set('function')}
            options={[['sales','Sales'],['marketing','Marketing'],['customer_success','Customer Success'],['cross_functional','Cross-functional']]}
          />

          <Field label="Name" required className="col-span-2">
            <Input value={form.name} onChange={(e) => set('name')(e.target.value)}
              placeholder="AI-Augmented Forecasting" className={errors.name ? 'border-destructive' : ''} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </Field>

          <Field label="Description" required className="col-span-2"
            hint="1–2 sentences: what it does and its primary value.">
            <textarea value={form.description} onChange={(e) => set('description')(e.target.value)}
              rows={3} placeholder="Describe the agent in 1–2 sentences…"
              className={cn('w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none', errors.description ? 'border-destructive' : '')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </Field>

          <SelectField label="Type" required value={form.type} onChange={set('type')}
            options={[['predictive','Predictive'],['generative','Generative'],['agentic','Agentic'],['hybrid','Hybrid']]}
          />
          <SelectField label="Tier" required value={form.tier} onChange={set('tier')}
            options={[['tier_0_foundation','T0 — Foundation'],['tier_1_quick_win','T1 — Quick Win'],['tier_2_strategic_bet','T2 — Strategic Bet'],['tier_3_flagship','T3 — Flagship']]}
          />
          <SelectField label="Stage" required value={form.stage} onChange={set('stage')}
            options={[['idea','Idea'],['evaluation','Evaluation'],['design','Design'],['pilot','Pilot'],['scale','Scale'],['production','Production'],['sunset','Sunset'],['killed','Killed']]}
          />
          <SelectField label="Build / Buy Decision" required value={form.buildBuyDecision} onChange={set('buildBuyDecision')}
            options={[['tbd','TBD'],['build','Build'],['buy','Buy'],['partner','Partner'],['hybrid','Hybrid']]}
          />
          {needsVendor && (
            <Field label="Vendor" hint="Primary vendor or partner name">
              <Input value={form.vendor} onChange={(e) => set('vendor')(e.target.value)} placeholder="Gong, Salesforce, etc." />
            </Field>
          )}
        </div>
      )}

      {/* Step 2 — Ownership & Timeline */}
      {step === 2 && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner" required hint="Person accountable for this agent">
            <Input value={form.owner} onChange={(e) => set('owner')(e.target.value)}
              placeholder="Sales AI Lead" className={errors.owner ? 'border-destructive' : ''} />
            {errors.owner && <p className="text-xs text-destructive">{errors.owner}</p>}
          </Field>
          <Field label="Owner Function">
            <Input value={form.ownerFunction} onChange={(e) => set('ownerFunction')(e.target.value)} placeholder="Sales" />
          </Field>
          <Field label="CDIO Partner" hint="CDIO-side counterpart">
            <Input value={form.cdioPartner} onChange={(e) => set('cdioPartner')(e.target.value)} placeholder="Director, Sales Technology" />
          </Field>
          <div />
          <Field label="Start Date" required>
            <Input type="date" value={form.startDate} onChange={(e) => set('startDate')(e.target.value)}
              className={errors.startDate ? 'border-destructive' : ''} />
            {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
          </Field>
          <Field label="Pilot Start Date">
            <Input type="date" value={form.pilotStartDate} onChange={(e) => set('pilotStartDate')(e.target.value)} />
          </Field>
          <Field label="Production Date">
            <Input type="date" value={form.productionDate} onChange={(e) => set('productionDate')(e.target.value)} />
          </Field>
          {(form.stage === 'killed' || form.stage === 'sunset') && (
            <>
              <Field label="Kill / Sunset Date">
                <Input type="date" value={form.killDate} onChange={(e) => set('killDate')(e.target.value)} />
              </Field>
              <Field label="Kill Reason" className="col-span-2">
                <Input value={form.killReason} onChange={(e) => set('killReason')(e.target.value)} placeholder="Why was this agent killed or sunset?" />
              </Field>
            </>
          )}
        </div>
      )}

      {/* Step 3 — Budget & Context */}
      {step === 3 && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Year 1 Budget ($)" required hint="Total spend including vendor, build, change mgmt">
            <Input type="number" min={0} value={form.budgetYear1}
              onChange={(e) => set('budgetYear1')(e.target.value)}
              placeholder="800000" className={errors.budgetYear1 ? 'border-destructive' : ''} />
            {errors.budgetYear1 && <p className="text-xs text-destructive">{errors.budgetYear1}</p>}
          </Field>
          <Field label="Year 2 Budget ($)">
            <Input type="number" min={0} value={form.budgetYear2} onChange={(e) => set('budgetYear2')(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Year 3 Budget ($)">
            <Input type="number" min={0} value={form.budgetYear3} onChange={(e) => set('budgetYear3')(e.target.value)} placeholder="Optional" />
          </Field>
          <div />
          <ScoreSelect label="Strategic Alignment Score" value={form.strategicAlignmentScore}
            onChange={set('strategicAlignmentScore')} hint="1 = low alignment, 5 = directly enables strategic priorities" />
          <ScoreSelect label="Time to Value Score" value={form.timeToValueScore}
            onChange={set('timeToValueScore')} hint="1 = >24 months, 5 = <3 months to first production value" />
          <Field label="Tags" className="col-span-2" hint="Comma-separated, e.g. gong, salesforce, quick-win">
            <Input value={form.tags} onChange={(e) => set('tags')(e.target.value)} placeholder="gong, salesforce, productivity" />
          </Field>
          <Field label="Notes" className="col-span-2">
            <textarea value={form.notes} onChange={(e) => set('notes')(e.target.value)}
              rows={3} placeholder="Any context, decisions, or status notes…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          </Field>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="outline" onClick={step === 1 ? onCancel : back}>
          {step === 1 ? 'Cancel' : <><ChevronLeft className="h-4 w-4 mr-1" />Back</>}
        </Button>
        {step < 3
          ? <Button onClick={next}>Next<ChevronRight className="h-4 w-4 ml-1" /></Button>
          : <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1.5" />{saving ? 'Saving…' : initial ? 'Save changes' : 'Create agent'}
            </Button>}
      </div>
    </div>
  );
}
