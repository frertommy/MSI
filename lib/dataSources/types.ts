/**
 * Shared data source interfaces.
 *
 * All data sources (v0, l1, l2) implement these interfaces so the FE
 * can switch between them via a single import swap.
 */

export interface TeamSummary {
  id: number;
  name: string;
  league: string;
  country: string;
  matchesPlayed: number;
}

export interface FixtureSummary {
  fixtureId: number;
  season: string;
  league: string;
  kickoffUtc: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals?: number;
  awayGoals?: number;
  result?: "H" | "D" | "A";
}

export interface OddsSnapshotSummary {
  externalFixtureId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  avgOdds: { home: number; draw: number; away: number };
  impliedProb: { home: number; draw: number; away: number };
  bookmakerCount: number;
}

export interface MSIRatingSummary {
  team: string;
  league: string;
  msiBase: number;
  msiOdds: number;
  msiFinal: number;
  confidence: number;
  oddsAdjustment: number;
  injuryAdjustment: number;
  newsAdjustment: number;
  oraclePrice?: number;
}

export interface TimeseriesPoint {
  date: string;
  baseElo: number;
  eloOdds?: number;
}

export interface RunInfo {
  runId: string;
  createdAt: string;
  name?: string;
  gitCommit?: string;
}

export interface DataSource {
  getTeams(): TeamSummary[];
  getTeamDetail(teamName: string): {
    team: TeamSummary;
    recentFixtures: FixtureSummary[];
    oddsSnapshots: OddsSnapshotSummary[];
  } | null;
  getTeamTimeseries(teamName: string): TimeseriesPoint[];
}

export interface L2DataSource extends DataSource {
  getLatestRun(): RunInfo | null;
  listRuns(): RunInfo[];
  getMSIRatings(runId?: string): MSIRatingSummary[];
}
