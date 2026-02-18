/**
 * L2 data source — reads from data_v1/l2_derived/runs/<run_id>/.
 */
import fs from "fs";
import path from "path";
import type {
  L2DataSource,
  TeamSummary,
  FixtureSummary,
  OddsSnapshotSummary,
  TimeseriesPoint,
  RunInfo,
  MSIRatingSummary,
} from "./types";

const L2_DIR = path.join(process.cwd(), "data_v1", "l2_derived");
const RUNS_DIR = path.join(L2_DIR, "runs");

function readRunFile<T>(runId: string, filename: string): T | null {
  const filePath = path.join(RUNS_DIR, runId, filename);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export interface TeamDerived {
  team: string;
  league: string;
  msiBase: number;
  msiOdds: number;
  msiFinal: number;
  confidence: number;
  oddsAdjustment: number;
  injuryAdjustment: number;
  newsAdjustment: number;
  oraclePrice: number | undefined;
  oracleConfidence: number | undefined;
  nextFixture: {
    opponent: string;
    date: string;
    marketWinProb: number;
    predictedWinProb: number;
    isHome: boolean;
  } | null;
  explainJson: Record<string, unknown>;
  timeseries: { date: string; baseElo: number; eloOdds?: number }[];
}

export interface ModelParams {
  K: number;
  homeAdvantage: number;
  goalMarginFactor: boolean;
  seasonRegression: number;
  oddsBlendWeight: number;
  oddsLiveWeight: number;
  oracle: { P0: number; beta: number; MSI0: number };
  [key: string]: unknown;
}

class L2Source implements L2DataSource {
  getLatestRun(): RunInfo | null {
    const latestFile = path.join(L2_DIR, "latest_run.json");
    if (!fs.existsSync(latestFile)) return null;
    return JSON.parse(fs.readFileSync(latestFile, "utf-8"));
  }

  listRuns(): RunInfo[] {
    const versionsFile = path.join(L2_DIR, "model_versions.json");
    if (!fs.existsSync(versionsFile)) return [];
    const versions = JSON.parse(fs.readFileSync(versionsFile, "utf-8"));
    return versions.map((v: any) => ({
      runId: v.runId,
      createdAt: v.createdAt,
      name: v.name,
      gitCommit: v.gitCommit,
    }));
  }

  private resolveRunId(runId?: string): string | null {
    if (runId) return runId;
    const latest = this.getLatestRun();
    return latest?.runId ?? null;
  }

  getTeams(runId?: string): TeamSummary[] {
    const rid = this.resolveRunId(runId);
    if (!rid) return [];
    const ratingsFile = readRunFile<{ ratings: any[] }>(rid, "msi_ratings.json");
    if (!ratingsFile) return [];
    return ratingsFile.ratings.map((r: any, idx: number) => ({
      id: idx + 1,
      name: r.team,
      league: r.league,
      country: "",
      matchesPlayed: 0,
    }));
  }

  getTeamDetail(teamName: string, runId?: string) {
    const teams = this.getTeams(runId);
    const team = teams.find((t) => t.name === teamName);
    if (!team) return null;
    return {
      team,
      recentFixtures: [] as FixtureSummary[],
      oddsSnapshots: [] as OddsSnapshotSummary[],
    };
  }

  getTeamTimeseries(teamName: string, runId?: string): TimeseriesPoint[] {
    const rid = this.resolveRunId(runId);
    if (!rid) return [];
    const daily = readRunFile<Record<string, { date: string; baseElo: number; eloOdds: number }[]>>(
      rid,
      "msi_daily.json"
    );
    if (!daily || !daily[teamName]) return [];
    return daily[teamName];
  }

  getMSIRatings(runId?: string): MSIRatingSummary[] {
    const rid = this.resolveRunId(runId);
    if (!rid) return [];

    const ratingsFile = readRunFile<{ ratings: any[] }>(rid, "msi_ratings.json");
    if (!ratingsFile) return [];

    const oracleFile = readRunFile<{ prices: any[] }>(rid, "oracle_prices.json");
    const priceMap = new Map<string, number>();
    if (oracleFile) {
      for (const p of oracleFile.prices) {
        priceMap.set(p.team, p.oraclePrice);
      }
    }

    return ratingsFile.ratings.map((r: any) => ({
      team: r.team,
      league: r.league,
      msiBase: r.msiBase,
      msiOdds: r.msiOdds,
      msiFinal: r.msiFinal,
      confidence: r.confidence,
      oddsAdjustment: r.oddsAdjustment,
      injuryAdjustment: r.injuryAdjustment,
      newsAdjustment: r.newsAdjustment,
      oraclePrice: priceMap.get(r.team),
    }));
  }

  /** Full derived data for a single team */
  getTeamDerived(teamName: string, runId?: string): TeamDerived | null {
    const rid = this.resolveRunId(runId);
    if (!rid) return null;

    const ratingsFile = readRunFile<{ ratings: any[] }>(rid, "msi_ratings.json");
    if (!ratingsFile) return null;

    const rating = ratingsFile.ratings.find((r: any) => r.team === teamName);
    if (!rating) return null;

    const oracleFile = readRunFile<{ prices: any[] }>(rid, "oracle_prices.json");
    const oracleEntry = oracleFile?.prices?.find((p: any) => p.team === teamName);

    const timeseries = this.getTeamTimeseries(teamName, rid);

    return {
      team: rating.team,
      league: rating.league,
      msiBase: rating.msiBase,
      msiOdds: rating.msiOdds,
      msiFinal: rating.msiFinal,
      confidence: rating.confidence,
      oddsAdjustment: rating.oddsAdjustment,
      injuryAdjustment: rating.injuryAdjustment,
      newsAdjustment: rating.newsAdjustment,
      oraclePrice: oracleEntry?.oraclePrice,
      oracleConfidence: oracleEntry?.oracleConfidence,
      nextFixture: rating.nextFixture ?? null,
      explainJson: rating.explainJson ?? {},
      timeseries,
    };
  }

  /** Model params for a run */
  getModelParams(runId?: string): ModelParams | null {
    const rid = this.resolveRunId(runId);
    if (!rid) return null;
    const mv = readRunFile<{ paramsJson: any }>(rid, "model_version.json");
    return mv?.paramsJson ?? null;
  }

  getSummary() {
    const latest = this.getLatestRun();
    const runs = this.listRuns();
    let teamCount = 0;
    if (latest) {
      const ratings = this.getMSIRatings(latest.runId);
      teamCount = ratings.length;
    }
    return {
      latestRunId: latest?.runId ?? null,
      createdAt: latest?.createdAt ?? null,
      teamCount,
      totalRuns: runs.length,
    };
  }
}

export const l2Source = new L2Source();
