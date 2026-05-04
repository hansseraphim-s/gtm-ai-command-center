'use client';

import { useEffect, useRef, useState } from 'react';
import type { Agent } from '@/lib/types';
import {
  exportAllData,
  importAllData,
  clearAllData,
  getAgentCount,
  type ExportPayload,
} from '@/lib/storage';
import { loadSeedData } from '@/lib/seed-data';
import { PageHeader } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Download, Upload, Trash2, Database } from 'lucide-react';
import { isoNow } from '@/lib/utils';

export default function DataPage() {
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAgentCount().then(setAgentCount);
  }, []);

  function showStatus(type: 'success' | 'error' | 'info', msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 4000);
  }

  async function handleExport() {
    try {
      const payload = await exportAllData();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtm-ai-export-${isoNow().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('success', `Exported ${payload.agents.length} agents successfully.`);
    } catch (e) {
      showStatus('error', `Export failed: ${(e as Error).message}`);
    }
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const payload: ExportPayload = JSON.parse(text);
      if (!Array.isArray(payload.agents)) throw new Error('Invalid file: missing agents array');
      await importAllData(payload);
      const count = await getAgentCount();
      setAgentCount(count);
      showStatus('success', `Imported ${payload.agents.length} agents from ${file.name}.`);
    } catch (e) {
      showStatus('error', `Import failed: ${(e as Error).message}`);
    }
  }

  async function handleSeed() {
    try {
      await loadSeedData();
      const count = await getAgentCount();
      setAgentCount(count);
      showStatus('success', `Seed data loaded — ${count} agents now in database.`);
    } catch (e) {
      showStatus('error', `Seed failed: ${(e as Error).message}`);
    }
  }

  async function handleReset() {
    try {
      await clearAllData();
      setAgentCount(0);
      setConfirmReset(false);
      showStatus('info', 'All data cleared. Database is now empty.');
    } catch (e) {
      showStatus('error', `Reset failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Data Management" subtitle="Export, import, seed, or reset local portfolio data" />

      {/* Status bar */}
      {status && (
        <div className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm ${
          status.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
          status.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
          'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          {status.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {status.type === 'error' && <AlertTriangle className="h-4 w-4 shrink-0" />}
          {status.msg}
        </div>
      )}

      {/* Current state */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />Database Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total agents</span>
            <span className="font-bold text-lg tabular-nums">{agentCount ?? '…'}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Data is stored locally in IndexedDB. It persists across browser sessions on this device.
          </p>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Export Data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download a full JSON backup of all agents, feasibility assessments, ROI methodologies,
            audit entries, and activity logs.
          </p>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />Export All Data
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Import Data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Import a previously exported JSON file. Existing records with the same IDs will be overwritten.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = '';
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" />Choose JSON File…
          </Button>
        </CardContent>
      </Card>

      {/* Seed data */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Load Seed Data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Load the 23-agent sample portfolio with realistic ROI targets, feasibility scores,
            adoption metrics, milestones, and risks. Existing data is preserved — seed agents
            are added alongside it.
          </p>
          <Button variant="outline" onClick={handleSeed} className="gap-2">
            <Database className="h-4 w-4" />Load Seed Data
          </Button>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete all agents, assessments, audit entries, and configuration.
            This cannot be undone. Export first if you want a backup.
          </p>
          {confirmReset ? (
            <div className="flex items-center gap-3">
              <Button variant="destructive" onClick={handleReset} className="gap-2">
                <Trash2 className="h-4 w-4" />Yes, delete everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 gap-2"
              onClick={() => setConfirmReset(true)}
            >
              <Trash2 className="h-4 w-4" />Reset All Data
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
