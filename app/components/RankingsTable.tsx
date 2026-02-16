"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import LeagueFilter from "./LeagueFilter";

interface TeamRow {
  rank: number;
  team: string;
  league: string;
  country: string;
  rating: number;
  msiLive: number;
  oddsAdj: number;
  wins: number;
  draws: number;
  losses: number;
  lastUpdated: string;
}

interface LayerTeamEntry {
  team: string;
  rating: number;
  rank: number;
}

interface ValidationData {
  baseElo: { correctPct: number; avgBrier: number; count: number };
  eloOdds: { correctPct: number; avgBrier: number; count: number };
  improvement: { correctPctDelta: number; brierDelta: number };
}

interface SignalAggregateData {
  avgMatchDayVolatility: { baseElo: number; eloOdds: number };
  avgPreMatchDirectionAccuracy: number;
  movementMultiplier: { eloOdds: number };
}

interface RankingsTableProps {
  teams: TeamRow[];
  hasOdds: boolean;
  layerTeams?: Record<string, LayerTeamEntry[]>;
  validation?: ValidationData;
  signalAggregate?: SignalAggregateData;
}

const COUNTRY_SHORT: Record<string, string> = {
  ENG: "ENG",
  ESP: "ESP",
  GER: "GER",
  ITA: "ITA",
  FRA: "FRA",
};

const COUNTRY_TO_LEAGUE: Record<string, string> = {
  ENG: "PL",
  ESP: "PD",
  GER: "BL1",
  ITA: "SA",
  FRA: "FL1",
};

const SIGNAL_LAYERS = [
  { key: "baseElo", label: "Match Data", color: "#22c55e", comingSoon: false },
  { key: "eloOdds", label: "Match + Odds", color: "#eab308", comingSoon: false },
  { key: "eloOddsInjuries", label: "+ Injuries", color: "#f97316", comingSoon: true },
  { key: "eloOddsInjuriesNews", label: "Full Signal", color: "#ef4444", comingSoon: true },
];

