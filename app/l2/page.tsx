import { l2Source } from "@/lib/dataSources/l2";

export default function L2Page() {
  const summary = l2Source.getSummary();
  const ratings = summary.latestRunId
    ? l2Source.getMSIRatings(summary.latestRunId)
    : [];
  const top10 = ratings.slice(0, 10);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          <span className="text-[var(--color-green)]">L2</span>
          <span className="text-[var(--color-text-dim)] font-normal">
            {" "}
            — Derived Layer
          </span>
        </h1>
        <p className="text-xs text-[var(--color-text-dim)]">
          Versioned model outputs computed from L1 facts. Each run is
          immutable and reproducible.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Latest Run" value={summary.latestRunId?.split("_").pop() ?? "—"} small />
        <StatCard label="Teams Computed" value={summary.teamCount} />
        <StatCard label="Total Runs" value={summary.totalRuns} />
        <StatCard
          label="Created At"
          value={summary.createdAt?.substring(0, 19) ?? "—"}
          small
        />
      </div>

      {/* Run ID */}
      {summary.latestRunId && (
        <div className="border border-[var(--color-border)] rounded-md p-4 bg-[var(--color-bg-card)] mb-6">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
            Run ID
          </div>
          <div className="text-xs font-mono text-[var(--color-text)]">
            {summary.latestRunId}
          </div>
        </div>
      )}

      {/* Top 10 Ratings Preview */}
      {top10.length > 0 && (
        <div className="border border-[var(--color-border)] rounded-md p-4 bg-[var(--color-bg-card)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
            Top 10 — MSI Final + Oracle Price
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--color-text-dim)] text-left">
                  <th className="py-1 pr-4">#</th>
                  <th className="py-1 pr-4">Team</th>
                  <th className="py-1 pr-4 text-right">MSI Base</th>
                  <th className="py-1 pr-4 text-right">Odds Adj</th>
                  <th className="py-1 pr-4 text-right">MSI Final</th>
                  <th className="py-1 pr-4 text-right">Confidence</th>
                  <th className="py-1 text-right">Oracle $</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((r, idx) => (
                  <tr
                    key={r.team}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
                  >
                    <td className="py-1.5 pr-4 tabular-nums text-[var(--color-text-dim)]">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 pr-4 font-medium">{r.team}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">
                      {Math.round(r.msiBase)}
                    </td>
                    <td
                      className={`py-1.5 pr-4 text-right tabular-nums ${
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
                    <td className="py-1.5 pr-4 text-right tabular-nums font-bold text-[var(--color-green)]">
                      {Math.round(r.msiFinal)}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-[var(--color-text-dim)]">
                      {(r.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[var(--color-yellow)]">
                      {r.oraclePrice ? `$${r.oraclePrice.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!summary.latestRunId && (
        <div className="border border-[var(--color-border)] rounded-md p-8 bg-[var(--color-bg-card)] text-center">
          <div className="text-sm text-[var(--color-text-dim)]">
            No L2 runs found. Run{" "}
            <code className="text-[var(--color-green)]">
              npm run pipeline:v1
            </code>{" "}
            to generate derived outputs.
          </div>
        </div>
      )}

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        L2 Derived — data_v1/l2_derived/ &middot; Session 2 will add
        full team drill-down views with timeseries
      </footer>
    </main>
  );
}

function StatCard({
  label,
  value,
  small,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-md p-3 bg-[var(--color-bg-card)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
        {label}
      </div>
      <div
        className={`font-bold tabular-nums text-[var(--color-green)] ${
          small ? "text-xs" : "text-lg"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
