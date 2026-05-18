"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ListOrdered,
  Loader2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  Trash2,
  Upload
} from "lucide-react";
import {
  getEvalSetForPattern,
  getPatternEvaluationBundle,
  type EvalCase,
  type LlmDimension,
  type PatternEvalId
} from "@/lib/evaluationModuleMock";
import type { ActionOptionId } from "@/lib/mockData";

type EvalKey = "llm" | "process" | "deterministic" | "robustness" | "safety";
type EvalOpenState = Record<EvalKey, boolean>;
type EvalMainTab = "llm" | "process" | "deterministic" | "robustness" | "safety" | "evals";

const LLM_DIMS: LlmDimension[] = ["Correctness", "Reasoning", "Tone", "Safety"];

const evalTabLabels: Record<EvalMainTab, string> = {
  evals: "Evals",
  process: "Process",
  deterministic: "Deterministic",
  robustness: "Robustness",
  safety: "Red Team",
  llm: "LLM Judge"
};

const EVAL_TAB_ORDER: EvalMainTab[] = ["evals", "process", "deterministic", "robustness", "safety", "llm"];

/** Demo: JSON `{ "cases": [...] }` or a raw array — minimal fields per case. */
function parseEvalCasesJson(text: string): EvalCase[] | null {
  try {
    const data = JSON.parse(text) as unknown;
    const raw = Array.isArray(data)
      ? data
      : data && typeof data === "object" && data !== null && "cases" in data && Array.isArray((data as { cases: unknown }).cases)
        ? (data as { cases: unknown[] }).cases
        : null;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw.map((row: unknown, i: number) => {
      const r = row as Record<string, unknown>;
      const expected = Array.isArray(r.expected) ? r.expected.map((x) => String(x)) : [];
      const failureReason = Array.isArray(r.failureReason) ? r.failureReason.map((x) => String(x)) : [];
      const linkedRaw = Array.isArray(r.linkedPatterns) ? r.linkedPatterns : [];
      const linkedPatterns = linkedRaw.filter(
        (x): x is PatternEvalId =>
          x === "intent-misclassification" || x === "tool-failure" || x === "reasoning-failure"
      );
      return {
        id: typeof r.id === "string" ? r.id : `ev-upload-${i}-${Math.random().toString(36).slice(2, 9)}`,
        query: String(r.query ?? ""),
        expected,
        actual: String(r.actual ?? ""),
        result: r.result === "fail" ? "fail" : "pass",
        failureReason,
        linkedPatterns: linkedPatterns.length ? linkedPatterns : undefined,
        suggestedFix: Array.isArray(r.suggestedFix) ? r.suggestedFix.map(String) : undefined
      };
    });
  } catch {
    return null;
  }
}

/** JSON `{ "criteria": ["…"] }`, JSON array of strings, or newline-separated text. */
function parseCriteriaFile(text: string): string[] | null {
  const t = text.trim();
  if (!t) return null;
  try {
    const data = JSON.parse(t) as unknown;
    if (Array.isArray(data)) {
      const lines = data.map(String).map((s) => s.trim()).filter(Boolean);
      return lines.length ? lines : null;
    }
    if (data && typeof data === "object" && data !== null && "criteria" in data) {
      const c = (data as { criteria: unknown }).criteria;
      if (Array.isArray(c)) {
        const lines = c.map(String).map((s) => s.trim()).filter(Boolean);
        return lines.length ? lines : null;
      }
    }
  } catch {
    /* plain text */
  }
  const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return lines.length ? lines : null;
}

function tierClass(tier: "good" | "warning" | "bad"): string {
  if (tier === "good") return "eval-pill eval-pill--good";
  if (tier === "warning") return "eval-pill eval-pill--warn";
  return "eval-pill eval-pill--bad";
}

function stepIcon(status: "pass" | "warn" | "fail"): string {
  if (status === "pass") return "✅";
  if (status === "warn") return "⚠️";
  return "❌";
}

function robustnessStatusLabel(status: "stable" | "drift" | "break"): string {
  if (status === "stable") return "Stable";
  if (status === "drift") return "Drift";
  return "Break";
}

function robustnessStatusClass(status: "stable" | "drift" | "break"): string {
  if (status === "stable") return "eval-pill eval-pill--good";
  if (status === "drift") return "eval-pill eval-pill--warn";
  return "eval-pill eval-pill--bad";
}

