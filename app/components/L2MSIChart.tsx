"use client";

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DataPoint {
  date: string;
  baseElo: number;
  eloOdds?: number;
}

interface Props {
  data: DataPoint[];
}

export default function L2MSIChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="border border-[var(--color-border)] rounded-md p-8 bg-[var(--color-bg-card)] text-center text-xs text-[var(--color-text-dim)]">
        No timeseries data available.
      </div>
    );
  }

  // Sample data if too many points
  const sampled = data.length > 200
    ? data.filter((_, i) => i % Math.ceil(data.length / 200) === 0 || i === data.length - 1)
    : data;

  const chartData = sampled.map((d) => ({
    date: d.date.substring(0, 10),
    base: Math.round(d.baseElo),
    odds: Math.round(d.eloOdds ?? d.baseElo),
    delta: Math.round((d.eloOdds ?? d.baseElo) - d.baseElo),
  }));

  const allVals = chartData.flatMap((d) => [d.base, d.odds]);
  const minY = Math.floor(Math.min(...allVals) / 50) * 50;
  const maxY = Math.ceil(Math.max(...allVals) / 50) * 50;

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
        MSI Rating Over Time
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#888898" }}
            interval={Math.floor(chartData.length / 6)}
            tickLine={false}
            axisLine={{ stroke: "#333348" }}
          />
          <YAxis
            domain={[minY, maxY]}
            tick={{ fontSize: 9, fill: "#888898" }}
            tickLine={false}
            axisLine={{ stroke: "#333348" }}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a2e",
              border: "1px solid #333348",
              borderRadius: "4px",
              fontSize: "11px",
            }}
            labelStyle={{ color: "#888898" }}
          />
          <Legend
            wrapperStyle={{ fontSize: "10px" }}
          />
          <Area
            type="monotone"
            dataKey="base"
            name="MSI Base"
            stroke="#555570"
            fill="#555570"
            fillOpacity={0.15}
            strokeWidth={1}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="odds"
            name="MSI + Odds"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
