/**
 * v0 data source — wraps existing lib/data.ts filesystem reads.
 *
 * This exists purely as an adapter to the DataSource interface.
 * It does NOT change any v0 behavior or paths.
 */
import {
  getRatings,
  getMatches,
  getTeamsRegistry,
  getMSILive,
  LEAGUE_LABELS,
  LEAGUE_COUNTRY,
} from "../data";
import type {
  DataSource,
  TeamSummary,
  FixtureSummary,
  OddsSnapshotSummary,
  TimeseriesPoint,
} from "./types";

class V0DataSource implements DataSource {
  getTeams(): TeamSummary[] {
    const registry = getTeamsRegistry();
    const ratings = getRatings();
    return ratings.teams.map((t, idx) => {
      const reg = registry[t.team];
      return {
        id: idx + 1,
        name: t.team,
        league: reg?.league || "?",
        country: reg?.country || LEAGUE_COUNTRY[reg?.league] || "?",
        matchesPlayed: t.matches,
      };
    });
  }

  getTeamDetail(teamName: string) {
    const teams = this.getTeams();
    const team = teams.find((t) => t.name === teamName);
    if (!team) return null;

    const allMatches = getMatches();
    const teamMatches = allMatches.filter(
      (m) => m.homeTeam === teamName || m.awayTeam === teamName
    );
    const recentFixtures: FixtureSummary[] = teamMatches.slice(-20).map((m) => ({
      fixtureId: m.id,
      season: m.season,
      league: m.league,
      kickoffUtc: m.date,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      result: (m.homeGoals > m.awayGoals ? "H" : m.homeGoals < m.awayGoals ? "A" : "D") as "H" | "D" | "A",
    }));

    return { team, recentFixtures, oddsSnapshots: [] as OddsSnapshotSummary[] };
  }

  getTeamTimeseries(teamName: string): TimeseriesPoint[] {
    const ratings = getRatings();
    const team = ratings.teams.find((t) => t.team === teamName);
    if (!team) return [];
    return team.ratingHistory.map((h) => ({
      date: h.date,
      baseElo: h.rating,
    }));
  }
}

export const v0Source = new V0DataSource();
