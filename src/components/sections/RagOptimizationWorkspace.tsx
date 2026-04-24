"use client";

import type React from "react";
import { useMemo, useReducer, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { ragMetrics, type RagMetrics } from "@/lib/mockData";

type StepStatus = "good" | "warning" | "bad";

type StepId = "step0" | "step1" | "step2" | "step3" | "step4" | "step5";

type WorkspaceActionId =
  | "chunkSize"
  | "embedding"
  | "queryRewrite"
  | "rerank"
  | "context"
  | "generation"
  | "e2e";

type Experiment = {
  id: string;
  stepId: StepId;
  actionId: WorkspaceActionId;
  label: string;
  before: RagMetrics;
  after: RagMetrics;
  createdAt: number;
};

type WorkspaceState = {
  before: RagMetrics;
  current: RagMetrics;
  experiments: Experiment[];
  expanded: Partial<Record<StepId, boolean>>;
  running?: { stepId: StepId; actionId: WorkspaceActionId };
  applied: boolean;
  lastResult?: { before: RagMetrics; after: RagMetrics; summary: string };
};

type Action =
  | { type: "toggle_expand"; stepId: StepId }
  | { type: "run_start"; stepId: StepId; actionId: WorkspaceActionId }
  | { type: "run_finish"; stepId: StepId; actionId: WorkspaceActionId; label: string; after: RagMetrics; summary: string }
  | { type: "preview"; before: RagMetrics; after: RagMetrics; summary: string }
  | { type: "apply" }
  | { type: "reset_preview" };

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function formatPct01(v: number) {
  return `${Math.round(v * 100)}%`;
}

function formatScore(v: number) {
  return `${Math.round(v)}`;
}

function statusOf({ recall, accuracy }: RagMetrics): StepStatus {
  // Primary gating metric is recall; accuracy follows.
  if (recall < 0.5 || accuracy < 0.65) return "bad";
  if (recall < 0.7 || accuracy < 0.72) return "warning";
  return "good";
}

function headerHint(m: RagMetrics) {
  if (m.recall < 0.5) return "Low recall is limiting answer accuracy. Recommend improving retrieval.";
  if (m.contextPrecision < 0.65) return "Context precision is borderline. Recommend tightening chunk selection and rerank.";
  if (m.faithfulness < 0.7) return "Faithfulness is below target. Recommend stronger grounding and citation policies.";
  return "RAG quality is trending healthy. Validate with E2E evaluation to lock gains.";
}

function compositeScore(m: RagMetrics) {
  // Weighted score for a stable demo feel.
  const w = { accuracy: 0.3, recall: 0.35, faithfulness: 0.2, contextPrecision: 0.15 };
  const s =
    (m.accuracy * w.accuracy +
      m.recall * w.recall +
      m.faithfulness * w.faithfulness +
      m.contextPrecision * w.contextPrecision) *
    100;
  return Math.round(s);
}

function applyDelta(m: RagMetrics, delta: Partial<RagMetrics>): RagMetrics {
  const next: RagMetrics = {
    score: m.score,
    accuracy: typeof delta.accuracy === "number" ? clamp01(delta.accuracy) : m.accuracy,
    recall: typeof delta.recall === "number" ? clamp01(delta.recall) : m.recall,
    faithfulness: typeof delta.faithfulness === "number" ? clamp01(delta.faithfulness) : m.faithfulness,
    contextPrecision: typeof delta.contextPrecision === "number" ? clamp01(delta.contextPrecision) : m.contextPrecision
  };
  next.score = typeof delta.score === "number" ? delta.score : compositeScore(next);
  return next;
}

function uid() {
  return Math.random().toString(16).slice(2);
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  if (action.type === "toggle_expand") {
    return {
      ...state,
      expanded: { ...state.expanded, [action.stepId]: !state.expanded[action.stepId] }
    };
  }

  if (action.type === "run_start") {
    return { ...state, running: { stepId: action.stepId, actionId: action.actionId } };
  }

  if (action.type === "run_finish") {
    const exp: Experiment = {
      id: uid(),
      stepId: action.stepId,
      actionId: action.actionId,
      label: action.label,
      before: state.current,
      after: action.after,
      createdAt: Date.now()
    };
    return {
      ...state,
      running: undefined,
      current: action.after,
      experiments: [exp, ...state.experiments],
      lastResult: { before: exp.before, after: exp.after, summary: action.summary }
    };
  }

  if (action.type === "preview") {
    return { ...state, lastResult: { before: action.before, after: action.after, summary: action.summary } };
  }

  if (action.type === "apply") {
    return { ...state, applied: true };
  }

  if (action.type === "reset_preview") {
    return { ...state, lastResult: undefined };
  }

  return state;
}

function stepTitle(id: StepId) {
  if (id === "step0") return "Step 0 — Data Readiness Check";
  if (id === "step1") return "Step 1 — Retrieval Optimization";
  if (id === "step2") return "Step 2 — Rerank Optimization";
  if (id === "step3") return "Step 3 — Context Optimization";
  if (id === "step4") return "Step 4 — Generation Optimization";
  return "Step 5 — End-to-End Evaluation";
}

function stepDiagnosis(id: StepId, m: RagMetrics) {
  if (id === "step0") return "Baseline data checks ensure chunk coverage and evaluation stability.";
  if (id === "step1") {
    if (m.recall < 0.5) return "Recall@5 is low—relevant shipping docs are missed, driving intent drift.";
    if (m.recall < 0.7) return "Recall@5 is improving—focus on embeddings + chunking to reach target.";
    return "Retrieval looks healthy—validate with rerank and E2E checks.";
  }
  if (id === "step2") return "Rerank improves precision by prioritizing the most relevant retrieved chunks.";
  if (id === "step3") return "Context selection reduces distractors, increasing answer accuracy and groundedness.";
  if (id === "step4") return "Generation tuning reduces hallucination and improves policy compliance.";
  return "E2E evaluation confirms improvements on real user queries and resolves regressions.";
}

function stepMetrics(id: StepId, m: RagMetrics) {
  if (id === "step1")
    return [
      { label: "Recall@5", value: formatPct01(m.recall) },
      { label: "Accuracy", value: formatPct01(m.accuracy) }
    ];
  if (id === "step2")
    return [
      { label: "Top1 Accuracy", value: formatPct01(m.contextPrecision) },
      { label: "Accuracy", value: formatPct01(m.accuracy) }
    ];
  if (id === "step3")
    return [
      { label: "Top1 Accuracy", value: formatPct01(m.contextPrecision) },
      { label: "Faithfulness", value: formatPct01(m.faithfulness) }
    ];
  if (id === "step4")
    return [
      { label: "Faithfulness", value: formatPct01(m.faithfulness) },
      { label: "Accuracy", value: formatPct01(m.accuracy) }
    ];
  if (id === "step5")
    return [
      { label: "RAG Score", value: formatScore(m.score) },
      { label: "Accuracy", value: formatPct01(m.accuracy) }
    ];
  return [
    { label: "Chunk Coverage", value: m.recall < 0.5 ? "Low" : "OK" },
    { label: "Data quality", value: "OK" }
  ];
}

function stepStatus(id: StepId, m: RagMetrics): StepStatus {
  if (id === "step0") return "warning";
  if (id === "step1") return statusOf(m);
  if (id === "step2") return m.contextPrecision < 0.65 ? "warning" : "good";
  if (id === "step3") return m.contextPrecision < 0.68 ? "warning" : "good";
  if (id === "step4") return m.faithfulness < 0.72 ? "warning" : "good";
  if (id === "step5") return m.score < 70 ? "warning" : "good";
  return "warning";
}

function statusLabel(s: StepStatus) {
  if (s === "good") return "Good";
  if (s === "warning") return "Warning";
  return "Bad";
}

function statusClass(s: StepStatus) {
  if (s === "good") return "rag-status rag-status--good";
  if (s === "warning") return "rag-status rag-status--warn";
  return "rag-status rag-status--bad";
}

function ActionButton({
  disabled,
  loading,
  done,
  label,
  onClick
}: {
  disabled?: boolean;
  loading?: boolean;
  done?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rag-action-btn ${done ? "rag-action-btn--done" : ""}`}
      disabled={disabled || loading || done}
      onClick={onClick}
    >
      {loading ? (
        <>
          <Loader2 size={14} className="rag-spin" />
          Optimizing…
        </>
      ) : done ? (
        <>
          <CheckCircle2 size={14} />
          {label}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function ResultComparison({
  before,
  after,
  summary,
  onOpenMetrics,
  showAfter
}: {
  before: RagMetrics;
  after: RagMetrics;
  summary: string;
  onOpenMetrics?: () => void;
  showAfter: boolean;
}) {
  const deltaRecall = Math.round((after.recall - before.recall) * 100);
  const deltaTop1 = Math.round((after.contextPrecision - before.contextPrecision) * 100);
  const deltaFaith = Math.round((after.faithfulness - before.faithfulness) * 100);
  const deltaAcc = Math.round((after.accuracy - before.accuracy) * 100);
  const deltaScore = after.score - before.score;

  const rows = [
    { key: "recall", label: "Recall@5", before: formatPct01(before.recall), after: formatPct01(after.recall), delta: `${deltaRecall >= 0 ? "+" : ""}${deltaRecall}%` },
    {
      key: "top1",
      label: "Top1 Accuracy",
      before: formatPct01(before.contextPrecision),
      after: formatPct01(after.contextPrecision),
      delta: `${deltaTop1 >= 0 ? "+" : ""}${deltaTop1}%`
    },
    {
      key: "faith",
      label: "Faithfulness",
      before: formatPct01(before.faithfulness),
      after: formatPct01(after.faithfulness),
      delta: `${deltaFaith >= 0 ? "+" : ""}${deltaFaith}%`
    },
    { key: "acc", label: "Accuracy", before: formatPct01(before.accuracy), after: formatPct01(after.accuracy), delta: `${deltaAcc >= 0 ? "+" : ""}${deltaAcc}%` }
  ] as const;

  const showSummary = !summary.trim().toLowerCase().startsWith("rag score:");

  return (
    <div className="rag-result">
      <div className="rag-result-head">
        <div className="rag-result-head-left">
          <div className="rag-result-title">
            <Sparkles size={25} />
            <span>RAG Score</span>
            <span className="rag-result-score">{before.score}</span>
          </div>
          {showAfter ? (
            <p className="rag-result-sub">
              RAG Score: <strong>{before.score}</strong> → <strong>{after.score}</strong>{" "}
              <span className="rag-result-uplift">{deltaScore >= 0 ? `(+${deltaScore})` : `(${deltaScore})`}</span>
            </p>
          ) : null}
        </div>
        <div className="rag-result-head-right">
          <button type="button" className="rag-metrics-link rag-metrics-link--inset" onClick={() => onOpenMetrics?.()}>
            View more detailed in Agent Metrics →
          </button>
        </div>
      </div>
      {showSummary ? <p className="rag-result-summary">{summary}</p> : null}

      <div className={`rag-result-table ${showAfter ? "" : "rag-result-table--single"}`} role="table" aria-label="RAG result table">
        {rows.map((r) => (
          <div key={r.key} className="rag-result-tr" role="row">
            <span className="rag-result-td rag-result-td--k" role="cell">
              {r.label}
            </span>
            <strong className="rag-result-td rag-result-td--before" role="cell">
              {r.before}
            </strong>
            {showAfter ? (
              <>
                <span className="rag-result-td rag-result-td--delta" role="cell">
                  <span className="rag-delta">{r.delta}</span>
                </span>
                <strong className="rag-result-td rag-result-td--after" role="cell">
                  {r.after}
                </strong>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepCard({
  stepId,
  title,
  recommended,
  status,
  diagnosis,
  metrics,
  expanded,
  onToggle,
  children
}: {
  stepId: StepId;
  title: string;
  recommended?: boolean;
  status: StepStatus;
  diagnosis: string;
  metrics: { label: string; value: string }[];
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`rag-step ${expanded ? "rag-step--open" : ""}`} aria-label={stepId}>
      <button type="button" className="rag-step-head" onClick={onToggle}>
        <div className="rag-step-left">
          <h4>{title}</h4>
          <div className="rag-step-badges">
            <span className={statusClass(status)}>{statusLabel(status)}</span>
            {recommended ? <span className="rag-reco">🔥 Recommended</span> : null}
          </div>
        </div>
        <div className="rag-step-right">
          <div className="rag-step-metrics">
            {metrics.map((m) => (
              <div key={m.label} className="rag-metric-chip">
                <span>{m.label}</span>
                <strong>{m.value}</strong>
              </div>
            ))}
          </div>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded ? (
        <div className="rag-step-body">
          <p className="rag-diagnosis">{diagnosis}</p>
          {children}
        </div>
      ) : null}
    </section>
  );
}

export type RagOptimizationWorkspaceProps = {
  onClose: () => void;
  onOpenMetrics?: () => void;
  onApplyOptimization: (impact: { intentAccuracyDelta: number; resolutionDelta: number; ragHitRateDelta: number }) => void;
  applied?: boolean;
};

export function RagOptimizationWorkspace({ onClose, onOpenMetrics, onApplyOptimization, applied }: RagOptimizationWorkspaceProps) {
  const initial: WorkspaceState = useMemo(
    () => ({
      before: { ...ragMetrics },
      current: { ...ragMetrics },
      experiments: [],
      expanded: { step0: true, step1: true, step2: true, step3: true, step4: true, step5: true },
      applied: !!applied
    }),
    [applied]
  );

  const [state, dispatch] = useReducer(reducer, initial);
  const [applying, setApplying] = useState(false);

  const hint = headerHint(state.current);
  const steps: StepId[] = ["step0", "step1", "step2", "step3", "step4", "step5"];
  const isDone = (actionId: WorkspaceActionId) => state.experiments.some((e) => e.actionId === actionId);

  const recommendedStep = (() => {
    // Choose the lowest-status step; tie-break by Step 1 retrieval.
    const order: StepId[] = ["step1", "step0", "step2", "step3", "step4", "step5"];
    const score = (sid: StepId) => {
      const s = stepStatus(sid, state.current);
      return s === "bad" ? 0 : s === "warning" ? 1 : 2;
    };
    let best = order[0];
    for (const sid of order) {
      if (score(sid) < score(best)) best = sid;
    }
    return best;
  })();

  const canApply = !state.applied && !applied && !applying;

  const run = (stepId: StepId, actionId: WorkspaceActionId, label: string, delta: Partial<RagMetrics>, summary: string) => {
    if (state.running) return;
    dispatch({ type: "run_start", stepId, actionId });
    window.setTimeout(() => {
      const after = applyDelta(state.current, delta);
      dispatch({ type: "run_finish", stepId, actionId, label, after, summary });
    }, 850);
  };

  const topStatus = statusOf(state.current);

  const runPlan = async () => {
    if (applying || state.applied || applied) return;
    setApplying(true);

    // Execute a deterministic "release plan" sequence and mirror results into Experiments.
    // Metrics here are offline workspace evals; the Metrics dashboard represents online actuals.
    let cur = state.current;

    const step = async (stepId: StepId, actionId: WorkspaceActionId, label: string, delta: Partial<RagMetrics>, summary: string) => {
      dispatch({ type: "run_start", stepId, actionId });
      await new Promise((r) => window.setTimeout(r, 700));
      cur = applyDelta(cur, delta);
      dispatch({ type: "run_finish", stepId, actionId, label, after: cur, summary });
      await new Promise((r) => window.setTimeout(r, 220));
    };

    await step(
      "step1",
      "chunkSize",
      "Chunk Size → 350 Tokens",
      { recall: Math.max(cur.recall, 0.55), contextPrecision: cur.contextPrecision + 0.02 },
      `Recall@5: ${formatPct01(state.current.recall)} → ${formatPct01(Math.max(state.current.recall, 0.55))} ↑`
    );
    await step(
      "step1",
      "embedding",
      "Embedding → Bilingual-v2",
      { recall: Math.max(cur.recall, 0.62), accuracy: Math.min(1, cur.accuracy + 0.03) },
      `Recall@5: ${formatPct01(Math.max(state.current.recall, 0.55))} → ${formatPct01(Math.max(cur.recall, 0.62))} ↑`
    );
    await step(
      "step1",
      "queryRewrite",
      "Query Rewrite Enabled",
      { recall: Math.max(cur.recall, 0.68), accuracy: Math.max(cur.accuracy, 0.78) },
      `Recall@5: ${formatPct01(Math.max(cur.recall, 0.62))} → ${formatPct01(Math.max(cur.recall, 0.68))} ↑`
    );
    await step(
      "step2",
      "rerank",
      "Rerank Enabled",
      { contextPrecision: Math.max(cur.contextPrecision, 0.7), accuracy: Math.min(1, cur.accuracy + 0.02) },
      `Context Precision: ${formatPct01(state.current.contextPrecision)} → ${formatPct01(Math.max(cur.contextPrecision, 0.7))} ↑`
    );
    await step(
      "step3",
      "context",
      "Context Policy Updated",
      { contextPrecision: Math.max(cur.contextPrecision, 0.74), faithfulness: Math.min(1, cur.faithfulness + 0.01) },
      `Context Precision: ${formatPct01(Math.max(cur.contextPrecision, 0.7))} → ${formatPct01(Math.max(cur.contextPrecision, 0.74))} ↑`
    );
    await step(
      "step4",
      "generation",
      "Grounded Prompt Enabled",
      { faithfulness: Math.max(cur.faithfulness, 0.76), accuracy: Math.min(1, cur.accuracy + 0.01) },
      `Faithfulness: ${formatPct01(state.current.faithfulness)} → ${formatPct01(Math.max(cur.faithfulness, 0.76))} ↑`
    );
    await step(
      "step5",
      "e2e",
      "E2E Evaluation Complete",
      { score: Math.max(cur.score, compositeScore(cur) + 6), accuracy: Math.max(cur.accuracy, 0.8) },
      `RAG Score: ${state.current.score} → ${Math.max(cur.score, compositeScore(cur) + 6)} ↑`
    );

    dispatch({ type: "apply" });
    onApplyOptimization({ intentAccuracyDelta: 12, resolutionDelta: 8, ragHitRateDelta: 10 });
    setApplying(false);
  };

  return (
    <section className="rag-workspace">
      <header className="rag-score-header">
        <div className="rag-score-left">
          <div className="rag-score-title">
            <h2>RAG Optimization Workspace</h2>
            <span className={`rag-pill ${topStatus}`}>{topStatus === "bad" ? "Needs attention" : topStatus === "warning" ? "Improving" : "Healthy"}</span>
          </div>
          <p className="rag-hint">{hint}</p>
        </div>

        <div className="rag-score-right">
          <div className="rag-header-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Back to Solution & Roadmap
            </button>
            <button
              type="button"
              className={`primary ${state.applied || applied ? "rag-apply--done" : ""}`}
              disabled={!canApply}
              onClick={runPlan}
            >
              {state.applied || applied ? (
                <>
                  <CheckCircle2 size={14} /> Applied
                </>
              ) : (
                applying ? (
                  <>
                    <Loader2 size={14} className="rag-spin" />
                    Applying…
                  </>
                ) : (
                  "Apply Optimization"
                )
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="rag-body">
        <ResultComparison
          before={state.before}
          after={state.current}
          summary={state.lastResult?.summary ?? "Baseline snapshot is shown on the left. Run an optimization to produce the after snapshot."}
          onOpenMetrics={onOpenMetrics}
          showAfter={state.experiments.length > 0 || state.applied || !!applied}
        />

        <div className="rag-steps">
          {steps.map((sid) => {
            const expanded = !!state.expanded[sid];
            const status = stepStatus(sid, state.current);
            const title = stepTitle(sid);
            const diagnosis = stepDiagnosis(sid, state.current);
            const metrics = stepMetrics(sid, state.current);
            const recommended = sid === recommendedStep;
            const isRunning = state.running?.stepId === sid;

            return (
              <StepCard
                key={sid}
                stepId={sid}
                title={title}
                recommended={recommended}
                status={status}
                diagnosis={diagnosis}
                metrics={metrics}
                expanded={expanded}
                onToggle={() => dispatch({ type: "toggle_expand", stepId: sid })}
              >
                {sid === "step0" ? (
                  <div className="rag-actions">
                    <p className="rag-mini">
                      Checks: data quality, chunk coverage, dedupe, eval set stability. (Demo: preflight is advisory.)
                    </p>
                  </div>
                ) : null}

                {sid === "step1" ? (
                  <div className="rag-actions">
                    <div className="rag-action-row">
                      <div className="rag-action-label">
                        <span>Adjust chunk size</span>
                        <small>Reduce dilution; improve recall on short shipping queries</small>
                      </div>
                      <ActionButton
                        loading={isRunning && state.running?.actionId === "chunkSize"}
                        done={isDone("chunkSize")}
                        label="Try 350 tokens"
                        onClick={() =>
                          run(
                            "step1",
                            "chunkSize",
                            "Chunk size → 350 tokens",
                            { recall: Math.max(state.current.recall, 0.55), contextPrecision: state.current.contextPrecision + 0.02 },
                            `Recall@5: ${formatPct01(state.current.recall)} → ${formatPct01(Math.max(state.current.recall, 0.55))} ↑`
                          )
                        }
                      />
                    </div>

                    <div className="rag-action-row">
                      <div className="rag-action-label">
                        <span>Switch embedding model</span>
                        <small>Improve semantic match (shipping ≈ logistics)</small>
                      </div>
                      <ActionButton
                        loading={isRunning && state.running?.actionId === "embedding"}
                        done={isDone("embedding")}
                        label="Use bilingual-v2"
                        onClick={() =>
                          run(
                            "step1",
                            "embedding",
                            "Embedding → bilingual-v2",
                            { recall: Math.max(state.current.recall, 0.62), accuracy: state.current.accuracy + 0.03 },
                            `Recall@5: ${formatPct01(state.current.recall)} → ${formatPct01(Math.max(state.current.recall, 0.62))} ↑`
                          )
                        }
                      />
                    </div>

                    <div className="rag-action-row">
                      <div className="rag-action-label">
                        <span>Enable query rewrite</span>
                        <small>Rewrite short queries into intent-aware retrieval prompts</small>
                      </div>
                      <ActionButton
                        loading={isRunning && state.running?.actionId === "queryRewrite"}
                        done={isDone("queryRewrite")}
                        label="Enable rewrite"
                        onClick={() =>
                          run(
                            "step1",
                            "queryRewrite",
                            "Query rewrite enabled",
                            { recall: Math.max(state.current.recall, 0.68), accuracy: Math.max(state.current.accuracy, 0.78) },
                            `Recall@5: ${formatPct01(state.current.recall)} → ${formatPct01(Math.max(state.current.recall, 0.68))} ↑`
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {sid === "step2" ? (
                  <div className="rag-actions">
                    <div className="rag-action-row">
                      <div className="rag-action-label">
                        <span>Enable cross-encoder rerank</span>
                        <small>Push shipping-time docs above refund templates</small>
                      </div>
                      <ActionButton
                        loading={isRunning && state.running?.actionId === "rerank"}
                        done={isDone("rerank")}
                        label="Enable rerank"
                        onClick={() =>
                          run(
                            "step2",
                            "rerank",
                            "Rerank enabled",
                            { contextPrecision: Math.max(state.current.contextPrecision, 0.7), accuracy: state.current.accuracy + 0.02 },
                            `Context Precision: ${formatPct01(state.current.contextPrecision)} → ${formatPct01(Math.max(state.current.contextPrecision, 0.7))} ↑`
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {sid === "step3" ? (
                  <div className="rag-actions">
                    <div className="rag-action-row">
                      <div className="rag-action-label">
                        <span>Tighten context window</span>
                        <small>Drop refund-policy distractors for shipping intents</small>
                      </div>
                      <ActionButton
                        loading={isRunning && state.running?.actionId === "context"}
                        done={isDone("context")}
                        label="Optimize context"
                        onClick={() =>
                          run(
                            "step3",
                            "context",
                            "Context policy updated",
                            { contextPrecision: Math.max(state.current.contextPrecision, 0.74), faithfulness: state.current.faithfulness + 0.01 },
                            `Context Precision: ${formatPct01(state.current.contextPrecision)} → ${formatPct01(Math.max(state.current.contextPrecision, 0.74))} ↑`
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {sid === "step4" ? (
                  <div className="rag-actions">
                    <div className="rag-action-row">
                      <div className="rag-action-label">
                        <span>Grounded generation prompt</span>
                        <small>Enforce citation + refusal for missing shipping context</small>
                      </div>
                      <ActionButton
                        loading={isRunning && state.running?.actionId === "generation"}
                        done={isDone("generation")}
                        label="Tune generation"
                        onClick={() =>
                          run(
                            "step4",
                            "generation",
                            "Grounded prompt enabled",
                            { faithfulness: Math.max(state.current.faithfulness, 0.76), accuracy: state.current.accuracy + 0.01 },
                            `Faithfulness: ${formatPct01(state.current.faithfulness)} → ${formatPct01(Math.max(state.current.faithfulness, 0.76))} ↑`
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {sid === "step5" ? (
                  <div className="rag-actions">
                    <div className="rag-action-row">
                      <div className="rag-action-label">
                        <span>Run E2E evaluation</span>
                        <small>Validate end-to-end improvements on shipping & refund cohorts</small>
                      </div>
                      <ActionButton
                        loading={isRunning && state.running?.actionId === "e2e"}
                        done={isDone("e2e")}
                        label="Run eval"
                        onClick={() =>
                          run(
                            "step5",
                            "e2e",
                            "E2E evaluation complete",
                            { score: Math.max(state.current.score, compositeScore(state.current) + 6), accuracy: Math.max(state.current.accuracy, 0.8) },
                            `RAG Score: ${state.current.score} → ${Math.max(state.current.score, compositeScore(state.current) + 6)} ↑`
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </StepCard>
            );
          })}
        </div>

        <aside className="rag-lab">
          <div className="rag-lab-head">
            <h3>Experiments</h3>
            <p>Each action preserves before/after so you can compare runs.</p>
          </div>
          {state.experiments.length === 0 ? (
            <div className="rag-empty">
              <p>No experiments yet.</p>
              <small>Run any action in Step 1 to start comparing outcomes.</small>
            </div>
          ) : (
            <div className="rag-exp-list">
              {state.experiments.map((e) => (
                <button
                  type="button"
                  key={e.id}
                  className="rag-exp"
                  onClick={() =>
                    dispatch({
                      type: "preview",
                      before: e.before,
                      after: e.after,
                      summary: `${e.label} • Recall@5 ${formatPct01(e.before.recall)} → ${formatPct01(e.after.recall)}`
                    })
                  }
                >
                  <div className="rag-exp-top">
                    <strong>{e.label}</strong>
                    <span className="rag-exp-step">{stepTitle(e.stepId).replace(" — ", ": ")}</span>
                  </div>
                  <div className="rag-exp-metrics">
                    <span>{`Recall@5 ${formatPct01(e.before.recall)} → ${formatPct01(e.after.recall)}`}</span>
                    <span>{`Accuracy ${formatPct01(e.before.accuracy)} → ${formatPct01(e.after.accuracy)}`}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

