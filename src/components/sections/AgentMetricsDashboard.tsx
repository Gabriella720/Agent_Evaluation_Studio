"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCcw } from "lucide-react";
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
  XAxis,
  YAxis
} from "recharts";
import { metrics, resolutionImpactBreakdown } from "@/lib/mockData";
import {
  escalationTrend,
  intentMatrix,
  latencySeries,
  metricFooterHint,
  npsGauge,
  ragHitSeries,
  rangeOptions,
  resolutionTrend,
  taskFunnel,
  topAgentSessions
} from "@/lib/metricsDashboardMock";

function metricOf(id: string) {
  const row = metrics.find((m) => m.id === id);
  if (!row) throw new Error(`Unknown metric ${id}`);
  return row;
}

/** Keeps Recharts legends below axes without overlap (compact KPI cards). */
const legendBottomCompact = {
  verticalAlign: "bottom" as const,
  align: "center" as const,
  iconSize: 8,
  wrapperStyle: { fontSize: "10px", lineHeight: "12px", paddingTop: 6 }
};

const axisTickSm = { fontSize: 10, fill: "#7d859d" };

export function AgentMetricsDashboard() {
  const [range, setRange] = useState<(typeof rangeOptions)[number]["id"]>("30d");
  const [openGroupMenu, setOpenGroupMenu] = useState<"business" | "product" | "system" | null>(null);
  const [enabledWidgets, setEnabledWidgets] = useState({
    business: ["resolution", "nps", "firstContact"],
    product: ["taskSuccess", "escalation", "repeatContact"],
    system: ["intent", "latency", "rag"]
  });

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

  const foot = <p className="kpi-card-foot">{metricFooterHint}</p>;

  const renderWidget = (id: string) => {
    if (id === "resolution") {
      const m = metricOf("resolution-rate");
      return (
        <article className="kpi-card kpi-critical">
          <h4>Resolution Rate</h4>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <p className="resolution-breakdown">
            Impact: {resolutionImpactBreakdown.map((b) => `${b.label} ${b.value}`).join(" · ")}
          </p>
          <div className="chart-shell compact">
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={resolutionTrend} margin={{ top: 4, right: 6, left: 0, bottom: 36 }}>
                <CartesianGrid stroke="#3f1d1d" />
                <XAxis dataKey="month" stroke="#fca5a5" tick={{ fontSize: 10, fill: "#fca5a5" }} height={22} />
                <YAxis stroke="#fca5a5" tick={{ fontSize: 10, fill: "#fca5a5" }} width={32} />
                <Tooltip />
                <Legend {...legendBottomCompact} />
                <Area type="monotone" dataKey="resolved" stackId="1" stroke="#22d3ee" fill="#22d3ee66" name="Resolved %" />
                <Area type="monotone" dataKey="unresolved" stackId="1" stroke="#ef4444" fill="#ef444466" name="Unresolved %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {foot}
        </article>
      );
    }

    if (id === "nps") {
      const m = metricOf("nps");
      return (
        <article className="kpi-card">
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <span className="kpi-gauge-status">{npsGauge.status}</span>
          </div>
          {foot}
        </article>
      );
    }

    if (id === "firstContact") {
      const m = metricOf("first-contact-resolution");
      const trendData = m.trend.map((t) => ({ label: t.label, value: t.value }));
      return (
        <article className="kpi-card">
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
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={false} name="FCR %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {foot}
        </article>
      );
    }

    if (id === "taskSuccess") {
      const m = metricOf("task-success");
      return (
        <article className="kpi-card">
          <h4>Task Success Rate</h4>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={230}>
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={taskFunnel} isAnimationActive nameKey="stage">
                  {taskFunnel.map((item) => (
                    <Cell key={item.stage} fill="#22d3ee" />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
          {foot}
        </article>
      );
    }

    if (id === "escalation") {
      const m = metricOf("escalation");
      return (
        <article className="kpi-card">
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
                <Tooltip />
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
          {foot}
        </article>
      );
    }

    if (id === "repeatContact") {
      const m = metricOf("repeat-contact-rate");
      const trendData = m.trend.map((t) => ({ label: t.label, value: t.value }));
      return (
        <article className="kpi-card">
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
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#fb7185" strokeWidth={2} dot name="Repeat %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {foot}
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
          {foot}
        </article>
      );
    }

    if (id === "latency") {
      const m = metricOf("latency");
      return (
        <article className="kpi-card">
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
                <Tooltip />
                <Legend {...legendBottomCompact} />
                <Line type="monotone" dataKey="p50" stroke="#22d3ee" strokeWidth={2} dot={false} name="P50 (ms)" />
                <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} dot={false} name="P95 (ms)" />
                <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={3} dot={false} name="P99 (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {foot}
        </article>
      );
    }

    if (id === "intent") {
      const m = metricOf("intent-accuracy");
      return (
        <article className="kpi-card kpi-system-warn">
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
          {foot}
        </article>
      );
    }

    if (id === "rag") {
      const m = metricOf("rag-hit");
      return (
        <article className="kpi-card">
          <h4>RAG Hit Rate</h4>
          <div className="kpi-metric-row">
            <strong className="kpi-current">{m.current}</strong>
            <span className="kpi-target">{m.target}</span>
            <span className={`kpi-delta ${m.status}`}>{m.delta}</span>
          </div>
          <div className="chart-shell">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={ragHitSeries} margin={{ top: 6, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid stroke="#202431" />
                <XAxis dataKey="label" stroke="#7d859d" tick={axisTickSm} height={22} />
                <YAxis stroke="#7d859d" tick={axisTickSm} width={34} />
                <Tooltip />
                <Legend {...legendBottomCompact} />
                <Area type="monotone" dataKey="hit" stackId="1" stroke="#22d3ee" fill="#22d3ee66" name="Hit %" />
                <Area type="monotone" dataKey="miss" stackId="1" stroke="#ef4444" fill="#ef444455" name="Miss %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {foot}
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
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#f97316" strokeWidth={2} dot name="Proxy load %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {foot}
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
                <Tooltip />
                <Bar dataKey="sessions" fill="#60a5fa88" name="Sessions" />
                <Line type="monotone" dataKey="rate" stroke="#f43f5e" strokeWidth={2} name="Rate %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {foot}
        </article>
      );
    }

    return (
      <article className="kpi-card">
        <h4>METRIC</h4>
        <p className="kpi-card-foot">{metricFooterHint}</p>
      </article>
    );
  };

  return (
    <section className="metrics-dashboard">
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
          { key: "business" as const, title: "BUSINESS METRICS", defaults: ["resolution", "nps", "firstContact"] },
          { key: "product" as const, title: "PRODUCT METRICS", defaults: ["taskSuccess", "escalation", "repeatContact"] },
          { key: "system" as const, title: "SYSTEM METRICS", defaults: ["intent", "latency", "rag"] }
        ] as const
      ).map((group) => (
        <section key={group.key} className="metrics-module">
          <div className="metrics-module-head">
            <h3>{group.title}</h3>
            <div className="metric-add-wrap">
              <button type="button" className="metric-add-btn" onClick={() => setOpenGroupMenu((prev) => (prev === group.key ? null : group.key))}>
                <Plus size={14} />
                Add metric
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
