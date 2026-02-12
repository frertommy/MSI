import { getRatings, getTeamsRegistry, LEAGUE_COUNTRY } from "@/lib/data";
import StatsBar from "./components/StatsBar";
import RankingsTable from "./components/RankingsTable";

export default function Home() {
  const ratings = getRatings();
  const registry = getTeamsRegistry();

  const teams = ratings.teams.map((t, i) => {
    const reg = registry[t.team];
    return {
      rank: i + 1,
      team: t.team,
      league: reg?.league || "?",
      country: reg?.country || LEAGUE_COUNTRY[reg?.league] || "?",
      rating: t.rating,
      wins: t.wins,
      draws: t.draws,
      losses: t.losses,
      lastUpdated: t.lastUpdated,
    };
  });

  const leagueSet = new Set(
    Object.values(registry).map((r) => r.league)
  );

  const leagueAvgs: Record<string, { sum: number; count: number }> = {};
  for (const t of ratings.teams) {
    const reg = registry[t.team];
    if (reg) {
      const country = reg.country;
      if (!leagueAvgs[country]) leagueAvgs[country] = { sum: 0, count: 0 };
      leagueAvgs[country].sum += t.rating;
      leagueAvgs[country].count++;
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          <span className="text-[var(--color-green)]">MSI</span>
          <span className="text-[var(--color-text-dim)] font-normal">
            {" "}
            — Match Strength Index
          </span>
        </h1>
        <p className="text-xs text-[var(--color-text-dim)] mb-3">
          Proprietary Elo ratings computed from{" "}
          {ratings.matchesProcessed.toLocaleString()}+ real match results
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-[10px] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text-dim)]">
            Independent
          </span>
          <span className="text-[10px] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text-dim)]">
            Not ClubElo
          </span>
          <span className="text-[10px] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text-dim)]">
            Not Opta
          </span>
        </div>
        <p className="text-[10px] text-[var(--color-text-dim)]">
          Powered by football-data.org &middot; Engine: K=
          {ratings.config.kFactor}, Home={ratings.config.homeAdvantage},
          GoalMargin=ln
        </p>
      </div>

      {/* Stats Bar */}
      <StatsBar
        teamsRated={ratings.teams.length}
        matchesProcessed={ratings.matchesProcessed}
        leagues={leagueSet.size}
        topRating={ratings.teams[0].rating}
        topTeam={ratings.teams[0].team}
      />

      {/* Rankings Table */}
      <RankingsTable teams={teams} />

      {/* League Averages */}
      <div className="mt-8 border-t border-[var(--color-border)] pt-4">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
          League Averages
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          {["ENG", "ESP", "GER", "ITA", "FRA"].map((c) => {
            const avg = leagueAvgs[c]
              ? Math.round(leagueAvgs[c].sum / leagueAvgs[c].count)
              : 0;
            return (
              <span key={c} className="tabular-nums">
                <span className="text-[var(--color-text-dim)]">{c}:</span>{" "}
                <span className="text-[var(--color-green)]">{avg}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-[var(--color-border)] pt-4 text-[10px] text-[var(--color-text-dim)]">
        MSI v1.0 &middot; Elo Engine: K={ratings.config.kFactor}, Home
        Advantage={ratings.config.homeAdvantage}, Goal Margin Multiplier=ln(|GD|+1)
      </footer>
    </main>
  );
}
