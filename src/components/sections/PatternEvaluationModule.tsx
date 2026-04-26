"use client";

import { useCallback, useMemo, useState } from "react";
import { Brain, ChevronDown, ChevronUp, ListOrdered, Loader2, ShieldCheck } from "lucide-react";
import {
  getPatternEvaluationBundle,
  type LlmDimension,
  type PatternEvalId
} from "@/lib/evaluationModuleMock";
import type { ActionOptionId } from "@/lib/mockData";

type EvalKey = "llm" | "process" | "deterministic";
type EvalOpenState = Record<EvalKey, boolean>;

const LLM_DIMS: LlmDimension[] = ["Correctness", "Reasoning", "Tone", "Safety"];

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

type PatternEvaluationModuleProps = {
  patternId: string;
  appliedForPattern: boolean;
  onApplyFix: (causeId: PatternEvalId, optionId?: ActionOptionId) => void;
  onOpenSimulation: () => void;
};

export function PatternEvaluationModule({
  patternId,
  appliedForPattern,
  onApplyFix,
  onOpenSimulation
}: PatternEvaluationModuleProps) {
  const bundle = useMemo(() => getPatternEvaluationBundle(patternId), [patternId]);

  const [open, setOpen] = useState<EvalOpenState>({
    llm: true,
    process: true,
    deterministic: true
  });
  const [llmDims, setLlmDims] = useState<Set<LlmDimension>>(() => new Set(LLM_DIMS));
  const [running, setRunning] = useState<EvalKey | null>(null);
  const [validating, setValidating] = useState(false);
  const [completed, setCompleted] = useState<Partial<Record<EvalKey, true>>>({});
  const [validationShown, setValidationShown] = useState(false);

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
      if (running || validating) return;
      setRunning(key);
      window.setTimeout(() => {
        setRunning(null);
        setCompleted((c) => ({ ...c, [key]: true }));
        setOpen((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
      }, 950);
    },
    [running, validating]
  );

  const baselineCorrectness = bundle.llm.breakdown.find((b) => b.dimension === "Correctness")?.score ?? 6.5;
  const baselineTool = bundle.process.toolAccuracy;
  const afterCorrectness = Math.min(10, Math.round((baselineCorrectness + bundle.uplift.correctness) * 10) / 10);
  const afterTool = Math.min(100, baselineTool + bundle.uplift.toolAccuracyPct);

  const rerunValidation = () => {
    if (!appliedForPattern || running || validating) return;
    setValidating(true);
    window.setTimeout(() => {
      setValidating(false);
      setValidationShown(true);
      setCompleted({ llm: true, process: true, deterministic: true });
    }, 1100);
  };

  const filteredLlmBreakdown = bundle.llm.breakdown.filter((b) => llmDims.has(b.dimension));

  return (
    <div className="pattern-eval-module" id="pattern-evaluation-module">
      <header className="pattern-eval-head">
        <div className="pattern-eval-head-text">
          <h3>Evaluation Strategy</h3>
          <p>
            Evidence for <strong>{bundle.patternName}</strong> — validate severity, localize failure, and confirm fixes against the
            same three verified drivers (no new root causes).
          </p>
        </div>
      </header>

      <section className="pattern-eval-evidence" aria-labelledby="eval-evidence-title">
        <h4 id="eval-evidence-title">Evaluation Evidence</h4>
        <ul>
          {bundle.evidenceBullets.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <div className="pattern-eval-cards">
        {/* LLM-as-a-Judge */}
        <article className={`pattern-eval-card ${open.llm ? "pattern-eval-card--open" : ""}`}>
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
                disabled={running !== null || validating || llmDims.size === 0}
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
                  <button type="button" className="pattern-eval-apply ghost" onClick={() => onApplyFix(bundle.llm.applyFix.causeId, bundle.llm.applyFix.optionId)}>
                    Apply Fix — {bundle.llm.applyFix.label}
                  </button>
                </div>
              ) : (
                <p className="pattern-eval-hint">Run to materialize scores for this pattern.</p>
              )}
            </div>
          ) : null}
        </article>

        {/* Process-based */}
        <article className={`pattern-eval-card ${open.process ? "pattern-eval-card--open" : ""}`}>
          <button
            type="button"
            className="pattern-eval-card-top"
            onClick={() => toggleOpen("process")}
          >
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
                disabled={running !== null || validating}
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
                        {s.name}{" "}
                        <span className="pattern-eval-step-ico">{stepIcon(s.status)}</span>
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

        {/* Deterministic */}
        <article className={`pattern-eval-card ${open.deterministic ? "pattern-eval-card--open" : ""}`}>
          <button
            type="button"
            className="pattern-eval-card-top"
            onClick={() => toggleOpen("deterministic")}
          >
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
                disabled={running !== null || validating}
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

      <section className="pattern-eval-validation" aria-labelledby="eval-validation-title">
        <div className="pattern-eval-validation-head">
          <h4 id="eval-validation-title">Simulation linkage — Before vs After</h4>
          <p>
            After you apply an optimization in Action Center, re-run evaluation here to capture the same signals for{" "}
            <strong>{bundle.patternName}</strong>, then validate projected KPI shifts in Impact Simulation.
          </p>
        </div>
        {!appliedForPattern ? (
          <p className="pattern-eval-hint">Apply a fix from Action Center for this pattern to unlock post-fix validation.</p>
        ) : !validationShown ? (
          <div className="pattern-eval-validation-actions">
            <button type="button" className="pattern-eval-run primary" disabled={running !== null || validating} onClick={rerunValidation}>
              {validating ? (
                <>
                  <Loader2 size={16} className="pattern-eval-spin" aria-hidden />
                  Re-running…
                </>
              ) : (
                "Re-run Evaluation (post-fix)"
              )}
            </button>
            <button type="button" className="ghost pattern-eval-sim-btn" onClick={onOpenSimulation}>
              Open Impact Simulation →
            </button>
          </div>
        ) : (
          <>
            <div className="pattern-eval-table-wrap">
              <table className="pattern-eval-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Before</th>
                    <th>After</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Correctness</td>
                    <td>{baselineCorrectness}</td>
                    <td className="pattern-eval-table-up">{afterCorrectness}</td>
                  </tr>
                  <tr>
                    <td>Tool Accuracy</td>
                    <td>{baselineTool}%</td>
                    <td className="pattern-eval-table-up">{afterTool}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" className="ghost pattern-eval-sim-btn" onClick={onOpenSimulation}>
              Open Impact Simulation →
            </button>
          </>
        )}
      </section>
    </div>
  );
}
