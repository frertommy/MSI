"use client";

import { useState } from "react";
import Link from "next/link";
import LeagueFilter from "./LeagueFilter";

interface TeamRow {
  rank: number;
  team: string;
  league: string;
  country: string;
  rating: number;
  wins: number;
  draws: number;
  losses: number;
  lastUpdated: string;
}

interface RankingsTableProps {
  teams: TeamRow[];
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

export default function RankingsTable({ teams }: RankingsTableProps) {
  const [league, setLeague] = useState("ALL");
  const [showAll, setShowAll] = useState(false);

  const filtered =
    league === "ALL"
      ? teams
      : teams.filter((t) => COUNTRY_TO_LEAGUE[t.country] === league);

  const display = showAll ? filtered : filtered.slice(0, 20);

  return (
    <div>
      <LeagueFilter selected={league} onSelect={setLeague} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-text-dim)] text-[10px] uppercase tracking-wider">
              <th className="text-left py-2 px-2 w-10">#</th>
              <th className="text-left py-2 px-2">Team</th>
              <th className="text-left py-2 px-2 w-16">League</th>
              <th className="text-right py-2 px-2 w-20">MSI Rating</th>
              <th className="text-right py-2 px-2 w-24">W-D-L</th>
              <th className="text-right py-2 px-2 w-24 hidden sm:table-cell">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {display.map((t, i) => (
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
                  <td className="py-2 px-2 text-right font-bold text-[var(--color-green)] tabular-nums">
                    {Math.round(t.rating)}
                  </td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-dim)] tabular-nums">
                    {t.wins}-{t.draws}-{t.losses}
                  </td>
                  <td className="py-2 px-2 text-right text-[var(--color-text-dim)] tabular-nums hidden sm:table-cell">
                    {t.lastUpdated.substring(0, 10)}
                  </td>
                </tr>
              </Link>
            ))}
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
