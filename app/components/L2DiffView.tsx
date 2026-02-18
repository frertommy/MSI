"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface TimeseriesPoint {
  date: string;
  baseElo: number;
  eloOdds?: number;
}

interface Props {
  msiBase: number;
  msiOdds: number;
  msiFinal: number;
  oddsAdjustment: number;
  injuryAdjustment: number;
  newsAdjustment: number;
  oraclePrice?: number;
  confidence: number;
  explainJson: Record<string, unknown>;
  timeseries: TimeseriesPoint[];
}

function interpretBadge(totalDelta: number): {
  label: string;
  color: string;
} {
  const abs = Math.abs(totalDelta);
  if (abs < 10) return { label: "Minor", color: "#888898" };
  if (abs < 30) return { label: "Moderate", color: "#eab308" };
  return { label: "Significant", color: "#ef4444" };
}

export default function L2DiffView({
  msiBase,
  msiFinal,
  oddsAdjustment,
  injuryAdjustment,
  newsAdjustment,
  oraclePrice,
  confidence,
  explainJson,
  timeseries,
}: Props) {
  const totalDelta = msiFinal - msiBase;
  const pricePctChange = oraclePrice
    ? ((oraclePrice - 100) / 100) * 100
    : null;

  const badge = interpretBadge(totalDelta);

  // Sparkline data — delta over time
  const sparkData = timeseries.length > 0
    ? (() => {
        const sampled = timeseries.length > 100
          ? timeseries.filter((_, i) => i % Math.ceil(timeseries.length / 100) === 0 || i === timeseries.length - 1)
          : timeseries;
        return sampled.map((d) => ({
          date: d.date.substring(5, 10),
          delta: Math.round((d.eloOdds ?? d.baseElo) - d.baseElo),
        }));
      })()
    : [];

  // Driver breakdown from explainJson
  const drivers = Object.entries(explainJson)
    .filter(([, v]) => typeof v === "number" && v !== 0)
    .sort(([, a], [, b]) => Math.abs(b as number) - Math.abs(a as number))
    .slice(0, 6);

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
          Diff View — Base vs Derived
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded border"
          style={{
            color: badge.color,
            borderColor: `${badge.color}40`,
            backgroundColor: `${badge.color}15`,
          }}
        >
          {badge.label}
        </span>
      </div>

      {/* Delta numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <DeltaCard
          label="Δ Odds"
          value={oddsAdjustment}
          format="pts"
        />
        <DeltaCard
          label="Δ Total"
          value={totalDelta}
          format="pts"
        />
        <DeltaCard
          label="Δ Price"
          value={pricePctChange}
          format="pct"
        />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            Confidence
          </div>
          <div className="text-lg font-bold tabular-nums text-[var(--color-text)]">
            {(confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Sparkline */}
      {sparkData.length > 3 && (
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
            Δ Total Over Time
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={sparkData}>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid #333348",
                  borderRadius: "4px",
                  fontSize: "10px",
                }}
              />
              <Area
                type="monotone"
                dataKey="delta"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.2}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Driver breakdown */}
      {drivers.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
            Driver Breakdown
          </div>
          <div className="space-y-1.5">
            {drivers.map(([key, val]) => {
              const v = val as number;
              const maxBar = Math.max(...drivers.map(([, dv]) => Math.abs(dv as number)));
              const barWidth = maxBar > 0 ? (Math.abs(v) / maxBar) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="w-32 text-[var(--color-text-dim)] text-[10px] truncate">
                    {key.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 h-3 bg-[var(--color-border)]/30 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: v > 0 ? "#22c55e" : "#ef4444",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span
                    className={`w-12 text-right tabular-nums text-[10px] font-bold ${
                      v > 0
                        ? "text-[var(--color-green)]"
                        : v < 0
                          ? "text-[var(--color-red)]"
                          : "text-[var(--color-text-dim)]"
                    }`}
                  >
                    {v > 0 ? "+" : ""}
                    {v.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Adjustment summary */}
      {(injuryAdjustment !== 0 || newsAdjustment !== 0) && (
        <div className="mt-4 pt-3 border-t border-[var(--color-border)]/50">
          <div className="flex flex-wrap gap-4 text-xs">
            {injuryAdjustment !== 0 && (
              <div>
                <span className="text-[var(--color-text-dim)]">Injury Adj:</span>{" "}
                <span className="font-bold tabular-nums text-[#f97316]">
                  {injuryAdjustment > 0 ? "+" : ""}
                  {injuryAdjustment.toFixed(1)}
                </span>
              </div>
            )}
            {newsAdjustment !== 0 && (
              <div>
                <span className="text-[var(--color-text-dim)]">News Adj:</span>{" "}
                <span
                  className={`font-bold tabular-nums ${
                    newsAdjustment > 0 ? "text-[var(--color-green)]" : "text-[#ef4444]"
                  }`}
                >
                  {newsAdjustment > 0 ? "+" : ""}
                  {newsAdjustment.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DeltaCard({
  label,
  value,
  format,
}: {
  label: string;
  value: number | null;
  format: "pts" | "pct";
}) {
  if (value === null) {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
          {label}
        </div>
        <div className="text-lg font-bold tabular-nums text-[var(--color-text-dim)]">
          —
        </div>
      </div>
    );
  }

  const color =
    value > 0
      ? "text-[var(--color-green)]"
      : value < 0
        ? "text-[var(--color-red)]"
        : "text-[var(--color-text-dim)]";

  const formatted =
    format === "pct"
      ? `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
      : `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>
        {formatted}
      </div>
    </div>
  );
}
