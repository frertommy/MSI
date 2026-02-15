import { getRatings, getTeamsRegistry, getMSILive, LEAGUE_COUNTRY } from "@/lib/data";
import StatsBar from "./components/StatsBar";
import RankingsTable from "./components/RankingsTable";

export default function Home() {
  const ratings = getRatings();
  const registry = getTeamsRegistry();
  const liveData = getMSILive();

  // Build lookup for live ratings
  const liveLookup: Record<string, { msiLive: number; oddsAdj: number }> = {};
  if (liveData) {
    for (const r of liveData.ratings) {
      liveLookup[r.team] = { msiLive: r.msiLive, oddsAdj: r.oddsAdjustment };
    }
  }

  // Use live rankings order if available, otherwise base Elo
  const source = liveData ? liveData.ratings : ratings.teams;

  const teams = source.map((t, i) => {
    const baseTeam = ratings.teams.find((bt) => bt.team === t.team);
    const reg = registry[t.team];
    const live = liveLookup[t.team];
    return {
      rank: i + 1,
      team: t.team,
      league: reg?.league || "?",
      country: reg?.country || LEAGUE_COUNTRY[reg?.league] || "?",
      rating: baseTeam?.rating ?? 0,
      msiLive: live?.msiLive ?? baseTeam?.rating ?? 0,
      oddsAdj: live?.oddsAdj ?? 0,
      wins: baseTeam?.wins ?? 0,
      draws: baseTeam?.draws ?? 0,
      losses: baseTeam?.losses ?? 0,
      lastUpdated: baseTeam?.lastUpdated ?? "",
    };
  });

  const leagueSet = new Set(
    Object.values(registry).map((r) => r.league)
  );

  const leagueAvgs: Record<string, { sum: number; count: number }> = {};
  for (const t of teams) {
    const country = t.country;
    if (!leagueAvgs[country]) leagueAvgs[country] = { sum: 0, count: 0 };
    leagueAvgs[country].sum += t.msiLive;
    leagueAvgs[country].count++;
  }

  const hasOdds = liveData && !liveData.stale && liveData.oddsSource !== "none";

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
          {hasOdds && " · Enhanced with live bookmaker odds"}
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
          {hasOdds && (
            <span className="text-[10px] border border-[var(--color-green)]/30 rounded px-2 py-0.5 text-[var(--color-green)]">
              Odds Live
            </span>
          )}
          {liveData?.stale && (
            <span className="text-[10px] border border-[var(--color-yellow)]/30 rounded px-2 py-0.5 text-[var(--color-yellow)]">
              Odds Stale
            </span>
          )}
        </div>
        <p className="text-[10px] text-[var(--color-text-dim)]">
          Powered by football-data.org &middot; Engine: K=
          {ratings.config.kFactor}, Home={ratings.config.homeAdvantage},
          GoalMargin=ln
          {hasOdds && " · Odds: The Odds API"}
        </p>
      </div>

      {/* Stats Bar */}
      <StatsBar
        teamsRated={ratings.teams.length}
        matchesProcessed={ratings.matchesProcessed}
        leagues={leagueSet.size}
        topRating={teams[0]?.msiLive ?? 0}
        topTeam={teams[0]?.team ?? ""}
      />

      {/* Rankings Table */}
      <RankingsTable teams={teams} hasOdds={!!hasOdds} />

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
        MSI v2.0 &middot; Elo Engine: K={ratings.config.kFactor}, Home
        Advantage={ratings.config.homeAdvantage}, Goal Margin Multiplier=ln(|GD|+1)
        {hasOdds && ` · Odds blended at 15% weight`}
      </footer>
    </main>
  );
}
