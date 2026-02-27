"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface RatingRow {
  team: string;
  league: string;
  l3Rating: number;
  baseElo: number;
  premium: number;
  oraclePrice: number;
  confidence: number;
  components: {
    matchCount: number;
  };
  dataFreshness: string;
}

interface Props {
  ratings: RatingRow[];
}

export default function L3TeamsTable({ ratings }: Props) {
  const router = useRouter();

  function handleRowClick(href: string) {
    if (window.getSelection()?.toString()) return;
    router.push(href);
  }

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] overflow-hidden">
      {/* Column explainer */}
      <div className="px-3 py-2 border-b border-[var(--color-border)]/50 text-[10px] text-[var(--color-text-dim)]">
        <span className="font-bold text-[#10b981]">L3 Market</span> = 80% market consensus + 20% base Elo &middot;{" "}
        <span className="font-bold text-[var(--color-text)]">Premium</span> = L3 &minus; Base &middot;{" "}
        <span className="font-bold text-[var(--color-yellow)]">Oracle $</span> = perpetual index price
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            <th className="text-left py-2 px-3">#</th>
            <th className="text-left py-2 px-3">Team</th>
            <th className="text-left py-2 px-3">League</th>
            <th className="text-right py-2 px-3">L3 Market</th>
            <th className="text-right py-2 px-3">Base</th>
            <th className="text-right py-2 px-3">Premium</th>
            <th className="text-right py-2 px-3">Oracle $</th>
            <th className="text-right py-2 px-3">Conf</th>
            <th className="text-center py-2 px-3">Odds</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((r, idx) => {
            const href = `/l3/team/${encodeURIComponent(r.team)}`;
            return (
              <tr
                key={r.team}
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
                    className="hover:text-[#10b981] transition-colors font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.team}
                  </Link>
                </td>
                <td className="py-2 px-3 text-[var(--color-text-dim)]">
                  {r.league}
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-bold text-[#10b981]">
                  {Math.round(r.l3Rating)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-[var(--color-text-dim)]">
                  {Math.round(r.baseElo)}
                </td>
                <td
                  className={`py-2 px-3 text-right tabular-nums ${
                    r.premium > 0
                      ? "text-[var(--color-green)]"
                      : r.premium < 0
                        ? "text-[var(--color-red)]"
                        : "text-[var(--color-text-dim)]"
                  }`}
                >
                  {r.premium > 0 ? "+" : ""}
                  {r.premium.toFixed(1)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-[var(--color-yellow)]">
                  ${r.oraclePrice.toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-[var(--color-text-dim)]">
                  {Math.round(r.confidence * 100)}%
                </td>
                <td className="py-2 px-3 text-center">
                  {r.components.matchCount > 0 ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-[#10b981]" title={`${r.components.matchCount} odds`} />
                  ) : (
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-text-dim)]/30" title="No odds" />
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
