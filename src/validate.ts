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

const clubEloReference = [
  { team: "Arsenal", elo: 2052, rank: 1 },
  { team: "Bayern Munich", elo: 1996, rank: 2 },
  { team: "Manchester City", elo: 1983, rank: 3 },
  { team: "Paris Saint-Germain", elo: 1969, rank: 4 },
  { team: "Barcelona", elo: 1949, rank: 5 },
  { team: "Liverpool", elo: 1941, rank: 6 },
  { team: "Inter Milan", elo: 1926, rank: 7 },
  { team: "Aston Villa", elo: 1924, rank: 8 },
  { team: "Real Madrid", elo: 1917, rank: 9 },
  { team: "Chelsea", elo: 1883, rank: 10 },
  { team: "Atlético Madrid", elo: 1871, rank: 11 },
  { team: "Napoli", elo: 1864, rank: 12 },
  { team: "Bayer Leverkusen", elo: 1861, rank: 13 },
  { team: "Newcastle", elo: 1842, rank: 14 },
  { team: "AC Milan", elo: 1838, rank: 15 },
  { team: "Juventus", elo: 1830, rank: 16 },
  { team: "Tottenham", elo: 1828, rank: 17 },
  { team: "Borussia Dortmund", elo: 1822, rank: 18 },
  { team: "Brighton", elo: 1808, rank: 19 },
  { team: "Marseille", elo: 1800, rank: 20 },
];

// Map football-data.org team names to ClubElo reference names
const NAME_MAP: Record<string, string> = {
  "Arsenal FC": "Arsenal",
  "FC Bayern München": "Bayern Munich",
  "Manchester City FC": "Manchester City",
  "Paris Saint-Germain FC": "Paris Saint-Germain",
  "FC Barcelona": "Barcelona",
  "Liverpool FC": "Liverpool",
  "FC Internazionale Milano": "Inter Milan",
  "Aston Villa FC": "Aston Villa",
  "Real Madrid CF": "Real Madrid",
  "Chelsea FC": "Chelsea",
  "Club Atlético de Madrid": "Atlético Madrid",
  "SSC Napoli": "Napoli",
  "Bayer 04 Leverkusen": "Bayer Leverkusen",
  "Newcastle United FC": "Newcastle",
  "AC Milan": "AC Milan",
  "Juventus FC": "Juventus",
  "Tottenham Hotspur FC": "Tottenham",
  "Borussia Dortmund": "Borussia Dortmund",
  "Brighton & Hove Albion FC": "Brighton",
  "Olympique de Marseille": "Marseille",
};

function assignRanks(values: number[], ascending: boolean = true): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => ascending ? a.v - b.v : b.v - a.v);
  const ranks = new Array(values.length);
  for (let i = 0; i < indexed.length; i++) {
    ranks[indexed[i].i] = i + 1;
  }
  return ranks;
}

function spearmanCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n <= 1) return 0;
  // Rank both arrays (higher rating = rank 1, so descending for ratings, ascending for ranks)
  const rankX = assignRanks(x, true);
  const rankY = assignRanks(y, true);
  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = rankX[i] - rankY[i];
    sumD2 += d * d;
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

function main() {
  const dataDir = path.join(__dirname, "..", "data");
  const ratingsFile = path.join(dataDir, "msi_ratings.json");

  if (!fs.existsSync(ratingsFile)) {
    console.error("msi_ratings.json not found. Run `npm run compute` first.");
    process.exit(1);
  }

  const ratingsData: RatingsFile = JSON.parse(
    fs.readFileSync(ratingsFile, "utf-8")
  );

  // Build a lookup from normalized name to MSI rank and rating
  const msiByName: Record<string, { rank: number; rating: number }> = {};
  for (let i = 0; i < ratingsData.teams.length; i++) {
    const t = ratingsData.teams[i];
    const normalized = NAME_MAP[t.team] || t.team;
    msiByName[normalized] = { rank: i + 1, rating: t.rating };
  }

  // Collect matched teams with their MSI ratings, then re-rank among themselves
  const matched: { team: string; ceRank: number; ceElo: number; msiRating: number; msiGlobalRank: number }[] = [];
  for (const ref of clubEloReference) {
    const msi = msiByName[ref.team];
    if (msi) {
      matched.push({ team: ref.team, ceRank: ref.rank, ceElo: ref.elo, msiRating: msi.rating, msiGlobalRank: msi.rank });
    }
  }

  // Re-rank matched teams by MSI rating (descending) to get MSI rank among these 20
  const byMsiRating = [...matched].sort((a, b) => b.msiRating - a.msiRating);
  const msiLocalRank: Record<string, number> = {};
  byMsiRating.forEach((t, i) => { msiLocalRank[t.team] = i + 1; });

  // Build comparison
  console.log("\n━━━ MSI vs ClubElo Validation ━━━\n");
  console.log(
    `${"#".padStart(3)} ${"Team".padEnd(25)} ${"CE Rank".padStart(8)} ${"MSI Rank".padStart(9)} ${"CE Elo".padStart(8)} ${"MSI Elo".padStart(9)} ${"Δ Rank".padStart(8)}`
  );
  console.log("─".repeat(80));

  const msiRatings: number[] = [];
  const ceElos: number[] = [];
  let totalAbsError = 0;
  let msiTop10InCeTop10 = 0;

  for (const ref of clubEloReference) {
    const m = matched.find((x) => x.team === ref.team);
    if (m) {
      const msiRank = msiLocalRank[ref.team];
      const rankDiff = msiRank - ref.rank;
      const rankDiffStr =
        rankDiff > 0 ? `+${rankDiff}` : rankDiff === 0 ? "=" : `${rankDiff}`;
      console.log(
        `${String(ref.rank).padStart(3)} ${ref.team.padEnd(25)} ${String(ref.rank).padStart(8)} ${String(msiRank).padStart(9)} ${String(ref.elo).padStart(8)} ${String(Math.round(m.msiRating)).padStart(9)} ${rankDiffStr.padStart(8)}`
      );
      msiRatings.push(m.msiRating);
      ceElos.push(ref.elo);
      totalAbsError += Math.abs(rankDiff);
      if (msiRank <= 10 && ref.rank <= 10) {
        msiTop10InCeTop10++;
      }
    } else {
      console.log(
        `${String(ref.rank).padStart(3)} ${ref.team.padEnd(25)} ${String(ref.rank).padStart(8)} ${"N/A".padStart(9)} ${String(ref.elo).padStart(8)} ${"N/A".padStart(9)} ${"N/A".padStart(8)}`
      );
    }
  }

  console.log("─".repeat(80));

  const matchedCount = matched.length;

  // Spearman rank correlation (using ratings — the function will rank internally)
  const spearman = spearmanCorrelation(msiRatings, ceElos);
  const mae = matchedCount > 0 ? totalAbsError / matchedCount : 0;

  console.log(`\nMatched teams: ${matchedCount} / ${clubEloReference.length}`);
  console.log(`Spearman rank correlation: ${spearman.toFixed(4)}`);
  console.log(`Mean absolute rank error:  ${mae.toFixed(2)}`);
  console.log(
    `MSI top 10 in ClubElo top 10: ${msiTop10InCeTop10} / 10`
  );

  // Note about rating scale difference
  console.log(
    `\nNote: ClubElo uses a different initial rating and longer history,`
  );
  console.log(
    `so absolute Elo values will differ. Rank correlation is the key metric.`
  );
}

main();
