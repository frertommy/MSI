/**
 * L1 data source — reads from data_v1/l1_facts/canonical/ and raw listings.
 */
import fs from "fs";
import path from "path";
import type {
  DataSource,
  TeamSummary,
  FixtureSummary,
  OddsSnapshotSummary,
  TimeseriesPoint,
} from "./types";

const CANONICAL_DIR = path.join(process.cwd(), "data_v1", "l1_facts", "canonical");
const RAW_DIR = path.join(process.cwd(), "data_v1", "l1_facts", "raw");

function readCanonical<T>(filename: string): T | null {
  const filePath = path.join(CANONICAL_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/** Count files in a raw subdirectory */
function rawFileCount(subdir: string): number {
  const dir = path.join(RAW_DIR, subdir);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}

/** Latest ingest timestamp from a raw subdirectory */
function latestIngestTimestamp(subdir: string): string | null {
  const dir = path.join(RAW_DIR, subdir);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  // Parse timestamp from filename: "2026-02-18T12-04-26-143Z_matches_xxx.json"
  const match = files[0].match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)/);
  if (match) return match[1].replace(/-(\d{3}Z)$/, ".$1").replace(/-/g, ":").replace(/T(\d{2}):(\d{2}):(\d{2}):(\d+Z)/, "T$1:$2:$3.$4");
  return files[0];
}

class L1DataSource implements DataSource {
  getTeams(): TeamSummary[] {
    const teams = readCanonical<TeamSummary[]>("teams.json");
    return teams ?? [];
  }

  getTeamDetail(teamName: string) {
    const teams = this.getTeams();
    const team = teams.find((t) => t.name === teamName);
    if (!team) return null;

    const allFixtures = readCanonical<FixtureSummary[]>("fixtures.json") ?? [];
    const allResults = readCanonical<{ fixtureId: number; homeGoals: number; awayGoals: number; resultFinal: string }[]>("match_results.json") ?? [];
    const resultsMap = new Map(allResults.map((r) => [r.fixtureId, r]));

    const teamFixtures = allFixtures
      .filter((f) => f.homeTeam === teamName || f.awayTeam === teamName)
      .slice(-20)
      .map((f) => {
        const result = resultsMap.get(f.fixtureId);
        return {
          ...f,
          homeGoals: result?.homeGoals,
          awayGoals: result?.awayGoals,
          result: result?.resultFinal as "H" | "D" | "A" | undefined,
        };
      });

    const allOdds = readCanonical<OddsSnapshotSummary[]>("odds_snapshots.json") ?? [];
    const teamOdds = allOdds.filter(
      (o) => o.homeTeam === teamName || o.awayTeam === teamName
    );

    return { team, recentFixtures: teamFixtures, oddsSnapshots: teamOdds };
  }

  getTeamTimeseries(_teamName: string): TimeseriesPoint[] {
    // L1 canonical doesn't store timeseries — that's an L2 concern
    return [];
  }

  /** L1-specific: summary stats for the stub page */
  getSummary(): {
    teamCount: number;
    fixtureCount: number;
    oddsSnapshotCount: number;
    rawCounts: Record<string, number>;
    lastIngest: string | null;
  } {
    const teams = this.getTeams();
    const fixtures = readCanonical<any[]>("fixtures.json") ?? [];
    const odds = readCanonical<any[]>("odds_snapshots.json") ?? [];

    return {
      teamCount: teams.length,
      fixtureCount: fixtures.length,
      oddsSnapshotCount: odds.length,
      rawCounts: {
        matches: rawFileCount("matches"),
        odds: rawFileCount("odds"),
        injuries: rawFileCount("injuries"),
        news: rawFileCount("news"),
      },
      lastIngest: latestIngestTimestamp("matches"),
    };
  }
}

export const l1Source = new L1DataSource();
