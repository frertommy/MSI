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

function rawFileCount(subdir: string): number {
  const dir = path.join(RAW_DIR, subdir);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).length;
}

function rawFileList(subdir: string): { name: string; size: number }[] {
  const dir = path.join(RAW_DIR, subdir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, size: stat.size };
    });
}

function latestIngestTimestamp(subdir: string): string | null {
  const dir = path.join(RAW_DIR, subdir);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  const match = files[0].match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+Z)/);
  if (match) return match[1];
  return files[0];
}

// Canonical result shape
interface CanonicalResult {
  fixtureId: number;
  homeGoals: number;
  awayGoals: number;
  resultFinal: string;
  source: string;
}

export interface TeamFacts {
  team: TeamSummary;
  allFixtures: FixtureSummary[];
  matchResults: (FixtureSummary & { homeGoals?: number; awayGoals?: number; result?: string })[];
  oddsSnapshots: OddsSnapshotSummary[];
  injuries: { playerName: string; position: string; reason: string }[];
  injuriesFetchedAt: string | null;
  newsEvents: { type: string; label: string; headline: string; newsAdjustment: number }[];
  newsComputedAt: string | null;
  provenance: { source: string; files: { name: string; size: number }[] }[];
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
    const allResults = readCanonical<CanonicalResult[]>("match_results.json") ?? [];
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

  /** Full facts for a team — matches, odds, injuries, news, provenance */
  getTeamFacts(teamName: string): TeamFacts | null {
    const teams = this.getTeams();
    const team = teams.find((t) => t.name === teamName);
    if (!team) return null;

    // Fixtures + results
    const allFixtures = readCanonical<FixtureSummary[]>("fixtures.json") ?? [];
    const allResults = readCanonical<CanonicalResult[]>("match_results.json") ?? [];
    const resultsMap = new Map(allResults.map((r) => [r.fixtureId, r]));

    const teamFixtures = allFixtures.filter(
      (f) => f.homeTeam === teamName || f.awayTeam === teamName
    );

    const matchResults = teamFixtures.map((f) => {
      const result = resultsMap.get(f.fixtureId);
      return {
        ...f,
        homeGoals: result?.homeGoals,
        awayGoals: result?.awayGoals,
        result: result?.resultFinal as "H" | "D" | "A" | undefined,
      };
    });

    // Odds snapshots
    const allOdds = readCanonical<OddsSnapshotSummary[]>("odds_snapshots.json") ?? [];
    const teamOdds = allOdds.filter(
      (o) => o.homeTeam === teamName || o.awayTeam === teamName
    );

    // Injuries from latest raw snapshot
    let injuries: { playerName: string; position: string; reason: string }[] = [];
    let injuriesFetchedAt: string | null = null;
    const injFiles = rawFileList("injuries");
    if (injFiles.length > 0) {
      try {
        const injPath = path.join(RAW_DIR, "injuries", injFiles[0].name);
        const raw = JSON.parse(fs.readFileSync(injPath, "utf-8"));
        const injData = raw.data ?? raw;
        injuriesFetchedAt = injData.fetchedAt ?? raw.fetchedAt ?? null;
        const teamInjData = injData.teams?.[teamName];
        if (teamInjData?.injuries) {
          injuries = teamInjData.injuries;
        }
      } catch { /* ignore */ }
    }

    // News from latest raw snapshot
    let newsEvents: { type: string; label: string; headline: string; newsAdjustment: number }[] = [];
    let newsComputedAt: string | null = null;
    const newsFiles = rawFileList("news");
    if (newsFiles.length > 0) {
      try {
        const newsPath = path.join(RAW_DIR, "news", newsFiles[0].name);
        const raw = JSON.parse(fs.readFileSync(newsPath, "utf-8"));
        const newsData = raw.data ?? raw;
        newsComputedAt = newsData.computedAt ?? raw.fetchedAt ?? null;
        const teamNewsData = newsData.teams?.[teamName];
        if (teamNewsData?.events) {
          newsEvents = teamNewsData.events.map((e: any) => ({
            type: e.type,
            label: e.label,
            headline: e.headline,
            newsAdjustment: teamNewsData.newsAdjustment ?? 0,
          }));
        }
      } catch { /* ignore */ }
    }

    // Provenance — list raw snapshot files used
    const provenance = [
      { source: "matches", files: rawFileList("matches") },
      { source: "odds", files: rawFileList("odds") },
      { source: "injuries", files: rawFileList("injuries") },
      { source: "news", files: rawFileList("news") },
    ];

    return {
      team,
      allFixtures: teamFixtures,
      matchResults,
      oddsSnapshots: teamOdds,
      injuries,
      injuriesFetchedAt,
      newsEvents,
      newsComputedAt,
      provenance,
    };
  }

  getTeamTimeseries(_teamName: string): TimeseriesPoint[] {
    return [];
  }

  getSummary() {
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
