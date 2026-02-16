"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface SingleDataPoint {
  date: string;
  rating: number;
}

interface MultiLayerDataPoint {
  date: string;
  baseElo: number;
  eloOdds: number;
  eloOddsInjuries: number;
  eloOddsInjuriesNews: number;
}

interface RatingChartProps {
  data: SingleDataPoint[];
  multiLayerData?: MultiLayerDataPoint[];
}

const RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "All", months: 0 },
];

const LAYERS = [
  {
    key: "baseElo" as const,
    label: "Match Data",
    color: "#22c55e",
    strokeWidth: 2,
    dash: undefined,
    defaultVisible: true,
    comingSoon: false,
  },
  {
    key: "eloOdds" as const,
    label: "Match + Odds",
    color: "#eab308",
    strokeWidth: 2,
    dash: undefined,
    defaultVisible: true,
    comingSoon: false,
  },
  {
    key: "eloOddsInjuries" as const,
    label: "+ Injuries",
    color: "#f97316",
    strokeWidth: 1.5,
    dash: "6 3",
    defaultVisible: false,
    comingSoon: true,
  },
  {
    key: "eloOddsInjuriesNews" as const,
    label: "Full Signal",
    color: "#ef4444",
    strokeWidth: 1.5,
    dash: "6 3",
    defaultVisible: false,
    comingSoon: true,
  },
];

export default function RatingChart({ data, multiLayerData }: RatingChartProps) {
  const [range, setRange] = useState("All");
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    () => new Set(LAYERS.filter((l) => l.defaultVisible).map((l) => l.key))
  );

  const isMultiLayer = multiLayerData && multiLayerData.length > 0;
  const chartSource = isMultiLayer ? multiLayerData : data;

  const filtered = useMemo(() => {
    if (range === "All" || chartSource.length === 0) return chartSource;
    const r = RANGES.find((r) => r.label === range);
    if (!r || r.months === 0) return chartSource;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - r.months);
    const cutoffStr = cutoff.toISOString().substring(0, 10);
    return chartSource.filter((d) => d.date >= cutoffStr);
  }, [chartSource, range]);

  if (chartSource.length === 0) return null;

  // Compute Y axis domain from all visible data
  const allValues: number[] = [];
  for (const d of filtered) {
    if (isMultiLayer) {
      const ml = d as MultiLayerDataPoint;
      for (const layer of LAYERS) {
        if (visibleLayers.has(layer.key)) {
          allValues.push(ml[layer.key]);
        }
      }
    } else {
      allValues.push((d as SingleDataPoint).rating);
    }
  }
  if (allValues.length === 0) return null;

  const minR = Math.floor(Math.min(...allValues) / 10) * 10 - 20;
  const maxR = Math.ceil(Math.max(...allValues) / 10) * 10 + 20;

  function toggleLayer(key: string) {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
          Rating History
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.label)}
              className={`px-2 py-0.5 text-[10px] rounded border transition-colors cursor-pointer ${
                range === r.label
                  ? "border-[var(--color-green)] text-[var(--color-green)] bg-[var(--color-green)]/10"
                  : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-layer legend with toggles */}
      {isMultiLayer && (
        <div className="flex flex-wrap gap-2 mb-3">
          {LAYERS.map((layer) => {
            const active = visibleLayers.has(layer.key);
            return (
              <button
                key={layer.key}
                onClick={() => toggleLayer(layer.key)}
                className={`flex items-center gap-1.5 px-2 py-1 text-[10px] rounded border transition-colors cursor-pointer ${
                  active
                    ? "border-current bg-current/10"
                    : "border-[var(--color-border)] opacity-40 hover:opacity-70"
                }`}
                style={{ color: active ? layer.color : "#888898" }}
              >
                <span
                  className="inline-block w-3 h-0.5 rounded"
                  style={{
                    backgroundColor: layer.color,
                    opacity: active ? 1 : 0.4,
                    borderTop: layer.dash ? "1px dashed" : "none",
                  }}
                />
                {layer.label}
                {layer.comingSoon && (
                  <span className="text-[var(--color-text-dim)]">(soon)</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={filtered}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#2a2a3a"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#888898" }}
              tickLine={false}
              axisLine={{ stroke: "#2a2a3a" }}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.toLocaleString("default", { month: "short" })} ${String(d.getFullYear()).slice(2)}`;
              }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              domain={[minR, maxR]}
              tick={{ fontSize: 10, fill: "#888898" }}
              tickLine={false}
              axisLine={{ stroke: "#2a2a3a" }}
              width={45}
            />
            <Tooltip
              contentStyle={{
                background: "#111118",
                border: "1px solid #2a2a3a",
                borderRadius: 6,
                fontSize: 11,
                fontFamily: "monospace",
              }}
              labelStyle={{ color: "#888898" }}
              formatter={(value: number | undefined, name?: string) => {
                const layer = LAYERS.find((l) => l.key === name);
                return [
                  value != null ? Math.round(value) : 0,
                  layer?.label || name || "",
                ];
              }}
            />
            {isMultiLayer ? (
              LAYERS.map((layer) =>
                visibleLayers.has(layer.key) ? (
                  <Line
                    key={layer.key}
                    type="monotone"
                    dataKey={layer.key}
                    stroke={layer.color}
                    strokeWidth={layer.strokeWidth}
                    strokeDasharray={layer.dash}
                    dot={false}
                    activeDot={{ r: 3, fill: layer.color }}
                  />
                ) : null
              )
            ) : (
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#22c55e" }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
