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
  CartesianGrid,
} from "recharts";

interface TimeseriesPoint {
  date: string;
  baseElo: number;
  l3Rating: number;
  oraclePrice: number;
}

interface Props {
  data: TimeseriesPoint[];
  mode?: "l3" | "oracle" | "overlay";
}

export default function L3MarketChart({ data, mode = "l3" }: Props) {
  if (data.length === 0) {
    return (
      <div className="border border-[var(--color-border)] rounded-md p-8 bg-[var(--color-bg-card)] text-center text-xs text-[var(--color-text-dim)]">
        No timeseries data available.
      </div>
    );
  }

  // Sample data if too many points
  const sampled =
    data.length > 200
      ? data.filter(
          (_, i) =>
            i % Math.ceil(data.length / 200) === 0 || i === data.length - 1
        )
      : data;

  const chartData = sampled.map((d) => ({
    date: d.date.substring(0, 10),
    base: Math.round(d.baseElo),
    l3: Math.round(d.l3Rating),
    oracle: d.oraclePrice,
    premium: Math.round(d.l3Rating - d.baseElo),
  }));

  // Y-axis ranges
  const msiVals = chartData.flatMap((d) => [d.base, d.l3]);
  const msiMin = Math.floor(Math.min(...msiVals) / 50) * 50;
  const msiMax = Math.ceil(Math.max(...msiVals) / 50) * 50;

  const oracleVals = chartData.map((d) => d.oracle);
  const oracleMin = Math.floor(Math.min(...oracleVals) * 0.95);
  const oracleMax = Math.ceil(Math.max(...oracleVals) * 1.05);

  const showOracle = mode === "oracle" || mode === "overlay";
  const showL3 = mode === "l3" || mode === "overlay";

  const labels: Record<string, string> = {
    l3: "L3 Market Price Over Time",
    oracle: "Oracle Price Over Time",
    overlay: "L3 + Oracle Overlay",
  };

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
        {labels[mode]}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#888898" }}
            interval={Math.floor(chartData.length / 6)}
            tickLine={false}
            axisLine={{ stroke: "#333348" }}
          />
          {showL3 && (
            <YAxis
              yAxisId="msi"
              domain={[msiMin, msiMax]}
              tick={{ fontSize: 9, fill: "#888898" }}
              tickLine={false}
              axisLine={{ stroke: "#333348" }}
              width={45}
            />
          )}
          {showOracle && (
            <YAxis
              yAxisId="usd"
              orientation={showL3 ? "right" : "left"}
              domain={[oracleMin, oracleMax]}
              tick={{ fontSize: 9, fill: "#eab308" }}
              tickLine={false}
              axisLine={{ stroke: "#eab30840" }}
              width={55}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a2e",
              border: "1px solid #333348",
              borderRadius: "4px",
              fontSize: "11px",
            }}
            labelStyle={{ color: "#888898" }}
            formatter={(value: any, name: any) => {
              if (name === "Oracle $") return [`$${Number(value).toFixed(2)}`, name];
              return [Math.round(Number(value)).toString(), name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: "10px" }} />
          {showL3 && (
            <>
              <Area
                yAxisId="msi"
                type="monotone"
                dataKey="base"
                name="Base ELO"
                stroke="#555570"
                fill="#555570"
                fillOpacity={0.1}
                strokeWidth={1}
                dot={false}
              />
              <Line
                yAxisId="msi"
                type="monotone"
                dataKey="l3"
                name="L3 Market"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
              />
            </>
          )}
          {showOracle && (
            <Line
              yAxisId="usd"
              type="monotone"
              dataKey="oracle"
              name="Oracle $"
              stroke="#eab308"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
