import { l1Source } from "@/lib/dataSources/l1";
import L1TeamsTable from "@/app/components/L1TeamsTable";

export default function L1TeamsPage() {
  const summary = l1Source.getSummary();
  const teams = l1Source.getTeams();

  // Pre-compute last result for each team (server-side)
  const teamRows = teams.map((team) => {
    const td = l1Source.getTeamDetail(team.name);
    const lastMatch = td?.recentFixtures?.[td.recentFixtures.length - 1];
    let lastResult: { label: "W" | "D" | "L"; score: string; opponent: string } | null = null;

    if (lastMatch) {
      const isHome = lastMatch.homeTeam === team.name;
      const opponent = isHome ? lastMatch.awayTeam : lastMatch.homeTeam;
      const resultChar = lastMatch.result;
      const resultLabel =
        resultChar === "H"
          ? isHome ? "W" : "L"
          : resultChar === "A"
            ? isHome ? "L" : "W"
            : resultChar === "D"
              ? "D"
              : null;
      const score =
        lastMatch.homeGoals != null
          ? `${lastMatch.homeGoals}-${lastMatch.awayGoals}`
          : null;

      if (resultLabel && opponent && score) {
        lastResult = { label: resultLabel as "W" | "D" | "L", score, opponent };
      }
    }

    return {
      name: team.name,
      league: team.league,
      matchesPlayed: team.matchesPlayed,
      lastResult,
    };
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          <span className="text-[var(--color-green)]">L1</span>
          <span className="text-[var(--color-text-dim)] font-normal">
            {" "}&mdash; Facts Layer
          </span>
        </h1>
        <p className="text-xs text-[var(--color-text-dim)] mb-3">
          Immutable source data &middot; {summary.teamCount} teams &middot;{" "}
          {summary.fixtureCount.toLocaleString()} fixtures &middot;{" "}
          {summary.oddsSnapshotCount} odds snapshots
        </p>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {Object.entries(summary.rawCounts).map(([src, count]) => (
            <span
              key={src}
              className="border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text-dim)]"
            >
              {src}: {count} raw
            </span>
          ))}
          {summary.lastIngest && (
            <span className="border border-[var(--color-green)]/30 rounded px-2 py-0.5 text-[var(--color-green)]">
              last ingest: {summary.lastIngest.substring(0, 19)}
            </span>
          )}
        </div>
      </div>

      <L1TeamsTable teams={teamRows} />

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        L1 Facts &middot; data_v1/l1_facts/
      </footer>
    </main>
  );
}
