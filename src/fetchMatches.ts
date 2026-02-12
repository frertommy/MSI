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
const SEASONS = [2020, 2021, 2022, 2023, 2024];
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

  // Build list of fetches needed (skip already downloaded)
  const toFetch: { league: string; season: number }[] = [];
  const existing: { league: string; season: number; file: string }[] = [];

  for (const league of LEAGUES) {
    for (const season of SEASONS) {
      const rawFile = path.join(rawDir, `${league}_${season}.json`);
      if (fs.existsSync(rawFile)) {
        const stat = fs.statSync(rawFile);
        if (stat.size > 100) {
          existing.push({ league, season, file: rawFile });
          continue;
        }
      }
      toFetch.push({ league, season });
    }
  }

  console.log(`Already have ${existing.length} files, need to fetch ${toFetch.length} more`);

  // Fetch new files
  let fetchCount = 0;
  for (const { league, season } of toFetch) {
    fetchCount++;
    const url = `${BASE_URL}/competitions/${league}/matches?season=${season}&status=FINISHED`;
    console.log(
      `[${fetchCount}/${toFetch.length}] Fetching ${league} ${seasonLabel(season)}...`
    );

    try {
      const data = fetchWithRetry(url);

      // Check for error response (free tier limit)
      if (data.errorCode || data.error) {
        console.warn(`  Blocked: ${data.message || data.error}. Skipping.`);
      } else {
        const rawFile = path.join(rawDir, `${league}_${season}.json`);
        fs.writeFileSync(rawFile, JSON.stringify(data, null, 2));
        const count = data.matches?.length ?? 0;
        console.log(`  Saved ${rawFile} (${count} matches)`);
        if (count > 0) {
          existing.push({ league, season, file: rawFile });
        }
      }
    } catch (err: any) {
      console.warn(`  Failed: ${err.message?.substring(0, 100)}. Skipping season.`);
    }

    // Rate limit delay
    if (fetchCount < toFetch.length) {
      console.log(`  Waiting ${DELAY_MS / 1000}s for rate limit...`);
      sleep(DELAY_MS);
    }
  }

  // Parse all raw files into matches
  const allMatches: Match[] = [];
  const teamRegistry: Record<
    string,
    { league: string; country: string; matchesPlayed: number }
  > = {};

  for (const { league, season, file } of existing) {
    const matches = parseRawFile(file, league, season);
    for (const match of matches) {
      allMatches.push(match);
      for (const team of [match.homeTeam, match.awayTeam]) {
        if (!teamRegistry[team]) {
          teamRegistry[team] = {
            league,
            country: LEAGUE_COUNTRY[league],
            matchesPlayed: 0,
          };
        }
        teamRegistry[team].matchesPlayed++;
      }
    }
  }

  // Sort all matches by date ascending
  allMatches.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Save combined matches
  const matchesFile = path.join(dataDir, "matches_all.json");
  fs.writeFileSync(matchesFile, JSON.stringify(allMatches, null, 2));
  console.log(`\nSaved ${matchesFile}`);

  // Save team registry
  const teamsFile = path.join(dataDir, "teams_registry.json");
  fs.writeFileSync(teamsFile, JSON.stringify(teamRegistry, null, 2));
  console.log(`Saved ${teamsFile}`);

  // Print summary
  console.log("\n━━━ Fetch Summary ━━━");
  console.log(`Total matches: ${allMatches.length}`);

  // Per league per season
  const byLeagueSeason: Record<string, Record<string, number>> = {};
  for (const m of allMatches) {
    if (!byLeagueSeason[m.league]) byLeagueSeason[m.league] = {};
    byLeagueSeason[m.league][m.season] = (byLeagueSeason[m.league][m.season] || 0) + 1;
  }

  for (const league of LEAGUES) {
    const seasons = byLeagueSeason[league] || {};
    const parts = Object.entries(seasons)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([s, c]) => `${s}: ${c}`);
    const total = Object.values(seasons).reduce((a, b) => a + b, 0);
    console.log(`  ${league} (${total} total): ${parts.join(", ")}`);
  }

  const dates = allMatches.map((m) => m.date);
  console.log(
    `Date range: ${dates[0]?.substring(0, 10)} to ${dates[dates.length - 1]?.substring(0, 10)}`
  );
  console.log(`Unique teams: ${Object.keys(teamRegistry).length}`);
}

main();
