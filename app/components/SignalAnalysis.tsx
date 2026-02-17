"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface TeamSignalMetrics {
  team: string;
  league: string;
  totalMatches: number;
  totalDataPoints: number;
  matchDayVolatility: {
    baseElo: number;
    eloOdds: number;
    eloOddsInjuries: number;
    eloOddsInjuriesNews: number;
  };
  betweenMatchVolatility: {
    baseElo: number;
    eloOdds: number;
    eloOddsInjuries: number;
    eloOddsInjuriesNews: number;
  };
  movementDays: {
    baseElo: number;
    eloOdds: number;
    eloOddsInjuries: number;
    eloOddsInjuriesNews: number;
  };
  deltaFromBase: {
    odds: {
      mean: number;
      stdDev: number;
      maxPositive: number;
      maxNegative: number;
      correlation: number;
    };
    injuries: { mean: number; stdDev: number; maxPositive: number; maxNegative: number; correlation: number };
    news: { mean: number; stdDev: number; maxPositive: number; maxNegative: number; correlation: number };
  };
  preMatchDirectionAccuracy: {
    totalPredictions: number;
    correctDirection: number;
    accuracy: number;
  };
}

interface AggregateSignalMetrics {
  totalTeams: number;
  totalMatches: number;
  avgMatchDayVolatility: { baseElo: number; eloOdds: number; injuries: number; news: number };
  avgBetweenMatchVolatility: { baseElo: number; eloOdds: number; injuries: number; news: number };
  avgMovementDaysPerMonth: { baseElo: number; eloOdds: number; injuries: number; news: number };
  avgPreMatchDirectionAccuracy: number;
  totalMovement: { baseElo: number; eloOdds: number; injuries: number; news: number };
  movementMultiplier: { eloOdds: number; injuries: number; news: number };
}

interface SignalAnalysisProps {
  teamMetrics: TeamSignalMetrics;
  aggregate: AggregateSignalMetrics;
}

const LAYER_COLORS = {
  baseElo: "#22c55e",
  eloOdds: "#eab308",
  injuries: "#f97316",
  news: "#ef4444",
};

export default function SignalAnalysis({
  teamMetrics,
  aggregate,
}: SignalAnalysisProps) {
  const vol = teamMetrics.matchDayVolatility;
  const delta = teamMetrics.deltaFromBase;
  const dir = teamMetrics.preMatchDirectionAccuracy;
  const movDays = teamMetrics.movementDays;

  // Movement boost: compare total odds movement to base movement
  const teamMovementBoost =
    vol.baseElo > 0
      ? Math.round(((vol.eloOdds - vol.baseElo) / vol.baseElo) * 100)
      : 0;
  const aggMovementBoost = Math.round((aggregate.movementMultiplier.eloOdds - 1) * 100);

  // Volatility bar chart data
  const volData = [
    { name: "Base Elo", value: vol.baseElo, color: LAYER_COLORS.baseElo, dimmed: false },
    { name: "+ Odds", value: vol.eloOdds, color: LAYER_COLORS.eloOdds, dimmed: false },
    { name: "+ Injuries", value: vol.eloOddsInjuries, color: LAYER_COLORS.injuries, dimmed: false },
    { name: "Full Signal", value: vol.eloOddsInjuriesNews, color: LAYER_COLORS.news, dimmed: false },
  ];

  return (
    <div className="mb-8">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
        Signal Analysis
      </div>

      <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] p-4">
        {/* Section 1: Volatility Comparison */}
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
            Match-Day Movement (avg pts per match)
          </div>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={volData}
                layout="vertical"
                margin={{ left: 70, right: 20, top: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#888898" }}
                  tickLine={false}
                  axisLine={{ stroke: "#2a2a3a" }}
                  domain={[0, "auto"]}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10, fill: "#888898" }}
                  tickLine={false}
                  axisLine={false}
                  width={65}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111118",
                    border: "1px solid #2a2a3a",
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                  formatter={(value: number | undefined) => [`${value ?? 0} pts`, "Avg movement"]}
                />
                <Bar dataKey="value" radius={[0, 3, 3, 0]} animationDuration={0}>
                  {volData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.color}
                      fillOpacity={entry.dimmed ? 0.25 : 0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Layer labels */}
          <div className="flex gap-4 mt-1 ml-[70px]">
            <span className="text-[9px] text-[var(--color-text-dim)] opacity-50">
              4 signal layers active
            </span>
          </div>
        </div>

        {/* Section 2: Key Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Movement Days / Month */}
          <div className="border border-[var(--color-border)] rounded px-3 py-2.5 bg-[var(--color-bg)]/50">
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
              Movement Days/Mo
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--color-text-dim)]">Base:</span>
                <span className="tabular-nums font-medium" style={{ color: LAYER_COLORS.baseElo }}>
                  {movDays.baseElo}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--color-text-dim)]">+Odds:</span>
                <span className="tabular-nums font-medium" style={{ color: LAYER_COLORS.eloOdds }}>
                  {movDays.eloOdds}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[var(--color-text-dim)]">+Inj:</span>
                <span className="tabular-nums font-medium" style={{ color: LAYER_COLORS.injuries }}>
                  {movDays.eloOddsInjuries}
                </span>
              </div>
            </div>
          </div>

          {/* Odds Direction Accuracy */}
          <div className="border border-[var(--color-border)] rounded px-3 py-2.5 bg-[var(--color-bg)]/50">
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
              Odds Direction
            </div>
            <div className="text-xl font-bold tabular-nums" style={{ color: LAYER_COLORS.eloOdds }}>
              {dir.accuracy}%
            </div>
            <div className="text-[9px] text-[var(--color-text-dim)] mt-0.5">
              {dir.correctDirection}/{dir.totalPredictions} predictions
            </div>
          </div>

          {/* Max Divergence */}
          <div className="border border-[var(--color-border)] rounded px-3 py-2.5 bg-[var(--color-bg)]/50">
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
              Max Divergence
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-[var(--color-green)]">&#9650;</span>
                <span className="tabular-nums font-medium">
                  +{delta.odds.maxPositive} pts
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-[var(--color-red)]">&#9660;</span>
                <span className="tabular-nums font-medium">
                  {delta.odds.maxNegative} pts
                </span>
              </div>
            </div>
            <div className="text-[9px] text-[var(--color-text-dim)] mt-1">
              avg: {delta.odds.mean > 0 ? "+" : ""}{delta.odds.mean} &#177;{delta.odds.stdDev}
            </div>
          </div>

          {/* Movement Boost */}
          <div className="border border-[var(--color-border)] rounded px-3 py-2.5 bg-[var(--color-bg)]/50">
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
              Movement Boost
            </div>
            <div className="text-xl font-bold tabular-nums" style={{ color: LAYER_COLORS.eloOdds }}>
              {teamMovementBoost > 0 ? "+" : ""}{teamMovementBoost}%
            </div>
            <div className="text-[9px] text-[var(--color-text-dim)] mt-0.5">
              vs base Elo
            </div>
            <div className="text-[9px] text-[var(--color-text-dim)]">
              (global avg: +{aggMovementBoost}%)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
