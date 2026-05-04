'use client';

import { useRouter } from 'next/navigation';
import type { Agent } from '@/lib/types';
import { saveAgent } from '@/lib/storage';
import { logActivity } from '@/lib/activity';
import { AgentForm } from '@/components/agents/agent-form';
import { PageHeader } from '@/components/layout/header';

export default function NewAgentPage() {
  const router = useRouter();

  async function handleSave(agent: Agent) {
    await saveAgent(agent);
    await logActivity({
      agentId: agent.id,
      type: 'decision',
      summary: `Agent created: ${agent.code} — ${agent.name}`,
      detail: `Stage: ${agent.stage} · Owner: ${agent.owner}`,
    });
    router.push(`/portfolio/${agent.id}`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="New Agent" subtitle="Define a new AI capability in the portfolio" />
      <AgentForm onSave={handleSave} onCancel={() => router.push('/portfolio')} />
    </div>
  );
}
