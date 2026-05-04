'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { AgentFunction, AgentStage } from '@/lib/types';
import { useAgents } from '@/hooks/use-agents';
import { isoNow } from '@/lib/utils';
import { logActivity } from '@/lib/activity';
import { PageHeader } from '@/components/layout/header';
import { StagePipeline } from '@/components/agents/stage-pipeline';
import { AgentTable } from '@/components/agents/agent-table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PortfolioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { agents, loading, upsertAgent, removeAgent } = useAgents();
  const [stageFilter, setStageFilter] = useState<AgentStage | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Pre-apply ?fn= filter passed by function-view deep links
  const fnParam = searchParams.get('fn') as AgentFunction | null;
  const [initialFnApplied, setInitialFnApplied] = useState(false);

  useEffect(() => {
    if (fnParam && !initialFnApplied && !loading) {
      setInitialFnApplied(true);
    }
  }, [fnParam, initialFnApplied, loading]);

  const handleStageChange = useCallback(
    async (newStage: AgentStage, agentId: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return;
      await upsertAgent({ ...agent, stage: newStage, updatedAt: isoNow() });
      await logActivity({
        agentId,
        type: 'stage_change',
        summary: `Stage advanced to ${newStage}`,
        previousStage: agent.stage,
        newStage,
      });
    },
    [agents, upsertAgent]
  );

  const handleDelete = useCallback(
    async (agentId: string) => {
      setDeleteConfirm(agentId);
    },
    []
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    await removeAgent(deleteConfirm);
    setDeleteConfirm(null);
  }, [deleteConfirm, removeAgent]);

  const agentToDelete = agents.find((a) => a.id === deleteConfirm);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Loading portfolio…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Portfolio"
        subtitle={`${agents.length} agents · full lifecycle from idea to production`}
        actions={
          <Button size="sm" onClick={() => router.push('/agents/new')}>
            <Plus className="h-4 w-4 mr-1.5" />New agent
          </Button>
        }
      />

      {/* Stage pipeline — clickable stage filters */}
      <StagePipeline
        agents={agents}
        activeStage={stageFilter}
        onStageClick={setStageFilter}
      />

      {/* Agent table */}
      <AgentTable
        agents={agents}
        stageFilter={stageFilter}
        onStageChange={handleStageChange}
        onDelete={handleDelete}
        initialFunctionFilter={fnParam ?? undefined}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete agent?</DialogTitle>
            <DialogDescription>
              This permanently deletes <strong>{agentToDelete?.code} — {agentToDelete?.name}</strong> and all
              associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
