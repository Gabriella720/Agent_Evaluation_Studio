export type DataSourceId = "feedback" | "production" | "trace";

export type DataSourceStatus = "connected" | "syncing" | "degraded";

export type DataSourceConfig = {
  id: DataSourceId;
  label: string;
  shortLabel: string;
  description: string;
  endpoint: string;
  authMethod: string;
  status: DataSourceStatus;
  lastSync: string;
  records24h: number;
  /** Demo: contributes to unified incident cohort */
  cohortCoveragePct: number;
};

export type FeedbackRecord = {
  id: string;
  sessionId: string;
  signal: "thumbs_down" | "thumbs_up" | "correction" | "re_ask";
  userComment?: string;
  intent: string;
  timestamp: string;
  linkedPattern?: string;
};

export type ProductionSessionRecord = {
  id: string;
  sessionId: string;
  channel: string;
  intent: string;
  resolved: boolean;
  latencyMs: number;
  escalation: boolean;
  timestamp: string;
};

export type TraceNodeType =
  | "intent"
  | "plan"
  | "reasoning"
  | "rag_retrieval"
  | "tool_call"
  | "response";

export type TraceNode = {
  id: string;
  type: TraceNodeType;
  name: string;
  latencyMs: number;
  status: "ok" | "warn" | "fail";
  summary: string;
  detail?: string;
  metadata?: { label: string; value: string }[];
};

export type AgentTraceSample = {
  traceId: string;
  sessionId: string;
  patternId: string;
  outcome: "success" | "failure";
  totalLatencyMs: number;
  sampled: boolean;
  nodes: TraceNode[];
};

export const dataSourceConfigs: Record<DataSourceId, DataSourceConfig> = {
  feedback: {
    id: "feedback",
    label: "User Feedback",
    shortLabel: "Feedback",
    description:
      "Collect thumbs, corrections, re-asks, and free-text signals from live CS sessions — front-line subjective experience becomes labeled training assets.",
    endpoint: "POST /v1/ingest/feedback",
    authMethod: "Bearer token (scoped: feedback.write)",
    status: "connected",
    lastSync: "2 min ago",
    records24h: 3842,
    cohortCoveragePct: 100
  },
  production: {
    id: "production",
    label: "Production Telemetry",
    shortLabel: "Production",
    description:
      "Stream agent online environment metrics: session outcomes, intent labels, latency, escalation, and API health from Taobao AI CS production traffic.",
    endpoint: "POST /v1/ingest/sessions",
    authMethod: "Service account + mTLS",
    status: "connected",
    lastSync: "30 sec ago",
    records24h: 1247,
    cohortCoveragePct: 100
  },
  trace: {
    id: "trace",
    label: "Agent Trace",
    shortLabel: "Trace",
    description:
      "Sample full decision-chain spans: intent → plan → reasoning → RAG retrieval → tool calls → response. Trace ≠ Log — Trace = Asset for Failure Pattern discovery.",
    endpoint: "POST /v1/ingest/traces",
    authMethod: "OTLP / JSON spans",
    status: "connected",
    lastSync: "1 min ago",
    records24h: 892,
    cohortCoveragePct: 71
  }
};

export const feedbackConfigFields = [
  { key: "channels", label: "Channels", value: "In-app widget, post-session survey, agent handoff" },
  { key: "signals", label: "Signals", value: "thumbs_up, thumbs_down, correction, re_ask, free_text" },
  { key: "pii", label: "PII handling", value: "Redact payment IDs before storage" },
  { key: "batch", label: "Batch window", value: "Real-time stream + 5 min micro-batch" }
];

export const productionConfigFields = [
  { key: "env", label: "Environment", value: "prod / taobao-ai-cs / cn-hangzhou" },
  { key: "sampling", label: "Session sampling", value: "100% failing sessions, 10% success (cost cap)" },
  { key: "fields", label: "Required fields", value: "session_id, intent, resolved, latency_ms, tool_errors" },
  { key: "retention", label: "Retention", value: "Hot 7d · Warm 90d · Archive 1y" }
];

export const traceConfigFields = [
  { key: "sampling", label: "Trace sampling", value: "100% error traces · 25% success · 100% escalation" },
  { key: "spans", label: "Required spans", value: "intent, plan, reasoning, rag_retrieval, tool_call, response" },
  { key: "rag", label: "RAG payload", value: "query, top_k, chunk_ids, scores, reranker" },
  { key: "tools", label: "Tool payload", value: "name, args_hash, status, latency, retry_count" }
];

