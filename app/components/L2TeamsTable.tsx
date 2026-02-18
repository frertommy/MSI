"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface RatingRow {
  team: string;
  league: string;
  msiBase: number;
  oddsAdjustment: number;
  msiFinal: number;
  confidence: number;
  oraclePrice?: number;
}

interface Props {
  ratings: RatingRow[];
}

export default function L2TeamsTable({ ratings }: Props) {
  const router = useRouter();

  function handleRowClick(href: string) {
    if (window.getSelection()?.toString()) return;
    router.push(href);
  }

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] overflow-hidden">
      {/* Column explainer */}
      <div className="px-3 py-2 border-b border-[var(--color-border)]/50 text-[10px] text-[var(--color-text-dim)]">
        <span className="font-bold text-[var(--color-text)]">MSI Base</span> = match Elo &middot;{" "}
        <span className="font-bold text-[var(--color-text)]">Odds Adj</span> = bookmaker adjustment &middot;{" "}
        <span className="font-bold text-[var(--color-green)]">MSI Final</span> = Base + Adj &middot;{" "}
        <span className="font-bold text-[var(--color-yellow)]">Oracle $</span> = mapped perp index
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
            <th className="text-left py-2 px-3">#</th>
            <th className="text-left py-2 px-3">Team</th>
            <th className="text-left py-2 px-3">League</th>
            <th className="text-right py-2 px-3">MSI Base</th>
            <th className="text-right py-2 px-3">Odds Adj</th>
            <th className="text-right py-2 px-3">MSI Final</th>
            <th className="text-right py-2 px-3">Conf</th>
            <th className="text-right py-2 px-3">Oracle $</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((r, idx) => {
            const href = `/l2/team/${encodeURIComponent(r.team)}`;
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
                    className="hover:text-[var(--color-green)] transition-colors font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.team}
                  </Link>
                </td>
                <td className="py-2 px-3 text-[var(--color-text-dim)]">
                  {r.league}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {Math.round(r.msiBase)}
                </td>
                <td
                  className={`py-2 px-3 text-right tabular-nums ${
                    r.oddsAdjustment > 0
                      ? "text-[var(--color-green)]"
                      : r.oddsAdjustment < 0
                        ? "text-[var(--color-red)]"
                        : "text-[var(--color-text-dim)]"
                  }`}
                >
                  {r.oddsAdjustment > 0 ? "+" : ""}
                  {r.oddsAdjustment.toFixed(1)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-bold text-[var(--color-green)]">
                  {Math.round(r.msiFinal)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-[var(--color-text-dim)]">
                  {(r.confidence * 100).toFixed(0)}%
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-[var(--color-yellow)]">
                  {r.oraclePrice ? `$${r.oraclePrice.toFixed(2)}` : "—"}
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
