import { metrics, resolutionRate24hTrend, METRIC_DRIVER_HINT } from "./mockData";

export const rangeOptions = [
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "90d", label: "Last 3 Months" }
] as const;

export const agentOptions = ["Taobao AI CS", "Logistics Assistant", "Returns Copilot"];

export const metricFooterHint = METRIC_DRIVER_HINT;

const metric = (id: string) => metrics.find((m) => m.id === id)!;

const npsCurrent = Number.parseInt(metric("nps").current.replace(/\D/g, ""), 10);

export const npsGauge = {
  score: Number.isFinite(npsCurrent) ? npsCurrent : 34,
  status: "Needs attention"
};

/** Stacked-style chart: resolved % vs remainder (same window as the 24h incident). */
export const resolutionTrend = resolutionRate24hTrend.map((t) => ({
  month: t.label,
  resolved: t.value,
  unresolved: Math.max(0, Math.round(100 - t.value))
}));

export const ahtMiniTrend = metric("latency").trend.map((t, i) => ({
  point: `T${i + 1}`,
  value: Math.round(t.value * 950)
}));

export const taskFunnel = [
  { stage: "Initiated", value: 100 },
  { stage: "Intent confirmed", value: 72 },
  { stage: "Knowledge retrieved", value: 68 },
  { stage: "Tool executed", value: 64 },
  { stage: "Task complete", value: 60 }
];

export const escalationTrend = metric("escalation").trend.map((t, i) => ({
  label: `W${i + 1}`,
  sessions: Math.round(1247 * (t.value / 100)),
  rate: t.value
}));

export const topAgentSessions = [
  { name: "Taobao AI CS", resolution: "62%", nps: "34", aht: "1.2s", rps: "28%" }
];

export const latencySeries = metric("latency").trend.map((t) => ({
  label: t.label,
  p50: Math.round(t.value * 720),
  p95: Math.round(t.value * 1180),
  p99: Math.round(t.value * 1520)
}));

/** Simplified confusion emphasis — only intent / routing story (no extra root causes). */
export const intentMatrix = [
  { actual: "Shipping", predicted: "Refund (wrong)", value: 312 },
  { actual: "Shipping", predicted: "Shipping (ok)", value: 942 },
  { actual: "Multi-intent", predicted: "Single topic", value: 198 },
  { actual: "Other", predicted: "Other", value: 421 }
];

// Legacy export retained for compatibility; now driven by RAG Score.
export const ragHitSeries = metric("rag-score").trend.map((t) => ({
  label: t.label,
  hit: t.value,
  miss: Math.max(0, 100 - t.value)
}));
