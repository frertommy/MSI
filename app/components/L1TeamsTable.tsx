"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface TeamRow {
  name: string;
  league: string;
  matchesPlayed: number;
  lastResult: {
    label: "W" | "D" | "L";
    score: string;
    opponent: string;
  } | null;
}

interface Props {
  teams: TeamRow[];
}

export default function L1TeamsTable({ teams }: Props) {
  const router = useRouter();

  function handleRowClick(href: string) {
    if (window.getSelection()?.toString()) return;
    router.push(href);
  }

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            <th className="text-left py-2 px-3">#</th>
            <th className="text-left py-2 px-3">Team</th>
            <th className="text-left py-2 px-3">League</th>
            <th className="text-right py-2 px-3">Matches</th>
            <th className="text-left py-2 px-3">Last Result</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, idx) => {
            const href = `/l1/team/${encodeURIComponent(team.name)}`;
            const r = team.lastResult;
            return (
              <tr
                key={team.name}
                role="link"
                tabIndex={0}
                className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer group"
                onClick={() => handleRowClick(href)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(href);
                  }
                }}
              >
                <td className="py-2 px-3 tabular-nums text-[var(--color-text-dim)]">
                  {idx + 1}
                </td>
                <td className="py-2 px-3">
                  <Link
                    href={href}
                    className="hover:text-[var(--color-green)] transition-colors font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {team.name}
                  </Link>
                </td>
                <td className="py-2 px-3 text-[var(--color-text-dim)]">
                  {team.league}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {team.matchesPlayed}
                </td>
                <td className="py-2 px-3">
                  {r ? (
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          r.label === "W"
                            ? "text-[var(--color-green)] border-[var(--color-green)]/30 bg-[var(--color-green)]/10"
                            : r.label === "L"
                              ? "text-[var(--color-red)] border-[var(--color-red)]/30 bg-[var(--color-red)]/10"
                              : "text-[var(--color-yellow)] border-[var(--color-yellow)]/30 bg-[var(--color-yellow)]/10"
                        }`}
                      >
                        {r.label}
                      </span>
                      <span className="tabular-nums">{r.score}</span>
                      <span className="text-[var(--color-text-dim)]">
                        vs {r.opponent.substring(0, 20)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-dim)]">&mdash;</span>
                  )}
                </td>
                <td className="py-2 px-3 text-[var(--color-text-dim)] opacity-0 group-hover:opacity-50 transition-opacity text-xs">
                  &rarr;
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
