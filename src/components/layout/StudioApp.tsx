"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  ChartColumn,
  ChevronRight,
  CircleAlert,
  Copy,
  FolderKanban,
  Lightbulb,
  MessageSquare,
  PlugZap,
  Send,
  Target,
  TriangleAlert
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  askAnalysisSummary,
  askTrend,
  actionCards,
  type ActionOptionId,
  cohortReplays,
  DEMO_AFFECTED_SESSIONS,
  ingestionApiExample,
  ingestionTraceExample,
  metrics as baseMetrics,
  patterns,
  ragSimulationLinkage,
  expectedBusinessImpact,
  fixBeforeAfterConversations,
  type FixConversationCard,
  rootCauseDrivers,
  sessionReplays,
  sessionReplaysMore,
} from "@/lib/mockData";
import { AppHeaderBar } from "@/components/layout/AppHeaderBar";
import { AgentMetricsDashboard } from "@/components/sections/AgentMetricsDashboard";
import { AskAgentSidebar } from "@/components/sections/AskAgentSidebar";
import { RagOptimizationWorkspace } from "@/components/sections/RagOptimizationWorkspace";
import { PatternEvaluationModule } from "@/components/sections/PatternEvaluationModule";
import type { TooltipContentProps } from "recharts";

const navItems = [
  { id: "connect", label: "Connect Agent", icon: PlugZap },
  { id: "metrics", label: "Agent Metrics", icon: ChartColumn },
  { id: "patterns", label: "Pattern Analysis", icon: FolderKanban },
  { id: "root", label: "Solution & Roadmap", icon: TriangleAlert },
  { id: "opt", label: "Impact Simulation", icon: Target }
] as const;

type NavId = (typeof navItems)[number]["id"] | "rag";

