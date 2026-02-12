import * as fs from "fs";
import * as path from "path";
import { computeElo, DEFAULT_CONFIG, TeamRating, EloConfig } from "./elo";

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

function main() {
  const dataDir = path.join(__dirname, "..", "data");
  const matchesFile = path.join(dataDir, "matches_all.json");

  if (!fs.existsSync(matchesFile)) {
    console.error("matches_all.json not found. Run `npm run fetch` first.");
    process.exit(1);
  }

  const matches: Match[] = JSON.parse(fs.readFileSync(matchesFile, "utf-8"));
  console.log(`Loaded ${matches.length} matches`);

  const config: EloConfig = { ...DEFAULT_CONFIG };
  const ratings: Record<string, TeamRating> = {};

  function getOrCreate(team: string): TeamRating {
    if (!ratings[team]) {
      ratings[team] = {
        team,
        rating: config.initialRating,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        lastUpdated: "",
        ratingHistory: [],
      };
    }
    return ratings[team];
  }

  // Process matches chronologically
  for (const match of matches) {
    const home = getOrCreate(match.homeTeam);
    const away = getOrCreate(match.awayTeam);

    const result = computeElo(
      home.rating,
      away.rating,
      match.homeGoals,
      match.awayGoals,
      config
    );

    // Update ratings
    home.rating = result.homeNewRating;
    away.rating = result.awayNewRating;

    // Update stats
    home.matches++;
    away.matches++;
    home.lastUpdated = match.date;
    away.lastUpdated = match.date;

    if (match.homeGoals > match.awayGoals) {
      home.wins++;
      away.losses++;
    } else if (match.homeGoals < match.awayGoals) {
      home.losses++;
      away.wins++;
    } else {
      home.draws++;
      away.draws++;
    }

    // Record history
    const dateStr = match.date.substring(0, 10);
    home.ratingHistory.push({ date: dateStr, rating: home.rating });
    away.ratingHistory.push({ date: dateStr, rating: away.rating });
  }

  // Sort teams by rating descending
  const sortedTeams = Object.values(ratings).sort(
    (a, b) => b.rating - a.rating
  );

  // Save ratings
  const ratingsOutput = {
    config,
    computedAt: new Date().toISOString(),
    matchesProcessed: matches.length,
    teams: sortedTeams,
  };
  const ratingsFile = path.join(dataDir, "msi_ratings.json");
  fs.writeFileSync(ratingsFile, JSON.stringify(ratingsOutput, null, 2));
  console.log(`Saved ${ratingsFile} (${sortedTeams.length} teams)`);

  // Build daily snapshots
  const dailySnapshots: Record<string, { date: string; rating: number }[]> = {};

  for (const team of sortedTeams) {
    const dayMap: Record<string, number> = {};
    for (const entry of team.ratingHistory) {
      dayMap[entry.date] = entry.rating; // last rating of the day wins
    }
    const sorted = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rating]) => ({ date, rating }));
    dailySnapshots[team.team] = sorted;
  }

  const dailyFile = path.join(dataDir, "msi_daily.json");
  fs.writeFileSync(dailyFile, JSON.stringify(dailySnapshots, null, 2));
  console.log(`Saved ${dailyFile}`);

  // Print top 20
  console.log("\n━━━ Top 20 MSI Ratings ━━━");
  for (let i = 0; i < Math.min(20, sortedTeams.length); i++) {
    const t = sortedTeams[i];
    console.log(
      `${String(i + 1).padStart(2)}.  ${t.team.padEnd(30)} ${Math.round(t.rating).toString().padStart(5)}  (${t.wins}W-${t.draws}D-${t.losses}L)`
    );
  }
}

main();
