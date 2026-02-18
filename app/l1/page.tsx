import { l1Source } from "@/lib/dataSources/l1";

export default function L1Page() {
  const summary = l1Source.getSummary();

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          <span className="text-[var(--color-green)]">L1</span>
          <span className="text-[var(--color-text-dim)] font-normal">
            {" "}
            — Facts Layer
          </span>
        </h1>
        <p className="text-xs text-[var(--color-text-dim)]">
          Immutable, append-only source data. Everything fetched from external
          APIs lives here.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Teams" value={summary.teamCount} />
        <StatCard label="Fixtures" value={summary.fixtureCount.toLocaleString()} />
        <StatCard label="Odds Snapshots" value={summary.oddsSnapshotCount} />
        <StatCard
          label="Last Ingest"
          value={summary.lastIngest?.substring(0, 19) ?? "—"}
          small
        />
      </div>

      {/* Raw snapshot counts */}
      <div className="border border-[var(--color-border)] rounded-md p-4 bg-[var(--color-bg-card)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
          Raw Snapshots (append-only)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          {Object.entries(summary.rawCounts).map(([key, count]) => (
            <div key={key}>
              <span className="text-[var(--color-text-dim)]">
                {key}:
              </span>{" "}
              <span className="text-[var(--color-text)] font-bold tabular-nums">
                {count}
              </span>{" "}
              <span className="text-[var(--color-text-dim)]">files</span>
            </div>
          ))}
        </div>
      </div>

      {/* Canonical files */}
      <div className="mt-6 border border-[var(--color-border)] rounded-md p-4 bg-[var(--color-bg-card)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-3">
          Canonical Files (rebuildable from raw)
        </div>
        <div className="text-xs space-y-1">
          <div>
            <span className="text-[var(--color-text-dim)]">teams.json:</span>{" "}
            <span className="font-bold tabular-nums">{summary.teamCount}</span> teams
          </div>
          <div>
            <span className="text-[var(--color-text-dim)]">fixtures.json:</span>{" "}
            <span className="font-bold tabular-nums">{summary.fixtureCount.toLocaleString()}</span> fixtures
          </div>
          <div>
            <span className="text-[var(--color-text-dim)]">match_results.json:</span>{" "}
            <span className="font-bold tabular-nums">{summary.fixtureCount.toLocaleString()}</span> results
          </div>
          <div>
            <span className="text-[var(--color-text-dim)]">odds_snapshots.json:</span>{" "}
            <span className="font-bold tabular-nums">{summary.oddsSnapshotCount}</span> snapshots
          </div>
        </div>
      </div>

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        L1 Facts — data_v1/l1_facts/ &middot; Session 2 will add team
        drill-down views
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
