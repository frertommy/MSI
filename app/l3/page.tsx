import { l3Source } from "@/lib/dataSources/l3";
import L3TeamsTable from "@/app/components/L3TeamsTable";

export default function L3TeamsPage() {
  const summary = l3Source.getSummary();
  const ratings = l3Source.getRatings();
  const runShort = summary.latestRunId?.split("_").pop() ?? "—";

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          <span className="text-[#10b981]">L3</span>
          <span className="text-[var(--color-text-dim)] font-normal">
            {" "}&mdash; Market Price
          </span>
        </h1>
        <p className="text-xs text-[var(--color-text-dim)] mb-3">
          Market-derived continuous pricing &middot; run:{" "}
          <span className="font-mono text-[#10b981]">{runShort}</span>{" "}
          &middot; {summary.teamCount} teams &middot;{" "}
          {summary.teamsWithOdds} with live odds
        </p>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {summary.createdAt && (
            <span className="border border-[#10b981]/30 rounded px-2 py-0.5 text-[#10b981]">
              computed: {summary.createdAt.substring(0, 19)}
            </span>
          )}
          <span className="border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text-dim)]">
            avg confidence: {Math.round(summary.avgConfidence * 100)}%
          </span>
          <span className="border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text-dim)]">
            weights: 80% market / 20% base
          </span>
        </div>
      </div>

      {ratings.length > 0 ? (
        <L3TeamsTable ratings={ratings} />
      ) : (
        <div className="border border-[var(--color-border)] rounded-md p-8 bg-[var(--color-bg-card)] text-center">
          <div className="text-sm text-[var(--color-text-dim)]">
            No L3 runs found. Run{" "}
            <code className="text-[#10b981]">npm run pipeline:l3</code>{" "}
            to compute market-derived pricing.
          </div>
        </div>
      )}

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        L3 Market-Derived &middot; data_v1/l3_derived/
      </footer>
    </main>
  );
}
