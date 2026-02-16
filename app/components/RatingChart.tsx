"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
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
  matchDates?: Set<string>;
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

// Delta mode layer definitions (no baseElo line since it's always 0)
const DELTA_LAYERS = [
  {
    key: "eloOdds" as const,
    label: "Odds vs Base",
    color: "#eab308",
    strokeWidth: 2,
    dash: undefined,
    defaultVisible: true,
    comingSoon: false,
  },
  {
    key: "eloOddsInjuries" as const,
    label: "+ Injuries vs Base",
    color: "#f97316",
    strokeWidth: 1.5,
    dash: "6 3",
    defaultVisible: false,
    comingSoon: true,
  },
  {
    key: "eloOddsInjuriesNews" as const,
    label: "Full vs Base",
    color: "#ef4444",
    strokeWidth: 1.5,
    dash: "6 3",
    defaultVisible: false,
    comingSoon: true,
  },
];

type ViewMode = "absolute" | "delta";

export default function RatingChart({
  data,
  multiLayerData,
  matchDates,
}: RatingChartProps) {
  const [range, setRange] = useState("All");
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    () => new Set(LAYERS.filter((l) => l.defaultVisible).map((l) => l.key))
  );
  const [viewMode, setViewMode] = useState<ViewMode>("absolute");

  const isMultiLayer = multiLayerData && multiLayerData.length > 0;
  const chartSource = isMultiLayer ? multiLayerData : data;
  const isDelta = viewMode === "delta" && isMultiLayer;

  const filtered = useMemo(() => {
    if (range === "All" || chartSource.length === 0) return chartSource;
    const r = RANGES.find((r) => r.label === range);
    if (!r || r.months === 0) return chartSource;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - r.months);
    const cutoffStr = cutoff.toISOString().substring(0, 10);
    return chartSource.filter((d) => d.date >= cutoffStr);
  }, [chartSource, range]);

  // Transform data for delta mode
  const displayData = useMemo(() => {
    if (!isDelta || !isMultiLayer) return filtered;
    return (filtered as MultiLayerDataPoint[]).map((point) => ({
      date: point.date,
      baseElo: 0,
      eloOdds: point.eloOdds - point.baseElo,
      eloOddsInjuries: point.eloOddsInjuries - point.baseElo,
      eloOddsInjuriesNews: point.eloOddsInjuriesNews - point.baseElo,
    }));
  }, [filtered, isDelta, isMultiLayer]);

  // Match day markers — only for 3M and 6M ranges
  const showMatchMarkers =
    matchDates && (range === "3M" || range === "6M");
  const matchMarkerDates = useMemo(() => {
    if (!showMatchMarkers || !matchDates) return [];
    return (displayData as { date: string }[])
      .filter((d) => matchDates.has(d.date))
      .map((d) => d.date);
  }, [showMatchMarkers, matchDates, displayData]);

  if (chartSource.length === 0) return null;

  // Compute Y axis domain from all visible data
  const allValues: number[] = [];
  const activeLayers = isDelta ? DELTA_LAYERS : LAYERS;

  for (const d of displayData) {
    if (isMultiLayer) {
      const ml = d as MultiLayerDataPoint;
      for (const layer of activeLayers) {
        if (visibleLayers.has(layer.key)) {
          allValues.push(ml[layer.key]);
        }
      }
      if (isDelta) allValues.push(0); // Always include zero line
    } else {
      allValues.push((d as SingleDataPoint).rating);
    }
  }
  if (allValues.length === 0) return null;

  const minR = isDelta
    ? Math.floor(Math.min(...allValues) / 5) * 5 - 10
    : Math.floor(Math.min(...allValues) / 10) * 10 - 20;
  const maxR = isDelta
    ? Math.ceil(Math.max(...allValues) / 5) * 5 + 10
    : Math.ceil(Math.max(...allValues) / 10) * 10 + 20;

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

  const chartTitle = isDelta
    ? "Signal Divergence from Base Elo"
    : "Rating History";

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
          {chartTitle}
        </div>
        <div className="flex gap-1">
          {/* View mode toggle */}
          {isMultiLayer && (
            <>
              <button
                onClick={() => setViewMode("absolute")}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors cursor-pointer ${
                  viewMode === "absolute"
                    ? "border-[var(--color-green)] text-[var(--color-green)] bg-[var(--color-green)]/10"
                    : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                }`}
              >
                Absolute
              </button>
              <button
                onClick={() => setViewMode("delta")}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors cursor-pointer ${
                  viewMode === "delta"
                    ? "border-[var(--color-yellow)] text-[var(--color-yellow)] bg-[var(--color-yellow)]/10"
                    : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                }`}
              >
                Delta
              </button>
              <span className="w-px bg-[var(--color-border)] mx-1" />
            </>
          )}
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
          {(isDelta ? DELTA_LAYERS : LAYERS).map((layer) => {
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
          {isDelta && (
            <span className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[var(--color-text-dim)]">
              <span className="inline-block w-3 h-px bg-[var(--color-text-dim)]" style={{ borderTop: "1px dashed #888898" }} />
              Base = 0
            </span>
          )}
        </div>
      )}

      <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={displayData}>
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
              tickFormatter={isDelta ? (v: number) => (v > 0 ? `+${v}` : String(v)) : undefined}
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
                const layers = isDelta ? DELTA_LAYERS : LAYERS;
                const layer = layers.find((l) => l.key === name);
                if (isDelta && name === "baseElo") {
                  return [0, "Base (ref)"];
                }
                const formatted = value != null
                  ? isDelta
                    ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}`
                    : String(Math.round(value))
                  : "0";
                return [formatted, layer?.label || name || ""];
              }}
            />

            {/* Zero reference line for delta mode */}
            {isDelta && (
              <ReferenceLine
                y={0}
                stroke="#888898"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}

            {/* Match day markers for 3M/6M zoom */}
            {showMatchMarkers &&
              matchMarkerDates.map((date) => (
                <ReferenceLine
                  key={date}
                  x={date}
                  stroke="#2a2a3a"
                  strokeDasharray="2 4"
                  strokeWidth={0.5}
                />
              ))}

            {isMultiLayer ? (
              isDelta ? (
                // Delta mode: area fills + lines
                <>
                  {DELTA_LAYERS.map((layer) =>
                    visibleLayers.has(layer.key) ? (
                      <Area
                        key={`area-${layer.key}`}
                        type="monotone"
                        dataKey={layer.key}
                        stroke="none"
                        fill={layer.color}
                        fillOpacity={0.08}
                        baseLine={0}
                        animationDuration={0}
                      />
                    ) : null
                  )}
                  {DELTA_LAYERS.map((layer) =>
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
                        animationDuration={0}
                      />
                    ) : null
                  )}
                </>
              ) : (
                // Absolute mode
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
                      animationDuration={0}
                    />
                  ) : null
                )
              )
            ) : (
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#22c55e" }}
                animationDuration={0}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
