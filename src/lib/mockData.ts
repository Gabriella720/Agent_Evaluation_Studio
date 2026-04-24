/**
 * Unified demo narrative (English UI):
 * Taobao AI CS — resolution rate down 20% in the last 24h.
 * Only three root drivers: Intent MisUnderstanding (40% / -8pp), Tool Failure (35% / -7pp), Reasoning Failure (25% / -5pp).
 */

export const DEMO_CASE_TITLE = "Taobao AI Customer Service";
export const DEMO_RESOLUTION_DROP = "20%";
export const DEMO_AFFECTED_SESSIONS = "1,247";
export const METRIC_DRIVER_HINT = "Driven by intent misunderstanding & tool failures";

export type RagMetrics = {
  /** Composite score (0-100) */
  score: number;
  /** Answer accuracy on eval set (0-1) */
  accuracy: number;
  /** Retrieval recall@5 on eval set (0-1) */
  recall: number;
  /** Faithfulness / groundedness (0-1) */
  faithfulness: number;
  /** Context precision (0-1) */
  contextPrecision: number;
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type MetricItem = {
  id: string;
  group: "Business" | "Product" | "System";
  name: string;
  current: string;
  target: string;
  delta: string;
  status: "up" | "down" | "warn";
  impactHint: string;
  trend: TrendPoint[];
};

export type PatternItem = {
  id: string;
  name: string;
  percentage: number;
  sessions: number;
  resolutionImpact: string;
  businessImpact: string;
  severity: "high" | "medium" | "low";
};

export type SessionReplayItem = {
  id: string;
  patternId: PatternItem["id"];
  /** Shown as "User #12847" in session header */
  userDisplayNum?: string;
  age: string;
  userMessage: string;
  agentMessage: string;
  /** Extra turns revealed when expanding dialogue within the card */
  extraTurns?: { role: "user" | "agent"; text: string }[];
  tags: string[];
};

export type CohortReplay = {
  id: PatternItem["id"];
  title: string;
  path: string;
};

/** Ingestion examples shown on Connect (English payloads). */
export const ingestionApiExample = `{
  "session_id": "123",
  "user_input": "When will my order ship?",
  "agent_response": "One moment while I check that for you",
  "intent": "order_status",
  "latency_ms": 1200
}`;

export const ingestionTraceExample = `{
  "trace_id": "abc",
  "spans": [
    {"name": "intent_detection", "latency": 120},
    {"name": "rag_retrieval", "latency": 300},
    {"name": "response_generation", "latency": 800}
  ]
}`;

/** Resolution rate trend over the last 24h window (hourly labels). */
export const resolutionRate24hTrend: TrendPoint[] = [
  { label: "00:00", value: 82 },
  { label: "04:00", value: 80 },
  { label: "08:00", value: 78 },
  { label: "12:00", value: 74 },
  { label: "16:00", value: 68 },
  { label: "20:00", value: 62 }
];

/** RAG workspace initial eval snapshot (single source of truth). */
export const ragMetrics: RagMetrics = {
  score: 62,
  accuracy: 0.68,
  recall: 0.42,
  faithfulness: 0.71,
  contextPrecision: 0.65
};

export const metrics: MetricItem[] = [
  {
    id: "resolution-rate",
    group: "Business",
    name: "Resolution Rate",
    current: "62%",
    target: "/ 82%",
    delta: "-20%",
    status: "down",
    impactHint: METRIC_DRIVER_HINT,
    trend: resolutionRate24hTrend
  },
  {
    id: "nps",
    group: "Business",
    name: "NPS",
    current: "34",
    target: "/ 52",
    delta: "-18%",
    status: "down",
    impactHint: METRIC_DRIVER_HINT,
    trend: [
      { label: "d1", value: 48 },
      { label: "d2", value: 46 },
      { label: "d3", value: 44 },
      { label: "d4", value: 41 },
      { label: "d5", value: 38 },
      { label: "d6", value: 34 }
    ]
  },
  {
    id: "first-contact-resolution",
    group: "Business",
    name: "First Contact Resolution",
    current: "58%",
    target: "/ 76%",
    delta: "-14%",
    status: "down",
    impactHint: METRIC_DRIVER_HINT,
    trend: [
      { label: "d1", value: 74 },
      { label: "d2", value: 72 },
      { label: "d3", value: 69 },
      { label: "d4", value: 66 },
      { label: "d5", value: 62 },
      { label: "d6", value: 58 }
    ]
  },
  {
    id: "task-success",
    group: "Product",
    name: "Task Success Rate",
    current: "71%",
    target: "/ 88%",
    delta: "-12%",
    status: "down",
    impactHint: METRIC_DRIVER_HINT,
    trend: [
      { label: "d1", value: 86 },
      { label: "d2", value: 84 },
      { label: "d3", value: 82 },
      { label: "d4", value: 79 },
      { label: "d5", value: 75 },
      { label: "d6", value: 71 }
    ]
  },
  {
    id: "escalation",
    group: "Product",
    name: "Escalation Rate",
    current: "28%",
    target: "/ 16%",
    delta: "+12%",
    status: "warn",
    impactHint: METRIC_DRIVER_HINT,
    trend: [
      { label: "d1", value: 16 },
      { label: "d2", value: 18 },
      { label: "d3", value: 20 },
      { label: "d4", value: 23 },
      { label: "d5", value: 26 },
      { label: "d6", value: 28 }
    ]
  },
  {
    id: "repeat-contact-rate",
    group: "Product",
    name: "Repeat Contact Rate",
    current: "22%",
    target: "/ 12%",
    delta: "+10%",
    status: "warn",
    impactHint: METRIC_DRIVER_HINT,
    trend: [
      { label: "d1", value: 11 },
      { label: "d2", value: 12 },
      { label: "d3", value: 14 },
      { label: "d4", value: 17 },
      { label: "d5", value: 20 },
      { label: "d6", value: 22 }
    ]
  },
  {
    id: "intent-accuracy",
    group: "System",
    name: "Intent Accuracy",
    current: "76%",
    target: "/ 94%",
    delta: "-18%",
    status: "down",
    impactHint: METRIC_DRIVER_HINT,
    trend: [
      { label: "d1", value: 94 },
      { label: "d2", value: 91 },
      { label: "d3", value: 88 },
      { label: "d4", value: 84 },
      { label: "d5", value: 80 },
      { label: "d6", value: 76 }
    ]
  },
  {
    id: "latency",
    group: "System",
    name: "Latency (avg)",
    current: "1.2s",
    target: "/ 0.6s",
    delta: "+70%",
    status: "warn",
    impactHint: METRIC_DRIVER_HINT,
    trend: [
      { label: "d1", value: 0.62 },
      { label: "d2", value: 0.71 },
      { label: "d3", value: 0.8 },
      { label: "d4", value: 0.9 },
      { label: "d5", value: 1.05 },
      { label: "d6", value: 1.2 }
    ]
  },
  {
    id: "rag-score",
    group: "System",
    name: "RAG Score",
    current: "62",
    target: "/ 80",
    delta: "-18",
    status: "down",
    impactHint: METRIC_DRIVER_HINT,
    trend: [
      { label: "d1", value: 78 },
      { label: "d2", value: 74 },
      { label: "d3", value: 70 },
      { label: "d4", value: 67 },
      { label: "d5", value: 64 },
      { label: "d6", value: 62 }
    ]
  }
];

export const resolutionImpactBreakdown = [
  { label: "Intent misunderstanding", value: "-8%" },
  { label: "Tool failure", value: "-7%" },
  { label: "Reasoning failure", value: "-5%" }
] as const;

export const patterns: PatternItem[] = [
  {
    id: "intent-misclassification",
    name: "Intent MisUnderstanding",
    percentage: 40,
    sessions: 499,
    resolutionImpact: "-8%",
    businessImpact: "Example: shipping questions classified as refund",
    severity: "high"
  },
  {
    id: "tool-failure",
    name: "Tool Failure",
    percentage: 35,
    sessions: 436,
    resolutionImpact: "-7%",
    businessImpact: "Example: order lookup API failures",
    severity: "high"
  },
  {
    id: "reasoning-failure",
    name: "Reasoning Failure",
    percentage: 25,
    sessions: 312,
    resolutionImpact: "-5%",
    businessImpact: "Example: multi-intent requests partially handled",
    severity: "medium"
  }
];

export type ActionOptionId =
  | "rag-retrieval"
  | "add-training-samples"
  | "add-context-signals"
  | "retry-mechanism"
  | "fallback-response"
  | "cot"
  | "planner";

export type ActionCard = {
  id: PatternItem["id"];
  title: string;
  impact: string;
  ctaLabel: string;
  /** Step 1: analysis content */
  analysis: {
    title: string;
    bullets?: string[];
    examples?: { label: string; lines: string[] }[];
  };
  /** Step 2: selectable optimization options */
  options: { id: ActionOptionId; label: string; kind?: "drawer" | "inline" }[];
  /** Inline demo (for Tool/Reasoning) */
  demo?: {
    beforeTitle: string;
    beforeLines: string[];
    afterTitle: string;
    afterLines: string[];
    metricChanges: string[];
  };
};

export const actionCards: ActionCard[] = [
  {
    id: "intent-misclassification",
    title: "Intent MisUnderstanding",
    impact: "Resolution -8%",
    ctaLabel: "Optimize Intent Classification",
    analysis: {
      title: "Problem analysis",
      examples: [
        {
          label: "Top error example",
          lines: [
            "User: “When will my order ship?”",
            "Predicted: refund ❌",
            "Correct: shipping ✅"
          ]
        }
      ],
      bullets: ["Intent errors increased (+18% vs prior day)", "Short shipping queries over-trigger refund policy templates"]
    },
    options: [
      { id: "rag-retrieval", label: "Improve RAG Retrieval", kind: "drawer" },
      { id: "add-training-samples", label: "Add Training Samples", kind: "inline" },
      { id: "add-context-signals", label: "Add Context Signals", kind: "inline" }
    ]
  },
  {
    id: "tool-failure",
    title: "Tool Failure",
    impact: "Resolution -7%",
    ctaLabel: "Fix API Reliability",
    analysis: {
      title: "Problem analysis",
      bullets: ["API failure rate: 18%", "Primary cause: timeout on order lookup endpoint"]
    },
    options: [
      { id: "retry-mechanism", label: "Add Retry Mechanism", kind: "inline" },
      { id: "fallback-response", label: "Add Fallback Response", kind: "inline" }
    ],
    demo: {
      beforeTitle: "Before",
      beforeLines: ["Agent: “Lookup failed, please try again later.”"],
      afterTitle: "After",
      afterLines: ["Agent: “System is busy — I’ve escalated this to a human agent to resolve quickly.”"],
      metricChanges: ["Escalation Rate ↓", "Resolution ↑"]
    }
  },
  {
    id: "reasoning-failure",
    title: "Reasoning Failure",
    impact: "Resolution -5%",
    ctaLabel: "Improve Multi-step Reasoning",
    analysis: {
      title: "Problem analysis",
      bullets: ["Multi-intent requests are not decomposed", "Only one subtask is addressed per turn"]
    },
    options: [
      { id: "cot", label: "Chain-of-Thought (hidden)", kind: "inline" },
      { id: "planner", label: "Planner Module", kind: "inline" }
    ],
    demo: {
      beforeTitle: "Before",
      beforeLines: ["User: “Change address + expedite shipping”", "Agent: “You can update your address in settings.”"],
      afterTitle: "After",
      afterLines: ["Agent:", "1) Update address", "2) Confirm expedite options", "3) Apply expedited shipping"],
      metricChanges: ["Resolution ↑", "Repeat contacts ↓"]
    }
  }
];

export const ragOptimizationAssistant = {
  title: "RAG Optimization Assistant",
  currentIssues: ["Retrieval Hit Rate: 65%", "Query understanding skew (shipping synonyms routed to refund policies)"],
  suggestions: ["Add semantic embeddings", "Synonym expansion (ship = logistics)", "Add context signals (order status, carrier)"],
  before: {
    query: "When will my order ship?",
    result: "Refund policy (incorrect)"
  },
  after: {
    result: "Shipping time & tracking guidance (correct)"
  },
  metricChanges: ["Retrieval Hit Rate: 65% → 85%", "Intent Accuracy: +12%"]
};

export const expectedBusinessImpact = [
  { label: "Resolution Rate", value: "62% → 80% (+18%)" },
  { label: "Support Tickets", value: "-1,200/day" },
  { label: "NPS Improvement", value: "34 → 52 (+18 points)" }
] as const;

export const fixBeforeAfterConversations = [
  {
    id: "fix-intent",
    title: "Intent MisUnderstanding Fix",
    before: { role: "User", text: "When will my order ship?" },
    beforeAgent: { role: "Agent", text: "You can request a refund here." },
    after: { role: "User", text: "When will my order ship?" },
    afterAgent: { role: "Agent", text: "Your order is preparing for shipment. You can track status in Orders → Shipping. If you share an order ID, I can check the latest carrier update." },
    variants: [
      {
        beforeUser: "When will my order ship?",
        beforeAgent: "You can request a refund here.",
        afterAgent:
          "Your order is preparing for shipment. You can track status in Orders → Shipping. If you share an order ID, I can check the latest carrier update."
      },
      {
        beforeUser: "When will my order ship? I need it by Friday.",
        beforeAgent: "Refunds are processed in 3–5 business days.",
        afterAgent:
          "I can help with shipping. If you share your order ID, I’ll check the latest carrier estimate. If delivery by Friday isn’t available, I can offer expedite options or connect you to a human agent."
      },
      {
        beforeUser: "Why hasn’t my package shipped yet?",
        beforeAgent: "Would you like to start a return instead?",
        afterAgent:
          "I see you’re asking about shipment status. Open Orders → Shipping to view the latest update. If you paste your order ID, I can pull the carrier scan history and confirm the next checkpoint."
      }
    ]
  },
  {
    id: "fix-tool",
    title: "Tool Failure Fix (Fallback)",
    before: { role: "User", text: "Check my order status for me" },
    beforeAgent: { role: "Agent", text: "Still checking… please try again shortly." },
    after: { role: "User", text: "Check my order status for me" },
    afterAgent: { role: "Agent", text: "The order service is currently busy. I’ve escalated this to a human agent and saved your request—no need to retry. You’ll get an update in the chat shortly." },
    variants: [
      {
        beforeUser: "Check my order status for me",
        beforeAgent: "Still checking… please try again shortly.",
        afterAgent:
          "The order service is currently busy. I’ve escalated this to a human agent and saved your request—no need to retry. You’ll get an update in the chat shortly."
      },
      {
        beforeUser: "Cancel my duplicate order.",
        beforeAgent: "I could not cancel the order due to a system error.",
        afterAgent:
          "I can’t reach the cancellation service right now. I’ve queued a retry and notified a human agent. If it doesn’t succeed in 10 minutes, you’ll receive a manual confirmation here."
      },
      {
        beforeUser: "Track order TB-902184",
        beforeAgent: "Lookup failed, please try again later.",
        afterAgent:
          "I’m having trouble reaching tracking right now. I’ll keep trying in the background. Meanwhile, you can view tracking in Orders → Shipping. If you prefer, I can also escalate this to a human agent."
      }
    ]
  },
  {
    id: "fix-reasoning",
    title: "Reasoning Fix (Multi-step)",
    before: { role: "User", text: "I need to change my address and expedite shipping" },
    beforeAgent: { role: "Agent", text: "You can update your shipping address in settings." },
    after: { role: "User", text: "I need to change my address and expedite shipping" },
    afterAgent: { role: "Agent", text: "Got it. Let’s do this in two steps:\n1) Update your shipping address\n2) Apply expedited shipping if available for the carrier\nIf you share the order ID, I’ll check expedite options right away." },
    variants: [
      {
        beforeUser: "I need to change my address and expedite shipping",
        beforeAgent: "You can update your shipping address in settings.",
        afterAgent:
          "Got it. Let’s do this in two steps:\n1) Update your shipping address\n2) Apply expedited shipping if available for the carrier\nIf you share the order ID, I’ll check expedite options right away."
      },
      {
        beforeUser: "Refund to original card AND keep loyalty points.",
        beforeAgent: "Refunds typically post in 3–5 business days.",
        afterAgent:
          "Understood—two parts:\n1) Refund method: original card\n2) Loyalty points: policy depends on order status\nShare the order ID and I’ll confirm whether points are retained or reversed, then proceed with the refund request."
      },
      {
        beforeUser: "Change address + add gift note + expedite.",
        beforeAgent: "You can change your address in settings.",
        afterAgent:
          "I can help with all three. Step-by-step:\n1) Update address\n2) Add gift note\n3) Check and apply expedite options\nIf you share the order ID, I’ll verify which options are available before we proceed."
      }
    ]
  }
] as const;

export type FixConversationVariant = {
  beforeUser: string;
  beforeAgent: string;
  afterAgent: string;
};

export type FixConversationCard = {
  id: string;
  title: string;
  before: { role: "User"; text: string };
  beforeAgent: { role: "Agent"; text: string };
  after: { role: "User"; text: string };
  afterAgent: { role: "Agent"; text: string };
  variants?: readonly FixConversationVariant[];
};

export const cohortReplays: CohortReplay[] = [
  {
    id: "intent-misclassification",
    title: "Cohort 1 — Intent Error",
    path: "Shipping question → misclassified as refund → wrong answer → repeat questions → unresolved"
  },
  {
    id: "tool-failure",
    title: "Cohort 2 — Tool Failure",
    path: "Order lookup → API failure → vague reply → user exits"
  },
  {
    id: "reasoning-failure",
    title: "Cohort 3 — Reasoning Failure",
    path: "Multi-intent request → partial understanding → incomplete answer → user abandons"
  }
];

export const sessionReplays: SessionReplayItem[] = [
  {
    id: "sess-intent-001",
    patternId: "intent-misclassification",
    userDisplayNum: "12847",
    age: "12m ago",
    userMessage: "When will my order ship?",
    agentMessage: "You can request a refund here.",
    extraTurns: [
      { role: "user", text: "I did not ask for a refund — I asked when it ships." },
      { role: "agent", text: "Please choose Refund or Return from the order menu to continue." }
    ],
    tags: ["Intent: incorrect", "Sentiment: neutral → angry", "Frustration: yes"]
  },
  {
    id: "sess-tool-002",
    patternId: "tool-failure",
    userDisplayNum: "13022",
    age: "8m ago",
    userMessage: "Check my order status for me",
    agentMessage: "Still checking… please try again shortly.",
    extraTurns: [
      { role: "user", text: "Order ID TB-902184." },
      { role: "agent", text: "I am unable to reach the order service right now. Please try later." }
    ],
    tags: ["Intent: correct", "Tool: failed", "Sentiment: neutral → disappointed"]
  },
  {
    id: "sess-reason-003",
    patternId: "reasoning-failure",
    userDisplayNum: "13105",
    age: "5m ago",
    userMessage: "I need to change my address and expedite shipping",
    agentMessage: "You can update your shipping address in settings.",
    extraTurns: [
      { role: "user", text: "And expedite — it is a gift, arriving Friday." },
      { role: "agent", text: "Expedited options appear after you save the new address." }
    ],
    tags: ["Reasoning: incomplete", "Frustration: yes"]
  }
];

/** Loaded when user chooses “View more conversations” (same incident, additional sessions). */
export const sessionReplaysMore: SessionReplayItem[] = [
  {
    id: "sess-intent-004",
    patternId: "intent-misclassification",
    userDisplayNum: "12991",
    age: "22m ago",
    userMessage: "Where is my package? Tracking shows no movement.",
    agentMessage: "Would you like to start a return instead?",
    extraTurns: [{ role: "user", text: "No. I want tracking updated." }],
    tags: ["Intent: incorrect", "Sentiment: negative", "Frustration: yes"]
  },
  {
    id: "sess-tool-005",
    patternId: "tool-failure",
    userDisplayNum: "13088",
    age: "31m ago",
    userMessage: "Cancel my duplicate order.",
    agentMessage: "I could not cancel the order due to a system error.",
    tags: ["Tool: failed", "Intent: correct", "Frustration: yes"]
  },
  {
    id: "sess-reason-006",
    patternId: "reasoning-failure",
    userDisplayNum: "13144",
    age: "44m ago",
    userMessage: "Refund to original card AND keep loyalty points.",
    agentMessage: "Refunds typically post in 3–5 business days.",
    tags: ["Reasoning: incomplete", "Sentiment: neutral → negative"]
  }
];

/** Same resolution trend for Pattern “AI Analysis” sparkline. */
export const askTrend = resolutionRate24hTrend;

export const askRelatedPatterns = patterns.map((p) => ({
  id: p.id,
  name: p.name,
  impact: `${p.percentage}% of failing traffic`,
  sessions: p.sessions
}));

export const askAnalysisSummary =
  "Resolution rate fell 20% in the last 24 hours. Contributors line up with the three verified drivers: intent routing errors, tool execution failures, and incomplete reasoning on multi-intent requests.";

export const askTriggerQuestionsNormalized = [
  "why did resolution rate drop today",
  "why is resolution rate down today",
  "why did the resolution rate drop today"
];

export const askFixedInsight = {
  summaryBullets: [
    "Intent errors increased (+18% vs prior day)",
    "Tool failures increased (+12% vs prior day)",
    "Multi-intent issues frequently answered incompletely"
  ],
  topDrivers: [
    { name: "Intent MisUnderstanding", share: "40%", resolutionImpact: "-8%" },
    { name: "Tool Failure", share: "35%", resolutionImpact: "-7%" },
    { name: "Reasoning Failure", share: "25%", resolutionImpact: "-5%" }
  ],
  suggestedActions: ["Improve intent recognition", "Add API fallback paths", "Improve handling of complex questions"]
};

export const askSuggestedActionLinks = [
  { id: "intent-misclassification" as const, label: "Optimize Intent Classification" },
  { id: "tool-failure" as const, label: "Fix Tool Failures" },
  { id: "reasoning-failure" as const, label: "Improve Reasoning" }
];

export const rootCauseDrivers = [
  {
    patternId: "intent-misclassification" as const,
    headline: "Intent errors",
    body: "Shipping and logistics queries are frequently routed to refund flows.",
    resolutionImpact: "Resolution -8%"
  },
  {
    patternId: "tool-failure" as const,
    headline: "Tool failures",
    body: "Order status APIs return errors; the agent falls back to non-answers.",
    resolutionImpact: "Resolution -7%"
  },
  {
    patternId: "reasoning-failure" as const,
    headline: "Reasoning gaps",
    body: "Compound requests only receive a partial policy answer.",
    resolutionImpact: "Resolution -5%"
  }
];

export const solutionByPattern: Record<
  PatternItem["id"],
  { title: string; items: string[] }
> = {
  "intent-misclassification": {
    title: "Intent issues",
    items: ["Improve RAG recall", "Strengthen classification model", "Add contextual understanding"]
  },
  "tool-failure": {
    title: "Tool issues",
    items: ["API fallback", "Retry mechanism", "Clearer error messaging"]
  },
  "reasoning-failure": {
    title: "Reasoning issues",
    items: ["Multi-intent decomposition", "Prompt optimization", "Introduce a planner"]
  }
};

export const simulationOutcome = [
  { label: "Resolution Rate", before: "62%", after: "80%", uplift: "+18%" },
  { label: "Intent Accuracy", before: "76%", after: "96%", uplift: "+20%" },
  { label: "Escalation Rate", before: "28%", after: "13%", uplift: "-15%" }
];

export function normalizeAskQuestion(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[?!.,']/g, "")
    .replace(/\s+/g, " ");
}

export function isAskResolutionDropQuestion(text: string): boolean {
  const n = normalizeAskQuestion(text);
  if (n.includes("three verified failure")) return true;
  if (n.includes("driver") && n.includes("resolution") && n.includes("gap")) return true;
  return askTriggerQuestionsNormalized.some((q) => n.includes(q) || n === q);
}

export function isAskRagOptimizationQuestion(text: string): boolean {
  const n = normalizeAskQuestion(text);
  return (
    n.includes("optimize rag") ||
    n.includes("improve rag") ||
    n.includes("rag optimization") ||
    n.includes("rag workspace") ||
    (n.includes("improve") && n.includes("retrieval"))
  );
}
