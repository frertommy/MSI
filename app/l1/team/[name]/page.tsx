import Link from "next/link";
import { notFound } from "next/navigation";
import { l1Source } from "@/lib/dataSources/l1";
import TeamTabs from "@/app/components/TeamTabs";
import L1OddsChart from "@/app/components/L1OddsChart";
import L1Provenance from "@/app/components/L1Provenance";

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateStaticParams() {
  const teams = l1Source.getTeams();
  return teams.map((t) => ({ name: t.name }));
}

export default async function L1TeamPage({ params }: PageProps) {
  const { name } = await params;
  const teamName = decodeURIComponent(name);

  const facts = l1Source.getTeamFacts(teamName);
  if (!facts) notFound();

  const { team, matchResults, oddsSnapshots, injuries, injuriesFetchedAt, newsEvents, newsComputedAt, provenance } = facts;

  // Recent 20 matches
  const recent = matchResults.slice(-20).reverse();

  // Result for this team
  function teamResult(m: typeof recent[0]) {
    const isHome = m.homeTeam === teamName;
    const r = m.result;
    if (!r) return null;
    if (r === "H") return isHome ? "W" : "L";
    if (r === "A") return isHome ? "L" : "W";
    return "D";
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/l1"
        className="text-xs text-[var(--color-text-dim)] hover:text-[var(--color-green)] transition-colors mb-6 inline-block"
      >
        &larr; Back to L1 Teams
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-tight mb-1">{teamName}</h1>
        <p className="text-xs text-[var(--color-text-dim)] mb-2">
          {team.league} &middot; {team.country} &middot;{" "}
          <span className="text-[var(--color-green)]">L1 Facts</span>
        </p>
        <div className="flex flex-wrap gap-4 text-xs">
          <div>
            <span className="text-[var(--color-text-dim)]">Matches:</span>{" "}
            <span className="font-bold tabular-nums">{matchResults.length}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-dim)]">Odds snapshots:</span>{" "}
            <span className="font-bold tabular-nums">{oddsSnapshots.length}</span>
          </div>
          <div>
            <span className="text-[var(--color-text-dim)]">Injuries:</span>{" "}
            <span className="font-bold tabular-nums">{injuries.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TeamTabs
        tabs={[
          {
            key: "matches",
            label: "Matches",
            color: "#22c55e",
            content: (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Opponent</th>
                      <th className="text-center py-2 px-2">H/A</th>
                      <th className="text-center py-2 px-2">Score</th>
                      <th className="text-center py-2 px-2">Res</th>
                      <th className="text-left py-2 px-2">League</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((m, i) => {
                      const isHome = m.homeTeam === teamName;
                      const opponent = isHome ? m.awayTeam : m.homeTeam;
                      const res = teamResult(m);
                      const score =
                        m.homeGoals != null
                          ? isHome
                            ? `${m.homeGoals}-${m.awayGoals}`
                            : `${m.awayGoals}-${m.homeGoals}`
                          : "—";
                      return (
                        <tr
                          key={i}
                          className="border-b border-[var(--color-border)]/50"
                        >
                          <td className="py-1.5 px-2 text-[var(--color-text-dim)] tabular-nums">
                            {m.kickoffUtc?.substring(0, 10)}
                          </td>
                          <td className="py-1.5 px-2">{opponent}</td>
                          <td className="py-1.5 px-2 text-center text-[var(--color-text-dim)]">
                            {isHome ? "H" : "A"}
                          </td>
                          <td className="py-1.5 px-2 text-center tabular-nums">
                            {score}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {res && (
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  res === "W"
                                    ? "text-[var(--color-green)] border-[var(--color-green)]/30 bg-[var(--color-green)]/10"
                                    : res === "L"
                                      ? "text-[var(--color-red)] border-[var(--color-red)]/30 bg-[var(--color-red)]/10"
                                      : "text-[var(--color-yellow)] border-[var(--color-yellow)]/30 bg-[var(--color-yellow)]/10"
                                }`}
                              >
                                {res}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-[var(--color-text-dim)]">
                            {m.league}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            key: "odds",
            label: `Odds (${oddsSnapshots.length})`,
            color: "#eab308",
            content: (
              <div>
                {oddsSnapshots.length > 0 ? (
                  <>
                    <L1OddsChart odds={oddsSnapshots} teamName={teamName} />
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
                            <th className="text-left py-2 px-2">Opponent</th>
                            <th className="text-center py-2 px-2">H/A</th>
                            <th className="text-center py-2 px-2">Kickoff</th>
                            <th className="text-right py-2 px-2">Home %</th>
                            <th className="text-right py-2 px-2">Draw %</th>
                            <th className="text-right py-2 px-2">Away %</th>
                            <th className="text-right py-2 px-2">Books</th>
                          </tr>
                        </thead>
                        <tbody>
                          {oddsSnapshots.map((o, i) => {
                            const isHome = o.homeTeam === teamName;
                            const opponent = isHome ? o.awayTeam : o.homeTeam;
                            return (
                              <tr key={i} className="border-b border-[var(--color-border)]/50">
                                <td className="py-1.5 px-2">{opponent}</td>
                                <td className="py-1.5 px-2 text-center text-[var(--color-text-dim)]">
                                  {isHome ? "H" : "A"}
                                </td>
                                <td className="py-1.5 px-2 text-center tabular-nums text-[var(--color-text-dim)]">
                                  {o.kickoff?.substring(0, 10)}
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums">
                                  {(o.impliedProb.home * 100).toFixed(1)}%
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-[var(--color-text-dim)]">
                                  {(o.impliedProb.draw * 100).toFixed(1)}%
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums">
                                  {(o.impliedProb.away * 100).toFixed(1)}%
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-[var(--color-text-dim)]">
                                  {o.bookmakerCount}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[var(--color-text-dim)]">No odds snapshots for this team.</p>
                )}
              </div>
            ),
          },
          ...(injuries.length > 0
            ? [
                {
                  key: "injuries",
                  label: `Injuries (${injuries.length})`,
                  color: "#f97316",
                  content: (
                    <div>
                      {injuriesFetchedAt && (
                        <p className="text-[10px] text-[var(--color-text-dim)] mb-3">
                          Snapshot: {injuriesFetchedAt}
                        </p>
                      )}
                      <div className="space-y-1">
                        {injuries.map((inj, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 text-xs border-b border-[var(--color-border)]/50 py-1.5"
                          >
                            <span className="font-medium">{inj.playerName}</span>
                            <span className="text-[var(--color-text-dim)]">{inj.position}</span>
                            <span className="text-[#f97316]">{inj.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
              ]
            : []),
          ...(newsEvents.length > 0
            ? [
                {
                  key: "news",
                  label: `News (${newsEvents.length})`,
                  color: "#ef4444",
                  content: (
                    <div>
                      {newsComputedAt && (
                        <p className="text-[10px] text-[var(--color-text-dim)] mb-3">
                          Snapshot: {newsComputedAt}
                        </p>
                      )}
                      <div className="space-y-2">
                        {newsEvents.map((ev, i) => (
                          <div
                            key={i}
                            className="border border-[var(--color-border)] rounded p-2 text-xs"
                          >
                            <span className="text-[#ef4444] font-bold mr-2">{ev.label}</span>
                            <span>{ev.headline}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />

      {/* Provenance */}
      <L1Provenance provenance={provenance} />

      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        L1 Facts &middot; {teamName}
      </footer>
    </main>
  );
}