export default function RankingsTable({
  teams,
  hasOdds,
  layerTeams,
  validation,
  signalAggregate,
}: RankingsTableProps) {
  const [league, setLeague] = useState("ALL");
  const [showAll, setShowAll] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState(
    layerTeams?.eloOdds ? "eloOdds" : "baseElo"
  );

  const hasLayers = layerTeams && Object.keys(layerTeams).length > 0;

  // Build lookup maps for each layer's team ratings
  const layerLookup = useMemo(() => {
    if (!layerTeams) return null;
    const lookup: Record<string, Record<string, { rating: number; rank: number }>> = {};
    for (const [layerKey, entries] of Object.entries(layerTeams)) {
      lookup[layerKey] = {};
      for (const entry of entries) {
        lookup[layerKey][entry.team] = { rating: entry.rating, rank: entry.rank };
      }
    }
    return lookup;
  }, [layerTeams]);

  // Build display data: merge base team info with selected layer's ratings
  const displayTeams = useMemo(() => {
    if (!hasLayers || !layerLookup) return teams;

    const currentLayer = layerLookup[selectedLayer];
    const baseLayer = layerLookup["baseElo"];
    if (!currentLayer) return teams;

    return teams
      .map((t) => {
        const layerData = currentLayer[t.team];
        const baseData = baseLayer?.[t.team];
        if (!layerData) return t;
        return {
          ...t,
          rank: layerData.rank,
          msiLive: layerData.rating,
          rating: baseData?.rating ?? t.rating,
          oddsAdj: baseData ? layerData.rating - baseData.rating : 0,
        };
      })
      .sort((a, b) => a.rank - b.rank);
  }, [teams, hasLayers, layerLookup, selectedLayer]);

  const filtered =
    league === "ALL"
      ? displayTeams
      : displayTeams.filter((t) => COUNTRY_TO_LEAGUE[t.country] === league);

  const display = showAll ? filtered : filtered.slice(0, 20);

  const showChange = hasLayers && selectedLayer !== "baseElo";
  const layerColor =
    SIGNAL_LAYERS.find((l) => l.key === selectedLayer)?.color ?? "#22c55e";

  return (
    <div>
      {/* Signal Layer Toggle */}
      {hasLayers && (
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mr-1">
              Signal:
            </span>
            {SIGNAL_LAYERS.map((l) => (
              <button
                key={l.key}
                onClick={() => !l.comingSoon && setSelectedLayer(l.key)}
                className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                  l.comingSoon
                    ? "border-[var(--color-border)] text-[var(--color-text-dim)] opacity-40 cursor-default"
                    : selectedLayer === l.key
                      ? "border-current bg-current/10 cursor-pointer"
                      : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] cursor-pointer"
                }`}
                style={
                  !l.comingSoon && selectedLayer === l.key
                    ? { color: l.color }
                    : undefined
                }
              >
                {l.label}
                {l.comingSoon && " (soon)"}
              </button>
            ))}
          </div>

          {/* Validation Badge */}
          {validation && (
            <div className="text-[10px] text-[var(--color-text-dim)] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded px-3 py-1.5 inline-flex flex-wrap gap-x-3 gap-y-0.5">
              <span>
                Prediction: Base{" "}
                <span className="text-[var(--color-text)]">
                  {validation.baseElo.correctPct}%
                </span>
                {" → +Odds "}
                <span className="text-[var(--color-green)]">
                  {validation.eloOdds.correctPct}%
                </span>
              </span>
              <span className="text-[var(--color-border)]">|</span>
              <span>
                Brier:{" "}
                <span className="text-[var(--color-text)]">
                  {validation.baseElo.avgBrier.toFixed(3)}
                </span>
                {" → "}
                <span className="text-[var(--color-green)]">
                  {validation.eloOdds.avgBrier.toFixed(3)}
                </span>
              </span>
              {signalAggregate && (
                <>
                  <span className="text-[var(--color-border)]">|</span>
                  <span>
                    Movement:{" "}
                    <span className="text-[var(--color-yellow)]">
                      +{Math.round((signalAggregate.movementMultiplier.eloOdds - 1) * 100)}%
                    </span>
                    {" more trading days"}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Signal Analysis Summary */}
          {signalAggregate && (
            <div className="text-[10px] text-[var(--color-text-dim)] mt-1.5 font-mono">
              <span className="uppercase tracking-wider">Signal Analysis</span>
              {"  ·  Match-day vol: "}
              <span className="text-[var(--color-text)]">{signalAggregate.avgMatchDayVolatility.baseElo} pts</span>
              {"  ·  +Odds vol: "}
              <span className="text-[var(--color-yellow)]">{signalAggregate.avgMatchDayVolatility.eloOdds} pts</span>
              {"  ·  Direction: "}
              <span className="text-[var(--color-yellow)]">{signalAggregate.avgPreMatchDirectionAccuracy}%</span>
            </div>
          )}
        </div>
      )}

      <LeagueFilter selected={league} onSelect={setLeague} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-text-dim)] text-[10px] uppercase tracking-wider">
              <th className="text-left py-2 px-2 w-10">#</th>
              <th className="text-left py-2 px-2">Team</th>
              <th className="text-left py-2 px-2 w-16">League</th>
              <th className="text-right py-2 px-2 w-24">
                {hasLayers
                  ? SIGNAL_LAYERS.find((l) => l.key === selectedLayer)?.label ?? "MSI"
                  : "MSI Live"}
              </th>
              {showChange && (
                <th className="text-right py-2 px-2 w-20">Change</th>
              )}
              <th className="text-right py-2 px-2 w-24">W-D-L</th>
              <th className="text-right py-2 px-2 w-24 hidden sm:table-cell">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {display.map((t, i) => {
              const change = showChange ? t.msiLive - t.rating : 0;
              return (
                <Link
                  key={t.team}
                  href={`/team/${encodeURIComponent(t.team)}`}
                  className="contents"
                >
                  <tr className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer">
                    <td className="py-2 px-2 text-[var(--color-text-dim)] tabular-nums">
                      {league === "ALL" ? t.rank : i + 1}
                    </td>
                    <td className="py-2 px-2 font-medium">{t.team}</td>
                    <td className="py-2 px-2 text-[var(--color-text-dim)]">
                      {COUNTRY_SHORT[t.country] || t.country}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span
                        className="font-bold"
                        style={{ color: layerColor }}
                      >
                        {Math.round(t.msiLive)}
                      </span>
                      {!hasLayers && hasOdds && t.oddsAdj !== 0 && (
                        <span
                          className={`ml-1 text-[10px] ${
                            t.oddsAdj > 0
                              ? "text-[var(--color-green)]"
                              : "text-[var(--color-red)]"
                          }`}
                        >
                          {t.oddsAdj > 0 ? "\u25B2" : "\u25BC"}
                          {Math.abs(t.oddsAdj).toFixed(0)}
                        </span>
                      )}
                    </td>
                    {showChange && (
                      <td className="py-2 px-2 text-right tabular-nums text-[10px]">
                        <span
                          className={
                            change > 0
                              ? "text-[var(--color-green)]"
                              : change < 0
                                ? "text-[var(--color-red)]"
                                : "text-[var(--color-text-dim)]"
                          }
                        >
                          {change > 0 ? "+" : ""}
                          {change.toFixed(1)}
                        </span>
                      </td>
                    )}
                    <td className="py-2 px-2 text-right text-[var(--color-text-dim)] tabular-nums">
                      {t.wins}-{t.draws}-{t.losses}
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--color-text-dim)] tabular-nums hidden sm:table-cell">
                      {t.lastUpdated.substring(0, 10)}
                    </td>
                  </tr>
                </Link>
              );
            })}
          </tbody>
        </table>
      </div>
      {!showAll && filtered.length > 20 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full py-2 text-xs text-[var(--color-text-dim)] border border-[var(--color-border)] rounded hover:border-[var(--color-green)] hover:text-[var(--color-green)] transition-colors cursor-pointer"
        >
          Show all {filtered.length} teams
        </button>
      )}
      {showAll && filtered.length > 20 && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-4 w-full py-2 text-xs text-[var(--color-text-dim)] border border-[var(--color-border)] rounded hover:border-[var(--color-green)] hover:text-[var(--color-green)] transition-colors cursor-pointer"
        >
          Show top 20 only
        </button>
      )}
    </div>
  );
}