export const feedbackSampleRecords: FeedbackRecord[] = [
  {
    id: "fb-001",
    sessionId: "sess-88421",
    signal: "thumbs_down",
    userComment: "Asked for refund, got shipping info instead",
    intent: "refund_request",
    timestamp: "2026-05-20 14:32",
    linkedPattern: "Intent Misunderstanding"
  },
  {
    id: "fb-002",
    sessionId: "sess-88455",
    signal: "correction",
    userComment: "No — cancel the order, don't change address",
    intent: "order_cancel",
    timestamp: "2026-05-20 14:28",
    linkedPattern: "Reasoning Failure"
  },
  {
    id: "fb-003",
    sessionId: "sess-88390",
    signal: "re_ask",
    intent: "shipping_status",
    timestamp: "2026-05-20 14:15"
  },
  {
    id: "fb-004",
    sessionId: "sess-88312",
    signal: "thumbs_up",
    intent: "track_package",
    timestamp: "2026-05-20 13:58"
  }
];

export const productionSampleRecords: ProductionSessionRecord[] = [
  {
    id: "prod-001",
    sessionId: "sess-88421",
    channel: "mobile_app",
    intent: "refund_request",
    resolved: false,
    latencyMs: 4200,
    escalation: true,
    timestamp: "2026-05-20 14:32"
  },
  {
    id: "prod-002",
    sessionId: "sess-88455",
    channel: "web",
    intent: "order_cancel",
    resolved: false,
    latencyMs: 3100,
    escalation: false,
    timestamp: "2026-05-20 14:28"
  },
  {
    id: "prod-003",
    sessionId: "sess-88390",
    channel: "mobile_app",
    intent: "shipping_status",
    resolved: true,
    latencyMs: 1800,
    escalation: false,
    timestamp: "2026-05-20 14:15"
  },
  {
    id: "prod-004",
    sessionId: "sess-88201",
    channel: "web",
    intent: "order_status",
    resolved: false,
    latencyMs: 5200,
    escalation: false,
    timestamp: "2026-05-20 13:40"
  }
];

