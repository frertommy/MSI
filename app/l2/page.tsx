import Link from "next/link";
import { l2Source } from "@/lib/dataSources/l2";

export default function L2TeamsPage() {
  const summary = l2Source.getSummary();
  const ratings = summary.latestRunId
    ? l2Source.getMSIRatings(summary.latestRunId)
    : [];

  const runShort = summary.latestRunId?.split("_").pop() ?? "—";

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          <span className="text-[var(--color-green)]">L2</span>
          <span className="text-[var(--color-text-dim)] font-normal">
            {" "}&mdash; Derived Layer
          </span>
        </h1>
        <p className="text-xs text-[var(--color-text-dim)] mb-3">
          Versioned model outputs &middot; run:{" "}
          <span className="font-mono text-[var(--color-green)]">{runShort}</span>{" "}
          &middot; {summary.teamCount} teams &middot; {summary.totalRuns} total runs
        </p>
        {summary.createdAt && (
          <span className="text-[10px] border border-[var(--color-green)]/30 rounded px-2 py-0.5 text-[var(--color-green)]">
            computed: {summary.createdAt.substring(0, 19)}
          </span>
        )}
      </div>

      {ratings.length > 0 ? (
        <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] overflow-hidden">
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
              </tr>
            </thead>
            <tbody>
              {ratings.map((r, idx) => (
                <tr
                  key={r.team}
                  className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <td className="py-2 px-3 tabular-nums text-[var(--color-text-dim)]">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3">
                    <Link
                      href={`/l2/team/${encodeURIComponent(r.team)}`}
                      className="hover:text-[var(--color-green)] transition-colors font-medium"
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-[var(--color-border)] rounded-md p-8 bg-[var(--color-bg-card)] text-center">
          <div className="text-sm text-[var(--color-text-dim)]">
            No L2 runs found. Run{" "}
            <code className="text-[var(--color-green)]">npm run pipeline:v1</code>{" "}
            to generate derived outputs.
          </div>
        </div>
      )}

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        L2 Derived &middot; data_v1/l2_derived/
      </footer>
    </main>
  );
}
