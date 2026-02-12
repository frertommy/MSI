import * as fs from "fs";
import * as path from "path";

interface TeamRating {
  team: string;
  rating: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  lastUpdated: string;
  ratingHistory: { date: string; rating: number }[];
}

interface RatingsFile {
  config: any;
  computedAt: string;
  matchesProcessed: number;
  teams: TeamRating[];
}

const LEAGUE_MAP: Record<string, string> = {};

// We need team->league mapping, so load from teams_registry.json
const LEAGUE_SHORT: Record<string, string> = {
  PL: "ENG",
  PD: "ESP",
  BL1: "GER",
  SA: "ITA",
  FL1: "FRA",
};

function main() {
  const dataDir = path.join(__dirname, "..", "data");
  const ratingsFile = path.join(dataDir, "msi_ratings.json");
  const teamsFile = path.join(dataDir, "teams_registry.json");

  if (!fs.existsSync(ratingsFile)) {
    console.error("msi_ratings.json not found. Run `npm run compute` first.");
    process.exit(1);
  }

  const ratingsData: RatingsFile = JSON.parse(
    fs.readFileSync(ratingsFile, "utf-8")
  );

  let teamRegistry: Record<
    string,
    { league: string; country: string; matchesPlayed: number }
  > = {};
  if (fs.existsSync(teamsFile)) {
    teamRegistry = JSON.parse(fs.readFileSync(teamsFile, "utf-8"));
  }

  const { teams, matchesProcessed } = ratingsData;

  // Determine date range from match data
  let dateRange = "";
  const matchesFile = path.join(dataDir, "matches_all.json");
  if (fs.existsSync(matchesFile)) {
    const allMatches = JSON.parse(fs.readFileSync(matchesFile, "utf-8"));
    if (allMatches.length > 0) {
      const firstYear = allMatches[0].date.substring(0, 4);
      const lastYear = allMatches[allMatches.length - 1].date.substring(0, 4);
      dateRange = `${firstYear}-${lastYear}`;
    }
  }

  // Header
  console.log(
    `\nMSI Rankings — Computed from ${matchesProcessed.toLocaleString()} real matches (${dateRange})`
  );
  console.log("━".repeat(70));
  console.log(
    `${"#".padStart(3)}   ${" Team".padEnd(30)} ${"League".padEnd(8)} ${"Rating".padStart(7)}  ${"W-D-L"}`
  );
  console.log("─".repeat(70));

  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    const reg = teamRegistry[t.team];
    const league = reg ? LEAGUE_SHORT[reg.league] || reg.league : "???";
    const wdl = `${t.wins}-${t.draws}-${t.losses}`;

    console.log(
      `${String(i + 1).padStart(3)}   ${t.team.padEnd(30)} ${league.padEnd(8)} ${Math.round(t.rating).toString().padStart(7)}  ${wdl}`
    );
  }

  console.log("━".repeat(70));

  // League averages
  const leagueRatings: Record<string, number[]> = {};
  for (const t of teams) {
    const reg = teamRegistry[t.team];
    if (reg) {
      const key = LEAGUE_SHORT[reg.league] || reg.league;
      if (!leagueRatings[key]) leagueRatings[key] = [];
      leagueRatings[key].push(t.rating);
    }
  }

  console.log("\nLeague Averages:");
  const avgs: string[] = [];
  for (const league of ["ENG", "ESP", "GER", "ITA", "FRA"]) {
    if (leagueRatings[league]) {
      const avg =
        leagueRatings[league].reduce((s, r) => s + r, 0) /
        leagueRatings[league].length;
      avgs.push(`${league}: ${Math.round(avg)}`);
    }
  }
  console.log("  " + avgs.join(" | "));
}

main();
