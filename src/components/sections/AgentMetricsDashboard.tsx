"use client";

import { useEffect, useMemo, useState } from "react";
import { Maximize2, Plus, RefreshCcw, X } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis
} from "recharts";
import type { MetricItem } from "@/lib/mockData";
import { metrics as baseMetrics, ragMetricModel, resolutionMetricAttribution } from "@/lib/mockData";
import { ragMetrics } from "@/lib/mockData";
import {
  escalationTrend,
  intentMatrix,
  latencySeries,
  npsGauge,
  rangeOptions,
  resolutionTrend,
  taskFunnel,
  topAgentSessions
} from "@/lib/metricsDashboardMock";

type TooltipValue = number | string | readonly (number | string)[];

function metricOf(metrics: readonly MetricItem[], id: string) {
  const row = metrics.find((m) => m.id === id);
  if (!row) throw new Error(`Unknown metric ${id}`);
  return row;
}

function formatTooltipValue(v: unknown): string {
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    if (Math.abs(v) >= 100) return v.toFixed(0);
    return v.toFixed(1);
  }
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => formatTooltipValue(x)).join(", ");
  return String(v ?? "");
}

function kpiTooltip(p: TooltipContentProps<TooltipValue, string | number>): React.ReactNode {
  if (!p?.active || !p?.payload || p.payload.length === 0) return null;
  return (
    <div className="kpi-tooltip">
      {p.label != null ? <div className="kpi-tooltip-title">{String(p.label)}</div> : null}
      <div className="kpi-tooltip-lines">
        {p.payload.map((entry, idx) => {
          const e = entry as unknown as { name?: unknown; value?: unknown; color?: string };
          const name = e.name != null ? String(e.name) : `Series ${idx + 1}`;
          const value = formatTooltipValue(e.value);
          return (
            <div key={`${name}-${idx}`} className="kpi-tooltip-line">
              <span className="kpi-tooltip-dot" style={{ background: e.color ?? "rgba(139, 92, 246, 0.9)" }} aria-hidden />
              <span className="kpi-tooltip-name">{name}</span>
              <strong className="kpi-tooltip-value">{value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Keep a single reference name for all charts.
const compactTooltip = kpiTooltip;

/** Keeps Recharts legends below axes without overlap (compact KPI cards). */
const legendBottomCompact = {
  verticalAlign: "bottom" as const,
  align: "center" as const,
  iconSize: 8,
  wrapperStyle: { fontSize: "10px", lineHeight: "12px", paddingTop: 6 }
};

const axisTickSm = { fontSize: 10, fill: "#7d859d" };

/** Linear series left→right as d1 .. d{points} (chronological window). */
function buildMetricSeries(_labelPrefix: string, startValue: number, endValue: number, points = 6) {
  const arr: { label: string; value: number }[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / Math.max(1, points - 1);
    const v = startValue + (endValue - startValue) * t;
    arr.push({ label: `d${i + 1}`, value: v });
  }
  return arr;
}

const ragSubMetricEndPct = {
  recall: ragMetrics.recall * 100,
  top1: ragMetrics.contextPrecision * 100,
  faithfulness: ragMetrics.faithfulness * 100,
  accuracy: ragMetrics.accuracy * 100
} as const;

export function AgentMetricsDashboard({
  metrics = baseMetrics,
  focusWidgetId,
  onFocusHandled,
  onOpenPatternAnalysis
}: {
  metrics?: readonly MetricItem[];
  focusWidgetId?: string;
  onFocusHandled?: () => void;
  onOpenPatternAnalysis?: (patternId: string) => void;
}) {
  const [range, setRange] = useState<(typeof rangeOptions)[number]["id"]>("30d");
  const [openGroupMenu, setOpenGroupMenu] = useState<"business" | "product" | "system" | null>(null);
  const [enabledWidgets, setEnabledWidgets] = useState({
    business: ["resolution", "nps", "firstContact"],
    product: ["taskSuccess", "escalation", "repeatContact"],
    system: ["intent", "latency", "rag"]
  });
  const [ragExpanded, setRagExpanded] = useState(false);
  const [ragZoom, setRagZoom] = useState<null | "accuracy" | "recall" | "faithfulness" | "context">(null);
  const [drivenOpen, setDrivenOpen] = useState(false);

  const scrollToWidget = (widgetId: string) => {
    const el = document.getElementById(`kpi-${widgetId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const headerSubtitle = useMemo(() => {
    if (range === "7d") return "Incident-aligned view: Taobao AI CS, last 7 days.";
    if (range === "90d") return "Long window for context; primary incident is the last 24 hours.";
    return "Default window: all KPIs trace to the same 24h resolution drop.";
  }, [range]);

  const optionalWidgets: Record<"business" | "product" | "system", readonly { id: string; label: string }[]> = {
    business: [{ id: "csat", label: "CSAT Trend" }],
    product: [{ id: "handoff", label: "Handoff Distribution" }],
    system: [{ id: "topSessions", label: "Top sessions (Taobao CS)" }]
  };

  const addWidget = (group: "business" | "product" | "system", widgetId: string) => {
    setEnabledWidgets((prev) => ({
      ...prev,
      [group]: prev[group].includes(widgetId) ? prev[group] : [...prev[group], widgetId]
    }));
    setOpenGroupMenu(null);
  };

  // Deep-link focus from other modules (e.g. RAG workspace -> RAG widget).
  // Uses the local widget id (e.g. "rag", "intent", "resolution").
  useEffect(() => {
    if (!focusWidgetId) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`kpi-${focusWidgetId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focusWidgetId === "rag") setRagExpanded(true);
      onFocusHandled?.();
    }, 60);
    return () => window.clearTimeout(t);
  }, [focusWidgetId, onFocusHandled]);

  const renderWidget = (id: string) => {
    if (id === "resolution") {
      const m = metricOf(metrics, "resolution-rate");
      return (
        <article className="kpi-card kpi-critical" id="kpi-resolution">
          <div className="kpi-card-head-row">
            <h4>Resolution Rate</h4>
            <button
              type="button"
              className="kpi-drill-btn"
              onClick={() => onOpenPatternAnalysis?.("intent-misclassification")}
            >
              Analysis →
            </button>
          </div>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="chart-shell resolution-trend">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={resolutionTrend} margin={{ top: 4, right: 6, left: 0, bottom: 36 }}>
                <CartesianGrid stroke="#3f1d1d" />
                <XAxis dataKey="month" stroke="#fca5a5" tick={{ fontSize: 10, fill: "#fca5a5" }} height={22} />
                <YAxis stroke="#fca5a5" tick={{ fontSize: 10, fill: "#fca5a5" }} width={32} />
                <Tooltip content={compactTooltip} />
                <Legend {...legendBottomCompact} />
                <Area type="monotone" dataKey="resolved" stackId="1" stroke="#22d3ee" fill="#22d3ee66" name="Resolved %" />
                <Area type="monotone" dataKey="unresolved" stackId="1" stroke="#ef4444" fill="#ef444466" name="Unresolved %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="driven-metrics">
            <div className="driven-metrics-head">
              <p className="driven-metrics-title">Driven Metrics</p>
              <button type="button" className="driven-metrics-toggle" onClick={() => setDrivenOpen((v) => !v)}>
                {drivenOpen ? "Hide" : "Show"}
              </button>
            </div>
            {drivenOpen ? (
              <div className="driven-metrics-grid">
              <div className="driven-col">
                <span className="driven-col-title">Product</span>
                {resolutionMetricAttribution.relatedMetrics
                  .filter((x) => x.level === "product")
                  .map((x) => (
                    <button
                      key={x.metricId}
                      type="button"
                      className="driven-row"
                      onClick={() => scrollToWidget(x.widgetId)}
                    >
                      <span className="driven-name">{x.name}</span>
                      <span className={`driven-delta ${x.direction}`}>
                        {({ up: "↑", down: "↓" } as const)[x.direction]} {({ up: "+", down: "-" } as const)[x.direction]}
                        {x.change}%
                      </span>
                    </button>
                  ))}
              </div>
              <div className="driven-col">
                <span className="driven-col-title">System</span>
                {resolutionMetricAttribution.relatedMetrics
                  .filter((x) => x.level === "system")
                  .map((x) => (
                    <button
                      key={x.metricId}
                      type="button"
                      className="driven-row"
                      onClick={() => scrollToWidget(x.widgetId)}
                    >
                      <span className="driven-name">{x.name}</span>
                      <span className={`driven-delta ${x.direction}`}>
                        {({ up: "↑", down: "↓" } as const)[x.direction]} {({ up: "+", down: "-" } as const)[x.direction]}
                        {x.change}%
                      </span>
                    </button>
                  ))}
              </div>
              </div>
            ) : null}
          </div>
        </article>
      );
    }

    if (id === "nps") {
      const m = metricOf(metrics, "nps");
      return (
        <article className="kpi-card" id="kpi-nps">
          <h4>NPS</h4>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="kpi-gauge">
            <ResponsiveContainer width="100%" height={110}>
              <PieChart>
                <Pie
                  data={[
                    { name: "score", value: npsGauge.score },
                    { name: "rest", value: Math.max(0, 100 - npsGauge.score) }
                  ]}
                  cx="50%"
                  cy="85%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={42}
                  outerRadius={55}
                  dataKey="value"
                >
                  <Cell fill="#f59e0b" />
                  <Cell fill="#1f2937" />
                </Pie>
                <Tooltip content={compactTooltip} />
              </PieChart>
            </ResponsiveContainer>
            <span className="kpi-gauge-status">{npsGauge.status}</span>
          </div>
        </article>
      );
    }

    if (id === "firstContact") {
      const m = metricOf(metrics, "first-contact-resolution");
      const trendData = m.trend.map((t) => ({ label: t.label, value: t.value }));
      return (
        <article className="kpi-card" id="kpi-firstContact">
          <h4>First Contact Resolution</h4>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="chart-shell compact">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={trendData}>
                <CartesianGrid stroke="#202431" />
                <XAxis dataKey="label" stroke="#7d859d" fontSize={11} />
                <YAxis stroke="#7d859d" fontSize={11} domain={["auto", "auto"]} />
                <Tooltip content={compactTooltip} />
                <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={false} name="FCR %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      );
    }

    if (id === "taskSuccess") {
      const m = metricOf(metrics, "task-success");
      return (
        <article className="kpi-card" id="kpi-taskSuccess">
          <h4>Task Success Rate</h4>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={230}>
              <FunnelChart>
                <Tooltip content={compactTooltip} />
                <Funnel dataKey="value" data={taskFunnel} isAnimationActive nameKey="stage">
                  {taskFunnel.map((item) => (
                    <Cell key={item.stage} fill="#22d3ee" />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </article>
      );
    }

    if (id === "escalation") {
      const m = metricOf(metrics, "escalation");
      return (
        <article className="kpi-card" id="kpi-escalation">
          <h4>Escalation Rate</h4>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={escalationTrend} margin={{ top: 6, right: 8, left: 0, bottom: 44 }}>
                <CartesianGrid stroke="#202431" />
                <XAxis dataKey="label" stroke="#7d859d" tick={axisTickSm} interval={0} height={22} />
                <YAxis yAxisId="left" stroke="#7d859d" tick={axisTickSm} width={36} />
                <YAxis yAxisId="right" orientation="right" stroke="#7d859d" tick={axisTickSm} width={36} />
                <Tooltip content={compactTooltip} />
                <Legend {...legendBottomCompact} />
                <Bar yAxisId="left" dataKey="sessions" fill="#22d3ee88" name="Escalated sessions" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rate"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Escalation %"
                  dot={{ r: 2.5, strokeWidth: 1 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>
      );
    }

    if (id === "repeatContact") {
      const m = metricOf(metrics, "repeat-contact-rate");
      const trendData = m.trend.map((t) => ({ label: t.label, value: t.value }));
      return (
        <article className="kpi-card" id="kpi-repeatContact">
          <h4>Repeat Contact Rate</h4>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="chart-shell compact">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={trendData}>
                <CartesianGrid stroke="#202431" />
                <XAxis dataKey="label" stroke="#7d859d" fontSize={11} />
                <YAxis stroke="#7d859d" fontSize={11} />
                <Tooltip content={compactTooltip} />
                <Line type="monotone" dataKey="value" stroke="#fb7185" strokeWidth={2} dot name="Repeat %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      );
    }

    if (id === "topSessions") {
      return (
        <article className="kpi-card">
          <h4>Top Sessions (Taobao CS)</h4>
          <div className="sessions-table">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Resolution</th>
                  <th>NPS</th>
                  <th>Latency</th>
                  <th>Escalation</th>
                </tr>
              </thead>
              <tbody>
                {topAgentSessions.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.resolution}</td>
                    <td>{row.nps}</td>
                    <td>{row.aht}</td>
                    <td>{row.rps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      );
    }

    if (id === "latency") {
      const m = metricOf(metrics, "latency");
      return (
        <article className="kpi-card" id="kpi-latency">
          <h4>System Latency (P50 / P95 / P99)</h4>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={latencySeries} margin={{ top: 6, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid stroke="#202431" />
                <XAxis dataKey="label" stroke="#7d859d" tick={axisTickSm} height={22} />
                <YAxis stroke="#7d859d" tick={axisTickSm} width={36} />
                <Tooltip content={compactTooltip} />
                <Legend {...legendBottomCompact} />
                <Line type="monotone" dataKey="p50" stroke="#22d3ee" strokeWidth={2} dot={false} name="P50 (ms)" />
                <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} dot={false} name="P95 (ms)" />
                <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={3} dot={false} name="P99 (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      );
    }

    if (id === "intent") {
      const m = metricOf(metrics, "intent-accuracy");
      return (
        <article className="kpi-card" id="kpi-intent">
          <h4>Intent Accuracy</h4>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="intent-matrix">
            {intentMatrix.map((item) => (
              <div key={`${item.actual}-${item.predicted}`} className="matrix-cell">
                <span>
                  {item.actual}→{item.predicted}
                </span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>
      );
    }

    if (id === "rag") {
      const m = metricOf(metrics, "rag-score");
      const scoreSeries = m.trend.map((t) => ({ label: t.label, value: t.value }));
      const recallSeries = buildMetricSeries(
        "",
        Math.min(96, ragSubMetricEndPct.recall + 16),
        ragSubMetricEndPct.recall,
        6
      );
      const top1Series = buildMetricSeries("", Math.min(96, ragSubMetricEndPct.top1 + 14), ragSubMetricEndPct.top1, 6);
      const faithSeries = buildMetricSeries(
        "",
        Math.min(96, ragSubMetricEndPct.faithfulness + 12),
        ragSubMetricEndPct.faithfulness,
        6
      );
      const accSeries = buildMetricSeries(
        "",
        Math.min(96, ragSubMetricEndPct.accuracy + 12),
        ragSubMetricEndPct.accuracy,
        6
      );
      const tooltipCompact = (props: TooltipContentProps<TooltipValue, string | number>) => {
        const active = !!props?.active;
        const payload = props?.payload?.[0];
        const label = props?.label;
        if (!active || !payload) return null;
        const v = (payload as { value?: unknown }).value;
        return (
          <div className="kpi-tooltip kpi-tooltip--compact">
            <div className="kpi-tooltip-row">
              <span className="kpi-tooltip-label">{String(label ?? "")}</span>
              <strong className="kpi-tooltip-value">
                {typeof v === "number" ? v.toFixed(1) : typeof v === "string" ? v : String(v ?? "")}
              </strong>
            </div>
          </div>
        );
      };
      return (
        <article className="kpi-card" id="kpi-rag">
          <div className="kpi-head-row">
            <h4>RAG Score</h4>
            <button type="button" className="kpi-mini-link" onClick={() => setRagExpanded((v) => !v)}>
              {ragExpanded ? "Hide sub-metrics" : "View 4 sub-metrics"}
            </button>
          </div>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="kpi-rag-target-block">
            <div className="kpi-rag-target-row">
              <span className="kpi-rag-target-strong">Target: {ragMetricModel.target}</span>
              <span className="kpi-rag-range-badge" title="Recommended operating band from retrieval QA + resolution elasticity curve">
                Range {ragMetricModel.recommendedRange[0]}–{ragMetricModel.recommendedRange[1]}
              </span>
            </div>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={scoreSeries} margin={{ top: 6, right: 8, left: 0, bottom: 36 }}>
                <CartesianGrid stroke="#202431" />
                <XAxis dataKey="label" stroke="#7d859d" tick={axisTickSm} height={22} />
                <YAxis stroke="#7d859d" tick={axisTickSm} width={34} />
                <Tooltip content={compactTooltip} />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.5} dot={false} name="RAG Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {ragExpanded ? (
            <div className="kpi-rag-expand">
              <div className="kpi-rag-grid">
                <div className="kpi-rag-mini">
                  <div className="kpi-rag-mini-head">
                    <div className="kpi-rag-mini-title">
                      <strong>Recall@5</strong>
                      <span>{Math.round(ragMetrics.recall * 100)}%</span>
                    </div>
                    <button
                      type="button"
                      className="kpi-zoom-btn"
                      aria-label="Expand chart"
                      onClick={() => setRagZoom("recall")}
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                  <div className="kpi-rag-mini-chart">
                    <ResponsiveContainer width="100%" height={72}>
                      <LineChart data={recallSeries}>
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip content={tooltipCompact} />
                        <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="kpi-rag-mini">
                  <div className="kpi-rag-mini-head">
                    <div className="kpi-rag-mini-title">
                      <strong>Top1 Accuracy</strong>
                      <span>{Math.round(ragMetrics.contextPrecision * 100)}%</span>
                    </div>
                    <button
                      type="button"
                      className="kpi-zoom-btn"
                      aria-label="Expand chart"
                      onClick={() => setRagZoom("context")}
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                  <div className="kpi-rag-mini-chart">
                    <ResponsiveContainer width="100%" height={72}>
                      <LineChart data={top1Series}>
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip content={tooltipCompact} />
                        <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="kpi-rag-mini">
                  <div className="kpi-rag-mini-head">
                    <div className="kpi-rag-mini-title">
                      <strong>Faithfulness</strong>
                      <span>{Math.round(ragMetrics.faithfulness * 100)}%</span>
                    </div>
                    <button
                      type="button"
                      className="kpi-zoom-btn"
                      aria-label="Expand chart"
                      onClick={() => setRagZoom("faithfulness")}
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                  <div className="kpi-rag-mini-chart">
                    <ResponsiveContainer width="100%" height={72}>
                      <LineChart data={faithSeries}>
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip content={tooltipCompact} />
                        <Line type="monotone" dataKey="value" stroke="#fb7185" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="kpi-rag-mini">
                  <div className="kpi-rag-mini-head">
                    <div className="kpi-rag-mini-title">
                      <strong>Accuracy</strong>
                      <span>{Math.round(ragMetrics.accuracy * 100)}%</span>
                    </div>
                    <button
                      type="button"
                      className="kpi-zoom-btn"
                      aria-label="Expand chart"
                      onClick={() => setRagZoom("accuracy")}
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                  <div className="kpi-rag-mini-chart">
                    <ResponsiveContainer width="100%" height={72}>
                      <LineChart data={accSeries}>
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip content={tooltipCompact} />
                        <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </article>
      );
    }

    if (id === "csat") {
      return (
        <article className="kpi-card">
          <h4>CSAT Trend</h4>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={escalationTrend}>
                <CartesianGrid stroke="#202431" />
                <XAxis dataKey="label" stroke="#7d859d" />
                <YAxis stroke="#7d859d" />
                <Tooltip content={compactTooltip} />
                <Line type="monotone" dataKey="rate" stroke="#f97316" strokeWidth={2} dot name="Proxy load %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      );
    }

    if (id === "handoff") {
      return (
        <article className="kpi-card">
          <h4>Handoff Distribution</h4>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={170}>
              <ComposedChart data={escalationTrend}>
                <CartesianGrid stroke="#202431" />
                <XAxis dataKey="label" stroke="#7d859d" />
                <YAxis stroke="#7d859d" />
                <Tooltip content={compactTooltip} />
                <Bar dataKey="sessions" fill="#60a5fa88" name="Sessions" />
                <Line type="monotone" dataKey="rate" stroke="#f43f5e" strokeWidth={2} name="Rate %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>
      );
    }

    return (
      <article className="kpi-card">
        <h4>METRIC</h4>
      </article>
    );
  };

  return (
    <section className="metrics-dashboard">
      {ragZoom ? (
        <div className="kpi-zoom-overlay" role="dialog" aria-modal="true">
          <div className="kpi-zoom-modal">
            <div className="kpi-zoom-head">
              <h4>
                {ragZoom === "accuracy"
                  ? "Accuracy"
                  : ragZoom === "recall"
                    ? "Recall@5"
                    : ragZoom === "faithfulness"
                      ? "Faithfulness"
                      : "Top1 Accuracy"}
              </h4>
              <button type="button" className="kpi-zoom-close" onClick={() => setRagZoom(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="kpi-zoom-chart">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={
                    ragZoom === "accuracy"
                      ? buildMetricSeries("", Math.min(96, ragSubMetricEndPct.accuracy + 14), ragSubMetricEndPct.accuracy, 12)
                      : ragZoom === "recall"
                        ? buildMetricSeries("", Math.min(96, ragSubMetricEndPct.recall + 18), ragSubMetricEndPct.recall, 12)
                        : ragZoom === "faithfulness"
                          ? buildMetricSeries(
                              "",
                              Math.min(96, ragSubMetricEndPct.faithfulness + 14),
                              ragSubMetricEndPct.faithfulness,
                              12
                            )
                          : buildMetricSeries("", Math.min(96, ragSubMetricEndPct.top1 + 16), ragSubMetricEndPct.top1, 12)
                  }
                  margin={{ top: 10, right: 12, left: 0, bottom: 10 }}
                >
                  <CartesianGrid stroke="#202431" />
                  <XAxis dataKey="label" stroke="#7d859d" tick={axisTickSm} height={18} />
                  <YAxis stroke="#7d859d" tick={axisTickSm} domain={[0, 100]} width={36} />
                  <Tooltip
                    content={(p: TooltipContentProps<TooltipValue, string | number>) => {
                      if (!p?.active || !p?.payload?.[0]) return null;
                      const v = (p.payload[0] as { value?: unknown }).value;
                      return (
                        <div className="kpi-tooltip">
                          <div className="kpi-tooltip-row">
                            <span className="kpi-tooltip-label">{String(p.label ?? "")}</span>
                            <strong className="kpi-tooltip-value">
                              {typeof v === "number" ? v.toFixed(1) : typeof v === "string" ? v : String(v ?? "")}
                            </strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
      <header className="metrics-dash-header">
        <div className="metrics-filter">
          <label>
            Time Range:
            <select value={range} onChange={(event) => setRange(event.target.value as "7d" | "30d" | "90d")}>
              {rangeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="refresh-btn">
            <RefreshCcw size={14} />
            Refresh
          </button>
        </div>
        <p>{headerSubtitle}</p>
      </header>

      {(
        [
          { key: "business" as const, title: "Business Metrics", defaults: ["resolution", "nps", "firstContact"] },
          { key: "product" as const, title: "Product Metrics", defaults: ["taskSuccess", "escalation", "repeatContact"] },
          { key: "system" as const, title: "System Metrics", defaults: ["intent", "latency", "rag"] }
        ] as const
      ).map((group) => (
        <section key={group.key} className="metrics-module">
          <div className="metrics-module-head">
            <h3>{group.title}</h3>
            <div className="metric-add-wrap">
              <button type="button" className="metric-add-btn" onClick={() => setOpenGroupMenu((prev) => (prev === group.key ? null : group.key))}>
                <Plus size={14} />
                Add Metric
              </button>
              {openGroupMenu === group.key && (
                <div className="metric-add-menu">
                  {optionalWidgets[group.key]
                    .filter((item) => !enabledWidgets[group.key].includes(item.id))
                    .map((item) => (
                      <button key={item.id} type="button" onClick={() => addWidget(group.key, item.id)}>
                        {item.label}
                      </button>
                    ))}
                  {optionalWidgets[group.key].filter((item) => !enabledWidgets[group.key].includes(item.id)).length === 0 ? (
                    <p className="metric-add-empty">No optional metrics</p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <div className="metrics-module-grid">
            {enabledWidgets[group.key].map((widgetId) => (
              <div key={`${group.key}-${widgetId}`}>{renderWidget(widgetId)}</div>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
