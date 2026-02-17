import * as fs from "fs";
import * as path from "path";
import {
  calculateOddsAdjustment,
  normalizeH2H,
  predictedWinProb,
} from "./oddsToElo";
import { calculateTeamInjuryImpact } from "./playerImportance";

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
  config: {
    homeAdvantage: number;
    [key: string]: unknown;
  };
  computedAt: string;
  matchesProcessed: number;
  teams: TeamRating[];
}

interface ProcessedFixture {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  avgOdds: { home: number; draw: number; away: number };
  impliedProb: { home: number; draw: number; away: number };
  bookmakerCount: number;
  oddsRange: {
    home: [number, number];
    draw: [number, number];
    away: [number, number];
  };
}

interface ProcessedOdds {
  fetchedAt: string;
  requestsRemaining: number | null;
  fixtures: ProcessedFixture[];
}

interface NextFixture {
  opponent: string;
  date: string;
  marketWinProb: number;
  predictedWinProb: number;
  isHome: boolean;
}

interface InjuryInfo {
  count: number;
  keyPlayers: string[];
  totalImpact: number;
}

interface MSILiveRating {
  team: string;
  league: string;
  baseElo: number;
  oddsAdjustment: number;
  injuryAdjustment: number;
  msiLive: number;
  msiLiveRank: number;
  injuries: InjuryInfo | null;
  nextFixture: NextFixture | null;
  lastUpdated: string;
}

interface InjuryDataEntry {
  playerName: string;
  position: string;
  reason: string;
}

interface InjuryDataFile {
  fetchedAt: string;
  teams: Record<string, { injuries: InjuryDataEntry[] }>;
}

interface MSILiveFile {
  computedAt: string;
  oddsSource: string;
  stale: boolean;
  ratings: MSILiveRating[];
}

