import { get, set, del, keys, createStore } from 'idb-keyval';
import type {
  Agent,
  PortfolioConfig,
  DataFeasibilityAssessment,
  ROIMethodology,
  ROIAuditEntry,
  ActivityEntry,
} from './types';

// Each store is a separate IDB database — idb-keyval creates one store per DB.
const agentStore = createStore('gtm-agents', 'agents');
const configStore = createStore('gtm-config', 'config');
const feasibilityStore = createStore('gtm-data-feasibility', 'assessments');
const methodologyStore = createStore('gtm-methodologies', 'methodologies');
const auditStore = createStore('gtm-roi-audit', 'entries');
const activityStore = createStore('gtm-activity', 'entries');

// ─── Agents ───────────────────────────────────────────────────────────────────

export async function getAllAgents(): Promise<Agent[]> {
  const agentKeys = await keys(agentStore);
  const agents = await Promise.all(
    agentKeys.map((k) => get<Agent>(k, agentStore))
  );
  return agents.filter((a): a is Agent => a !== undefined);
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  return get<Agent>(id, agentStore);
}

export async function saveAgent(agent: Agent): Promise<void> {
  await set(agent.id, agent, agentStore);
}

export async function deleteAgent(id: string): Promise<void> {
  await del(id, agentStore);
}

export async function getAgentCount(): Promise<number> {
  const agentKeys = await keys(agentStore);
  return agentKeys.length;
}

// ─── Portfolio Config ─────────────────────────────────────────────────────────

const CONFIG_KEY = 'portfolio-config';

export async function getPortfolioConfig(): Promise<
  PortfolioConfig | undefined
> {
  return get<PortfolioConfig>(CONFIG_KEY, configStore);
}

export async function savePortfolioConfig(config: PortfolioConfig): Promise<void> {
  await set(CONFIG_KEY, config, configStore);
}

// ─── Data Feasibility Assessments ────────────────────────────────────────────

export async function getDataFeasibility(
  agentId: string
): Promise<DataFeasibilityAssessment | undefined> {
  return get<DataFeasibilityAssessment>(agentId, feasibilityStore);
}

export async function saveDataFeasibility(
  assessment: DataFeasibilityAssessment
): Promise<void> {
  await set(assessment.agentId, assessment, feasibilityStore);
}

export async function getAllDataFeasibilityAssessments(): Promise<
  DataFeasibilityAssessment[]
> {
  const allKeys = await keys(feasibilityStore);
  const items = await Promise.all(
    allKeys.map((k) => get<DataFeasibilityAssessment>(k, feasibilityStore))
  );
  return items.filter((a): a is DataFeasibilityAssessment => a !== undefined);
}

// ─── ROI Methodologies ───────────────────────────────────────────────────────

export async function getROIMethodologiesForAgent(
  agentId: string
): Promise<ROIMethodology[]> {
  const allKeys = await keys(methodologyStore);
  const items = await Promise.all(
    allKeys.map((k) => get<ROIMethodology>(k, methodologyStore))
  );
  return items.filter(
    (m): m is ROIMethodology => m !== undefined && m.agentId === agentId
  );
}

export async function getAllROIMethodologies(): Promise<ROIMethodology[]> {
  const allKeys = await keys(methodologyStore);
  const items = await Promise.all(
    allKeys.map((k) => get<ROIMethodology>(k, methodologyStore))
  );
  return items.filter((m): m is ROIMethodology => m !== undefined);
}

export async function saveROIMethodology(
  methodology: ROIMethodology
): Promise<void> {
  await set(methodology.id, methodology, methodologyStore);
}

// ─── ROI Audit Log (append-only) ─────────────────────────────────────────────

export async function appendROIAuditEntry(entry: ROIAuditEntry): Promise<void> {
  await set(entry.id, entry, auditStore);
}

export async function getROIAuditLogForAgent(
  agentId: string
): Promise<ROIAuditEntry[]> {
  const allKeys = await keys(auditStore);
  const items = await Promise.all(
    allKeys.map((k) => get<ROIAuditEntry>(k, auditStore))
  );
  return items
    .filter((e): e is ROIAuditEntry => e !== undefined && e.agentId === agentId)
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt));
}

export async function getAllROIAuditEntries(): Promise<ROIAuditEntry[]> {
  const allKeys = await keys(auditStore);
  const items = await Promise.all(
    allKeys.map((k) => get<ROIAuditEntry>(k, auditStore))
  );
  return items
    .filter((e): e is ROIAuditEntry => e !== undefined)
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt));
}

// ─── Activity Log (append-only per agent) ────────────────────────────────────

export async function appendActivityEntry(entry: ActivityEntry): Promise<void> {
  await set(entry.id, entry, activityStore);
}

export async function getActivityLogForAgent(
  agentId: string
): Promise<ActivityEntry[]> {
  const allKeys = await keys(activityStore);
  const items = await Promise.all(
    allKeys.map((k) => get<ActivityEntry>(k, activityStore))
  );
  return items
    .filter(
      (e): e is ActivityEntry => e !== undefined && e.agentId === agentId
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getAllActivityEntries(limit?: number): Promise<ActivityEntry[]> {
  const allKeys = await keys(activityStore);
  const items = await Promise.all(
    allKeys.map((k) => get<ActivityEntry>(k, activityStore))
  );
  const sorted = items
    .filter((e): e is ActivityEntry => e !== undefined)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return limit ? sorted.slice(0, limit) : sorted;
}

// ─── Bulk Export / Import ─────────────────────────────────────────────────────

export type ExportPayload = {
  exportedAt: string;
  version: 1;
  agents: Agent[];
  config: PortfolioConfig | undefined;
  dataFeasibilityAssessments: DataFeasibilityAssessment[];
  roiMethodologies: ROIMethodology[];
  roiAuditEntries: ROIAuditEntry[];
  activityEntries: ActivityEntry[];
};

export async function exportAllData(): Promise<ExportPayload> {
  const [agents, config, dataFeasibilityAssessments, roiMethodologies, roiAuditEntries] =
    await Promise.all([
      getAllAgents(),
      getPortfolioConfig(),
      getAllDataFeasibilityAssessments(),
      getAllROIMethodologies(),
      getAllROIAuditEntries(),
    ]);

  const activityKeys = await keys(activityStore);
  const activityItems = await Promise.all(
    activityKeys.map((k) => get<ActivityEntry>(k, activityStore))
  );
  const activityEntries = activityItems.filter(
    (e): e is ActivityEntry => e !== undefined
  );

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    agents,
    config,
    dataFeasibilityAssessments,
    roiMethodologies,
    roiAuditEntries,
    activityEntries,
  };
}

export async function importAllData(payload: ExportPayload): Promise<void> {
  await Promise.all([
    ...payload.agents.map(saveAgent),
    payload.config ? savePortfolioConfig(payload.config) : Promise.resolve(),
    ...payload.dataFeasibilityAssessments.map(saveDataFeasibility),
    ...payload.roiMethodologies.map(saveROIMethodology),
    ...payload.roiAuditEntries.map(appendROIAuditEntry),
    ...payload.activityEntries.map(appendActivityEntry),
  ]);
}

// ─── Dev utility: wipe all stores ────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  const stores = [
    agentStore,
    configStore,
    feasibilityStore,
    methodologyStore,
    auditStore,
    activityStore,
  ];

  await Promise.all(
    stores.map(async (store) => {
      const storeKeys = await keys(store);
      await Promise.all(storeKeys.map((k) => del(k, store)));
    })
  );
}
