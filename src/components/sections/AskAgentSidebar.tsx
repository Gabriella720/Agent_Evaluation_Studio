"use client";

import { useMemo, useState } from "react";
import { Copy, Mic, Send, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { askFixedInsight, askSuggestedActionLinks, isAskRagOptimizationQuestion } from "@/lib/mockData";

type AskAgentSidebarProps = {
  ingested: boolean;
  onFocusAsk?: () => void;
  onOpenMetrics?: () => void;
  onOpenPatterns?: () => void;
  onOpenSessionReplay?: (sessionId: string) => void;
  onOpenActionCenter?: (causeId: string) => void;
  onOpenSolutionRoadmap?: () => void;
  onOpenRagWorkspace?: () => void;
};

const exampleQuestions = [
  "Why did resolution rate drop today?",
  "Which driver contributed most to the resolution gap?",
  "Summarize the three verified failure patterns",
  "How to improve RAG?"
];

export function AskAgentSidebar({
  ingested,
  onFocusAsk,
  onOpenMetrics,
  onOpenPatterns,
  onOpenActionCenter,
  onOpenSolutionRoadmap,
  onOpenRagWorkspace
}: AskAgentSidebarProps) {
  const [draft, setDraft] = useState("");
  const [voiceActive, setVoiceActive] = useState(false);
  const [askState, setAskState] = useState<"idle" | "working" | "done">("idle");
  const [steps, setSteps] = useState<{ id: string; label: string; done: boolean }[]>([]);
  const [lastQuestion, setLastQuestion] = useState<string>("");
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);

  const answerText = useMemo(() => {
    return [
      "Agent Metrics Summary",
      `- ${askFixedInsight.summaryBullets.join("\n- ")}`,
      "",
      "Pattern Analysis",
      `- ${askFixedInsight.topDrivers.map((d) => `${d.name} ${d.share} · resolution ${d.resolutionImpact}`).join("\n- ")}`,
      "",
      "Solution & Roadmap",
      `- ${askSuggestedActionLinks.map((a) => a.label).join("\n- ")}`
    ].join("\n");
  }, []);

  const runMockWork = () => {
    setSteps([
      { id: "reason", label: "Reasoning…", done: false },
      { id: "search", label: "Searching sessions & traces…", done: false },
      { id: "rank", label: "Ranking drivers by impact…", done: false },
      { id: "compose", label: "Composing answer…", done: false }
    ]);
    setAskState("working");

    const tick = (id: string, delay: number) => {
      window.setTimeout(() => {
        setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, done: true } : s)));
      }, delay);
    };

    tick("reason", 420);
    tick("search", 980);
    tick("rank", 1450);
    tick("compose", 1880);

    window.setTimeout(() => {
      setAskState("done");
    }, 2050);
  };

  const send = () => {
    if (!ingested) return;
    onFocusAsk?.();
    const q = draft.trim();
    if (!q) return;
    setLastQuestion(q);
    setDraft("");
    setFeedback(null);
    setCopied(false);

    // Always show mock work (demo polish).
    runMockWork();
  };

  return (
    <aside className="ask-sidebar">
      <div className="ask-sidebar-head">
        <div className="ask-sidebar-icon-wrap" aria-hidden>
          <Sparkles size={14} strokeWidth={2.2} />
        </div>
        <div className="ask-sidebar-head-text">
          <h2>Ask Your Agent</h2>
          <p>AI-powered insights</p>
        </div>
      </div>

      <div className="ask-sidebar-body">
        <div className="ask-bubble assistant">
          <p>
            Ask about the Taobao AI CS incident: resolution is down 20% in 24 hours. I only surface the three verified drivers—
            intent, tool, and reasoning—so every module stays consistent.
          </p>
          <div className="ask-inline-links">
            <button type="button" onClick={() => onOpenMetrics?.()} disabled={!ingested}>
              Agent Metrics
            </button>
            <span>·</span>
            <button type="button" onClick={() => onOpenPatterns?.()} disabled={!ingested}>
              Pattern Analysis
            </button>
            <span>·</span>
            <button type="button" onClick={() => onOpenSolutionRoadmap?.()} disabled={!ingested}>
              Solution & Roadmap
            </button>
          </div>
        </div>

        {askState !== "idle" && (
          <div className="ask-insight-card">
            <div className="ask-result-head">
              <p className="ask-result-q">Q: {lastQuestion || "—"}</p>
              {askState === "working" && <span className="ask-result-pill">Working</span>}
              {askState === "done" && <span className="ask-result-pill ask-result-pill--done">Complete</span>}
            </div>

            {askState === "working" && (
              <div className="ask-steps">
                {steps.map((s) => (
                  <div key={s.id} className={`ask-step ${s.done ? "done" : ""}`}>
                    <span className="dot" />
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {askState === "done" && (
              <>
                <h3 className="ask-insight-title">Agent Metrics Summary</h3>
                <ul className="ask-insight-list">
                  {askFixedInsight.summaryBullets.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <button type="button" className="ask-link-row" onClick={() => onOpenMetrics?.()} disabled={!ingested}>
                  Open Agent Metrics →
                </button>

                <h3 className="ask-insight-title">Pattern Analysis</h3>
                <ul className="ask-insight-drivers">
                  {askFixedInsight.topDrivers.map((d) => (
                    <li key={d.name}>
                      <strong>{d.name}</strong> <span>{d.share}</span> · resolution {d.resolutionImpact}
                    </li>
                  ))}
                </ul>
                <button type="button" className="ask-link-row" onClick={() => onOpenPatterns?.()} disabled={!ingested}>
                  Open Pattern Analysis →
                </button>

                <h3 className="ask-insight-title">Solution & Roadmap</h3>
                <div className="ask-action-links">
                  {askSuggestedActionLinks.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="ask-action-link"
                      disabled={!ingested}
                      onClick={() => onOpenActionCenter?.(a.id)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="ask-link-row" onClick={() => onOpenSolutionRoadmap?.()} disabled={!ingested}>
                  Open Solution & Roadmap →
                </button>

                {isAskRagOptimizationQuestion(lastQuestion) ? (
                  <div className="ask-rag-cta">
                    <h3 className="ask-insight-title">RAG Optimization Workspace</h3>
                    <ul className="ask-insight-list">
                      <li>Start with Step 1 Retrieval: tune chunk size, embeddings, and query rewrite to raise Recall@5.</li>
                      <li>Enable rerank + context selection to reduce refund-policy distractors for shipping intents.</li>
                      <li>Run E2E evaluation, then Apply Optimization to propagate improvements to Metrics and Simulation.</li>
                    </ul>
                    <button type="button" className="ask-link-row" onClick={() => onOpenRagWorkspace?.()} disabled={!ingested}>
                      Open RAG Optimization Workspace →
                    </button>
                  </div>
                ) : null}

                <div className="ask-feedback">
                  <button
                    type="button"
                    className="ask-feedback-btn"
                    aria-label="Copy answer"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(answerText);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1200);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    <Copy size={14} />
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <div className="ask-feedback-right">
                    <button
                      type="button"
                      className={`ask-icon-react ${feedback === "up" ? "active" : ""}`}
                      aria-label="Thumbs up"
                      onClick={() => setFeedback((v) => (v === "up" ? null : "up"))}
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      type="button"
                      className={`ask-icon-react ${feedback === "down" ? "active" : ""}`}
                      aria-label="Thumbs down"
                      onClick={() => setFeedback((v) => (v === "down" ? null : "down"))}
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <p className="ask-examples-label">Example questions</p>
        <div className="ask-examples">
          {exampleQuestions.map((q) => (
            <button
              key={q}
              type="button"
              className="ask-example-chip"
              onClick={() => {
                setDraft(q);
                // If user clicks an example, run immediately.
                window.setTimeout(() => {
                  // Avoid sending if ingestion is locked.
                  if (!ingested) return;
                  setLastQuestion(q);
                  setDraft("");
                  setFeedback(null);
                  setCopied(false);
                  runMockWork();
                }, 0);
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {!ingested && (
          <p className="ask-sidebar-hint">Send sample data from Agent Data Ingestion to unlock the full incident storyline.</p>
        )}
      </div>

      <div className="ask-sidebar-footer">
        <div className={`ask-input-wrap ${voiceActive ? "ask-input-wrap--voice" : ""}`}>
          <textarea
            rows={3}
            placeholder={voiceActive ? "Listening — speak now or type your question…" : "Ask about your agent performance..."}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => onFocusAsk?.()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label="Ask your agent"
          />
          <div className="ask-input-actions">
            <button
              type="button"
              className={`ask-mic-btn ${voiceActive ? "ask-mic-btn--active" : ""}`}
              aria-label={voiceActive ? "Stop voice input" : "Start voice input"}
              aria-pressed={voiceActive}
              onClick={() => setVoiceActive((v) => !v)}
            >
              <Mic size={16} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={`ask-send-btn ${voiceActive ? "ask-send-btn--secondary" : ""}`}
              aria-label="Send"
              disabled={!ingested}
              onClick={send}
            >
              <Send size={14} />
              Send
            </button>
          </div>
        </div>
        <p className="ask-powered-line">Powered by AI • Real-time analysis</p>
      </div>
    </aside>
  );
}
