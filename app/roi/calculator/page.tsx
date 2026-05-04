'use client';

import { useState, useMemo, useRef } from 'react';
import { evaluateFormula } from '@/lib/formula-parser';
import { PageHeader } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return sign + '$' + (abs / 1_000_000_000).toFixed(2) + 'B';
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(0) + 'K';
  return sign + '$' + abs.toFixed(0);
}

function fmtNum(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function fmtPct(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '—';
  return (n * 100).toFixed(0) + '%';
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Category = 'sga' | 'revenue' | 'capacity' | 'quality' | 'custom';
type Ramp = 'aggressive' | 'standard' | 'conservative';

interface GlobalState {
  wacc: number; population: number; hourlyRate: number; adoption: number;
  invY1: number; invY2: number; invY3: number; ramp: Ramp;
}
interface SgaState { hours: number; conversion: number; }
interface RevState { base: number; lift: number; attribution: number; margin: number; cycle: number; }
interface CapState { multiplier: number; growth: number; costPerHire: number; verifiability: number; }
interface QualState { improvement: number; approach: string; exposure: number; confidence: number; }
interface CustomState {
  aName: string; aVal: number; bName: string; bVal: number;
  cName: string; cVal: number; dName: string; dVal: number; formula: string;
}
interface Context { useCaseName: string; fn: string; tier: string; }

// ─── Calculation functions ───────────────────────────────────────────────────

function calcSGA(g: GlobalState, s: SgaState) {
  const adopt = g.adoption / 100;
  const grossHours = s.hours * 50 * g.population * adopt;
  const grossValue = grossHours * g.hourlyRate;
  const realized = grossValue * s.conversion;
  return { grossHours, grossValue, realized, defensible: realized };
}

function calcRevenue(g: GlobalState, r: RevState) {
  const lift = r.lift / 100;
  const adopt = g.adoption / 100;
  const margin = r.margin / 100;
  const gross = r.base * lift * adopt;
  const marginContrib = gross * margin;
  const attributed = marginContrib * r.attribution;
  return { gross, marginContrib, attributed, defensible: attributed };
}

function calcCapacity(g: GlobalState, c: CapState) {
  const growth = c.growth / 100;
  const mult = Math.max(c.multiplier, 1.0001);
  const hiresAvoided = g.population * growth * (1 - 1 / mult);
  const grossAvoided = hiresAvoided * c.costPerHire;
  const verified = grossAvoided * c.verifiability;
  return { hiresAvoided, grossAvoided, verified, defensible: verified };
}

function calcQuality(_g: GlobalState, q: QualState) {
  const imp = q.improvement / 100;
  const exposureAvoided = q.exposure * imp;
  const monetizable = exposureAvoided * q.confidence;
  return { exposureAvoided, monetizable, defensible: monetizable };
}

function calcCustom(c: CustomState): { value: number; error: string | null } {
  const params: Record<string, number> = {};
  const entries: [string, string, number][] = [
    [c.aName, 'a', c.aVal], [c.bName, 'b', c.bVal],
    [c.cName, 'c', c.cVal], [c.dName, 'd', c.dVal],
  ];
  for (const [name, , val] of entries) {
    if (name.trim()) params[name.trim()] = val;
  }
  if (!c.formula.trim()) return { value: 0, error: 'No formula entered' };
  try {
    const value = evaluateFormula(c.formula, params);
    return { value, error: null };
  } catch (e) {
    return { value: 0, error: (e as Error).message };
  }
}

function getRampFactors(ramp: Ramp): [number, number, number] {
  if (ramp === 'aggressive') return [0.5, 1.0, 1.0];
  if (ramp === 'conservative') return [0.15, 0.6, 1.0];
  return [0.3, 0.8, 1.0];
}

function computePayback(i1: number, i2: number, i3: number, v1: number, v2: number, v3: number): string {
  let cum = 0;
  let inv = i1;
  for (let m = 1; m <= 12; m++) { cum += v1 / 12; if (cum >= inv) return m + ' months'; }
  inv += i2;
  for (let m = 1; m <= 12; m++) { cum += v2 / 12; if (cum >= inv) return (12 + m) + ' months'; }
  inv += i3;
  for (let m = 1; m <= 12; m++) { cum += v3 / 12; if (cum >= inv) return (24 + m) + ' months'; }
  return '> 36 months';
}

interface ScenarioRow { name: string; factor: number; totalVal: number; npv: number; roi: string; payback: string; }

function calcFramings(runRate: number, g: GlobalState) {
  const wacc = g.wacc / 100;
  const [r1, r2, r3] = getRampFactors(g.ramp);
  const v1 = runRate * r1, v2 = runRate * r2, v3 = runRate * r3;
  const totalInv = g.invY1 + g.invY2 + g.invY3;
  const totalVal = v1 + v2 + v3;
  const npv = (v1 - g.invY1) / (1 + wacc) + (v2 - g.invY2) / Math.pow(1 + wacc, 2) + (v3 - g.invY3) / Math.pow(1 + wacc, 3);
  const roi = totalInv > 0 ? (totalVal - totalInv) / totalInv : 0;
  const payback = computePayback(g.invY1, g.invY2, g.invY3, v1, v2, v3);

  const scenarios: ScenarioRow[] = [
    { name: 'Base case', factor: 1.0 },
    { name: 'Adoption miss (−25%)', factor: 0.75 },
    { name: 'Lift miss (−50%)', factor: 0.5 },
    { name: 'Severe downside (−75%)', factor: 0.25 },
    { name: 'Upside (+25%)', factor: 1.25 },
  ].map((s) => {
    const rr = runRate * s.factor;
    const sv1 = rr * r1, sv2 = rr * r2, sv3 = rr * r3;
    const stv = sv1 + sv2 + sv3;
    const snpv = (sv1 - g.invY1) / (1 + wacc) + (sv2 - g.invY2) / Math.pow(1 + wacc, 2) + (sv3 - g.invY3) / Math.pow(1 + wacc, 3);
    const sroi = totalInv > 0 ? ((stv - totalInv) / totalInv * 100).toFixed(0) + '%' : '—';
    const spb = computePayback(g.invY1, g.invY2, g.invY3, sv1, sv2, sv3);
    return { name: s.name, factor: s.factor, totalVal: stv, npv: snpv, roi: sroi, payback: spb };
  });

  return { v1, v2, v3, totalInv, totalVal, npv, roi, payback, runRate, scenarios };
}

// ─── Templates ──────────────────────────────────────────────────────────────

interface Template {
  name: string; population?: number;
  hours?: number; conversion?: number;
  base?: number; lift?: number; attr?: number; margin?: number; cycle?: number;
  mult?: number; growth?: number; cost?: number; ver?: number;
  imp?: number; app?: string; exp?: number; conf?: number;
}

const TEMPLATES: Record<string, Template> = {
  sga_meeting_prep: { hours: 3.5, conversion: 0.5, name: 'S1 - Meeting Prep & Post-Call Summaries' },
  sga_crm_update: { hours: 2.5, conversion: 0.5, name: 'S2 - AI CRM Auto-Update' },
  sga_qbr_prep: { hours: 5, conversion: 0.5, name: 'C3 - AI-Augmented QBR Prep', population: 120 },
  sga_content_gen: { hours: 8, conversion: 0.7, name: 'M1 - AI Content Generation', population: 80 },
  sga_deflection: { hours: 6, conversion: 0.5, name: 'C1 - Tier-1 Support Deflection' },
  rev_lead_scoring: { base: 80_000_000, lift: 4, attr: 0.7, margin: 55, cycle: 5, name: 'M2 - Predictive Lead Scoring' },
  rev_deal_coaching: { base: 150_000_000, lift: 3, attr: 0.7, margin: 55, cycle: 8, name: 'S5 - Real-Time Deal Coaching' },
  rev_health: { base: 600_000_000, lift: 1.5, attr: 0.4, margin: 55, cycle: 0, name: 'C2 - Predictive Customer Health' },
  rev_expansion: { base: 200_000_000, lift: 4, attr: 0.7, margin: 55, cycle: 0, name: 'C5 - Expansion Opportunity Routing' },
  cap_outbound: { mult: 2.0, growth: 15, cost: 200_000, ver: 0.7, name: 'S4 - Personalized Outbound at Scale' },
  cap_account_intel: { mult: 1.5, growth: 12, cost: 250_000, ver: 0.7, name: 'S11 - Autonomous Account Intelligence' },
  cap_intervention: { mult: 1.4, growth: 10, cost: 220_000, ver: 0.7, name: 'C4 - Proactive Intervention Agent' },
  qual_forecast: { imp: 5, app: 'capital', exp: 50_000_000, conf: 0.25, name: 'S6 - AI-Augmented Forecasting' },
  qual_deal_desk: { imp: 8, app: 'penalty', exp: 20_000_000, conf: 0.5, name: 'S8 - AI Deal Desk Price Integrity' },
  qual_data: { imp: 15, app: 'risk', exp: 5_000_000, conf: 0.25, name: 'CRM Data Hygiene' },
};

// ─── Snapshot type ───────────────────────────────────────────────────────────

interface Snapshot {
  activeCategory: Category;
  ctx: Context;
  globals: GlobalState;
  sga: SgaState;
  rev: RevState;
  cap: CapState;
  qual: QualState;
  custom: CustomState;
}

// ─── Reusable input components ───────────────────────────────────────────────

function NumInput({ label, value, onChange, step, min, suffix, prefix, hint }: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; suffix?: string; prefix?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-brand-accent uppercase tracking-wide">{label}</label>
      <div className="flex items-center mt-1">
        {prefix && <span className="bg-muted border border-r-0 border-input rounded-l px-3 py-2 text-sm text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={cn(
            'w-full border border-input bg-background text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-accent',
            prefix ? 'rounded-r' : suffix ? 'rounded-l' : 'rounded',
          )}
        />
        {suffix && <span className="bg-muted border border-l-0 border-input rounded-r px-3 py-2 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function SelectInput({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-brand-accent uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-input bg-background rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function LiveBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 bg-sidebar rounded-lg p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Live Calculation</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{children}</div>
    </div>
  );
}

function LiveStat({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'yellow' }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn(
        'text-2xl font-bold tabular-nums',
        highlight === 'green' ? 'text-green-400' : highlight === 'yellow' ? 'text-amber-300' : 'text-foreground',
      )}>{value}</p>
    </div>
  );
}

