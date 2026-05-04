'use client';
import { useEffect, useState } from 'react';
import type { Agent } from '@/lib/types';
import { getAllAgents } from '@/lib/storage';
import { FunctionView } from '@/components/dashboard/function-view';

export default function CustomerSuccessPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getAllAgents().then((a) => { setAgents(a); setLoading(false); }); }, []);
  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;
  return <FunctionView agents={agents} fn="customer_success" fnLabel="Customer Success AI" />;
}
