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

    // Load oracle prices if available
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

  /** L2-specific: summary stats for the stub page */
  getSummary(): {
    latestRunId: string | null;
    createdAt: string | null;
    teamCount: number;
    totalRuns: number;
  } {
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