function perturbationTypeLabel(t: "noise" | "typo" | "rephrase"): string {
  if (t === "noise") return "Noise";
  if (t === "typo") return "Typo";
  return "Rephrase";
}

function safetyAttackLabel(t: "prompt-injection" | "sensitive-term" | "privilege-escalation"): string {
  if (t === "prompt-injection") return "Prompt injection";
  if (t === "sensitive-term") return "Sensitive term";
  return "Privilege escalation";
}

function safetyResultClass(result: "blocked" | "leaked" | "partial"): string {
  if (result === "blocked") return "eval-pill eval-pill--good";
  if (result === "partial") return "eval-pill eval-pill--warn";
  return "eval-pill eval-pill--bad";
}

type PatternEvaluationModuleProps = {
  patternId: string;
  appliedForPattern: boolean;
  onApplyFix: (causeId: PatternEvalId, optionId?: ActionOptionId) => void;
};

export function PatternEvaluationModule({
  patternId,
  appliedForPattern,
  onApplyFix
}: PatternEvaluationModuleProps) {
  const bundle = useMemo(() => getPatternEvaluationBundle(patternId), [patternId]);
  const evalSet = useMemo(() => getEvalSetForPattern(patternId), [patternId]);

  const [activeTab, setActiveTab] = useState<EvalMainTab>("evals");
  const [open, setOpen] = useState<EvalOpenState>({
    llm: true,
    process: true,
    deterministic: true,
    robustness: true,
    safety: true
  });
  const [llmDims, setLlmDims] = useState<Set<LlmDimension>>(() => new Set(LLM_DIMS));
  const [running, setRunning] = useState<EvalKey | null>(null);
  const [completed, setCompleted] = useState<Partial<Record<EvalKey, true>>>({});
  const [expandedEvalCaseId, setExpandedEvalCaseId] = useState<string | null>(null);

  const datasetInputRef = useRef<HTMLInputElement>(null);
  const criteriaInputRef = useRef<HTMLInputElement>(null);
  const [evalCases, setEvalCases] = useState<EvalCase[]>(() => evalSet.cases.map((c) => ({ ...c })));
  const [evalDatasetLabel, setEvalDatasetLabel] = useState<string | null>(null);
  const [datasetHint, setDatasetHint] = useState<string | null>(null);
  const [successCriteriaLines, setSuccessCriteriaLines] = useState<string[]>(() => [...evalSet.successCriteria]);
  const [criteriaSavedFlash, setCriteriaSavedFlash] = useState(false);
  const [criteriaHint, setCriteriaHint] = useState<string | null>(null);

  useEffect(() => {
    setEvalCases(evalSet.cases.map((c) => ({ ...c })));
    setSuccessCriteriaLines([...evalSet.successCriteria]);
    setEvalDatasetLabel(null);
    setDatasetHint(null);
    setCriteriaHint(null);
  }, [patternId, evalSet]);

  const toggleOpen = (key: EvalKey) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDim = (d: LlmDimension) => {
    setLlmDims((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const runEval = useCallback(
    (key: EvalKey) => {
      if (running) return;
      setRunning(key);
      window.setTimeout(() => {
        setRunning(null);
        setCompleted((c) => ({ ...c, [key]: true }));
        setOpen((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
      }, 950);
    },
    [running]
  );

  const filteredLlmBreakdown = bundle.llm.breakdown.filter((b) => llmDims.has(b.dimension));

  const showEvalAfterRate = appliedForPattern;
  const evalPassRateComputed = useMemo(() => {
    if (evalCases.length === 0) return evalSet.passRate;
    const passed = evalCases.filter((c) => c.result === "pass").length;
    return Math.round((passed / evalCases.length) * 100);
  }, [evalCases, evalSet.passRate]);
  const evalAfterRate = evalSet.passRateAfterOptimization;

  useEffect(() => {
    const linked = evalCases.find((c) => c.linkedPatterns?.includes(patternId as PatternEvalId));
    setExpandedEvalCaseId(linked?.id ?? null);
  }, [patternId, evalCases]);

  const onDatasetFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseEvalCasesJson(text);
      if (!parsed) {
        setDatasetHint("Could not parse file — use JSON array or { \"cases\": [ … ] }.");
        return;
      }
      setEvalCases(parsed);
      setEvalDatasetLabel(file.name);
      setDatasetHint(`Loaded ${parsed.length} case(s) — demo only, session memory.`);
    } catch {
      setDatasetHint("Failed to read file.");
    }
  };

  const onCriteriaFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const lines = parseCriteriaFile(text);
      if (!lines) {
        setCriteriaHint("Could not parse criteria — use JSON array, { \"criteria\": [] }, or one line per criterion.");
        return;
      }
      setSuccessCriteriaLines(lines);
      setCriteriaHint(`Imported ${lines.length} criterion/criteria from ${file.name}.`);
    } catch {
      setCriteriaHint("Failed to read file.");
    }
  };

  const saveCriteria = () => {
    const cleaned = successCriteriaLines.map((s) => s.trim()).filter(Boolean);
    setSuccessCriteriaLines(cleaned);
    setCriteriaSavedFlash(true);
    window.setTimeout(() => setCriteriaSavedFlash(false), 2200);
  };

  const updateCriterionLine = (index: number, value: string) => {
    setSuccessCriteriaLines((prev) => prev.map((line, i) => (i === index ? value : line)));
  };

  const removeCriterionLine = (index: number) => {
    setSuccessCriteriaLines((prev) => prev.filter((_, i) => i !== index));
  };

  const addCriterionLine = () => {
    setSuccessCriteriaLines((prev) => [...prev, ""]);
  };

  const toggleEvalCase = (id: string) => {
    setExpandedEvalCaseId((prev) => (prev === id ? null : id));
  };

  const tabPanelMotion = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.2 }
  };

  const renderEvalCaseRow = (c: EvalCase) => {
    const patternLinked = c.linkedPatterns?.includes(patternId as PatternEvalId);
    const expanded = expandedEvalCaseId === c.id;

    return (
      <article
        key={c.id}
        className={`pattern-eval-eval-case ${patternLinked ? "pattern-eval-eval-case--pattern-linked" : ""} ${
          c.result === "pass" ? "pattern-eval-eval-case--pass" : "pattern-eval-eval-case--fail"
        }`}
      >
        <button type="button" className="pattern-eval-eval-case-top" onClick={() => toggleEvalCase(c.id)}>
          <span className="pattern-eval-eval-case-query">{c.query}</span>
          <span className={`pattern-eval-eval-badge pattern-eval-eval-badge--${c.result}`}>
            {c.result === "pass" ? "PASS" : "FAIL"}
          </span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              className="pattern-eval-eval-case-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <div className="pattern-eval-eval-detail-inner">
                <p className="pattern-eval-label">User Query</p>
                <blockquote className="pattern-eval-eval-quote">&quot;{c.query}&quot;</blockquote>
                <p className="pattern-eval-label">Expected Behavior</p>
                <ul className="pattern-eval-eval-bullets">
                  {c.expected.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="pattern-eval-label">Actual Output</p>
                <p className="pattern-eval-eval-actual">{c.actual}</p>
                <p className="pattern-eval-label">Result</p>
                <p className={c.result === "pass" ? "pattern-eval-eval-result pass" : "pattern-eval-eval-result fail"}>
                  {c.result === "pass" ? "PASS" : "FAIL"}
                </p>
                {c.result === "fail" && c.failureReason.length > 0 ? (
                  <>
                    <p className="pattern-eval-label">Why it failed</p>
                    <ul className="pattern-eval-eval-introspection">
                      {c.failureReason.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {c.result === "fail" && c.suggestedFix && c.suggestedFix.length > 0 ? (
                  <div className="pattern-eval-suggested-fix">
                    <p className="pattern-eval-label">Suggested Fix</p>
                    <ul>
                      {c.suggestedFix.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="pattern-eval-apply ghost pattern-eval-suggested-fix-cta"
                      onClick={() => {
                        const pid = c.linkedPatterns?.[0] ?? "intent-misclassification";
                        onApplyFix(pid);
                      }}
                    >
                      Open Solution — apply optimization
                    </button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </article>
    );
  };

  return (
    <div className="pattern-eval-module" id="pattern-evaluation-module">
      <header className="pattern-eval-head">
        <div className="pattern-eval-head-text">
          <h3>Evaluation Strategy</h3>
          <p>
            Evidence for <strong>{bundle.patternName}</strong> — validate severity, localize failure, stress-test robustness, red-team
            safety, and confirm fixes against verified drivers (no new root causes).
          </p>
        </div>
      </header>

      <div className="pattern-eval-main-tabs" role="tablist" aria-label="Evaluation methods">
        {EVAL_TAB_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`pattern-eval-main-tab ${activeTab === tab ? "pattern-eval-main-tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {evalTabLabels[tab]}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} {...tabPanelMotion} className="pattern-eval-tab-panel-wrap">
          {activeTab === "llm" ? (
            <div className="pattern-eval-tab-panel">
              <article className={`pattern-eval-card pattern-eval-card--solo ${open.llm ? "pattern-eval-card--open" : ""}`}>
                <button type="button" className="pattern-eval-card-top" onClick={() => toggleOpen("llm")}>
                  <div className="pattern-eval-card-icon pattern-eval-card-icon--violet" aria-hidden>
                    <Brain size={18} />
                  </div>
                  <div className="pattern-eval-card-meta">
                    <h4>LLM-as-a-Judge</h4>
                    <p>Model-graded quality on representative failing turns (mock).</p>
                  </div>
                  {open.llm ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {open.llm ? (
                  <div className="pattern-eval-card-body">
                    <p className="pattern-eval-label">Dimensions</p>
                    <div className="pattern-eval-chips">
                      {LLM_DIMS.map((d) => (
                        <label key={d} className={`pattern-eval-chip ${llmDims.has(d) ? "pattern-eval-chip--on" : ""}`}>
                          <input type="checkbox" checked={llmDims.has(d)} onChange={() => toggleDim(d)} />
                          {d}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="pattern-eval-run primary"
                      disabled={running !== null || llmDims.size === 0}
                      onClick={() => runEval("llm")}
                    >
                      {running === "llm" ? (
                        <>
                          <Loader2 size={16} className="pattern-eval-spin" aria-hidden />
                          Running…
                        </>
                      ) : (
                        "Run Evaluation"
                      )}
                    </button>

                    {completed.llm ? (
                      <div className="pattern-eval-result">
                        <div className="pattern-eval-result-row">
                          <span>Overall Score</span>
                          <strong>
                            {bundle.llm.overall} / {bundle.llm.max}{" "}
                            <span className={tierClass("warning")}>snapshot</span>
                          </strong>
                        </div>
                        <p className="pattern-eval-label">Breakdown</p>
                        <ul className="pattern-eval-breakdown">
                          {filteredLlmBreakdown.map((row) => (
                            <li key={row.dimension}>
                              <span>{row.dimension}</span>
                              <span>
                                <strong>
                                  {row.score}
                                  {row.tag ? ` ${row.tag}` : ""}
                                </strong>{" "}
                                <span className={tierClass(row.tier)}>{row.tier === "bad" ? "low" : row.tier}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="pattern-eval-insight">
                          <span>Insight</span> {bundle.llm.insight}
                        </p>
                        <button
                          type="button"
                          className="pattern-eval-apply ghost"
                          onClick={() => onApplyFix(bundle.llm.applyFix.causeId, bundle.llm.applyFix.optionId)}
                        >
                          Apply Fix — {bundle.llm.applyFix.label}
                        </button>
                      </div>
                    ) : (
                      <p className="pattern-eval-hint">Run to materialize scores for this pattern.</p>
                    )}
                  </div>
                ) : null}
              </article>
            </div>
          ) : null}

          {activeTab === "process" ? (
            <div className="pattern-eval-tab-panel">
              <article className={`pattern-eval-card pattern-eval-card--solo ${open.process ? "pattern-eval-card--open" : ""}`}>
                <button type="button" className="pattern-eval-card-top" onClick={() => toggleOpen("process")}>
                  <div className="pattern-eval-card-icon pattern-eval-card-icon--cyan" aria-hidden>
                    <ListOrdered size={18} />
                  </div>
                  <div className="pattern-eval-card-meta">
                    <h4>Process-based</h4>
                    <p>Session path audit: intent → tools → response (mock).</p>
                  </div>
                  {open.process ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {open.process ? (
                  <div className="pattern-eval-card-body">
                    <button
                      type="button"
                      className="pattern-eval-run primary"
                disabled={running !== null}
                onClick={() => runEval("process")}
                    >
                      {running === "process" ? (
                        <>
                          <Loader2 size={16} className="pattern-eval-spin" aria-hidden />
                          Running…
                        </>
                      ) : (
                        "Run Evaluation"
                      )}
                    </button>

                    {completed.process ? (
                      <div className="pattern-eval-result">
                        <p className="pattern-eval-label">Step Breakdown</p>
                        <ol className="pattern-eval-steps">
                          {bundle.process.steps.map((s) => (
                            <li key={s.name}>
                              {s.name} <span className="pattern-eval-step-ico">{stepIcon(s.status)}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="pattern-eval-metrics2">
                          <div>
                            <span>Path Efficiency</span>
                            <strong>{bundle.process.pathEfficiency}%</strong>
                          </div>
                          <div>
                            <span>Tool Accuracy</span>
                            <strong>{bundle.process.toolAccuracy}%</strong>
                          </div>
                        </div>
                        <p className="pattern-eval-insight">
                          <span>Insight</span> {bundle.process.insight}
                        </p>
                        <button
                          type="button"
                          className="pattern-eval-apply ghost"
                          onClick={() => onApplyFix(bundle.process.applyFix.causeId, bundle.process.applyFix.optionId)}
                        >
                          Apply Fix — {bundle.process.applyFix.label}
                        </button>
                      </div>
                    ) : (
                      <p className="pattern-eval-hint">Run to replay the execution graph for this cohort.</p>
                    )}
                  </div>
                ) : null}
              </article>
            </div>
          ) : null}

          {activeTab === "deterministic" ? (
            <div className="pattern-eval-tab-panel">
              <article className={`pattern-eval-card pattern-eval-card--solo ${open.deterministic ? "pattern-eval-card--open" : ""}`}>
                <button type="button" className="pattern-eval-card-top" onClick={() => toggleOpen("deterministic")}>
                  <div className="pattern-eval-card-icon pattern-eval-card-icon--amber" aria-hidden>
                    <ShieldCheck size={18} />
                  </div>
                  <div className="pattern-eval-card-meta">
                    <h4>Deterministic Checks</h4>
                    <p>Contract checks on tool traces (mock).</p>
                  </div>
                  {open.deterministic ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {open.deterministic ? (
                  <div className="pattern-eval-card-body">
                    <button
                      type="button"
                      className="pattern-eval-run primary"
                disabled={running !== null}
                onClick={() => runEval("deterministic")}
                    >
                      {running === "deterministic" ? (
                        <>
                          <Loader2 size={16} className="pattern-eval-spin" aria-hidden />
                          Running…
                        </>
                      ) : (
                        "Run Evaluation"
                      )}
                    </button>

                    {completed.deterministic ? (
                      <div className="pattern-eval-result">
                        <ul className="pattern-eval-checks">
                          {bundle.deterministic.checks.map((c) => (
                            <li key={c.label}>
                              {c.label}：{c.ok ? "✅" : "❌"}
                            </li>
                          ))}
                        </ul>
                        <div className="pattern-eval-result-row">
                          <span>Validation Pass Rate</span>
                          <strong>
                            {bundle.deterministic.passRate}% <span className={tierClass("warning")}>audit</span>
                          </strong>
                        </div>
                        <p className="pattern-eval-insight">
                          <span>Insight</span> {bundle.deterministic.insight}
                        </p>
                        <button
                          type="button"
                          className="pattern-eval-apply ghost"
                          onClick={() => onApplyFix(bundle.deterministic.applyFix.causeId, bundle.deterministic.applyFix.optionId)}
                        >
                          Apply Fix — {bundle.deterministic.applyFix.label}
                        </button>
                      </div>
                    ) : (
                      <p className="pattern-eval-hint">Run to validate contracts independent of model prose.</p>
                    )}
                  </div>
                ) : null}
              </article>
            </div>
          ) : null}

          {activeTab === "robustness" ? (
            <div className="pattern-eval-tab-panel">
              <article className={`pattern-eval-card pattern-eval-card--solo ${open.robustness ? "pattern-eval-card--open" : ""}`}>
                <button type="button" className="pattern-eval-card-top" onClick={() => toggleOpen("robustness")}>
                  <div className="pattern-eval-card-icon pattern-eval-card-icon--indigo" aria-hidden>
                    <Shuffle size={18} />
                  </div>
                  <div className="pattern-eval-card-meta">
                    <h4>Robustness &amp; Consistency</h4>
                    <p>
                      Stress-test with light prompt perturbations (noise, typos, rephrasing) and measure output variance — production
                      apps cannot trust accidental correctness.
                    </p>
                  </div>
                  {open.robustness ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {open.robustness ? (
                  <div className="pattern-eval-card-body">
                    <button
                      type="button"
                      className="pattern-eval-run primary"
                      disabled={running !== null}
                      onClick={() => runEval("robustness")}
                    >
                      {running === "robustness" ? (
                        <>
                          <Loader2 size={16} className="pattern-eval-spin" aria-hidden />
                          Running stress trials…
                        </>
                      ) : (
                        "Run Robustness Suite"
                      )}
                    </button>

                    {completed.robustness ? (
                      <div className="pattern-eval-result">
                        <div className="pattern-eval-metrics2">
                          <div>
                            <span>Consistency Score</span>
                            <strong>
                              {bundle.robustness.consistencyScore}%{" "}
                              <span className={tierClass(bundle.robustness.consistencyScore >= 75 ? "good" : "warning")}>
                                {bundle.robustness.consistencyScore >= 75 ? "stable" : "fragile"}
                              </span>
                            </strong>
                          </div>
                          <div>
                            <span>Output Variance (σ)</span>
                            <strong>
                              {bundle.robustness.outputVariance.toFixed(2)}{" "}
                              <span className={tierClass(bundle.robustness.outputVariance <= 0.2 ? "good" : "bad")}>spread</span>
                            </strong>
                          </div>
                        </div>
                        <p className="pattern-eval-hint-inline pattern-eval-robustness-meta">
                          {bundle.robustness.trialsRun} perturbation trials on representative failing turns (mock).
                        </p>
                        <p className="pattern-eval-label">Perturbation Trials</p>
                        <ul className="pattern-eval-trial-list">
                          {bundle.robustness.trials.map((trial) => (
                            <li key={trial.id} className="pattern-eval-trial-item">
                              <div className="pattern-eval-trial-head">
                                <span className="pattern-eval-trial-type">{perturbationTypeLabel(trial.perturbationType)}</span>
                                <span className={robustnessStatusClass(trial.status)}>{robustnessStatusLabel(trial.status)}</span>
                                <span className="pattern-eval-trial-match">Match {trial.semanticMatch}%</span>
                              </div>
                              <p className="pattern-eval-trial-prompt">
                                <span>Baseline</span> {trial.baselinePrompt}
                              </p>
                              <p className="pattern-eval-trial-prompt pattern-eval-trial-prompt--perturbed">
                                <span>Perturbed</span> {trial.perturbedPrompt}
                              </p>
                              <p className="pattern-eval-trial-output">
                                <span>Baseline out</span> {trial.baselineOutput}
                              </p>
                              <p className="pattern-eval-trial-output pattern-eval-trial-output--alt">
                                <span>Perturbed out</span> {trial.perturbedOutput}
                              </p>
                            </li>
                          ))}
                        </ul>
                        <p className="pattern-eval-insight">
                          <span>Insight</span> {bundle.robustness.insight}
                        </p>
                        <button
                          type="button"
                          className="pattern-eval-apply ghost"
                          onClick={() => onApplyFix(bundle.robustness.applyFix.causeId, bundle.robustness.applyFix.optionId)}
                        >
                          Apply Fix — {bundle.robustness.applyFix.label}
                        </button>
                      </div>
                    ) : (
                      <p className="pattern-eval-hint">Run to measure variance across noisy, typo, and rephrased prompts.</p>
                    )}
                  </div>
                ) : null}
              </article>
            </div>
          ) : null}

          {activeTab === "safety" ? (
            <div className="pattern-eval-tab-panel">
              <article className={`pattern-eval-card pattern-eval-card--solo ${open.safety ? "pattern-eval-card--open" : ""}`}>
                <button type="button" className="pattern-eval-card-top" onClick={() => toggleOpen("safety")}>
                  <div className="pattern-eval-card-icon pattern-eval-card-icon--rose" aria-hidden>
                    <ShieldAlert size={18} />
                  </div>
                  <div className="pattern-eval-card-meta">
                    <h4>Safety &amp; Red Teaming</h4>
                    <p>
                      Simulate prompt injection, sensitive-term probes, and privilege-escalation attempts. Safety is 1, performance is
                      0 — incident prevention defines agent lifecycle.
                    </p>
                  </div>
                  {open.safety ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {open.safety ? (
                  <div className="pattern-eval-card-body">
                    <button
                      type="button"
                      className="pattern-eval-run primary"
                      disabled={running !== null}
                      onClick={() => runEval("safety")}
                    >
                      {running === "safety" ? (
                        <>
                          <Loader2 size={16} className="pattern-eval-spin" aria-hidden />
                          Running red team…
                        </>
                      ) : (
                        "Run Red Team Suite"
                      )}
                    </button>

                    {completed.safety ? (
                      <div className="pattern-eval-result">
                        <div className="pattern-eval-result-row">
                          <span>Safety Score</span>
                          <strong>
                            {bundle.safety.safetyScore} / 100{" "}
                            <span className={tierClass(bundle.safety.safetyScore >= 90 ? "good" : "warning")}>gate</span>
                          </strong>
                        </div>
                        <div className="pattern-eval-result-row">
                          <span>Attacks Blocked</span>
                          <strong>
                            {bundle.safety.attacksBlocked} / {bundle.safety.attacksTotal}{" "}
                            <span className={tierClass(bundle.safety.attacksBlocked === bundle.safety.attacksTotal ? "good" : "bad")}>
                              {Math.round((bundle.safety.attacksBlocked / bundle.safety.attacksTotal) * 100)}%
                            </span>
                          </strong>
                        </div>
                        <p className="pattern-eval-label">Red Team Probes</p>
                        <ul className="pattern-eval-attack-list">
                          {bundle.safety.cases.map((probe) => (
                            <li key={probe.id} className="pattern-eval-attack-item">
                              <div className="pattern-eval-trial-head">
                                <span className="pattern-eval-trial-type">{safetyAttackLabel(probe.attackType)}</span>
                                <span className={safetyResultClass(probe.result)}>
                                  {probe.result === "blocked" ? "Blocked" : probe.result === "partial" ? "Partial" : "Leaked"}
                                </span>
                                <span className={`pattern-eval-severity pattern-eval-severity--${probe.severity}`}>
                                  {probe.severity}
                                </span>
                              </div>
                              <p className="pattern-eval-trial-prompt">
                                <span>Payload</span> {probe.payload}
                              </p>
                              <p className="pattern-eval-trial-output">
                                <span>Agent</span> {probe.agentResponse}
                              </p>
                              {probe.notes.length > 0 ? (
                                <ul className="pattern-eval-eval-introspection pattern-eval-attack-notes">
                                  {probe.notes.map((note) => (
                                    <li key={note}>{note}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        <p className="pattern-eval-insight">
                          <span>Insight</span> {bundle.safety.insight}
                        </p>
                        <button
                          type="button"
                          className="pattern-eval-apply ghost"
                          onClick={() => onApplyFix(bundle.safety.applyFix.causeId, bundle.safety.applyFix.optionId)}
                        >
                          Apply Fix — {bundle.safety.applyFix.label}
                        </button>
                      </div>
                    ) : (
                      <p className="pattern-eval-hint">Run to probe injection, sensitive content, and escalation paths.</p>
                    )}
                  </div>
                ) : null}
              </article>
            </div>
          ) : null}

          {activeTab === "evals" ? (
            <div className="pattern-eval-tab-panel">
              <article className="pattern-eval-card pattern-eval-card--solo pattern-eval-card--open pattern-eval-eval-set-card">
                <input
                  ref={datasetInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="pattern-eval-file-input"
                  aria-hidden
                  tabIndex={-1}
                  onChange={onDatasetFileChange}
                />
                <input
                  ref={criteriaInputRef}
                  type="file"
                  accept=".json,.txt,text/plain,application/json"
                  className="pattern-eval-file-input"
                  aria-hidden
                  tabIndex={-1}
                  onChange={onCriteriaFileChange}
                />

                <div className="pattern-eval-card-top pattern-eval-card-top--static">
                  <div className="pattern-eval-card-icon pattern-eval-card-icon--green" aria-hidden>
                    <ClipboardList size={18} />
                  </div>
                  <div className="pattern-eval-card-meta pattern-eval-card-meta--grow">
                    <h4>{evalSet.name}</h4>
                    <p>User-defined benchmark tests — upload a JSON eval set or edit cases below (demo; session only).</p>
                    <div className="pattern-eval-upload-row">
                      <button type="button" className="pattern-eval-upload-btn" onClick={() => datasetInputRef.current?.click()}>
                        <Upload size={14} aria-hidden />
                        Upload eval set
                      </button>
                      {evalDatasetLabel ? (
                        <span className="pattern-eval-upload-filename" title={evalDatasetLabel}>
                          {evalDatasetLabel}
                        </span>
                      ) : (
                        <span className="pattern-eval-upload-hint">JSON: array or {"{"} &quot;cases&quot;: [ … ] {"}"}</span>
                      )}
                    </div>
                    {datasetHint ? <p className="pattern-eval-inline-hint">{datasetHint}</p> : null}
                  </div>
                </div>

                <div className="pattern-eval-card-body pattern-eval-eval-set-body">
                  <div className="pattern-eval-metrics-align">
                    <p>
                      <strong>Eval Pass Rate: {evalPassRateComputed}%</strong>
                      <span className="pattern-eval-metrics-align-sub">
                        Computed from current test cases ({evalCases.length} total). Aligns with Task Success narrative when using the
                        default set (demo).
                      </span>
                    </p>
                  </div>

                  <div className="pattern-eval-before-after">
                    <div>
                      <span className="pattern-eval-label">Before Optimization</span>
                      <p>
                        Pass Rate: <strong>{evalPassRateComputed}%</strong>
                      </p>
                    </div>
                    <div>
                      <span className="pattern-eval-label">After Optimization</span>
                      <p>
                        Pass Rate:{" "}
                        <strong className={showEvalAfterRate ? "pattern-eval-table-up" : ""}>
                          {showEvalAfterRate ? `${evalAfterRate}%` : "—"}
                        </strong>
                        {!showEvalAfterRate ? (
                          <span className="pattern-eval-hint-inline">
                            {" "}
                            Apply a fix from Solution &amp; Roadmap for this pattern to unlock projected pass rate.
                          </span>
                        ) : (
                          <span className="pattern-eval-hint-inline">
                            {" "}
                            Resolution rate in Impact Simulation rises with the same intervention (demo).
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="pattern-eval-success-criteria pattern-eval-success-criteria--editable">
                    <div className="pattern-eval-criteria-head">
                      <p className="pattern-eval-label">Success Criteria</p>
                      <div className="pattern-eval-criteria-actions">
                        <button type="button" className="pattern-eval-upload-btn pattern-eval-upload-btn--sm" onClick={() => criteriaInputRef.current?.click()}>
                          <Upload size={13} aria-hidden />
                          Upload
                        </button>
                        <button type="button" className="pattern-eval-save-btn" onClick={saveCriteria}>
                          Save
                        </button>
                        {criteriaSavedFlash ? <span className="pattern-eval-saved-pill">Saved</span> : null}
                      </div>
                    </div>
                    {criteriaHint ? <p className="pattern-eval-inline-hint pattern-eval-inline-hint--criteria">{criteriaHint}</p> : null}
                    <ul className="pattern-eval-criteria-edit-list">
                      {successCriteriaLines.map((line, idx) => (
                        <li key={`crit-${idx}`}>
                          <span className="pattern-eval-criteria-check" aria-hidden>
                            ✔
                          </span>
                          <input
                            type="text"
                            className="pattern-eval-criteria-input"
                            value={line}
                            onChange={(e) => updateCriterionLine(idx, e.target.value)}
                            placeholder="Criterion description"
                            aria-label={`Criterion ${idx + 1}`}
                          />
                          <button
                            type="button"
                            className="pattern-eval-criteria-remove"
                            aria-label={`Remove criterion ${idx + 1}`}
                            onClick={() => removeCriterionLine(idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="pattern-eval-add-criterion" onClick={addCriterionLine}>
                      <Plus size={14} aria-hidden />
                      Add criterion
                    </button>
                    <p className="pattern-eval-success-fail-hint">
                      Failures violate one or more criteria above — especially intent ↔ tool alignment.
                    </p>
                  </div>

                  <div className="pattern-eval-prompt-improve">
                    <p className="pattern-eval-label">Prompt Improvement</p>
                    <blockquote>{evalSet.promptImprovement}</blockquote>
                  </div>

                  <p className="pattern-eval-label">Test Cases</p>
                  <p className="pattern-eval-pattern-link-hint">
                    Rows linked to <strong>{bundle.patternName}</strong> are highlighted when you enter Evaluation from that Pattern
                    Analysis cohort.
                  </p>
                  <div className="pattern-eval-eval-case-list">{evalCases.map(renderEvalCaseRow)}</div>
                </div>
              </article>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
