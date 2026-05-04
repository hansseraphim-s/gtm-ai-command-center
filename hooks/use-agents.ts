'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAllAgents, saveAgent, deleteAgent } from '@/lib/storage';
import { loadSeedDataIfEmpty } from '@/lib/seed-data';
import type { Agent } from '@/lib/types';

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadSeedDataIfEmpty();
      const data = await getAllAgents();
      data.sort((a, b) => a.code.localeCompare(b.code));
      setAgents(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const upsertAgent = useCallback(async (agent: Agent) => {
    await saveAgent(agent);
    setAgents((prev) => {
      const idx = prev.findIndex((a) => a.id === agent.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = agent;
        return next;
      }
      return [...prev, agent].sort((a, b) => a.code.localeCompare(b.code));
    });
  }, []);

  const removeAgent = useCallback(async (id: string) => {
    await deleteAgent(id);
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { agents, loading, error, reload: load, upsertAgent, removeAgent };
}
