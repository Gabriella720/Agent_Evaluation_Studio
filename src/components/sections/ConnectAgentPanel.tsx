"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  GitBranch,
  MessageSquareHeart,
  Radio,
  Send,
  Settings2
} from "lucide-react";
import {
  agentTraceSamples,
  dataFusionSummary,
  dataSourceConfigs,
  feedbackConfigFields,
  feedbackSampleRecords,
  ingestionFeedbackExample,
  ingestionProductionExample,
  ingestionTraceExample,
  productionConfigFields,
  productionSampleRecords,
  traceConfigFields,
  type AgentTraceSample,
  type DataSourceId,
  type TraceNodeType
} from "@/lib/dataSourceMock";

type ConnectAgentPanelProps = {
  ingested: boolean;
  onSendSampleData: () => void;
};

type ConnectTab = DataSourceId;

const TAB_ORDER: ConnectTab[] = ["feedback", "production", "trace"];

const tabIcons: Record<ConnectTab, typeof MessageSquareHeart> = {
  feedback: MessageSquareHeart,
  production: Radio,
  trace: GitBranch
};

const traceNodeLabels: Record<TraceNodeType, string> = {
  intent: "Intent",
  plan: "Plan",
  reasoning: "Reasoning",
  rag_retrieval: "RAG",
  tool_call: "Tool",
  response: "Response"
};

function statusClass(status: "connected" | "syncing" | "degraded" | "ok" | "warn" | "fail"): string {
  if (status === "connected" || status === "ok") return "ds-pill ds-pill--good";
  if (status === "syncing" || status === "warn") return "ds-pill ds-pill--warn";
  return "ds-pill ds-pill--bad";
}

function snippetForTab(tab: ConnectTab): string {
  if (tab === "feedback") return ingestionFeedbackExample;
  if (tab === "production") return ingestionProductionExample;
  return ingestionTraceExample;
}

function configFieldsForTab(tab: ConnectTab) {
  if (tab === "feedback") return feedbackConfigFields;
  if (tab === "production") return productionConfigFields;
  return traceConfigFields;
}