function TemplatePill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs border border-input rounded px-3 py-1 hover:bg-brand-accent hover:text-white hover:border-brand-accent transition-colors"
    >
      {label}
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ROICalculatorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Context
  const [ctx, setCtx] = useState<Context>({ useCaseName: '', fn: 'Sales', tier: 'Tier 1 — Quick Win' });
  const pCtx = <K extends keyof Context>(k: K) => (v: Context[K]) => setCtx((p) => ({ ...p, [k]: v }));

  // Global assumptions
  const [globals, setGlobals] = useState<GlobalState>({
    wacc: 10, population: 250, hourlyRate: 95, adoption: 65,
    invY1: 500_000, invY2: 300_000, invY3: 250_000, ramp: 'standard',
  });
  const pG = <K extends keyof GlobalState>(k: K) => (v: GlobalState[K]) => setGlobals((p) => ({ ...p, [k]: v }));

  // Category
  const [activeCategory, setActiveCategory] = useState<Category>('sga');

  // SG&A
  const [sga, setSga] = useState<SgaState>({ hours: 3.5, conversion: 0.5 });
  const pSga = <K extends keyof SgaState>(k: K) => (v: SgaState[K]) => setSga((p) => ({ ...p, [k]: v }));

  // Revenue
  const [rev, setRev] = useState<RevState>({ base: 100_000_000, lift: 3, attribution: 0.7, margin: 55, cycle: 10 });
  const pRev = <K extends keyof RevState>(k: K) => (v: RevState[K]) => setRev((p) => ({ ...p, [k]: v }));

  // Capacity
  const [cap, setCap] = useState<CapState>({ multiplier: 1.5, growth: 12, costPerHire: 200_000, verifiability: 0.7 });
  const pCap = <K extends keyof CapState>(k: K) => (v: CapState[K]) => setCap((p) => ({ ...p, [k]: v }));

  // Quality
  const [qual, setQual] = useState<QualState>({ improvement: 5, approach: 'risk', exposure: 20_000_000, confidence: 0.25 });
  const pQual = <K extends keyof QualState>(k: K) => (v: QualState[K]) => setQual((p) => ({ ...p, [k]: v }));

  // Custom
  const [custom, setCustom] = useState<CustomState>({
    aName: 'param_a', aVal: 100, bName: 'param_b', bVal: 50,
    cName: 'param_c', cVal: 0.7, dName: 'param_d', dVal: 1,
    formula: 'param_a * param_b * param_c * param_d',
  });
  const pCustom = <K extends keyof CustomState>(k: K) => (v: CustomState[K]) => setCustom((p) => ({ ...p, [k]: v }));

  // ─── Computed ────────────────────────────────────────────────────────────

  const sgaResult = useMemo(() => calcSGA(globals, sga), [globals, sga]);
  const revResult = useMemo(() => calcRevenue(globals, rev), [globals, rev]);
  const capResult = useMemo(() => calcCapacity(globals, cap), [globals, cap]);
  const qualResult = useMemo(() => calcQuality(globals, qual), [globals, qual]);
  const customResult = useMemo(() => calcCustom(custom), [custom]);

  const runRate = useMemo(() => {
    switch (activeCategory) {
      case 'sga': return sgaResult.defensible;
      case 'revenue': return revResult.defensible;
      case 'capacity': return capResult.defensible;
      case 'quality': return qualResult.defensible;
      case 'custom': return customResult.error ? 0 : customResult.value;
    }
  }, [activeCategory, sgaResult, revResult, capResult, qualResult, customResult]);

  const framings = useMemo(() => calcFramings(runRate, globals), [runRate, globals]);

  const talkingPoints = useMemo(() => {
    const { npv, roi, payback, runRate: rr, totalInv, totalVal } = framings;
    const name = ctx.useCaseName || 'this agent';
    const fn = ctx.fn;
    const pts: string[] = [];
    pts.push(`"${name} is a ${fmtUSD(totalInv)} cumulative investment over three years that we project will deliver ${fmtUSD(totalVal)} of cumulative value, with ${fmtUSD(rr)} of annualized run-rate by end of Year 3."`);
    if (payback.includes('>')) {
      pts.push(`Payback exceeds 36 months on the base case. CFOs typically want sub-18-month payback for AI investments — be ready to defend why this case justifies a longer horizon (foundation investment, agentic capability, multi-use-case leverage).`);
    } else {
      pts.push(`${payback} payback on the base case — within the 12–18 month range CFOs expect for productivity AI, longer for agentic AI investments.`);
    }
    if (roi >= 2) {
      pts.push(`3-year NPV of ${fmtUSD(npv)} at our discount rate, ${fmtPct(roi)} ROI. Sits at the lower end of published AI-in-GTM benchmarks — defending the lower bound, earning the upper bound through execution.`);
    } else if (roi >= 0.5) {
      pts.push(`3-year NPV of ${fmtUSD(npv)}, ${fmtPct(roi)} ROI. Modest by AI portfolio standards — be prepared to explain strategic positioning.`);
    } else {
      pts.push(`ROI of ${fmtPct(roi)} is below the bar most CFOs will fund. Tighten the inputs or reconsider the scope.`);
    }
    pts.push(`Stress-tested with 25%, 50%, and 75% downside scenarios. Even at 50% lift miss the case still produces positive NPV — that's where I want to defend the floor.`);
    pts.push(`By end of FY28, this agent runs at ${fmtUSD(rr)} of annualized impact in the ${fn} function. Commit ${fmtUSD(rr * 0.6)} to the operating plan and treat ${fmtUSD(rr * 0.4)} as upside earned through execution.`);
    pts.push(`Pre-committed kill criteria, ${fn} leader sign-off, treatment-vs-control measurement where feasible. The methodology is what makes the numbers defensible.`);
    return pts;
  }, [framings, ctx]);

  // ─── Templates ───────────────────────────────────────────────────────────

  function loadTemplate(key: string) {
    const t = TEMPLATES[key];
    if (!t) return;
    if (t.name) setCtx((p) => ({ ...p, useCaseName: t.name! }));
    if (t.population) setGlobals((p) => ({ ...p, population: t.population! }));
    if (key.startsWith('sga_')) {
      setSga({ hours: t.hours ?? 3.5, conversion: t.conversion ?? 0.5 });
      setActiveCategory('sga');
    } else if (key.startsWith('rev_')) {
      setRev({ base: t.base ?? 100_000_000, lift: t.lift ?? 3, attribution: t.attr ?? 0.7, margin: t.margin ?? 55, cycle: t.cycle ?? 0 });
      setActiveCategory('revenue');
    } else if (key.startsWith('cap_')) {
      setCap({ multiplier: t.mult ?? 1.5, growth: t.growth ?? 12, costPerHire: t.cost ?? 200_000, verifiability: t.ver ?? 0.7 });
      setActiveCategory('capacity');
    } else if (key.startsWith('qual_')) {
      setQual({ improvement: t.imp ?? 5, approach: t.app ?? 'risk', exposure: t.exp ?? 20_000_000, confidence: t.conf ?? 0.25 });
      setActiveCategory('quality');
    }
  }

  // ─── Export / Import ─────────────────────────────────────────────────────

  function exportSnapshot() {
    const snap: Snapshot = { activeCategory, ctx, globals, sga, rev, cap, qual, custom };
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (ctx.useCaseName || 'roi-snapshot').replace(/[^a-z0-9]+/gi, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importSnapshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const snap: Snapshot = JSON.parse(ev.target?.result as string);
        if (snap.activeCategory) setActiveCategory(snap.activeCategory);
        if (snap.ctx) setCtx(snap.ctx);
        if (snap.globals) setGlobals(snap.globals);
        if (snap.sga) setSga(snap.sga);
        if (snap.rev) setRev(snap.rev);
        if (snap.cap) setCap(snap.cap);
        if (snap.qual) setQual(snap.qual);
        if (snap.custom) setCustom(snap.custom);
      } catch {
        alert('Invalid snapshot file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function resetAll() {
    if (!confirm('Reset all inputs to defaults?')) return;
    setCtx({ useCaseName: '', fn: 'Sales', tier: 'Tier 1 — Quick Win' });
    setGlobals({ wacc: 10, population: 250, hourlyRate: 95, adoption: 65, invY1: 500_000, invY2: 300_000, invY3: 250_000, ramp: 'standard' });
    setSga({ hours: 3.5, conversion: 0.5 });
    setRev({ base: 100_000_000, lift: 3, attribution: 0.7, margin: 55, cycle: 10 });
    setCap({ multiplier: 1.5, growth: 12, costPerHire: 200_000, verifiability: 0.7 });
    setQual({ improvement: 5, approach: 'risk', exposure: 20_000_000, confidence: 0.25 });
    setCustom({ aName: 'param_a', aVal: 100, bName: 'param_b', bVal: 50, cName: 'param_c', cVal: 0.7, dName: 'param_d', dVal: 1, formula: 'param_a * param_b * param_c * param_d' });
    setActiveCategory('sga');
  }

  // ─── Tabs config ─────────────────────────────────────────────────────────

  const TABS: { id: Category; label: string }[] = [
    { id: 'sga', label: 'SG&A Efficiency' },
    { id: 'revenue', label: 'Revenue Acceleration' },
    { id: 'capacity', label: 'Capacity Creation' },
    { id: 'quality', label: 'Quality Uplift' },
    { id: 'custom', label: 'Custom Formula' },
  ];

  const { v1, v2, v3, totalInv, totalVal, npv, roi, payback, scenarios } = framings;

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="CFO-Grade ROI Calculator"
        subtitle="Audit-grade methodology · Four value categories · Live NPV, payback, and sensitivity"
        actions={
          <div className="flex gap-2 print:hidden">
            <Button size="sm" variant="outline" onClick={exportSnapshot}>Export JSON</Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>Import JSON</Button>
            <Button size="sm" variant="outline" onClick={resetAll}>Reset</Button>
            <Button size="sm" onClick={() => window.print()}>Print to PDF</Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={importSnapshot} />
          </div>
        }
      />

      {/* Instructions */}
      <div className="border-l-4 border-brand-accent bg-muted/40 p-4 text-sm rounded-r">
        <p className="font-semibold mb-1">How to use</p>
        <p className="text-muted-foreground">Step 1: Enter use case context and global assumptions. Step 2: Select a value category (or load a template). Step 3: Enter inputs — outputs compute live. Step 4: Review the CFO Framings panel. Step 5: Export JSON or Print to PDF.</p>
      </div>

      {/* Use Case Context */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-bold mb-4 border-b pb-2">Use Case Context</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-brand-accent uppercase tracking-wide">Agent / Use Case Name</label>
            <input
              type="text"
              value={ctx.useCaseName}
              onChange={(e) => pCtx('useCaseName')(e.target.value)}
              placeholder="e.g., S1 — Meeting Prep Agent"
              className="mt-1 w-full border border-input bg-background rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"
            />
          </div>
          <SelectInput label="Function" value={ctx.fn} onChange={pCtx('fn')} options={[
            { value: 'Sales', label: 'Sales' },
            { value: 'Marketing', label: 'Marketing' },
            { value: 'Customer Success', label: 'Customer Success' },
            { value: 'Cross-Functional', label: 'Cross-Functional' },
          ]} />
          <SelectInput label="Tier" value={ctx.tier} onChange={pCtx('tier')} options={[
            { value: 'Tier 1 — Quick Win', label: 'Tier 1 — Quick Win' },
            { value: 'Tier 2 — Strategic Bet', label: 'Tier 2 — Strategic Bet' },
            { value: 'Tier 3 — Flagship', label: 'Tier 3 — Flagship' },
            { value: 'Tier 0 — Foundation', label: 'Tier 0 — Foundation' },
          ]} />
        </div>
      </div>

      {/* Global Assumptions */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-bold mb-1 border-b pb-2">Global Assumptions</h2>
        <p className="text-xs text-muted-foreground mb-4">These flow into every calculation. Set once per case.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumInput label="Discount Rate (WACC + risk)" value={globals.wacc} onChange={pG('wacc')} step={0.5} suffix="%" hint="Equinix typical: 8–12%" />
          <NumInput label="Affected Population" value={globals.population} onChange={pG('population')} hint="Headcount affected" />
          <NumInput label="Fully-Loaded Hourly Rate" value={globals.hourlyRate} onChange={pG('hourlyRate')} prefix="$" hint="Salary + benefits + overhead ÷ 2,080" />
          <NumInput label="Adoption Rate Assumption" value={globals.adoption} onChange={pG('adoption')} suffix="%" hint="% of population actively using" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <NumInput label="Year 1 Investment" value={globals.invY1} onChange={pG('invY1')} prefix="$" />
          <NumInput label="Year 2 Investment" value={globals.invY2} onChange={pG('invY2')} prefix="$" />
          <NumInput label="Year 3 Investment" value={globals.invY3} onChange={pG('invY3')} prefix="$" />
          <SelectInput label="Ramp Pattern" value={globals.ramp} onChange={(v) => pG('ramp')(v as Ramp)} options={[
            { value: 'aggressive', label: 'Aggressive (50% Y1, 100% Y2)' },
            { value: 'standard', label: 'Standard (30% Y1, 80% Y2, 100% Y3)' },
            { value: 'conservative', label: 'Conservative (15% Y1, 60% Y2, 100% Y3)' },
          ]} />
        </div>
      </div>

      {/* Category Tabs */}
      <div>
        <div className="flex flex-wrap gap-2 mb-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveCategory(t.id)}
              className={cn(
                'px-4 py-2.5 rounded-t-lg text-sm font-semibold transition-colors',
                activeCategory === t.id
                  ? 'bg-sidebar text-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* SG&A Panel */}
        {activeCategory === 'sga' && (
          <div className="rounded-b-lg rounded-tr-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h2 className="text-sm font-bold">SG&A Efficiency</h2>
              <span className="text-xs bg-muted text-brand-accent px-2 py-1 rounded font-semibold uppercase tracking-wide">Most defensible — direct cost basis</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Hours saved per role, translated to fully-loaded labor cost. Best CFO confidence because the counterfactual is bounded.</p>
            <div className="bg-muted/40 rounded p-3 mb-4">
              <p className="text-xs font-semibold text-brand-accent uppercase mb-2">Pre-built templates</p>
              <div className="flex flex-wrap gap-2">
                <TemplatePill label="Meeting Prep (S1)" onClick={() => loadTemplate('sga_meeting_prep')} />
                <TemplatePill label="CRM Auto-Update (S2)" onClick={() => loadTemplate('sga_crm_update')} />
                <TemplatePill label="QBR Prep (C3)" onClick={() => loadTemplate('sga_qbr_prep')} />
                <TemplatePill label="Content Generation (M1)" onClick={() => loadTemplate('sga_content_gen')} />
                <TemplatePill label="Support Deflection (C1)" onClick={() => loadTemplate('sga_deflection')} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumInput label="Hours Saved Per User Per Week" value={sga.hours} onChange={pSga('hours')} step={0.5} hint="Direct measurement via time studies or workflow logs" />
              <SelectInput label="Conversion to Realized Cost" value={String(sga.conversion)} onChange={(v) => pSga('conversion')(parseFloat(v))} options={[
                { value: '1.0', label: '100% — headcount reduction or growth absorption' },
                { value: '0.5', label: '50% — partial conversion (CFO-realistic)' },
                { value: '0.25', label: '25% — quality uplift mostly, minor cost impact' },
              ]} hint="CFOs discount 'hours saved' unless they convert to dollars" />
            </div>
            <LiveBox>
              <LiveStat label="Gross Hours / Year" value={fmtNum(sgaResult.grossHours)} />
              <LiveStat label="Gross Annual Value" value={fmtUSD(sgaResult.grossValue)} />
              <LiveStat label="Realized (after conversion)" value={fmtUSD(sgaResult.realized)} highlight="green" />
              <LiveStat label="CFO-Defensible Estimate" value={fmtUSD(sgaResult.defensible)} highlight="yellow" />
            </LiveBox>
            <p className="text-xs text-muted-foreground mt-3 italic">Formula: hours/week × 50 weeks × population × adoption% × hourly_rate × conversion%</p>
          </div>
        )}

        {/* Revenue Panel */}
        {activeCategory === 'revenue' && (
          <div className="rounded-b-lg rounded-tr-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h2 className="text-sm font-bold">Revenue Acceleration</h2>
              <span className="text-xs bg-muted text-brand-accent px-2 py-1 rounded font-semibold uppercase tracking-wide">Higher value — requires control comparison</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Pipeline, conversion, deal velocity, expansion ARR, retention. CFOs discount these without treatment-vs-control evidence.</p>
            <div className="bg-muted/40 rounded p-3 mb-4">
              <p className="text-xs font-semibold text-brand-accent uppercase mb-2">Pre-built templates</p>
              <div className="flex flex-wrap gap-2">
                <TemplatePill label="Lead Scoring (M2)" onClick={() => loadTemplate('rev_lead_scoring')} />
                <TemplatePill label="Deal Coaching (S5)" onClick={() => loadTemplate('rev_deal_coaching')} />
                <TemplatePill label="Customer Health (C2)" onClick={() => loadTemplate('rev_health')} />
                <TemplatePill label="Expansion Routing (C5)" onClick={() => loadTemplate('rev_expansion')} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NumInput label="Baseline Annual Revenue Affected" value={rev.base} onChange={pRev('base')} prefix="$" hint="Revenue stream this agent influences" />
              <NumInput label="Expected Lift" value={rev.lift} onChange={pRev('lift')} step={0.5} suffix="%" hint="Conversion / win rate / retention uplift" />
              <SelectInput label="Attribution Confidence" value={String(rev.attribution)} onChange={(v) => pRev('attribution')(parseFloat(v))} options={[
                { value: '1.0', label: '100% — controlled experiment with matched cohort' },
                { value: '0.7', label: '70% — natural control (regions, segments)' },
                { value: '0.4', label: '40% — before/after only, no control' },
                { value: '0.2', label: '20% — survey/anecdotal evidence only' },
              ]} hint="CFO will apply this discount mentally — apply it explicitly" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <NumInput label="Gross Margin %" value={rev.margin} onChange={pRev('margin')} step={1} suffix="%" hint="CFOs care about margin contribution, not just revenue" />
              <NumInput label="Cycle Time Reduction" value={rev.cycle} onChange={pRev('cycle')} step={1} suffix="% faster" hint="Adds working-capital benefit (smaller effect)" />
            </div>
            <LiveBox>
              <LiveStat label="Gross Revenue Lift" value={fmtUSD(revResult.gross)} />
              <LiveStat label="Gross Margin Contribution" value={fmtUSD(revResult.marginContrib)} />
              <LiveStat label="Attribution-Adjusted" value={fmtUSD(revResult.attributed)} highlight="green" />
              <LiveStat label="CFO-Defensible Estimate" value={fmtUSD(revResult.defensible)} highlight="yellow" />
            </LiveBox>
            <p className="text-xs text-muted-foreground mt-3 italic">Formula: baseline × lift% × adoption% × gross_margin% × attribution_confidence</p>
          </div>
        )}

        {/* Capacity Panel */}
        {activeCategory === 'capacity' && (
          <div className="rounded-b-lg rounded-tr-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h2 className="text-sm font-bold">Capacity Creation</h2>
              <span className="text-xs bg-muted text-brand-accent px-2 py-1 rounded font-semibold uppercase tracking-wide">Newest framing — strongest for agentic AI</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Growth absorbed without proportional headcount growth. The killer CFO framing for agentic motions.</p>
            <div className="bg-muted/40 rounded p-3 mb-4">
              <p className="text-xs font-semibold text-brand-accent uppercase mb-2">Pre-built templates</p>
              <div className="flex flex-wrap gap-2">
                <TemplatePill label="Agentic Outbound (S4)" onClick={() => loadTemplate('cap_outbound')} />
                <TemplatePill label="Account Intelligence (S11)" onClick={() => loadTemplate('cap_account_intel')} />
                <TemplatePill label="Proactive Intervention (C4)" onClick={() => loadTemplate('cap_intervention')} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumInput label="Capacity Multiplier" value={cap.multiplier} onChange={pCap('multiplier')} step={0.1} min={1} hint="e.g., 1.5× = each user handles 50% more workload" />
              <NumInput label="Growth Rate Absorbed" value={cap.growth} onChange={pCap('growth')} step={1} suffix="% YoY" hint="Equinix planned growth absorbed without hiring" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <NumInput label="Fully-Loaded Annual Cost Per Hire" value={cap.costPerHire} onChange={pCap('costPerHire')} prefix="$" hint="Salary + benefits + recruiting + ramp" />
              <SelectInput label="Verifiability" value={String(cap.verifiability)} onChange={(v) => pCap('verifiability')(parseFloat(v))} options={[
                { value: '1.0', label: '100% — headcount line goes through CFO office' },
                { value: '0.7', label: '70% — strong but partial visibility' },
                { value: '0.4', label: '40% — claimed avoidance, hard to verify' },
              ]} hint="CFO weights 'avoided cost' claims by verifiability" />
            </div>
            <LiveBox>
              <LiveStat label="Hires Avoided / Year" value={fmtNum(capResult.hiresAvoided)} />
              <LiveStat label="Gross Avoided Cost" value={fmtUSD(capResult.grossAvoided)} />
              <LiveStat label="Verifiable Avoidance" value={fmtUSD(capResult.verified)} highlight="green" />
              <LiveStat label="CFO-Defensible Estimate" value={fmtUSD(capResult.defensible)} highlight="yellow" />
            </LiveBox>
            <p className="text-xs text-muted-foreground mt-3 italic">Formula: population × growth% × (1 − 1/multiplier) × cost_per_hire × verifiability</p>
          </div>
        )}

        {/* Quality Panel */}
        {activeCategory === 'quality' && (
          <div className="rounded-b-lg rounded-tr-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h2 className="text-sm font-bold">Quality Uplift</h2>
              <span className="text-xs bg-muted text-brand-accent px-2 py-1 rounded font-semibold uppercase tracking-wide">Hardest to monetize — supporting evidence</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Forecast accuracy, decision quality, data hygiene, customer experience, risk reduction. Best as supporting evidence; primary only when monetizable.</p>
            <div className="bg-muted/40 rounded p-3 mb-4">
              <p className="text-xs font-semibold text-brand-accent uppercase mb-2">Pre-built templates</p>
              <div className="flex flex-wrap gap-2">
                <TemplatePill label="Forecast Accuracy (S6)" onClick={() => loadTemplate('qual_forecast')} />
                <TemplatePill label="Deal Desk Price Integrity (S8)" onClick={() => loadTemplate('qual_deal_desk')} />
                <TemplatePill label="CRM Data Hygiene" onClick={() => loadTemplate('qual_data')} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumInput label="Quality Metric Improvement" value={qual.improvement} onChange={pQual('improvement')} step={0.5} suffix="pp" hint="e.g., forecast accuracy from 80% to 85%" />
              <SelectInput label="Monetization Approach" value={qual.approach} onChange={pQual('approach')} options={[
                { value: 'risk', label: 'Risk reduction (bad outcomes avoided)' },
                { value: 'capital', label: 'Cost of capital reduction' },
                { value: 'penalty', label: 'Penalty / write-off avoidance' },
                { value: 'csat', label: 'CSAT-linked retention' },
              ]} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <NumInput label="Annual Exposure / Risk Pool" value={qual.exposure} onChange={pQual('exposure')} prefix="$" hint="Dollars at stake in the bad-outcome scenario" />
              <SelectInput label="Monetization Confidence" value={String(qual.confidence)} onChange={(v) => pQual('confidence')(parseFloat(v))} options={[
                { value: '0.5', label: '50% — direct measurable conversion' },
                { value: '0.25', label: '25% — defensible with audit support' },
                { value: '0.1', label: '10% — qualitative narrative only' },
              ]} />
            </div>
            <div className="mt-6 bg-sidebar rounded-lg p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Live Calculation</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <LiveStat label="Risk-Weighted Exposure Avoided" value={fmtUSD(qualResult.exposureAvoided)} />
                <LiveStat label="Monetizable Value" value={fmtUSD(qualResult.monetizable)} highlight="green" />
                <LiveStat label="CFO-Defensible Estimate" value={fmtUSD(qualResult.defensible)} highlight="yellow" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">Formula: exposure × improvement_pp/100 × monetization_confidence</p>
          </div>
        )}

        {/* Custom Panel */}
        {activeCategory === 'custom' && (
          <div className="rounded-b-lg rounded-tr-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h2 className="text-sm font-bold">Custom Formula</h2>
              <span className="text-xs bg-muted text-brand-accent px-2 py-1 rounded font-semibold uppercase tracking-wide">Build your own</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">For agents that don&apos;t fit the four categories. Define your own monetization formula using named parameters.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['a', 'b', 'c', 'd'] as const).map((k) => (
                <div key={k}>
                  <label className="text-xs font-semibold text-brand-accent uppercase tracking-wide">Parameter {k.toUpperCase()}</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input
                      type="text"
                      value={custom[`${k}Name` as keyof CustomState] as string}
                      onChange={(e) => pCustom(`${k}Name` as keyof CustomState)(e.target.value)}
                      placeholder="Name"
                      className="border border-input bg-background rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    />
                    <input
                      type="number"
                      value={custom[`${k}Val` as keyof CustomState] as number}
                      onChange={(e) => pCustom(`${k}Val` as keyof CustomState)(parseFloat(e.target.value) || 0)}
                      placeholder="Value"
                      className="border border-input bg-background rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold text-brand-accent uppercase tracking-wide">Formula (use parameter names; +, −, *, /, parentheses only)</label>
              <input
                type="text"
                value={custom.formula}
                onChange={(e) => pCustom('formula')(e.target.value)}
                className="mt-1 w-full border border-input bg-background rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-accent"
              />
              <p className="text-xs text-muted-foreground mt-1">Safe evaluator: only the four parameters above can be referenced. No function calls.</p>
            </div>
            <div className="mt-6 bg-sidebar rounded-lg p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Live Calculation</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Computed Annual Value</p>
                  <p className="text-3xl font-bold tabular-nums">
                    {customResult.error ? '—' : fmtUSD(customResult.value)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Formula Status</p>
                  <p className={cn('text-sm font-semibold mt-1', customResult.error ? 'text-red-500' : 'text-green-500')}>
                    {customResult.error ? `✗ ${customResult.error}` : '✓ Valid formula'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CFO Framings Panel */}
      <div className="rounded-lg border-2 border-brand-accent bg-card p-5">
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <h2 className="text-sm font-bold">CFO Framings — The Numbers That Matter for Capital Allocation</h2>
          <Button size="sm" variant="outline" onClick={() => window.print()} className="print:hidden">Print to PDF</Button>
        </div>
        <p className="text-sm text-muted-foreground mb-5">Computed from the active category and global assumptions. The capital allocation language CFOs actually use.</p>

        {/* Year-by-year build */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Year 1 — Ramp', inv: globals.invY1, val: v1, net: v1 - globals.invY1 },
            { label: 'Year 2 — Scale', inv: globals.invY2, val: v2, net: v2 - globals.invY2 },
            { label: 'Year 3 — Run-Rate', inv: globals.invY3, val: v3, net: v3 - globals.invY3 },
          ].map((yr) => (
            <div key={yr.label} className="bg-muted/40 rounded p-4">
              <p className="text-xs font-semibold text-brand-accent uppercase mb-3">{yr.label}</p>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Investment</p>
                  <p className="text-base font-bold">{fmtUSD(yr.inv)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Realized Value</p>
                  <p className="text-base font-bold text-green-600">{fmtUSD(yr.val)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className={cn('text-base font-bold', yr.net >= 0 ? 'text-green-600' : 'text-red-500')}>{fmtUSD(yr.net)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Headline metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Payback Period', value: payback, sub: 'Months until cumulative value > investment' },
            { label: '3-Year NPV', value: fmtUSD(npv), sub: 'At your discount rate' },
            { label: '3-Year ROI', value: fmtPct(roi), sub: '(Total value − investment) / investment' },
            { label: 'EOY3 Run-Rate', value: fmtUSD(runRate), sub: 'Annualized impact at year 3' },
          ].map((m) => (
            <div key={m.label} className="bg-sidebar rounded p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{m.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{m.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Sensitivity */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-bold mb-3">Sensitivity Analysis — Downside scenarios CFOs always probe</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-2 text-xs font-semibold text-brand-accent uppercase">Scenario</th>
                  <th className="text-right p-2 text-xs font-semibold text-brand-accent uppercase">3-Year Value</th>
                  <th className="text-right p-2 text-xs font-semibold text-brand-accent uppercase">NPV</th>
                  <th className="text-right p-2 text-xs font-semibold text-brand-accent uppercase">ROI</th>
                  <th className="text-right p-2 text-xs font-semibold text-brand-accent uppercase">Payback</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {scenarios.map((s) => (
                  <tr key={s.name} className={cn(s.factor === 1.0 ? 'bg-muted/30 font-semibold' : '')}>
                    <td className="p-2 text-sm">{s.name}</td>
                    <td className="p-2 text-right tabular-nums">{fmtUSD(s.totalVal)}</td>
                    <td className={cn('p-2 text-right tabular-nums', s.npv < 0 ? 'text-red-500' : '')}>{fmtUSD(s.npv)}</td>
                    <td className="p-2 text-right tabular-nums">{s.roi}</td>
                    <td className="p-2 text-right">{s.payback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CFO Talking Points */}
      <div className="rounded-lg border bg-muted/20 p-5">
        <h2 className="text-sm font-bold mb-3">CFO Talking Points — How to Frame This in the Conversation</h2>
        <div className="space-y-3">
          {talkingPoints.map((pt, i) => (
            <div key={i} className={cn('text-sm', i === talkingPoints.length - 1 ? 'border-t pt-3' : '')}>
              <p className="text-muted-foreground">{pt}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-4">
        AI Investment ROI Calculator · Built for the CFO conversation, not the marketing pitch · Equinix GTM AI Business Transformation
      </p>
    </div>
  );
}
