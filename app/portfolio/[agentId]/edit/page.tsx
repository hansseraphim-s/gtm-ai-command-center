'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Agent } from '@/lib/types';
import { getAgent, saveAgent } from '@/lib/storage';
import { logActivity } from '@/lib/activity';
import { AgentForm } from '@/components/agents/agent-form';
import { PageHeader } from '@/components/layout/header';

export default function EditAgentPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgent(agentId).then((a) => {
      setAgent(a ?? null);
      setLoading(false);
    });
  }, [agentId]);

  async function handleSave(updated: Agent) {
    await saveAgent(updated);
    const stageChanged = agent && agent.stage !== updated.stage;
    if (stageChanged) {
      await logActivity({
        agentId,
        type: 'stage_change',
        summary: `Stage changed to ${updated.stage}`,
        previousStage: agent!.stage,
        newStage: updated.stage,
      });
    } else {
      await logActivity({
        agentId,
        type: 'note',
        summary: `Agent details updated: ${updated.code} — ${updated.name}`,
      });
    }
    router.push(`/portfolio/${agentId}`);
  }

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!agent) return <div className="py-12 text-center text-sm text-muted-foreground">Agent not found.</div>;

  return (
    <div className="max-w-2xl">
      <PageHeader title={`Edit ${agent.code} — ${agent.name}`} subtitle="Update agent attributes" />
      <AgentForm
        initial={agent}
        onSave={handleSave}
        onCancel={() => router.push(`/portfolio/${agentId}`)}
      />
    </div>
  );
}
