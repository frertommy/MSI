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
const SEASONS = [2023, 2024];
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

function main() {
  const rawDir = path.join(__dirname, "..", "data", "raw");
  const dataDir = path.join(__dirname, "..", "data");
  fs.mkdirSync(rawDir, { recursive: true });

  const allMatches: Match[] = [];
  const teamRegistry: Record<
    string,
    { league: string; country: string; matchesPlayed: number }
  > = {};

  let callCount = 0;
  const totalCalls = LEAGUES.length * SEASONS.length;

  for (const league of LEAGUES) {
    for (const season of SEASONS) {
      callCount++;
      const url = `${BASE_URL}/competitions/${league}/matches?season=${season}&status=FINISHED`;
      console.log(
        `[${callCount}/${totalCalls}] Fetching ${league} ${seasonLabel(season)}...`
      );

      const data = fetchWithRetry(url);

      // Save raw response
      const rawFile = path.join(rawDir, `${league}_${season}.json`);
      fs.writeFileSync(rawFile, JSON.stringify(data, null, 2));
      console.log(
        `  Saved ${rawFile} (${data.matches?.length ?? 0} matches)`
      );

      // Parse matches
      if (data.matches && Array.isArray(data.matches)) {
        for (const m of data.matches) {
          const homeTeam = m.homeTeam?.name ?? "Unknown";
          const awayTeam = m.awayTeam?.name ?? "Unknown";
          const homeGoals = m.score?.fullTime?.home;
          const awayGoals = m.score?.fullTime?.away;

          if (homeGoals == null || awayGoals == null) continue;

          const match: Match = {
            id: m.id,
            date: m.utcDate,
            league,
            season: seasonLabel(season),
            homeTeam,
            awayTeam,
            homeGoals,
            awayGoals,
            matchday: m.matchday ?? 0,
          };
          allMatches.push(match);

          // Update team registry
          for (const team of [homeTeam, awayTeam]) {
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

      // Rate limit delay (skip after last call)
      if (callCount < totalCalls) {
        console.log(`  Waiting ${DELAY_MS / 1000}s for rate limit...`);
        sleep(DELAY_MS);
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

  const byLeague: Record<string, number> = {};
  for (const m of allMatches) {
    byLeague[m.league] = (byLeague[m.league] || 0) + 1;
  }
  for (const [league, count] of Object.entries(byLeague)) {
    console.log(`  ${league}: ${count} matches`);
  }

  const dates = allMatches.map((m) => m.date);
  console.log(
    `Date range: ${dates[0]?.substring(0, 10)} to ${dates[dates.length - 1]?.substring(0, 10)}`
  );
  console.log(`Unique teams: ${Object.keys(teamRegistry).length}`);
}

main();
