import type { ActionOptionId } from "./mockData";

export type PatternEvalId = "intent-misclassification" | "tool-failure" | "reasoning-failure";

export type EvalStatusTier = "good" | "warning" | "bad";

export type LlmDimension = "Correctness" | "Reasoning" | "Tone" | "Safety";

export type LlmJudgeBreakdownItem = {
  dimension: LlmDimension;
  score: number;
  max: number;
  tier: EvalStatusTier;
  /** Short label e.g. "(low)" for low correctness */
  tag?: string;
};

export type LlmJudgeResult = {
  overall: number;
  max: number;
  breakdown: LlmJudgeBreakdownItem[];
  insight: string;
  applyFix: { label: string; causeId: PatternEvalId; optionId?: ActionOptionId };
};

export type ProcessStep = { name: string; status: "pass" | "warn" | "fail" };

export type ProcessEvalResult = {
  steps: ProcessStep[];
  pathEfficiency: number;
  toolAccuracy: number;
  insight: string;
  applyFix: { label: string; causeId: PatternEvalId; optionId?: ActionOptionId };
};

export type DeterministicCheck = { label: string; ok: boolean };

export type DeterministicEvalResult = {
  checks: DeterministicCheck[];
  passRate: number;
  insight: string;
  applyFix: { label: string; causeId: PatternEvalId; optionId?: ActionOptionId };
};

export type PatternEvaluationBundle = {
  patternName: string;
  evidenceBullets: string[];
  llm: LlmJudgeResult;
  process: ProcessEvalResult;
  deterministic: DeterministicEvalResult;
  /** Used for Before vs After table after optimization */
  uplift: { correctness: number; toolAccuracyPct: number };
};

function isPattern(id: string): id is PatternEvalId {
  return id === "intent-misclassification" || id === "tool-failure" || id === "reasoning-failure";
}

