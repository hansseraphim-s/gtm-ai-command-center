'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPortfolioConfig, savePortfolioConfig } from '@/lib/storage';
import { SEED_CONFIG } from '@/lib/seed-data';
import type { PortfolioConfig } from '@/lib/types';

export function usePortfolioConfig() {
  const [config, setConfig] = useState<PortfolioConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await getPortfolioConfig();
      setConfig(stored ?? SEED_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateConfig = useCallback(async (next: PortfolioConfig) => {
    await savePortfolioConfig(next);
    setConfig(next);
  }, []);

  return { config, loading, updateConfig };
}
