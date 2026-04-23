"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

type MetricCardProps = {
  title: string;
  value: string;
  target?: string;
  change: number;
  trend: number[];
  status: "good" | "warning" | "critical";
  insight?: string;
};

export function MetricCard({ title, value, target, change, trend, status, insight }: MetricCardProps) {
  const chartData = trend.map((item, index) => ({ value: item, index }));
  const isUp = change > 0;

  return (
    <article className="metric-card-v2">
      <div className="metric-card-v2-head">
        <div>
          <p className="metric-card-v2-title">{title}</p>
          <div className="metric-card-v2-values">
            <strong className={`metric-card-v2-value metric-${status}`}>{value}</strong>
            {target ? <span className="metric-card-v2-target">/ {target}</span> : null}
          </div>
        </div>
        <div className={`metric-card-v2-pill metric-pill-${status}`}>
          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>
            {isUp ? "+" : ""}
            {change}%
          </span>
        </div>
      </div>

      <div className="metric-card-v2-chart">
        <ResponsiveContainer width="100%" height={40}>
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={status === "critical" ? "#ef4444" : status === "warning" ? "#f59e0b" : "#10b981"}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {insight ? <p className="metric-card-v2-insight">{insight}</p> : null}
    </article>
  );
}