const bundles: Record<PatternEvalId, PatternEvaluationBundle> = {
  "intent-misclassification": {
    patternName: "Intent Misclassification",
    evidenceBullets: [
      "LLM-as-a-Judge: Correctness is the weakest dimension — consistent with misrouted intents, not safety regressions.",
      "Process evaluation: Intent Detection fails first; downstream tool calls follow the wrong task graph.",
      "Deterministic checks: structured tool outputs disagree with expected SQL/API contracts for shipping queries."
    ],
    llm: {
      overall: 7.2,
      max: 10,
      breakdown: [
        { dimension: "Correctness", score: 6.5, max: 10, tier: "bad", tag: "(low)" },
        { dimension: "Reasoning", score: 7.0, max: 10, tier: "warning" },
        { dimension: "Tone", score: 8.5, max: 10, tier: "good" },
        { dimension: "Safety", score: 9.0, max: 10, tier: "good" }
      ],
      insight: "Low correctness aligns with intent misclassification pattern",
      applyFix: {
        label: "Optimize Intent Classification",
        causeId: "intent-misclassification",
        optionId: "add-training-samples"
      }
    },
    process: {
      steps: [
        { name: "Intent Detection", status: "fail" },
        { name: "Tool Selection", status: "fail" },
        { name: "Response Generation", status: "warn" }
      ],
      pathEfficiency: 60,
      toolAccuracy: 55,
      insight: "Intent routing failure drives incorrect tool invocation for this cohort — aligned with Intent Misclassification.",
      applyFix: {
        label: "Optimize Intent Classification",
        causeId: "intent-misclassification",
        optionId: "add-context-signals"
      }
    },
    deterministic: {
      checks: [
        { label: "SQL result match", ok: false },
        { label: "API response valid", ok: false },
        { label: "Code output", ok: true }
      ],
      passRate: 70,
      insight: "Mismatch in tool output contributes to resolution drop",
      applyFix: {
        label: "Improve RAG Retrieval",
        causeId: "intent-misclassification",
        optionId: "rag-retrieval"
      }
    },
    uplift: { correctness: 1.7, toolAccuracyPct: 25 }
  },
  "tool-failure": {
    patternName: "Tool Failure",
    evidenceBullets: [
      "LLM-as-a-Judge: Reasoning stays moderate while Correctness dips — typical when tools return empty or wrong payloads.",
      "Process evaluation: Tool Selection fails even when intent is stable — matches API reliability incidents.",
      "Deterministic checks: API and SQL gates fail while generated prose still formats — points to integration faults."
    ],
    llm: {
      overall: 6.9,
      max: 10,
      breakdown: [
        { dimension: "Correctness", score: 6.4, max: 10, tier: "bad" },
        { dimension: "Reasoning", score: 7.1, max: 10, tier: "warning" },
        { dimension: "Tone", score: 8.2, max: 10, tier: "good" },
        { dimension: "Safety", score: 8.8, max: 10, tier: "good" }
      ],
      insight: "Score profile matches Tool Failure sessions: the model explains well but cannot ground answers in reliable tool data.",
      applyFix: { label: "Fix Tool Calls", causeId: "tool-failure", optionId: "retry-mechanism" }
    },
    process: {
      steps: [
        { name: "Intent Detection", status: "pass" },
        { name: "Tool Selection", status: "fail" },
        { name: "Response Generation", status: "warn" }
      ],
      pathEfficiency: 60,
      toolAccuracy: 55,
      insight: "Tool misuse contributes to failure pattern",
      applyFix: { label: "Fix Tool Calls", causeId: "tool-failure", optionId: "retry-mechanism" }
    },
    deterministic: {
      checks: [
        { label: "SQL result match", ok: false },
        { label: "API response valid", ok: false },
        { label: "Code output", ok: true }
      ],
      passRate: 70,
      insight: "Mismatch in tool output contributes to resolution drop",
      applyFix: { label: "Fix Tool Calls", causeId: "tool-failure", optionId: "fallback-response" }
    },
    uplift: { correctness: 1.5, toolAccuracyPct: 25 }
  },
  "reasoning-failure": {
    patternName: "Reasoning Failure",
    evidenceBullets: [
      "LLM-as-a-Judge: Reasoning is the softest dimension while tools verify — consistent with partial multi-step handling.",
      "Process evaluation: early steps pass but final response assembly degrades — matches multi-intent reasoning gaps.",
      "Deterministic checks: code formatting passes; contract checks waver when multiple subtasks are entangled."
    ],
    llm: {
      overall: 7.0,
      max: 10,
      breakdown: [
        { dimension: "Correctness", score: 6.8, max: 10, tier: "warning" },
        { dimension: "Reasoning", score: 6.2, max: 10, tier: "bad", tag: "(low)" },
        { dimension: "Tone", score: 8.4, max: 10, tier: "good" },
        { dimension: "Safety", score: 8.9, max: 10, tier: "good" }
      ],
      insight: "Low reasoning scores align with Reasoning Failure: the agent stops after one subtask instead of completing the bundle.",
      applyFix: { label: "Improve Multi-step Reasoning", causeId: "reasoning-failure", optionId: "planner" }
    },
    process: {
      steps: [
        { name: "Intent Detection", status: "pass" },
        { name: "Tool Selection", status: "pass" },
        { name: "Response Generation", status: "fail" }
      ],
      pathEfficiency: 48,
      toolAccuracy: 82,
      insight: "Execution path is tool-complete but response synthesis drops — characteristic of Reasoning Failure in this slice.",
      applyFix: { label: "Improve Multi-step Reasoning", causeId: "reasoning-failure", optionId: "cot" }
    },
    deterministic: {
      checks: [
        { label: "SQL result match", ok: true },
        { label: "API response valid", ok: false },
        { label: "Code output", ok: true }
      ],
      passRate: 70,
      insight: "Partial contract mismatches map to incomplete reasoning chains rather than a single tool outage.",
      applyFix: { label: "Improve Multi-step Reasoning", causeId: "reasoning-failure", optionId: "planner" }
    },
    uplift: { correctness: 1.2, toolAccuracyPct: 8 }
  }
};

export function getPatternEvaluationBundle(patternId: string): PatternEvaluationBundle {
  if (!isPattern(patternId)) return bundles["intent-misclassification"];
  return bundles[patternId];
}

/** Ask sidebar: model vs tool diagnosis */
export function isModelVsToolEvaluationQuestion(q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return false;
  const modelTool =
    t.includes("model") && (t.includes("tool") || t.includes("tools"));
  const context =
    t.includes("problem") ||
    t.includes("issue") ||
    t.includes("fault") ||
    t.includes("caused") ||
    t.includes("because") ||
    t.includes("which") ||
    t.includes(" or ");
  return modelTool && context;
}
