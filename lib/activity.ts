import type { ActivityEntry, ActivityEntryType, AgentStage } from './types';
import { appendActivityEntry } from './storage';

export async function logActivity(opts: {
  agentId: string;
  type: ActivityEntryType;
  summary: string;
  detail?: string;
  previousStage?: AgentStage;
  newStage?: AgentStage;
}): Promise<void> {
  const entry: ActivityEntry = {
    id: crypto.randomUUID(),
    agentId: opts.agentId,
    timestamp: new Date().toISOString(),
    author: 'You',
    type: opts.type,
    summary: opts.summary,
    detail: opts.detail,
    previousStage: opts.previousStage,
    newStage: opts.newStage,
  };
  await appendActivityEntry(entry);
}
