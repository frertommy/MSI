/**
 * L3 data source — reads from data_v1/l3_derived/runs/<run_id>/.
 */
import fs from "fs";
import path from "path";
import type { RunInfo } from "./types";

const L3_DIR = path.join(process.cwd(), "data_v1", "l3_derived");
const RUNS_DIR = path.join(L3_DIR, "runs");

function readRunFile<T>(runId: string, filename: string): T | null {
  const filePath = path.join(RUNS_DIR, runId, filename);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ── Types ──────────────────────────────────────────────────────────────

export interface L3RatingSummary {
  team: string;
  league: string;
  l3Rating: number;
  baseElo: number;
  marketConsensus: number;
  premium: number;
  oraclePrice: number;
  oracleConfidence: number;
  confidence: number;
  components: {
    matchImplied: number;
    matchCount: number;
    avgWinProb: number;
  };
  timestamp: string;
  dataFreshness: string;
}

export interface L3TeamDetail {
  team: string;
  league: string;
  l3Rating: number;
  baseElo: number;
  marketConsensus: number;
  premium: number;
  oraclePrice: number;
  oracleConfidence: number;
  confidence: number;
  components: {
    matchImplied: number;
    matchCount: number;
    avgWinProb: number;
  };
  timestamp: string;
  dataFreshness: string;
  timeseries: { date: string; baseElo: number; l3Rating: number; oraclePrice: number }[];
}

export interface L3Params {
  marketWeight: number;
  baseEloWeight: number;
  oracle: { P0: number; beta: number; MSI0: number };
  matchDecayDays: number;
}

// ── Data source class ──────────────────────────────────────────────────

class L3Source {
  getLatestRun(): RunInfo | null {
    const latestFile = path.join(L3_DIR, "latest_run.json");
    if (!fs.existsSync(latestFile)) return null;
    return JSON.parse(fs.readFileSync(latestFile, "utf-8"));
  }

  private resolveRunId(runId?: string): string | null {
    if (runId) return runId;
    const latest = this.getLatestRun();
    return latest?.runId ?? null;
  }

  getRatings(runId?: string): L3RatingSummary[] {
    const rid = this.resolveRunId(runId);
    if (!rid) return [];
    const file = readRunFile<{ ratings: L3RatingSummary[] }>(rid, "l3_ratings.json");
    return file?.ratings ?? [];
  }

  getTeamDetail(teamName: string, runId?: string): L3TeamDetail | null {
    const rid = this.resolveRunId(runId);
    if (!rid) return null;

    const file = readRunFile<{ ratings: L3RatingSummary[] }>(rid, "l3_ratings.json");
    if (!file) return null;

    const rating = file.ratings.find((r) => r.team === teamName);
    if (!rating) return null;

    // Load timeseries
    const daily = readRunFile<Record<string, { date: string; baseElo: number; l3Rating: number; oraclePrice: number }[]>>(
      rid,
      "l3_daily.json"
    );
    const timeseries = daily?.[teamName] ?? [];

    return { ...rating, timeseries };
  }

  getParams(runId?: string): L3Params | null {
    const rid = this.resolveRunId(runId);
    if (!rid) return null;
    const file = readRunFile<{ params: L3Params }>(rid, "l3_ratings.json");
    return file?.params ?? null;
  }

  getSummary() {
    const latest = this.getLatestRun();
    const ratings = this.getRatings();
    const withOdds = ratings.filter((r) => r.components.matchCount > 0);
    return {
      latestRunId: latest?.runId ?? null,
      createdAt: latest?.createdAt ?? null,
      teamCount: ratings.length,
      teamsWithOdds: withOdds.length,
      avgConfidence: ratings.length > 0
        ? Math.round(ratings.reduce((s, r) => s + r.confidence, 0) / ratings.length * 100) / 100
        : 0,
    };
  }
}

export const l3Source = new L3Source();