export function StudioApp() {
  const [activeNav, setActiveNav] = useState<NavId>("connect");
  const [connectTab, setConnectTab] = useState<"api" | "trace">("api");
  const [ingested, setIngested] = useState(false);
  const [activePattern, setActivePattern] = useState("intent-misclassification");
  const [lastSimulatedSignature, setLastSimulatedSignature] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<"api" | "trace" | null>(null);
  const [highlightSessionId, setHighlightSessionId] = useState<string | null>(null);
  const [patternsSessionsExpanded, setPatternsSessionsExpanded] = useState(false);
  const [sessionDialogueOpen, setSessionDialogueOpen] = useState<Record<string, boolean>>({});
  const [openActionCardId, setOpenActionCardId] = useState<string | null>(null);
  const [selectedActionOption, setSelectedActionOption] = useState<ActionOptionId | null>(null);
  const [appliedOptimizations, setAppliedOptimizations] = useState<Partial<Record<ActionOptionId, boolean>>>({});
  const [appliedCause, setAppliedCause] = useState<Partial<Record<string, boolean>>>({});
  const [fixVariantIndex, setFixVariantIndex] = useState<Record<string, number>>({});
  const [ragImpact, setRagImpact] = useState<{ intentAccuracyDelta: number; resolutionDelta: number; ragHitRateDelta: number } | null>(
    null
  );
  const [metricsFocusWidgetId, setMetricsFocusWidgetId] = useState<string | null>(null);
  const [patternSubView, setPatternSubView] = useState<"overview" | "evaluation">("overview");

  useEffect(() => {
    if (!highlightSessionId) return;
    const el = document.getElementById(`session-replay-${highlightSessionId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(() => setHighlightSessionId(null), 3200);
    return () => window.clearTimeout(t);
  }, [highlightSessionId, activeNav]);

  const onSendSampleData = () => {
    setIngested(true);
    setActiveNav("metrics");
  };

  const copyConnectSnippet = async (type: "api" | "trace", content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedType(type);
      setTimeout(() => {
        setCopiedType((prev) => (prev === type ? null : prev));
      }, 1400);
    } catch {
      setCopiedType(null);
    }
  };

  const sessionsForCohort = useMemo(() => {
    const pool = patternsSessionsExpanded ? [...sessionReplays, ...sessionReplaysMore] : sessionReplays;
    return pool.filter((s) => s.patternId === activePattern);
  }, [patternsSessionsExpanded, activePattern]);

  const hasMoreSessionsForCohort = useMemo(
    () => sessionReplaysMore.some((s) => s.patternId === activePattern),
    [activePattern]
  );

  const patternName = (id: string) => patterns.find((p) => p.id === id)?.name ?? id;

  const actionCardForCause = (causeId: string) => actionCards.find((c) => c.id === causeId);

  const openActionCenterFor = (causeId: string, selectOption?: ActionOptionId | null) => {
    setActivePattern(causeId);
    setActiveNav("root");
    setOpenActionCardId(causeId);
    setSelectedActionOption(selectOption === undefined ? null : selectOption);
  };

  const applyOptimization = (causeId: string, optionId: ActionOptionId) => {
    setAppliedOptimizations((prev) => ({ ...prev, [optionId]: true }));
    setAppliedCause((prev) => ({ ...prev, [causeId]: true }));
    // Any new optimization invalidates the last simulation snapshot.
    setLastSimulatedSignature(null);
  };

  const ragApplied = !!appliedOptimizations["rag-retrieval"];

  const appliedCount = Object.values(appliedCause).filter(Boolean).length;
  const hasAnyAppliedOptimization = useMemo(() => Object.values(appliedOptimizations).some(Boolean), [appliedOptimizations]);
  const currentSimulationSignature = useMemo(() => {
    const keys = Object.entries(appliedOptimizations)
      .filter(([, v]) => !!v)
      .map(([k]) => k)
      .sort();
    const rag = ragImpact ? `${ragImpact.intentAccuracyDelta}|${ragImpact.resolutionDelta}|${ragImpact.ragHitRateDelta}` : "none";
    return `${keys.join(",")}::${rag}`;
  }, [appliedOptimizations, ragImpact]);
  const simulationFinished = lastSimulatedSignature != null && lastSimulatedSignature === currentSimulationSignature;
  const simAfter = useMemo(() => {
    // Deterministic mapping: full uplift only when all three causes have at least one applied optimization.
    const full = appliedCount >= 3;
    const some = appliedCount > 0;
    const ragOnly = appliedCount === 1 && ragApplied && !!ragImpact;
    return {
      resolution: full ? "80%" : ragOnly ? `${62 + ragImpact!.resolutionDelta}%` : some ? "70%" : "--",
      intentAccuracy: full ? "96%" : ragOnly ? `${76 + ragImpact!.intentAccuracyDelta}%` : some ? "84%" : "--",
      escalation: full ? "13%" : some ? "20%" : "--",
      sessionLength: full ? "5.1 min" : some ? "6.8 min" : "--",
      satisfaction: full ? "4.5/5" : some ? "4.1/5" : "--",
      apiTimeout: full ? "3%" : some ? "9%" : "--",
      resolutionUplift: full ? "+18%" : some ? "+8%" : "apply actions",
      intentUplift: full ? "+20%" : ragOnly ? `+${ragImpact!.intentAccuracyDelta}%` : some ? "+8%" : "apply actions",
      escalationUplift: full ? "-15%" : some ? "-8%" : "apply actions",
      sessionUplift: full ? "-38%" : some ? "-17%" : "apply actions",
      satisfactionUplift: full ? "+41%" : some ? "+28%" : "apply actions",
      apiTimeoutUplift: full ? "-75%" : some ? "-50%" : "apply actions"
    };
  }, [appliedCount, ragApplied, ragImpact]);

  const toggleSessionDialogue = (id: string) => {
    setSessionDialogueOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sessionTagClass = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes("frustration") && t.includes("yes")) return "sr-badge sr-badge--bad";
    if (t.includes("incorrect") || t.includes("failed") || t.includes("incomplete")) return "sr-badge sr-badge--bad";
    if (t.includes("sentiment") || t.includes("negative") || t.includes("disappointed") || t.includes("angry")) {
      return "sr-badge sr-badge--warn";
    }
    return "sr-badge sr-badge--neutral";
  };

  return (
    <div className="studio-app">
      <AppHeaderBar />

      <PanelGroup direction="horizontal" autoSaveId="agent-studio-panels" className="studio-panels">
        <Panel defaultSize={16} minSize={12} maxSize={32} className="panel-shell panel-nav">
          <aside className="side-nav side-nav-only">
            <nav className="nav-list">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`nav-item ${activeNav === item.id ? "active" : ""}`}
                    onClick={() => {
                      if (item.id === "patterns") setPatternSubView("overview");
                      setActiveNav(item.id);
                    }}
                  >
                    <Icon size={14} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel defaultSize={58} minSize={36} className="panel-shell panel-main">
          <main className="content-wrap">

        {activeNav !== "connect" && activeNav !== "opt" && activeNav !== "rag" && (
          <section className="alert-banner">
            <div className="alert-left">
              <div className="alert-icon-wrap">
                <AlertTriangle size={14} />
              </div>
              <div className="alert-copy">
                <h3>
                  Critical: Resolution Rate Drop Detected
                  <span className="alert-badge">Active</span>
                </h3>
                <p>
                  Taobao AI Customer Service resolution rate decreased by <span className="alert-emphasis">20%</span> in the past 24 hours.
                  Affecting approximately <span className="alert-emphasis">1,247 user sessions.</span>
                </p>
                <small>
                  Detected: 2 hours ago
                  <span className="alert-sep">•</span>
                  Impact: <span className="alert-emphasis">High</span>
                  <span className="alert-sep">•</span>
                  Trend: <span className="alert-emphasis">Worsening</span>
                </small>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!ingested) return;
                if (activeNav === "metrics") {
                  setPatternSubView("overview");
                  setActiveNav("patterns");
                } else setActiveNav("metrics");
              }}
            >
              {activeNav === "metrics" ? "Investigate" : "View Data"}
            </button>
          </section>
        )}

        {activeNav === "connect" && (
          <section className="connect-panel">
            <h2>Agent Data Ingestion</h2>
            <p>Stream Taobao AI Customer Service sessions. One click loads the full incident dataset used across Metrics, Patterns, Root Cause, and Simulation.</p>
            <div className="connect-tabs">
              <button className={connectTab === "api" ? "active" : ""} type="button" onClick={() => setConnectTab("api")}>
                API
              </button>
              <button className={connectTab === "trace" ? "active" : ""} type="button" onClick={() => setConnectTab("trace")}>
                Trace
              </button>
            </div>
            {connectTab === "api" ? (
              <>
                <div className="connect-code-block">
                  <div className="trace-head">
                    <div>
                      <h4>API payload example</h4>
                      <small>POST JSON session payloads to the ingestion endpoint</small>
                    </div>
                    <button
                      type="button"
                      className="copy-icon"
                      aria-label="Copy API integration example"
                      onClick={() => copyConnectSnippet("api", ingestionApiExample)}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <pre>{ingestionApiExample}</pre>
                </div>
                <div className="ingestion-actions">
                  <button type="button" className="primary" onClick={onSendSampleData}>
                    <Send size={14} />
                    Send Sample Data
                  </button>
                  <button type="button" className="ghost">View Documentation</button>
                  {copiedType === "api" && <span className="copied-state">Copied</span>}
                </div>
              </>
            ) : (
              <>
                <div className="connect-code-block">
                  <div className="trace-head">
                    <div>
                      <h4>Trace payload example</h4>
                      <small>Ship OpenTelemetry spans for each agent turn</small>
                    </div>
                    <button
                      type="button"
                      className="copy-icon"
                      aria-label="Copy trace example"
                      onClick={() => copyConnectSnippet("trace", ingestionTraceExample)}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <pre>{ingestionTraceExample}</pre>
                </div>
                <div className="ingestion-actions">
                  <button type="button" className="primary" onClick={onSendSampleData}>
                    <Send size={14} />
                    Send Sample Data
                  </button>
                  <button type="button" className="ghost">View Documentation</button>
                  {copiedType === "trace" && <span className="copied-state">Copied</span>}
                </div>
              </>
            )}
          </section>
        )}

        {!ingested && activeNav !== "connect" && (
          <section className="empty-state">
            <Bot size={20} />
            <h3>Analytics modules are locked</h3>
            <p>Please go to Connect Agent and click Send Sample Data first. Then Agent Metrics, Patterns, Root Cause, and Optimization tabs will show their full content.</p>
          </section>
        )}

        {ingested && activeNav === "metrics" && (
          <>
            <section className="panel">
              <h2>Key Metrics Overview</h2>
              <AgentMetricsDashboard
                metrics={baseMetrics}
                focusWidgetId={metricsFocusWidgetId ?? undefined}
                onFocusHandled={() => setMetricsFocusWidgetId(null)}
                onOpenPatternAnalysis={(patternId) => {
                  setActiveNav("patterns");
                  setPatternSubView("overview");
                  setActivePattern(patternId);
                }}
              />
            </section>
          </>
        )}

        {ingested && activeNav === "rag" && (
          <section className="panel rag-panel">
            <RagOptimizationWorkspace
              applied={ragApplied}
              onClose={() => setActiveNav("root")}
              onOpenMetrics={() => {
                setActiveNav("metrics");
                setMetricsFocusWidgetId("rag");
              }}
              onApplyOptimization={(impact) => {
                setRagImpact(impact);
                applyOptimization("intent-misclassification", "rag-retrieval");
              }}
            />
          </section>
        )}

        {ingested && activeNav === "patterns" && (
          <div className="pattern-analysis-page">
            {patternSubView === "overview" ? (
              <>
            <section className="panel pattern-module">
              <div className="rcd-panel-head">
                <h2>Root Cause Detection</h2>
                <div className="rcd-panel-actions">
                  <button type="button" className="rcd-solution-entry" onClick={() => setActiveNav("root")}>
                    <span className="rcd-eval-entry-text">
                      <span className="rcd-eval-entry-title">Solution &amp; Roadmap</span>
                      <span className="rcd-eval-entry-sub">Recommended fixes and rollout plan</span>
                    </span>
                    <ChevronRight className="rcd-eval-entry-chevron" size={20} strokeWidth={2.2} aria-hidden />
                  </button>
                  <button type="button" className="rcd-eval-entry" onClick={() => setPatternSubView("evaluation")}>
                    <span className="rcd-eval-entry-text">
                      <span className="rcd-eval-entry-title">Evaluation</span>
                      <span className="rcd-eval-entry-sub">How conclusions are verified</span>
                    </span>
                    <ChevronRight className="rcd-eval-entry-chevron" size={20} strokeWidth={2.2} aria-hidden />
                  </button>
                </div>
              </div>
              <p className="panel-lead">{askAnalysisSummary}</p>
              <div className="chart-shell rcd-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={askTrend}>
                    <CartesianGrid stroke="#202431" />
                    <XAxis dataKey="label" stroke="#6e7388" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#6e7388" domain={[58, 86]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={(p: TooltipContentProps<number | string | readonly (number | string)[], string | number>) => {
                        if (!p?.active || !p?.payload?.[0]) return null;
                        const v = p.payload[0].value;
                        return (
                          <div className="kpi-tooltip">
                            <div className="kpi-tooltip-title">{String(p.label ?? "")}</div>
                            <div className="kpi-tooltip-lines">
                              <div className="kpi-tooltip-line">
                                <span className="kpi-tooltip-dot" style={{ background: p.payload[0].color ?? "rgba(139, 92, 246, 0.9)" }} aria-hidden />
                                <span className="kpi-tooltip-name">{String(p.payload[0].name ?? "Resolution %")}</span>
                                <strong className="kpi-tooltip-value">{typeof v === "number" ? v.toFixed(0) : String(v ?? "")}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot name="Resolution %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="rcd-drivers-intro">Share of failing traffic vs. impact on resolution (three verified drivers only)</p>
              <div className="rcd-driver-grid">
                {patterns.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`rcd-driver-card ${activePattern === p.id ? "rcd-driver-card--active" : ""}`}
                    onClick={() => {
                      setActivePattern(p.id);
                      setPatternsSessionsExpanded(false);
                      setSessionDialogueOpen({});
                    }}
                  >
                    <div className="rcd-driver-head">
                      <strong>{p.name}</strong>
                      <span className="rcd-driver-impact">{p.resolutionImpact}</span>
                    </div>
                    <div className="rcd-driver-meta">
                      <span>{p.percentage}% of failures</span>
                      <span>{p.sessions} sessions</span>
                    </div>
                    <div className="rcd-driver-bar-wrap" aria-hidden>
                      <div className="rcd-driver-bar" style={{ width: `${p.percentage}%` }} />
                    </div>
                    <p className="rcd-driver-example">{p.businessImpact}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel pattern-module">
              <h2>Cohort Replay</h2>
              <p className="panel-lead">
                Each card is a representative journey for one failure mode. <strong>Select a cohort</strong> to load matching
                session replays below—the same pattern is highlighted in Root cause detection.
              </p>
              <div className="cohort-replay-grid">
                {cohortReplays.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className={`cohort-replay-card cohort-replay-card--btn ${activePattern === c.id ? "cohort-replay-card--active" : ""}`}
                    onClick={() => {
                      setActivePattern(c.id);
                      setPatternsSessionsExpanded(false);
                      setSessionDialogueOpen({});
                    }}
                    aria-pressed={activePattern === c.id}
                  >
                    <h5>{c.title}</h5>
                    <p>{c.path}</p>
                    <span className="cohort-replay-hint">Show sessions for this cohort →</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel pattern-module">
              <div className="session-replay-head">
                <h2>Session Replay</h2>
                <p className="panel-lead">
                  Showing conversations for <strong>{patternName(activePattern)}</strong>. These sessions share the same failure
                  pattern as the cohort you selected above. Expand a thread for follow-up turns, or load an additional sample for
                  this cohort only.
                </p>
              </div>
              <div className="session-replay-list">
                {sessionsForCohort.length === 0 ? (
                  <p className="sr-empty">No replay samples for this cohort in the current slice.</p>
                ) : (
                  sessionsForCohort.map((session) => (
                  <article
                    key={session.id}
                    id={`session-replay-${session.id}`}
                    className={`sr-session ${highlightSessionId === session.id ? "sr-session--focus" : ""}`}
                  >
                    <header className="sr-session-meta">
                      User #{session.userDisplayNum ?? "—"} · {session.age} · {patternName(session.patternId)}
                    </header>
                    <div className="sr-msg sr-msg--user">
                      <MessageSquare size={16} strokeWidth={2} className="sr-msg-icon" aria-hidden />
                      <div className="sr-msg-body">
                        <span className="sr-msg-label">User</span>
                        <p>{session.userMessage}</p>
                      </div>
                    </div>
                    <div className="sr-msg sr-msg--agent">
                      <AlertTriangle size={16} strokeWidth={2} className="sr-msg-icon" aria-hidden />
                      <div className="sr-msg-body">
                        <span className="sr-msg-label">Agent</span>
                        <p>{session.agentMessage}</p>
                      </div>
                    </div>
                    {session.extraTurns && session.extraTurns.length > 0 && (
                      <>
                        {sessionDialogueOpen[session.id] &&
                          session.extraTurns.map((turn, idx) => (
                            <div
                              key={`${session.id}-ex-${idx}`}
                              className={turn.role === "user" ? "sr-msg sr-msg--user" : "sr-msg sr-msg--agent"}
                            >
                              {turn.role === "user" ? (
                                <MessageSquare size={16} strokeWidth={2} className="sr-msg-icon" aria-hidden />
                              ) : (
                                <AlertTriangle size={16} strokeWidth={2} className="sr-msg-icon" aria-hidden />
                              )}
                              <div className="sr-msg-body">
                                <span className="sr-msg-label">{turn.role === "user" ? "User" : "Agent"}</span>
                                <p>{turn.text}</p>
                              </div>
                            </div>
                          ))}
                        <button type="button" className="sr-dialogue-toggle" onClick={() => toggleSessionDialogue(session.id)}>
                          {sessionDialogueOpen[session.id] ? "Hide follow-up turns" : "Show more dialogue"}
                        </button>
                      </>
                    )}
                    <div className="sr-badges">
                      {session.tags.map((tag) => (
                        <span key={tag} className={sessionTagClass(tag)}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                  ))
                )}
              </div>
              {hasMoreSessionsForCohort && (
                <button
                  type="button"
                  className="sr-load-more ghost"
                  disabled={patternsSessionsExpanded}
                  onClick={() => setPatternsSessionsExpanded(true)}
                >
                  {patternsSessionsExpanded
                    ? "All sample conversations for this cohort are visible"
                    : "View more conversations for this cohort"}
                </button>
              )}
            </section>
              </>
            ) : (
              <section className="panel pattern-module pattern-evaluation-subpage" id="pattern-evaluation-subpage">
                <button type="button" className="pattern-sub-back" onClick={() => setPatternSubView("overview")}>
                  <ArrowLeft size={16} strokeWidth={2.2} aria-hidden />
                  Pattern Analysis
                </button>
                <h2>Evaluation</h2>
                <p className="panel-lead">
                  The Pattern Analysis overview summarizes <em>what</em> failed for <strong>{patternName(activePattern)}</strong>. This
                  page shows <em>how</em> that conclusion is supported—LLM Judge, process traces, deterministic checks, and curated{" "}
                  <strong>Evals</strong> tied to the same drivers and Task Success metrics. Use the tabs below to probe your agent with the
                  same signals (demo).
                </p>
                <PatternEvaluationModule
                  key={activePattern}
                  patternId={activePattern}
                  appliedForPattern={!!appliedCause[activePattern]}
                  onApplyFix={(causeId, optionId) => openActionCenterFor(causeId, optionId)}
                />
              </section>
            )}
          </div>
        )}

        {ingested && activeNav === "root" && (
          <section className="action-center">
            <article className="panel action-center-left">
              <header className="solution-panel-head">
                <div className="solution-panel-icon solution-panel-icon--danger" aria-hidden>
                  <CircleAlert size={16} />
                </div>
                <div>
                  <h2>Root Causes (click to act)</h2>
                  <p>Diagnosed from {DEMO_AFFECTED_SESSIONS} sessions</p>
                </div>
              </header>

              <div className="ac-cause-list">
                {patterns.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`ac-cause ${activePattern === p.id ? "ac-cause--active" : ""}`}
                    onClick={() => {
                      setActivePattern(p.id);
                      setOpenActionCardId(p.id);
                      setSelectedActionOption(null);
                    }}
                  >
                    <div className="ac-cause-title">
                      <strong>{p.name}</strong>
                      <span className="ac-cause-impact">{p.resolutionImpact}</span>
                    </div>
                    <div className="ac-cause-meta">
                      <span>{p.percentage}% share</span>
                      <span>·</span>
                      <span>{p.sessions} sessions</span>
                      {appliedCause[p.id] ? <span className="ac-applied-pill">Optimized</span> : null}
                    </div>
                    <p className="ac-cause-desc">{p.businessImpact}</p>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="ac-impact-jump"
                disabled={!hasAnyAppliedOptimization}
                onClick={() => setActiveNav("opt")}
              >
                Open Impact Simulation →
              </button>
            </article>

            <article className="panel action-center-right">
              <header className="solution-panel-head">
                <div className="solution-panel-icon solution-panel-icon--good" aria-hidden>
                  <Lightbulb size={16} />
                </div>
                <div>
                  <h2>Actions</h2>
                  <p>Execute optimizations and record applied state</p>
                </div>
              </header>

              {(() => {
                const card = actionCardForCause(activePattern);
                if (!card) return null;

                const opened = openActionCardId === card.id;
                return (
                  <section className="ac-action-card">
                    <div className="ac-action-head">
                      <div>
                        <h3 className="ac-action-title">
                          {card.title} <span className="ac-action-impact">({card.impact})</span>
                        </h3>
                        <p className="ac-action-sub">{rootCauseDrivers.find((d) => d.patternId === card.id)?.body}</p>
                      </div>
                      {appliedCause[card.id] ? <span className="ac-applied-pill ac-applied-pill--solid">Optimized</span> : null}
                    </div>

                    <button
                      type="button"
                      className="ac-action-cta primary"
                      onClick={() => setOpenActionCardId((prev) => (prev === card.id ? null : card.id))}
                    >
                      {card.ctaLabel}
                    </button>

                    <motion.div
                      className="ac-action-panel"
                      initial={false}
                      animate={opened ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                    >
                      {opened && (
                        <div className="ac-action-panel-inner">
                          <div className="ac-step">
                            <h4>Step 1 — {card.analysis.title}</h4>
                            {card.analysis.bullets ? (
                              <ul>
                                {card.analysis.bullets.map((b) => (
                                  <li key={b}>{b}</li>
                                ))}
                              </ul>
                            ) : null}
                            {card.analysis.examples?.map((ex) => (
                              <div key={ex.label} className="ac-example">
                                <p className="ac-example-label">{ex.label}</p>
                                <pre className="ac-example-pre">{ex.lines.join("\n")}</pre>
                              </div>
                            ))}
                          </div>

                          <div className="ac-step">
                            <h4>Step 2 — Choose an optimization</h4>
                            <div className="ac-option-row">
                              {card.options.map((opt) => {
                                const applied = !!appliedOptimizations[opt.id];
                                const selected = selectedActionOption === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    className={`ac-option ${selected ? "ac-option--active" : ""} ${applied ? "ac-option--applied" : ""}`}
                                    onClick={() => {
                                      setSelectedActionOption(opt.id);
                                      if (opt.id === "rag-retrieval") setActiveNav("rag");
                                    }}
                                  >
                                    {opt.label}
                                    {applied ? <span className="ac-option-applied">Applied</span> : null}
                                  </button>
                                );
                              })}
                            </div>

                            {selectedActionOption && card.options.some((o) => o.id === selectedActionOption && o.kind !== "drawer") ? (
                              <button
                                type="button"
                                className="ac-apply-btn primary"
                                disabled={!!appliedOptimizations[selectedActionOption]}
                                onClick={() => applyOptimization(card.id, selectedActionOption)}
                              >
                                {appliedOptimizations[selectedActionOption] ? "Applied" : "Apply Optimization"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </section>
                );
              })()}
            </article>

            {/* RAG retrieval is now handled by the full RAG Optimization Workspace page. */}
          </section>
        )}

        {ingested && activeNav === "opt" && (
          <section className="impact-page">
            <header className="impact-header">
              <h2>Optimization Impact</h2>
              <p>Simulate and validate the impact of proposed solutions</p>
            </header>

            <section className="impact-hero">
              <div>
                <h3>Impact Simulation</h3>
                <p>Projected outcomes after implementing your applied optimizations</p>
              </div>
              <button
                type="button"
                className={`primary impact-run ${simulationFinished ? "impact-run--done" : ""}`}
                disabled={!hasAnyAppliedOptimization}
                onClick={() => {
                  if (!hasAnyAppliedOptimization) return;
                  // Manual trigger only: capture a simulation snapshot for the currently applied optimizations.
                  setLastSimulatedSignature(currentSimulationSignature);
                }}
              >
                {simulationFinished ? "Finished Simulation" : "Run Simulation"}
              </button>
            </section>

            <section className="impact-rag-linkage" aria-labelledby="impact-rag-linkage-title">
              <h4 id="impact-rag-linkage-title">RAG score ↔ Resolution (demo elasticity)</h4>
              <p className="impact-rag-linkage-lead">
                Same narrative as the RAG Score card: large resolution lifts while RAG is below ~80, then marginal returns — supporting a
                business target of <strong>80</strong> instead of chasing 85+ blindly.
              </p>
              <ul className="impact-rag-linkage-list">
                {ragSimulationLinkage.map((row) => (
                  <li key={`${row.ragFrom}-${row.ragTo}`}>
                    <span className="impact-rag-linkage-kpi">
                      RAG Score: {row.ragFrom} → {row.ragTo}
                    </span>
                    <span className="impact-rag-linkage-sep">·</span>
                    <span className="impact-rag-linkage-res">Resolution: {row.resolutionDelta}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="impact-business">
              <div className="impact-business-head">
                <div className="impact-business-icon" aria-hidden>
                  <span>↗</span>
                </div>
                <h3>Expected Business Impact</h3>
              </div>
              <div className="impact-business-grid">
                {expectedBusinessImpact.map((i) => (
                  <div key={i.label} className="impact-business-item">
                    <p>{i.label}</p>
                    <strong>{i.value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <div className="impact-grid">
              {[
                { label: "Resolution Rate", before: "62%", after: simAfter.resolution, uplift: simAfter.resolutionUplift },
                { label: "Escalation Rate", before: "28%", after: simAfter.escalation, uplift: simAfter.escalationUplift },
                { label: "Avg Session Length", before: "8.2 min", after: simAfter.sessionLength, uplift: simAfter.sessionUplift },
                { label: "Intent Accuracy", before: "76%", after: simAfter.intentAccuracy, uplift: simAfter.intentUplift },
                { label: "User Satisfaction", before: "3.2/5", after: simAfter.satisfaction, uplift: simAfter.satisfactionUplift },
                { label: "API Timeout Rate", before: "12%", after: simAfter.apiTimeout, uplift: simAfter.apiTimeoutUplift }
              ].map((item) => (
                <motion.article key={item.label} className="impact-card" initial={{ opacity: 0.88 }} animate={{ opacity: 1 }}>
                  <p className="impact-card-title">{item.label}</p>
                  <div className="impact-before-after">
                    <div>
                      <span className="impact-label">Before</span>
                      <strong className="impact-before">{item.before}</strong>
                    </div>
                    <div className="impact-mid">
                      <span className="impact-arrow">→</span>
                      <span className="impact-uplift-inline">{simulationFinished ? item.uplift : "waiting..."}</span>
                    </div>
                    <div>
                      <span className="impact-label">After</span>
                      <strong className="impact-after">{simulationFinished ? item.after : "--"}</strong>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>

            <section className="impact-fix">
              <header className="impact-fix-head">
                <h3>Before / After Fix</h3>
                <p>For the same user question, see the expected response after applying the corresponding fix</p>
              </header>
              <div className="impact-fix-grid">
                {fixBeforeAfterConversations.map((c) => (
                  <article key={c.id} className="impact-fix-card">
                    <h4>{c.title}</h4>
                    {(() => {
                      const typed = c as unknown as FixConversationCard;
                      const variants = typed.variants;
                      const idx = fixVariantIndex[c.id] ?? 0;
                      const v = variants?.[idx] ?? null;
                      const userText = v?.beforeUser ?? c.before.text;
                      const beforeAgentText = v?.beforeAgent ?? c.beforeAgent.text;
                      const afterAgentText = v?.afterAgent ?? c.afterAgent.text;

                      return (
                        <>
                    <div className="impact-fix-cols">
                      <div className="impact-fix-col">
                        <span className="impact-fix-tag">Before</span>
                        <div className="impact-fix-msg impact-fix-msg--user">{userText}</div>
                        <div className="impact-fix-msg impact-fix-msg--agent">{beforeAgentText}</div>
                      </div>
                      <div className="impact-fix-col">
                        <span className="impact-fix-tag">After</span>
                        <div className="impact-fix-msg impact-fix-msg--user">{userText}</div>
                        <div className="impact-fix-msg impact-fix-msg--agent">{afterAgentText}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="impact-more-btn"
                      onClick={() => {
                        const total = variants?.length ?? 1;
                        setFixVariantIndex((prev) => ({ ...prev, [c.id]: ((prev[c.id] ?? 0) + 1) % total }));
                      }}
                    >
                      View more Dialogues
                    </button>
                        </>
                      );
                    })()}
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {ingested && activeNav === "connect" && (
          <section className="empty-state">
            <Bot size={20} />
            <h3>Agent is connected and observable</h3>
            <p>Use the left navigation tabs to inspect metrics, analyze patterns, review root cause, and validate optimization impact.</p>
          </section>
        )}
          </main>
        </Panel>

        <PanelResizeHandle className="resize-handle" />

        <Panel defaultSize={26} minSize={18} maxSize={42} className="panel-shell panel-ask">
          <AskAgentSidebar
            ingested={ingested}
            onOpenMetrics={() => setActiveNav("metrics")}
            onOpenPatterns={() => {
              setPatternSubView("overview");
              setActiveNav("patterns");
            }}
            onOpenSessionReplay={(id) => {
              const row = [...sessionReplays, ...sessionReplaysMore].find((s) => s.id === id);
              const inMore = sessionReplaysMore.some((s) => s.id === id);
              setPatternSubView("overview");
              setActiveNav("patterns");
              if (row) setActivePattern(row.patternId);
              if (inMore) setPatternsSessionsExpanded(true);
              setSessionDialogueOpen({});
              setHighlightSessionId(id);
            }}
            onOpenActionCenter={(causeId, optionId) => openActionCenterFor(causeId, optionId)}
            onOpenPatternEvaluation={() => {
              setActiveNav("patterns");
              setPatternSubView("evaluation");
              window.setTimeout(() => {
                document.getElementById("pattern-evaluation-subpage")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 120);
            }}
            onOpenSolutionRoadmap={() => setActiveNav("root")}
            onOpenRagWorkspace={() => {
              if (!ingested) return;
              setActiveNav("rag");
            }}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
