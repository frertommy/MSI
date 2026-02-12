import * as fs from "fs";
import * as path from "path";
import { computeElo, regressTowardMean, DEFAULT_CONFIG, TeamRating, EloConfig } from "./elo";

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

  // Load team registry for league info
  const registryFile = path.join(dataDir, "teams_registry.json");
  const teamRegistry: Record<string, { league: string; country: string; matchesPlayed: number }> =
    fs.existsSync(registryFile) ? JSON.parse(fs.readFileSync(registryFile, "utf-8")) : {};

  const config: EloConfig = { ...DEFAULT_CONFIG };
  const ratings: Record<string, TeamRating> = {};
  const teamLeague: Record<string, string> = {};

  function getOrCreate(team: string, league?: string): TeamRating {
    if (!ratings[team]) {
      // Determine league from match context, registry, or fallback
      const lg = league || teamRegistry[team]?.league || "";
      if (lg) teamLeague[team] = lg;
      const baseline = config.leagueBaseline[lg] ?? config.initialRating;
      ratings[team] = {
        team,
        rating: baseline,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        lastUpdated: "",
        ratingHistory: [],
      };
    }
    if (league && !teamLeague[team]) teamLeague[team] = league;
    return ratings[team];
  }

  // Detect season boundaries: when there's a 60+ day gap between matches
  let lastMatchDate: Date | null = null;
  let seasonBreakCount = 0;

  // Process matches chronologically
  for (const match of matches) {
    const matchDate = new Date(match.date);

    // Check for season break (60+ day gap)
    if (lastMatchDate) {
      const dayGap = (matchDate.getTime() - lastMatchDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dayGap >= 60) {
        seasonBreakCount++;
        console.log(
          `  Season break detected: ${lastMatchDate.toISOString().substring(0, 10)} → ${match.date.substring(0, 10)} (${Math.round(dayGap)} days gap)`
        );
        console.log(`  Applying ${(config.seasonRegression * 100).toFixed(0)}% regression to mean for ${Object.keys(ratings).length} teams`);

        // Apply regression toward league-adjusted mean for all existing teams
        for (const team of Object.values(ratings)) {
          const lg = teamLeague[team.team] || "";
          const mean = config.leagueBaseline[lg] ?? config.initialRating;
          const oldRating = team.rating;
          team.rating = regressTowardMean(oldRating, mean, config.seasonRegression);
          // Record the regression in history
          const dateStr = match.date.substring(0, 10);
          team.ratingHistory.push({ date: dateStr, rating: team.rating });
        }
      }
    }
    lastMatchDate = matchDate;

    const home = getOrCreate(match.homeTeam, match.league);
    const away = getOrCreate(match.awayTeam, match.league);

    const result = computeElo(
      home.rating,
      away.rating,
      match.homeGoals,
      match.awayGoals,
      config,
      match.league
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

  console.log(`Season breaks detected: ${seasonBreakCount}`);

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