function main() {
  const dataDir = path.join(__dirname, "..", "data");

  // Load base ratings
  const ratingsFile = path.join(dataDir, "msi_ratings.json");
  if (!fs.existsSync(ratingsFile)) {
    console.error("msi_ratings.json not found. Run `npm run compute` first.");
    process.exit(1);
  }
  const ratingsData: RatingsFile = JSON.parse(
    fs.readFileSync(ratingsFile, "utf-8")
  );
  const homeAdvantage = ratingsData.config.homeAdvantage || 65;

  // Build rating lookup
  const ratingMap: Record<string, number> = {};
  for (const t of ratingsData.teams) {
    ratingMap[t.team] = t.rating;
  }

  // Load team registry
  const registryFile = path.join(dataDir, "teams_registry.json");
  const registry: Record<
    string,
    { league: string; country: string; matchesPlayed: number }
  > = fs.existsSync(registryFile)
    ? JSON.parse(fs.readFileSync(registryFile, "utf-8"))
    : {};

  // Load odds
  const oddsFile = path.join(dataDir, "odds", "current.json");
  let oddsData: ProcessedOdds | null = null;
  let stale = false;

  if (fs.existsSync(oddsFile)) {
    oddsData = JSON.parse(fs.readFileSync(oddsFile, "utf-8"));
    const fetchedAt = new Date(oddsData!.fetchedAt);
    const ageHours =
      (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > 48) {
      console.warn(
        `⚠ Odds data is ${Math.round(ageHours)}h old (>48h). Marking as stale.`
      );
      stale = true;
    }
    console.log(
      `Loaded odds: ${oddsData!.fixtures.length} fixtures (fetched ${oddsData!.fetchedAt})`
    );
  } else {
    console.log(
      "No odds data found. MSI Live = base Elo for all teams."
    );
  }

  // Load injury data
  const injuryFile = path.join(dataDir, "injuries", "current.json");
  let injuryData: InjuryDataFile | null = null;
  if (fs.existsSync(injuryFile)) {
    const raw: InjuryDataFile = JSON.parse(
      fs.readFileSync(injuryFile, "utf-8")
    );
    if (raw.fetchedAt && Object.keys(raw.teams).length > 0) {
      injuryData = raw;
      const totalInj = Object.values(raw.teams).reduce(
        (s, t) => s + t.injuries.length,
        0
      );
      console.log(
        `Loaded injuries: ${totalInj} across ${Object.keys(raw.teams).length} teams (fetched ${raw.fetchedAt})`
      );
    }
  }
  if (!injuryData) {
    console.log("No injury data found. injuryAdjustment = 0 for all teams.");
  }

  // Load name mapping
  const mappingFile = path.join(dataDir, "name_mapping_odds.json");
  const nameMapping: Record<string, string> = fs.existsSync(mappingFile)
    ? JSON.parse(fs.readFileSync(mappingFile, "utf-8"))
    : {};

  function resolveTeamName(oddsName: string): string | null {
    if (ratingMap[oddsName] !== undefined) return oddsName;
    const mapped = nameMapping[oddsName];
    if (mapped && ratingMap[mapped] !== undefined) return mapped;
    return null;
  }

  // Process fixtures and compute adjustments per team
  const teamAdjustments: Record<string, number[]> = {};
  const teamNextFixtures: Record<string, NextFixture[]> = {};

  if (oddsData && !stale) {
    for (const fixture of oddsData.fixtures) {
      const homeName = resolveTeamName(fixture.homeTeam);
      const awayName = resolveTeamName(fixture.awayTeam);

      if (!homeName || !awayName) continue;

      const homeElo = ratingMap[homeName];
      const awayElo = ratingMap[awayName];
      if (homeElo === undefined || awayElo === undefined) continue;

      // Normalize to exclude draws for h2h comparison
      const h2h = normalizeH2H(
        fixture.impliedProb.home,
        fixture.impliedProb.away
      );

      // Home team adjustment
      const homeAdj = calculateOddsAdjustment(
        homeElo,
        awayElo,
        true,
        h2h.home,
        homeAdvantage
      );
      if (!teamAdjustments[homeName]) teamAdjustments[homeName] = [];
      teamAdjustments[homeName].push(homeAdj);

      const homePredicted = predictedWinProb(
        homeElo,
        awayElo,
        true,
        homeAdvantage
      );
      if (!teamNextFixtures[homeName]) teamNextFixtures[homeName] = [];
      teamNextFixtures[homeName].push({
        opponent: awayName,
        date: fixture.kickoff,
        marketWinProb: h2h.home,
        predictedWinProb: homePredicted,
        isHome: true,
      });

      // Away team adjustment
      const awayAdj = calculateOddsAdjustment(
        awayElo,
        homeElo,
        false,
        h2h.away,
        homeAdvantage
      );
      if (!teamAdjustments[awayName]) teamAdjustments[awayName] = [];
      teamAdjustments[awayName].push(awayAdj);

      const awayPredicted = predictedWinProb(
        awayElo,
        homeElo,
        false,
        homeAdvantage
      );
      if (!teamNextFixtures[awayName]) teamNextFixtures[awayName] = [];
      teamNextFixtures[awayName].push({
        opponent: homeName,
        date: fixture.kickoff,
        marketWinProb: h2h.away,
        predictedWinProb: awayPredicted,
        isHome: false,
      });
    }
  }

  // Build MSI Live ratings
  const liveRatings: MSILiveRating[] = [];

  for (const team of ratingsData.teams) {
    const adjs = teamAdjustments[team.team];
    const avgAdj =
      adjs && adjs.length > 0
        ? adjs.reduce((s, v) => s + v, 0) / adjs.length
        : 0;

    // Pick nearest upcoming fixture
    const fixtures = teamNextFixtures[team.team];
    let nextFixture: NextFixture | null = null;
    if (fixtures && fixtures.length > 0) {
      fixtures.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      nextFixture = fixtures[0];
    }

    // Compute injury adjustment
    let injAdj = 0;
    let injuryInfo: InjuryInfo | null = null;
    if (injuryData) {
      const teamInjData = injuryData.teams[team.team];
      if (teamInjData && teamInjData.injuries.length > 0) {
        const impact = calculateTeamInjuryImpact(
          team.team,
          teamInjData.injuries.map((i) => ({
            name: i.playerName,
            position: i.position,
            reason: i.reason,
          }))
        );
        injAdj = impact.ratingAdjustment;
        injuryInfo = {
          count: impact.injuredPlayers.length,
          keyPlayers: impact.injuredPlayers
            .filter((p) => p.importance >= 0.7)
            .map((p) => p.name),
          totalImpact: Math.round(impact.totalImpact * 100) / 100,
        };
      }
    }

    const reg = registry[team.team];

    liveRatings.push({
      team: team.team,
      league: reg?.league || "?",
      baseElo: team.rating,
      oddsAdjustment: Math.round(avgAdj * 10) / 10,
      injuryAdjustment: Math.round(injAdj * 10) / 10,
      msiLive: team.rating + avgAdj + injAdj,
      msiLiveRank: 0, // filled after sorting
      injuries: injuryInfo,
      nextFixture,
      lastUpdated: team.lastUpdated,
    });
  }

  // Sort by msiLive descending and assign ranks
  liveRatings.sort((a, b) => b.msiLive - a.msiLive);
  liveRatings.forEach((r, i) => {
    r.msiLiveRank = i + 1;
  });

  // Save MSI Live
  const liveOutput: MSILiveFile = {
    computedAt: new Date().toISOString(),
    oddsSource: oddsData?.fetchedAt || "none",
    stale,
    ratings: liveRatings,
  };

  const liveFile = path.join(dataDir, "msi_live.json");
  fs.writeFileSync(liveFile, JSON.stringify(liveOutput, null, 2));
  console.log(`\nSaved ${liveFile} (${liveRatings.length} teams)`);

  // Append daily snapshot
  const today = new Date().toISOString().substring(0, 10);
  const dailyFile = path.join(dataDir, "msi_live_daily.json");
  let dailyData: Record<
    string,
    Record<string, { baseElo: number; oddsAdj: number; msiLive: number }>
  > = {};

  if (fs.existsSync(dailyFile)) {
    dailyData = JSON.parse(fs.readFileSync(dailyFile, "utf-8"));
  }

  dailyData[today] = {};
  for (const r of liveRatings) {
    dailyData[today][r.team] = {
      baseElo: Math.round(r.baseElo * 100) / 100,
      oddsAdj: r.oddsAdjustment,
      msiLive: Math.round(r.msiLive * 100) / 100,
    };
  }

  fs.writeFileSync(dailyFile, JSON.stringify(dailyData, null, 2));
  console.log(`Updated ${dailyFile} (snapshot for ${today})`);

  // Print top 20
  const adjustedCount = liveRatings.filter(
    (r) => r.oddsAdjustment !== 0
  ).length;
  const injuredCount = liveRatings.filter(
    (r) => r.injuryAdjustment !== 0
  ).length;
  console.log(`\nTeams with odds adjustments: ${adjustedCount}`);
  console.log(`Teams with injury adjustments: ${injuredCount}`);
  console.log(
    `Teams without odds data: ${liveRatings.length - adjustedCount}`
  );

  console.log("\n━━━ Top 20 MSI Live Ratings ━━━");
  for (let i = 0; i < Math.min(20, liveRatings.length); i++) {
    const r = liveRatings[i];
    const adj =
      r.oddsAdjustment !== 0
        ? ` (odds:${r.oddsAdjustment >= 0 ? "+" : ""}${r.oddsAdjustment.toFixed(1)})`
        : "";
    const inj =
      r.injuryAdjustment !== 0
        ? ` (inj:${r.injuryAdjustment.toFixed(1)})`
        : "";
    const next = r.nextFixture
      ? ` → vs ${r.nextFixture.opponent.substring(0, 15)} (${r.nextFixture.isHome ? "H" : "A"}, ${(r.nextFixture.marketWinProb * 100).toFixed(0)}%)`
      : "";
    console.log(
      `${String(i + 1).padStart(2)}.  ${r.team.padEnd(30)} ${Math.round(r.msiLive).toString().padStart(5)}${adj}${inj}${next}`
    );
  }
}

main();
