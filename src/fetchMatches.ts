import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
if (!API_KEY) {
  console.error("Missing FOOTBALL_DATA_API_KEY in .env");
  process.exit(1);
}

const BASE_URL = "https://api.football-data.org/v4";
const LEAGUES = ["PL", "PD", "BL1", "SA", "FL1"];
const API_SEASONS = [2023, 2024];
const DELAY_MS = 7000;

const LEAGUE_COUNTRY: Record<string, string> = {
  PL: "ENG",
  PD: "ESP",
  BL1: "GER",
  SA: "ITA",
  FL1: "FRA",
};

interface Match {
  id: number;
  date: string;
  league: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  matchday: number;
}

function sleep(ms: number): void {
  execSync(`sleep ${ms / 1000}`);
}

function fetchJSON(url: string): any {
  const cmd = `curl -s --max-time 60 "${url}" -H "X-Auth-Token: ${API_KEY}"`;
  const result = execSync(cmd, { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
  return JSON.parse(result);
}

function fetchWithRetry(url: string): any {
  try {
    return fetchJSON(url);
  } catch (err) {
    console.warn(`  First attempt failed, retrying in 10s...`);
    sleep(10000);
    return fetchJSON(url);
  }
}

function seasonLabel(year: number): string {
  return `${year}-${year + 1}`;
}

function parseRawFile(filePath: string, league: string, season: number): Match[] {
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const matches: Match[] = [];
  if (data.matches && Array.isArray(data.matches)) {
    for (const m of data.matches) {
      const homeTeam = m.homeTeam?.name ?? "Unknown";
      const awayTeam = m.awayTeam?.name ?? "Unknown";
      const homeGoals = m.score?.fullTime?.home;
      const awayGoals = m.score?.fullTime?.away;
      if (homeGoals == null || awayGoals == null) continue;
      matches.push({
        id: m.id,
        date: m.utcDate,
        league,
        season: seasonLabel(season),
        homeTeam,
        awayTeam,
        homeGoals,
        awayGoals,
        matchday: m.matchday ?? 0,
      });
    }
  }
  return matches;
}

function main() {
  const rawDir = path.join(__dirname, "..", "data", "raw");
  const dataDir = path.join(__dirname, "..", "data");
  fs.mkdirSync(rawDir, { recursive: true });

  // ── Step 1: Load historical data (from football-data.co.uk CSVs) ──
  const historicalFile = path.join(dataDir, "matches_historical.json");
  let historicalMatches: Match[] = [];
  if (fs.existsSync(historicalFile)) {
    historicalMatches = JSON.parse(fs.readFileSync(historicalFile, "utf-8"));
    console.log(`Loaded ${historicalMatches.length} historical matches from CSVs`);
  } else {
    console.log("No historical data found. Run `npm run fetch:historical` first.");
  }

  // ── Step 2: Load/fetch API data (football-data.org, 2023-2025) ──
  const toFetch: { league: string; season: number }[] = [];
  const existing: { league: string; season: number; file: string }[] = [];

  for (const league of LEAGUES) {
    for (const season of API_SEASONS) {
      const rawFile = path.join(rawDir, `${league}_${season}.json`);
      if (fs.existsSync(rawFile) && fs.statSync(rawFile).size > 100) {
        existing.push({ league, season, file: rawFile });
      } else {
        toFetch.push({ league, season });
      }
    }
  }

  console.log(`API data: ${existing.length} cached, ${toFetch.length} to fetch`);

  let fetchCount = 0;
  for (const { league, season } of toFetch) {
    fetchCount++;
    const url = `${BASE_URL}/competitions/${league}/matches?season=${season}&status=FINISHED`;
    console.log(`[${fetchCount}/${toFetch.length}] Fetching ${league} ${seasonLabel(season)}...`);

    try {
      const data = fetchWithRetry(url);
      if (data.errorCode || data.error) {
        console.warn(`  Blocked: ${data.message || data.error}. Skipping.`);
      } else {
        const rawFile = path.join(rawDir, `${league}_${season}.json`);
        fs.writeFileSync(rawFile, JSON.stringify(data, null, 2));
        const count = data.matches?.length ?? 0;
        console.log(`  Saved (${count} matches)`);
        if (count > 0) existing.push({ league, season, file: rawFile });
      }
    } catch (err: any) {
      console.warn(`  Failed: ${err.message?.substring(0, 100)}. Skipping.`);
    }
    if (fetchCount < toFetch.length) { sleep(DELAY_MS); }
  }

  const apiMatches: Match[] = [];
  for (const { league, season, file } of existing) {
    apiMatches.push(...parseRawFile(file, league, season));
  }
  console.log(`Loaded ${apiMatches.length} API matches`);

  // ── Step 3: Merge + deduplicate ──
  // Historical covers 2015-2025 from CSVs, API covers 2023-2025 with higher quality.
  // For the overlap (2023-2024, 2024-2025), prefer API data.
  // Dedup key: date (YYYY-MM-DD) + homeTeam + awayTeam

  const apiKeys = new Set<string>();
  for (const m of apiMatches) {
    const key = `${m.date.substring(0, 10)}|${m.homeTeam}|${m.awayTeam}`;
    apiKeys.add(key);
  }

  // Filter historical: keep matches that DON'T have an API equivalent
  const filteredHistorical = historicalMatches.filter((m) => {
    const key = `${m.date.substring(0, 10)}|${m.homeTeam}|${m.awayTeam}`;
    return !apiKeys.has(key);
  });

  const dupsRemoved = historicalMatches.length - filteredHistorical.length;
  console.log(`Deduplication: removed ${dupsRemoved} historical matches (covered by API)`);

  const allMatches = [...filteredHistorical, ...apiMatches];
  allMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ── Step 4: Build team registry ──
  const teamRegistry: Record<string, { league: string; country: string; matchesPlayed: number }> = {};
  for (const match of allMatches) {
    for (const team of [match.homeTeam, match.awayTeam]) {
      if (!teamRegistry[team]) {
        teamRegistry[team] = {
          league: match.league,
          country: LEAGUE_COUNTRY[match.league],
          matchesPlayed: 0,
        };
      }
      teamRegistry[team].matchesPlayed++;
    }
  }

  // ── Step 5: Save ──
  const matchesFile = path.join(dataDir, "matches_all.json");
  fs.writeFileSync(matchesFile, JSON.stringify(allMatches, null, 2));
  console.log(`\nSaved ${matchesFile}`);

  const teamsFile = path.join(dataDir, "teams_registry.json");
  fs.writeFileSync(teamsFile, JSON.stringify(teamRegistry, null, 2));
  console.log(`Saved ${teamsFile}`);

  // ── Summary ──
  console.log("\n━━━ Merge Summary ━━━");
  console.log(`Total matches: ${allMatches.length}`);
  console.log(`  Historical (CSV): ${filteredHistorical.length}`);
  console.log(`  API (JSON):       ${apiMatches.length}`);
  console.log(`  Duplicates removed: ${dupsRemoved}`);

  const byLeagueSeason: Record<string, Record<string, number>> = {};
  for (const m of allMatches) {
    if (!byLeagueSeason[m.league]) byLeagueSeason[m.league] = {};
    byLeagueSeason[m.league][m.season] = (byLeagueSeason[m.league][m.season] || 0) + 1;
  }

  for (const league of LEAGUES) {
    const seasons = byLeagueSeason[league] || {};
    const total = Object.values(seasons).reduce((a, b) => a + b, 0);
    console.log(`  ${league}: ${total} total`);
  }

  if (allMatches.length > 0) {
    console.log(`Date range: ${allMatches[0].date.substring(0, 10)} to ${allMatches[allMatches.length - 1].date.substring(0, 10)}`);
  }
  console.log(`Unique teams: ${Object.keys(teamRegistry).length}`);
}

main();
