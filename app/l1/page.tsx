import Link from "next/link";
import { l1Source } from "@/lib/dataSources/l1";

export default function L1TeamsPage() {
  const summary = l1Source.getSummary();
  const teams = l1Source.getTeams();

  // Get last match result per team from canonical
  const detail = (name: string) => l1Source.getTeamDetail(name);

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

      {/* Team List Table */}
      <div className="border border-[var(--color-border)] rounded-md bg-[var(--color-bg-card)] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Team</th>
              <th className="text-left py-2 px-3">League</th>
              <th className="text-right py-2 px-3">Matches</th>
              <th className="text-left py-2 px-3">Last Result</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, idx) => {
              const td = detail(team.name);
              const lastMatch = td?.recentFixtures?.[td.recentFixtures.length - 1];
              const isHome = lastMatch?.homeTeam === team.name;
              const opponent = lastMatch
                ? isHome
                  ? lastMatch.awayTeam
                  : lastMatch.homeTeam
                : null;
              const resultChar = lastMatch?.result;
              const resultLabel =
                resultChar === "H"
                  ? isHome
                    ? "W"
                    : "L"
                  : resultChar === "A"
                    ? isHome
                      ? "L"
                      : "W"
                    : resultChar === "D"
                      ? "D"
                      : null;
              const score =
                lastMatch?.homeGoals != null
                  ? `${lastMatch.homeGoals}-${lastMatch.awayGoals}`
                  : null;

              return (
                <tr
                  key={team.name}
                  className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <td className="py-2 px-3 tabular-nums text-[var(--color-text-dim)]">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3">
                    <Link
                      href={`/l1/team/${encodeURIComponent(team.name)}`}
                      className="hover:text-[var(--color-green)] transition-colors font-medium"
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
                    {resultLabel && opponent ? (
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            resultLabel === "W"
                              ? "text-[var(--color-green)] border-[var(--color-green)]/30 bg-[var(--color-green)]/10"
                              : resultLabel === "L"
                                ? "text-[var(--color-red)] border-[var(--color-red)]/30 bg-[var(--color-red)]/10"
                                : "text-[var(--color-yellow)] border-[var(--color-yellow)]/30 bg-[var(--color-yellow)]/10"
                          }`}
                        >
                          {resultLabel}
                        </span>
                        <span className="tabular-nums">{score}</span>
                        <span className="text-[var(--color-text-dim)]">
                          vs {opponent?.substring(0, 20)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-dim)]">&mdash;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        L1 Facts &middot; data_v1/l1_facts/
      </footer>
    </main>
  );
}