export const agentTraceSamples: AgentTraceSample[] = [
  {
    traceId: "tr-88421-a",
    sessionId: "sess-88421",
    patternId: "intent-misclassification",
    outcome: "failure",
    totalLatencyMs: 4180,
    sampled: true,
    nodes: [
      {
        id: "n1",
        type: "intent",
        name: "Intent Detection",
        latencyMs: 95,
        status: "fail",
        summary: "Classified as shipping_inquiry (0.72) — expected refund_request",
        metadata: [
          { label: "predicted", value: "shipping_inquiry" },
          { label: "confidence", value: "0.72" }
        ]
      },
      {
        id: "n2",
        type: "plan",
        name: "Task Planner",
        latencyMs: 140,
        status: "warn",
        summary: "Plan: lookup_order → return_tracking — misaligned with refund intent",
        detail: "Subtasks: [check_carrier_status, format_tracking_link]"
      },
      {
        id: "n3",
        type: "reasoning",
        name: "Chain-of-Thought",
        latencyMs: 220,
        status: "warn",
        summary: "Reasoning anchored on shipping keywords; refund policy not retrieved"
      },
      {
        id: "n4",
        type: "rag_retrieval",
        name: "RAG Retrieval",
        latencyMs: 380,
        status: "ok",
        summary: "Top-3 chunks: shipping_policy, tracking_faq, delivery_sla",
        metadata: [
          { label: "top_k", value: "3" },
          { label: "max_score", value: "0.81" },
          { label: "chunks", value: "ship-042, faq-018, sla-003" }
        ]
      },
      {
        id: "n5",
        type: "tool_call",
        name: "order_api.lookup",
        latencyMs: 890,
        status: "ok",
        summary: "Returned order #48291 — status: out_for_delivery",
        metadata: [
          { label: "tool", value: "order_api.lookup" },
          { label: "retries", value: "0" }
        ]
      },
      {
        id: "n6",
        type: "response",
        name: "Response Generation",
        latencyMs: 680,
        status: "fail",
        summary: "Generated tracking reply — user asked for refund path"
      }
    ]
  },
  {
    traceId: "tr-88455-b",
    sessionId: "sess-88455",
    patternId: "reasoning-failure",
    outcome: "failure",
    totalLatencyMs: 3050,
    sampled: true,
    nodes: [
      {
        id: "n1",
        type: "intent",
        name: "Intent Detection",
        latencyMs: 88,
        status: "ok",
        summary: "order_cancel (0.91)"
      },
      {
        id: "n2",
        type: "plan",
        name: "Task Planner",
        latencyMs: 120,
        status: "ok",
        summary: "Plan: verify_order → invoke_cancel_flow → confirm"
      },
      {
        id: "n3",
        type: "reasoning",
        name: "Chain-of-Thought",
        latencyMs: 190,
        status: "fail",
        summary: "Stopped after address-change subtask — cancel branch not executed",
        detail: "Partial plan completion: address_update only"
      },
      {
        id: "n4",
        type: "tool_call",
        name: "address_api.update",
        latencyMs: 720,
        status: "ok",
        summary: "Updated shipping address on order #48291",
        metadata: [{ label: "tool", value: "address_api.update" }]
      },
      {
        id: "n5",
        type: "response",
        name: "Response Generation",
        latencyMs: 540,
        status: "fail",
        summary: "Confirmed address change — user requested cancellation"
      }
    ]
  },
  {
    traceId: "tr-88201-c",
    sessionId: "sess-88201",
    patternId: "tool-failure",
    outcome: "failure",
    totalLatencyMs: 5180,
    sampled: true,
    nodes: [
      {
        id: "n1",
        type: "intent",
        name: "Intent Detection",
        latencyMs: 92,
        status: "ok",
        summary: "order_status (0.89)"
      },
      {
        id: "n2",
        type: "plan",
        name: "Task Planner",
        latencyMs: 110,
        status: "ok",
        summary: "Plan: resolve_tracking_id → logistics_api.status"
      },
      {
        id: "n3",
        type: "rag_retrieval",
        name: "RAG Retrieval",
        latencyMs: 340,
        status: "ok",
        summary: "Retrieved carrier_sla + tracking_help (score 0.76)"
      },
      {
        id: "n4",
        type: "tool_call",
        name: "logistics_api.track",
        latencyMs: 3200,
        status: "fail",
        summary: "API timeout after 2 retries — empty payload",
        metadata: [
          { label: "tool", value: "logistics_api.track" },
          { label: "retries", value: "2" },
          { label: "error", value: "TIMEOUT" }
        ]
      },
      {
        id: "n5",
        type: "reasoning",
        name: "Fallback Reasoning",
        latencyMs: 180,
        status: "warn",
        summary: "Hallucinated delivery ETA without tool grounding"
      },
      {
        id: "n6",
        type: "response",
        name: "Response Generation",
        latencyMs: 620,
        status: "fail",
        summary: "Fluent prose with unverified carrier status"
      }
    ]
  }
];

export const ingestionFeedbackExample = `{
  "session_id": "sess-88421",
  "signal": "thumbs_down",
  "intent": "refund_request",
  "comment": "Asked for refund, got shipping info",
  "timestamp": "2026-05-20T14:32:00Z"
}`;

export const ingestionProductionExample = `{
  "session_id": "sess-88421",
  "channel": "mobile_app",
  "intent": "refund_request",
  "resolved": false,
  "latency_ms": 4200,
  "escalation": true,
  "timestamp": "2026-05-20T14:32:00Z"
}`;

export const ingestionTraceExample = `{
  "trace_id": "tr-88421-a",
  "session_id": "sess-88421",
  "sampled": true,
  "spans": [
    {"name": "intent_detection", "type": "intent", "latency_ms": 95, "status": "fail"},
    {"name": "task_planner", "type": "plan", "latency_ms": 140},
    {"name": "chain_of_thought", "type": "reasoning", "latency_ms": 220},
    {"name": "rag_retrieval", "type": "rag_retrieval", "latency_ms": 380, "top_k": 3},
    {"name": "order_api.lookup", "type": "tool_call", "latency_ms": 890},
    {"name": "response_generation", "type": "response", "latency_ms": 680}
  ]
}`;

export const dataFusionSummary = {
  headline: "Unified incident cohort — Feedback × Production × Trace",
  bullets: [
    "Feedback surfaces subjective failure signals (thumbs, corrections, re-asks)",
    "Production telemetry anchors volume, latency, escalation, and resolution outcomes",
    "Trace spans reconstruct plan → reasoning → RAG → tools for causal Failure Pattern analysis"
  ]
};
