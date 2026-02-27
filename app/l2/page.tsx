import { l2Source } from "@/lib/dataSources/l2";
import L2TeamsTable from "@/app/components/L2TeamsTable";

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
        <L2TeamsTable ratings={ratings} />
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
