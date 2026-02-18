"use client";

import {
  ComposedChart,
  Line,
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
  eloOdds?: number;
}

interface OracleParams {
  P0: number;
  beta: number;
  MSI0: number;
}

interface Props {
  data: TimeseriesPoint[];
  oracleParams?: OracleParams | null;
  currentOraclePrice?: number;
}

function computeOraclePrice(msiFinal: number, params: OracleParams): number {
  return params.P0 * Math.exp(params.beta * (msiFinal - params.MSI0));
}

export default function L2MSIOracleOverlayChart({
  data,
  oracleParams,
  currentOraclePrice,
}: Props) {
  if (data.length === 0) {
    return (
      <div className="border border-[var(--color-border)] rounded-md p-8 bg-[var(--color-bg-card)] text-center text-xs text-[var(--color-text-dim)]">
        No timeseries data available.
      </div>
    );
  }

  const params = oracleParams ?? { P0: 100, beta: 0.005, MSI0: 1500 };

  // Sample if too many points
  const sampled =
    data.length > 200
      ? data.filter(
          (_, i) =>
            i % Math.ceil(data.length / 200) === 0 || i === data.length - 1
        )
      : data;

  const chartData = sampled.map((d) => {
    const msiFinal = d.eloOdds ?? d.baseElo;
    const oracle = computeOraclePrice(msiFinal, params);
    return {
      date: d.date.substring(0, 10),
      msiBase: Math.round(d.baseElo * 10) / 10,
      msiFinal: Math.round(msiFinal * 10) / 10,
      oraclePrice: Math.round(oracle * 100) / 100,
    };
  });

  const msiVals = chartData.flatMap((d) => [d.msiBase, d.msiFinal]);
  const msiMin = Math.floor(Math.min(...msiVals) / 50) * 50;
  const msiMax = Math.ceil(Math.max(...msiVals) / 50) * 50;

  const oracleVals = chartData.map((d) => d.oraclePrice);
  const oracleMin = Math.floor(Math.min(...oracleVals) * 0.95 * 100) / 100;
  const oracleMax = Math.ceil(Math.max(...oracleVals) * 1.05 * 100) / 100;

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
          MSI + Oracle Price Overlay
        </div>
        {currentOraclePrice != null && (
          <div className="text-xs">
            <span className="text-[var(--color-text-dim)]">Current:</span>{" "}
            <span className="font-bold tabular-nums text-[var(--color-yellow)]">
              ${currentOraclePrice.toFixed(2)}
            </span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#2a2a3a"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#888898" }}
            interval={Math.floor(chartData.length / 6)}
            tickLine={false}
            axisLine={{ stroke: "#333348" }}
          />
          <YAxis
            yAxisId="msi"
            domain={[msiMin, msiMax]}
            tick={{ fontSize: 9, fill: "#888898" }}
            tickLine={false}
            axisLine={{ stroke: "#333348" }}
            width={45}
            label={{
              value: "MSI",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 9, fill: "#888898" },
            }}
          />
          <YAxis
            yAxisId="usd"
            orientation="right"
            domain={[oracleMin, oracleMax]}
            tick={{ fontSize: 9, fill: "#eab308" }}
            tickLine={false}
            axisLine={{ stroke: "#eab30840" }}
            width={55}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            label={{
              value: "Oracle $",
              angle: 90,
              position: "insideRight",
              style: { fontSize: 9, fill: "#eab308" },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a2e",
              border: "1px solid #333348",
              borderRadius: "4px",
              fontSize: "11px",
            }}
            labelStyle={{ color: "#888898" }}
            formatter={(value: any, name: any) => {
              if (name === "Oracle $")
                return [`$${Number(value).toFixed(2)}`, name];
              return [Math.round(Number(value)).toString(), name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: "10px" }} />
          <Line
            yAxisId="msi"
            type="monotone"
            dataKey="msiBase"
            name="MSI Base"
            stroke="#555570"
            strokeWidth={1}
            dot={false}
          />
          <Line
            yAxisId="msi"
            type="monotone"
            dataKey="msiFinal"
            name="MSI Final"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="usd"
            type="monotone"
            dataKey="oraclePrice"
            name="Oracle $"
            stroke="#eab308"
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 text-[10px] text-[var(--color-text-dim)]">
        Oracle computed from MSI Final: P₀ &times; exp(β &times; (MSI &minus;
        MSI₀)) | P₀={params.P0}, β={params.beta}, MSI₀={params.MSI0}
      </div>
    </div>
  );
}