function TraceTimeline({ trace }: { trace: AgentTraceSample }) {
  return (
    <div className="ds-trace-timeline">
      <div className="ds-trace-timeline-head">
        <span>
          <strong>{trace.traceId}</strong> · {trace.sessionId}
        </span>
        <span className={statusClass(trace.outcome === "success" ? "ok" : "fail")}>
          {trace.outcome === "success" ? "Success" : "Failure"}
        </span>
        <span className="ds-trace-meta">{trace.totalLatencyMs} ms total</span>
        {trace.sampled ? <span className="ds-pill ds-pill--info">Sampled</span> : null}
      </div>
      <ol className="ds-trace-nodes">
        {trace.nodes.map((node, idx) => (
          <li key={node.id} className={`ds-trace-node ds-trace-node--${node.status}`}>
            <div className="ds-trace-node-rail" aria-hidden>
              <span className={`ds-trace-node-dot ds-trace-node-dot--${node.type}`} />
              {idx < trace.nodes.length - 1 ? <span className="ds-trace-node-line" /> : null}
            </div>
            <div className="ds-trace-node-body">
              <div className="ds-trace-node-top">
                <span className={`ds-trace-type ds-trace-type--${node.type}`}>{traceNodeLabels[node.type]}</span>
                <strong>{node.name}</strong>
                <span className="ds-trace-latency">{node.latencyMs} ms</span>
                <span className={statusClass(node.status)}>{node.status}</span>
              </div>
              <p className="ds-trace-summary">{node.summary}</p>
              {node.detail ? <p className="ds-trace-detail">{node.detail}</p> : null}
              {node.metadata && node.metadata.length > 0 ? (
                <dl className="ds-trace-meta-grid">
                  {node.metadata.map((m) => (
                    <div key={m.label}>
                      <dt>{m.label}</dt>
                      <dd>{m.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ConnectAgentPanel({ ingested, onSendSampleData }: ConnectAgentPanelProps) {
  const [activeTab, setActiveTab] = useState<ConnectTab>("feedback");
  const [copiedTab, setCopiedTab] = useState<ConnectTab | null>(null);
  const [expandedTraceId, setExpandedTraceId] = useState<string>(agentTraceSamples[0]?.traceId ?? "");
  const [showConfig, setShowConfig] = useState(true);
  const [showRecords, setShowRecords] = useState(true);
  const [connectedSources, setConnectedSources] = useState<Record<DataSourceId, boolean>>({
    feedback: true,
    production: true,
    trace: true
  });
  const [statusMenuId, setStatusMenuId] = useState<DataSourceId | null>(null);

  const activeConfig = dataSourceConfigs[activeTab];
  const configFields = configFieldsForTab(activeTab);
  const activeConnected = connectedSources[activeTab];

  const connectedCount = TAB_ORDER.filter((id) => connectedSources[id]).length;

  const totalRecords24h = useMemo(
    () =>
      TAB_ORDER.reduce((sum, id) => (connectedSources[id] ? sum + dataSourceConfigs[id].records24h : sum), 0),
    [connectedSources]
  );

  const traceCoveragePct = connectedSources.trace ? dataSourceConfigs.trace.cohortCoveragePct : 0;

  const setSourceConnected = (id: DataSourceId, connected: boolean) => {
    setConnectedSources((prev) => ({ ...prev, [id]: connected }));
    setStatusMenuId(null);
  };

  const toggleStatusMenu = (id: DataSourceId, e: MouseEvent) => {
    e.stopPropagation();
    setStatusMenuId((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    if (!statusMenuId) return;
    const close = () => setStatusMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [statusMenuId]);

  const copySnippet = async (tab: ConnectTab) => {
    try {
      await navigator.clipboard.writeText(snippetForTab(tab));
      setCopiedTab(tab);
      window.setTimeout(() => setCopiedTab((prev) => (prev === tab ? null : prev)), 1400);
    } catch {
      setCopiedTab(null);
    }
  };

  const TabIcon = tabIcons[activeTab];

  return (
    <section className="connect-panel connect-panel--multi">
      <header className="connect-panel-head">
        <div>
          <h2>Agent Data Ingestion</h2>
          <p>
            Connect three data planes for full-scene insight — user feedback, production telemetry, and decision-chain traces
            power Metrics, Pattern Analysis, Root Cause, and Simulation.
          </p>
        </div>
        {ingested && connectedCount > 0 ? (
          <div className="connect-fusion-badge">
            <CheckCircle2 size={16} aria-hidden />
            {connectedCount === TAB_ORDER.length
              ? "All sources linked"
              : `${connectedCount} of ${TAB_ORDER.length} sources linked`}
          </div>
        ) : null}
      </header>

      <div className="connect-fusion-banner">
        <Database size={16} aria-hidden />
        <div>
          <strong>{dataFusionSummary.headline}</strong>
          <ul>
            {dataFusionSummary.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        <div className="connect-fusion-stats">
          <div>
            <span>Incident sessions</span>
            <strong>{connectedSources.production ? "1,247" : "—"}</strong>
          </div>
          <div>
            <span>Records (24h)</span>
            <strong>{totalRecords24h > 0 ? totalRecords24h.toLocaleString() : "—"}</strong>
          </div>
          <div>
            <span>Trace coverage</span>
            <strong>{traceCoveragePct > 0 ? `${traceCoveragePct}%` : "—"}</strong>
          </div>
        </div>
      </div>

      <div className="connect-source-strip">
        {TAB_ORDER.map((id) => {
          const cfg = dataSourceConfigs[id];
          const Icon = tabIcons[id];
          const isConnected = connectedSources[id];
          return (
            <button
              key={id}
              type="button"
              className={`connect-source-card ${activeTab === id ? "connect-source-card--active" : ""} ${
                !isConnected ? "connect-source-card--disconnected" : ""
              }`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} aria-hidden />
              <div className="connect-source-card-text">
                <strong>{cfg.shortLabel}</strong>
                <span>{isConnected ? `${cfg.records24h.toLocaleString()} / 24h` : "Not connected"}</span>
              </div>
              <div className="connect-source-status-wrap">
                <button
                  type="button"
                  className={`connect-source-status-btn ${isConnected ? "connect-source-status-btn--on" : "connect-source-status-btn--off"}`}
                  aria-expanded={statusMenuId === id}
                  aria-haspopup="menu"
                  onClick={(e) => toggleStatusMenu(id, e)}
                >
                  {isConnected ? "Connected" : "Disconnected"}
                  <ChevronDown size={12} aria-hidden />
                </button>
                {statusMenuId === id ? (
                  <div
                    className="connect-source-status-menu"
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className={isConnected ? "active" : ""}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceConnected(id, true);
                      }}
                    >
                      Connect
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={!isConnected ? "active" : ""}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceConnected(id, false);
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="connect-tabs connect-tabs--three">
        {TAB_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? "active" : ""}
            onClick={() => setActiveTab(id)}
          >
            {dataSourceConfigs[id].label}
          </button>
        ))}
      </div>

      <div className="connect-tab-body">
        <div className="connect-source-intro">
          <TabIcon size={18} aria-hidden />
          <div>
            <h3>{activeConfig.label}</h3>
            <p>{activeConfig.description}</p>
          </div>
          <div className="connect-source-meta">
            <span className={statusClass(activeConnected ? "connected" : "fail")}>
              {activeConnected ? "connected" : "disconnected"}
            </span>
            <span>Last sync: {activeConnected ? activeConfig.lastSync : "—"}</span>
            <span>Cohort: {activeConnected ? `${activeConfig.cohortCoveragePct}%` : "0%"}</span>
          </div>
        </div>

        <div className="connect-dual-grid">
          <article className="connect-card">
            <button type="button" className="connect-card-toggle" onClick={() => setShowConfig((v) => !v)}>
              <Settings2 size={16} aria-hidden />
              <span>Data Source Configuration</span>
              {showConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showConfig ? (
              <div className="connect-card-body">
                <dl className="connect-config-dl">
                  <div>
                    <dt>Endpoint</dt>
                    <dd>
                      <code>{activeConfig.endpoint}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Auth</dt>
                    <dd>{activeConfig.authMethod}</dd>
                  </div>
                  {configFields.map((f) => (
                    <div key={f.key}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </article>

          <article className="connect-card">
            <button type="button" className="connect-card-toggle" onClick={() => setShowRecords((v) => !v)}>
              <Activity size={16} aria-hidden />
              <span>Data Source Info &amp; Recent Records</span>
              {showRecords ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showRecords ? (
              <div className="connect-card-body">
                {!activeConnected ? (
                  <p className="connect-card-hint connect-card-hint--muted">
                    This source is disconnected. Use the status menu on the card above to Connect, or configure the endpoint
                    below.
                  </p>
                ) : null}
                {activeTab === "feedback" && activeConnected ? (
                  <table className="connect-records-table">
                    <thead>
                      <tr>
                        <th>Session</th>
                        <th>Signal</th>
                        <th>Intent</th>
                        <th>Pattern</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feedbackSampleRecords.map((r) => (
                        <tr key={r.id}>
                          <td>{r.sessionId}</td>
                          <td>
                            <span className={`ds-signal ds-signal--${r.signal}`}>{r.signal.replace("_", " ")}</span>
                          </td>
                          <td>{r.intent}</td>
                          <td>{r.linkedPattern ?? "—"}</td>
                          <td>{r.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}

                {activeTab === "production" && activeConnected ? (
                  <table className="connect-records-table">
                    <thead>
                      <tr>
                        <th>Session</th>
                        <th>Channel</th>
                        <th>Intent</th>
                        <th>Resolved</th>
                        <th>Latency</th>
                        <th>Escalation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionSampleRecords.map((r) => (
                        <tr key={r.id}>
                          <td>{r.sessionId}</td>
                          <td>{r.channel}</td>
                          <td>{r.intent}</td>
                          <td>{r.resolved ? "Yes" : "No"}</td>
                          <td>{r.latencyMs} ms</td>
                          <td>{r.escalation ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}

                {activeTab === "trace" && activeConnected ? (
                  <div className="ds-trace-list">
                    <p className="connect-card-hint">
                      Sampled decision chains — expand to inspect plan, reasoning, RAG, and tool spans end-to-end.
                    </p>
                    {agentTraceSamples.map((trace) => {
                      const open = expandedTraceId === trace.traceId;
                      return (
                        <div key={trace.traceId} className="ds-trace-card">
                          <button
                            type="button"
                            className="ds-trace-card-top"
                            onClick={() => setExpandedTraceId(open ? "" : trace.traceId)}
                          >
                            <span>
                              {trace.traceId} · {trace.sessionId} · {trace.nodes.length} spans
                            </span>
                            <span className={statusClass(trace.outcome === "success" ? "ok" : "fail")}>
                              {trace.outcome}
                            </span>
                            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          {open ? <TraceTimeline trace={trace} /> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        </div>

        <div className="connect-code-block">
          <div className="trace-head">
            <div>
              <h4>Integration payload example</h4>
              <small>POST JSON to {activeConfig.endpoint}</small>
            </div>
            <button
              type="button"
              className="copy-icon"
              aria-label={`Copy ${activeConfig.label} example`}
              onClick={() => copySnippet(activeTab)}
            >
              <Copy size={14} />
            </button>
          </div>
          <pre>{snippetForTab(activeTab)}</pre>
        </div>

        <div className="ingestion-actions">
          <button type="button" className="primary" onClick={onSendSampleData}>
            <Send size={14} />
            Send Sample Data
          </button>
          <button type="button" className="ghost">
            View Documentation
          </button>
          {copiedTab === activeTab ? <span className="copied-state">Copied</span> : null}
        </div>
      </div>
    </section>
  );
}
