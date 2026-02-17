import * as fs from "fs";
import * as path from "path";
import { computeElo, regressTowardMean, DEFAULT_CONFIG, EloConfig } from "./elo";
import { getPlayerImportance, injuryToEloAdjustment } from "./playerImportance";

interface MatchOdds {
  avgHome: number;
  avgDraw: number;
  avgAway: number;
}

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
  odds: MatchOdds | null;
}

interface LayerSnapshot {
  date: string;
  baseElo: number;
  eloOdds: number;
  eloOddsInjuries: number;
  eloOddsInjuriesNews: number;
}

interface TeamLayerEntry {
  team: string;
  rating: number;
  rank: number;
}

interface LayerMeta {
  label: string;
  description: string;
  color: string;
  teams: TeamLayerEntry[];
}

interface MultiLayerCurrent {
  computedAt: string;
  matchesProcessed: number;
  matchesWithOdds: number;
  validation: ValidationResults;
  layers: Record<string, LayerMeta>;
}

interface ValidationResults {
  baseElo: { correctPct: number; avgBrier: number; count: number };
  eloOdds: { correctPct: number; avgBrier: number; count: number };
  improvement: { correctPctDelta: number; brierDelta: number };
}

// ── Pre-match odds adjustment ──
function preMatchOddsAdjustment(
  homeElo: number,
  awayElo: number,
  odds: MatchOdds,
  homeAdvantage: number,
  blendWeight: number = 0.08
): { homeAdj: number; awayAdj: number } {
  const rawH = 1 / odds.avgHome;
  const rawD = 1 / odds.avgDraw;
  const rawA = 1 / odds.avgAway;
  const total = rawH + rawD + rawA;
  const marketHome = rawH / total;
  const marketAway = rawA / total;

  // Normalize to head-to-head (exclude draw)
  const marketHomeH2H = marketHome / (marketHome + marketAway);
  const marketAwayH2H = marketAway / (marketHome + marketAway);

  // What our Elo predicts
  const eloDiff = homeElo + homeAdvantage - awayElo;
  const predictedHome = 1 / (1 + Math.pow(10, -eloDiff / 400));
  const predictedAway = 1 - predictedHome;

  // Gap
  const homeGap = marketHomeH2H - predictedHome;
  const awayGap = marketAwayH2H - predictedAway;

  // Convert to Elo points and apply weight
  const homeAdj = homeGap * 400 * blendWeight;
  const awayAdj = awayGap * 400 * blendWeight;

  return { homeAdj, awayAdj };
}

// ── Injury data loading ──
interface InjuryEntry {
  playerName: string;
  position: string;
  reason: string;
}

interface InjuryDataFile {
  fetchedAt: string;
  teams: Record<string, { injuries: InjuryEntry[] }>;
}

function loadInjuryData(dataDir: string): InjuryDataFile | null {
  const injuryFile = path.join(dataDir, "injuries", "current.json");
  if (!fs.existsSync(injuryFile)) return null;
  try {
    const data: InjuryDataFile = JSON.parse(fs.readFileSync(injuryFile, "utf-8"));
    // Only use if actually fetched (non-empty fetchedAt)
    if (!data.fetchedAt || Object.keys(data.teams).length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

function injuryAdjustment(
  team: string,
  _date: string,
  injuryData: InjuryDataFile | null
): number {
  if (!injuryData) return 0;
  const teamData = injuryData.teams[team];
  if (!teamData || teamData.injuries.length === 0) return 0;

  const totalImpact = teamData.injuries.reduce((sum, inj) => {
    return sum + getPlayerImportance(inj.playerName, inj.position);
  }, 0);

  return injuryToEloAdjustment(totalImpact);
}

// ── News data loading ──
interface NewsTeamData {
  events: { type: string; label: string; headline: string; decayedImpact: number }[];
  totalDecayedImpact: number;
  newsAdjustment: number;
}

interface NewsDataFile {
  computedAt: string;
  dampeningFactor: number;
  capElo: number;
  teams: Record<string, NewsTeamData>;
}

function loadNewsData(dataDir: string): NewsDataFile | null {
  const newsFile = path.join(dataDir, "news", "current.json");
  if (!fs.existsSync(newsFile)) return null;
  try {
    const data: NewsDataFile = JSON.parse(fs.readFileSync(newsFile, "utf-8"));
    if (!data.computedAt || Object.keys(data.teams).length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

function newsAdjustment(
  team: string,
  _date: string,
  newsData: NewsDataFile | null
): number {
  if (!newsData) return 0;
  const teamData = newsData.teams[team];
  if (!teamData) return 0;
  return teamData.newsAdjustment;
}

// ── Brier score ──
function brierScore(
  predHome: number,
  predDraw: number,
  predAway: number,
  actual: "H" | "D" | "A"
): number {
  const act = { H: [1, 0, 0], D: [0, 1, 0], A: [0, 0, 1] }[actual];
  return (
    ((predHome - act[0]) ** 2 +
      (predDraw - act[1]) ** 2 +
      (predAway - act[2]) ** 2) /
    3
  );
}

function predictedProbs(
  homeElo: number,
  awayElo: number,
  homeAdvantage: number
): { home: number; draw: number; away: number } {
  const eloDiff = homeElo + homeAdvantage - awayElo;
  const expectedHome = 1 / (1 + Math.pow(10, -eloDiff / 400));
  // Approximate draw probability from Elo spread
  const drawProb = Math.max(0.15, 0.28 - Math.abs(eloDiff) / 2000);
  const home = expectedHome * (1 - drawProb);
  const away = (1 - expectedHome) * (1 - drawProb);
  return { home, draw: drawProb, away };
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

  const withOdds = matches.filter((m) => m.odds).length;
  console.log(`Matches with odds: ${withOdds}`);

  // Load injury data (only applies to current/future — not historical)
  const injuryData = loadInjuryData(dataDir);
  if (injuryData) {
    const injuredTeams = Object.keys(injuryData.teams).length;
    const totalInj = Object.values(injuryData.teams).reduce(
      (s, t) => s + t.injuries.length,
      0
    );
    console.log(`Injury data loaded: ${totalInj} injuries across ${injuredTeams} teams`);
  } else {
    console.log("No injury data available — Layer 3 = Layer 2");
  }

  // Load news data (only applies to current/future — not historical)
  const newsData = loadNewsData(dataDir);
  if (newsData) {
    const newsTeams = Object.keys(newsData.teams).length;
    const totalEvents = Object.values(newsData.teams).reduce(
      (s, t) => s + t.events.length,
      0
    );
    console.log(`News data loaded: ${totalEvents} events across ${newsTeams} teams`);
  } else {
    console.log("No news data available — Layer 4 = Layer 3");
  }

  const registryFile = path.join(dataDir, "teams_registry.json");
  const teamRegistry: Record<
    string,
    { league: string; country: string; matchesPlayed: number }
  > = fs.existsSync(registryFile)
    ? JSON.parse(fs.readFileSync(registryFile, "utf-8"))
    : {};

  const config: EloConfig = { ...DEFAULT_CONFIG };

  // ── 4 parallel rating layers ──
  const baseElo: Record<string, number> = {};
  const eloOdds: Record<string, number> = {};
  const eloOddsInjuries: Record<string, number> = {};
  const eloOddsInjuriesNews: Record<string, number> = {};
  const teamLeague: Record<string, string> = {};

  function initTeam(team: string, league?: string) {
    if (baseElo[team] !== undefined) return;
    const lg = league || teamRegistry[team]?.league || "";
    if (lg) teamLeague[team] = lg;
    const baseline = config.leagueBaseline[lg] ?? config.initialRating;
    baseElo[team] = baseline;
    eloOdds[team] = baseline;
    eloOddsInjuries[team] = baseline;
    eloOddsInjuriesNews[team] = baseline;
  }

  // ── Daily snapshots ──
  const dailySnapshots: Record<string, LayerSnapshot[]> = {};

  function recordSnapshot(team: string, date: string) {
    if (!dailySnapshots[team]) dailySnapshots[team] = [];
    dailySnapshots[team].push({
      date,
      baseElo: baseElo[team],
      eloOdds: eloOdds[team],
      eloOddsInjuries: eloOddsInjuries[team],
      eloOddsInjuriesNews: eloOddsInjuriesNews[team],
    });
  }

  // ── Validation tracking ──
  let baseCorrect = 0;
  let oddsCorrect = 0;
  let baseBrierSum = 0;
  let oddsBrierSum = 0;
  let validationCount = 0;

  // ── Season break detection ──
  let lastMatchDate: Date | null = null;

  // ── Process matches ──
  for (const match of matches) {
    const matchDate = new Date(match.date);
    const dateStr = match.date.substring(0, 10);

    // Check for season break (60+ day gap)
    if (lastMatchDate) {
      const dayGap =
        (matchDate.getTime() - lastMatchDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dayGap >= 60) {
        for (const team of Object.keys(baseElo)) {
          const lg = teamLeague[team] || "";
          const mean = config.leagueBaseline[lg] ?? config.initialRating;
          baseElo[team] = regressTowardMean(baseElo[team], mean, config.seasonRegression);
          eloOdds[team] = regressTowardMean(eloOdds[team], mean, config.seasonRegression);
          eloOddsInjuries[team] = regressTowardMean(eloOddsInjuries[team], mean, config.seasonRegression);
          eloOddsInjuriesNews[team] = regressTowardMean(eloOddsInjuriesNews[team], mean, config.seasonRegression);
        }
      }
    }
    lastMatchDate = matchDate;

    initTeam(match.homeTeam, match.league);
    initTeam(match.awayTeam, match.league);
    if (match.league && !teamLeague[match.homeTeam]) teamLeague[match.homeTeam] = match.league;
    if (match.league && !teamLeague[match.awayTeam]) teamLeague[match.awayTeam] = match.league;

    // ── Layer 2/3/4: Pre-match odds adjustment ──
    let homeOddsAdj = 0;
    let awayOddsAdj = 0;
    if (match.odds) {
      const adj = preMatchOddsAdjustment(
        eloOdds[match.homeTeam],
        eloOdds[match.awayTeam],
        match.odds,
        config.homeAdvantage
      );
      homeOddsAdj = adj.homeAdj;
      awayOddsAdj = adj.awayAdj;
    }

    // Injury adjustments: only apply to the most recent matches
    // (injury data reflects current state, not historical)
    const isRecentMatch = matches.indexOf(match) >= matches.length - 200;
    const activeInjuryData = isRecentMatch ? injuryData : null;
    const homeInjAdj = injuryAdjustment(match.homeTeam, dateStr, activeInjuryData);
    const awayInjAdj = injuryAdjustment(match.awayTeam, dateStr, activeInjuryData);
    const activeNewsData = isRecentMatch ? newsData : null;
    const homeNewsAdj = newsAdjustment(match.homeTeam, dateStr, activeNewsData);
    const awayNewsAdj = newsAdjustment(match.awayTeam, dateStr, activeNewsData);

    // Apply pre-match adjustments to Layer 2
    const l2HomePreMatch = eloOdds[match.homeTeam] + homeOddsAdj;
    const l2AwayPreMatch = eloOdds[match.awayTeam] + awayOddsAdj;

    // Layer 3 = Layer 2 + injuries
    const l3HomePreMatch = eloOddsInjuries[match.homeTeam] + homeOddsAdj + homeInjAdj;
    const l3AwayPreMatch = eloOddsInjuries[match.awayTeam] + awayOddsAdj + awayInjAdj;

    // Layer 4 = Layer 3 + news
    const l4HomePreMatch = eloOddsInjuriesNews[match.homeTeam] + homeOddsAdj + homeInjAdj + homeNewsAdj;
    const l4AwayPreMatch = eloOddsInjuriesNews[match.awayTeam] + awayOddsAdj + awayInjAdj + awayNewsAdj;

    // ── Validation: measure prediction accuracy BEFORE updating ──
    if (match.odds) {
      const actualResult =
        match.homeGoals > match.awayGoals
          ? "H"
          : match.homeGoals < match.awayGoals
            ? "A"
            : "D";

      // Base Elo prediction
      const basePreds = predictedProbs(
        baseElo[match.homeTeam],
        baseElo[match.awayTeam],
        config.homeAdvantage
      );
      const basePredResult =
        basePreds.home > basePreds.draw && basePreds.home > basePreds.away
          ? "H"
          : basePreds.away > basePreds.draw
            ? "A"
            : "D";
      if (basePredResult === actualResult) baseCorrect++;
      baseBrierSum += brierScore(
        basePreds.home,
        basePreds.draw,
        basePreds.away,
        actualResult as "H" | "D" | "A"
      );

      // Elo+Odds prediction (using adjusted ratings)
      const oddsPreds = predictedProbs(l2HomePreMatch, l2AwayPreMatch, config.homeAdvantage);
      const oddsPredResult =
        oddsPreds.home > oddsPreds.draw && oddsPreds.home > oddsPreds.away
          ? "H"
          : oddsPreds.away > oddsPreds.draw
            ? "A"
            : "D";
      if (oddsPredResult === actualResult) oddsCorrect++;
      oddsBrierSum += brierScore(
        oddsPreds.home,
        oddsPreds.draw,
        oddsPreds.away,
        actualResult as "H" | "D" | "A"
      );

      validationCount++;
    }

    // ── Layer 1: Base Elo update ──
    const r1 = computeElo(
      baseElo[match.homeTeam],
      baseElo[match.awayTeam],
      match.homeGoals,
      match.awayGoals,
      config,
      match.league
    );
    baseElo[match.homeTeam] = r1.homeNewRating;
    baseElo[match.awayTeam] = r1.awayNewRating;

    // ── Layer 2: Elo + Odds update (use adjusted pre-match ratings) ──
    const r2 = computeElo(
      l2HomePreMatch,
      l2AwayPreMatch,
      match.homeGoals,
      match.awayGoals,
      config,
      match.league
    );
    eloOdds[match.homeTeam] = r2.homeNewRating;
    eloOdds[match.awayTeam] = r2.awayNewRating;

    // ── Layer 3: Elo + Odds + Injuries ──
    const r3 = computeElo(
      l3HomePreMatch,
      l3AwayPreMatch,
      match.homeGoals,
      match.awayGoals,
      config,
      match.league
    );
    eloOddsInjuries[match.homeTeam] = r3.homeNewRating;
    eloOddsInjuries[match.awayTeam] = r3.awayNewRating;

    // ── Layer 4: Elo + Odds + Injuries + News ──
    const r4 = computeElo(
      l4HomePreMatch,
      l4AwayPreMatch,
      match.homeGoals,
      match.awayGoals,
      config,
      match.league
    );
    eloOddsInjuriesNews[match.homeTeam] = r4.homeNewRating;
    eloOddsInjuriesNews[match.awayTeam] = r4.awayNewRating;

    // Record snapshots
    recordSnapshot(match.homeTeam, dateStr);
    recordSnapshot(match.awayTeam, dateStr);
  }

  // ── Deduplicate daily snapshots (last rating of each day wins) ──
  for (const team of Object.keys(dailySnapshots)) {
    const dayMap: Record<string, LayerSnapshot> = {};
    for (const snap of dailySnapshots[team]) {
      dayMap[snap.date] = snap;
    }
    dailySnapshots[team] = Object.values(dayMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  // ── Save daily snapshots ──
  const dailyFile = path.join(dataDir, "msi_multilayer_daily.json");
  fs.writeFileSync(dailyFile, JSON.stringify(dailySnapshots));
  console.log(`\nSaved ${dailyFile}`);

  // ── Build current rankings for each layer ──
  function buildLayer(
    ratings: Record<string, number>,
    label: string,
    description: string,
    color: string
  ): LayerMeta {
    const teams = Object.entries(ratings)
      .sort(([, a], [, b]) => b - a)
      .map(([team, rating], i) => ({
        team,
        rating: Math.round(rating * 100) / 100,
        rank: i + 1,
      }));
    return { label, description, color, teams };
  }

  const validation: ValidationResults = {
    baseElo: {
      correctPct: Math.round((baseCorrect / validationCount) * 1000) / 10,
      avgBrier: Math.round((baseBrierSum / validationCount) * 10000) / 10000,
      count: validationCount,
    },
    eloOdds: {
      correctPct: Math.round((oddsCorrect / validationCount) * 1000) / 10,
      avgBrier: Math.round((oddsBrierSum / validationCount) * 10000) / 10000,
      count: validationCount,
    },
    improvement: {
      correctPctDelta:
        Math.round(
          ((oddsCorrect - baseCorrect) / validationCount) * 1000
        ) / 10,
      brierDelta:
        Math.round(
          ((oddsBrierSum - baseBrierSum) / validationCount) * 10000
        ) / 10000,
    },
  };

  const currentOutput: MultiLayerCurrent = {
    computedAt: new Date().toISOString(),
    matchesProcessed: matches.length,
    matchesWithOdds: withOdds,
    validation,
    layers: {
      baseElo: buildLayer(
        baseElo,
        "Match Data",
        "Elo from match results only",
        "#22c55e"
      ),
      eloOdds: buildLayer(
        eloOdds,
        "Match + Odds",
        "Elo adjusted by pre-match betting odds",
        "#eab308"
      ),
      eloOddsInjuries: buildLayer(
        eloOddsInjuries,
        "Match + Odds + Injuries",
        "Elo adjusted by odds and current injury data",
        "#f97316"
      ),
      eloOddsInjuriesNews: buildLayer(
        eloOddsInjuriesNews,
        "Full Signal",
        "Elo adjusted by odds, injuries, and news events",
        "#ef4444"
      ),
    },
  };

  const currentFile = path.join(dataDir, "msi_multilayer_current.json");
  fs.writeFileSync(currentFile, JSON.stringify(currentOutput, null, 2));
  console.log(`Saved ${currentFile}`);

  // ── Save validation separately ──
  const validationFile = path.join(dataDir, "msi_multilayer_validation.json");
  fs.writeFileSync(validationFile, JSON.stringify(validation, null, 2));
  console.log(`Saved ${validationFile}`);

  // ── Print results ──
  console.log("\n━━━ Validation: Base Elo vs Elo+Odds ━━━");
  console.log(`Matches evaluated: ${validationCount}`);
  console.log(
    `Layer 1 (Base Elo):   Correct outcome ${validation.baseElo.correctPct}%, Avg Brier ${validation.baseElo.avgBrier}`
  );
  console.log(
    `Layer 2 (Elo+Odds):   Correct outcome ${validation.eloOdds.correctPct}%, Avg Brier ${validation.eloOdds.avgBrier}`
  );
  console.log(
    `Improvement:          ${validation.improvement.correctPctDelta >= 0 ? "+" : ""}${validation.improvement.correctPctDelta}% accuracy, ${validation.improvement.brierDelta >= 0 ? "+" : ""}${validation.improvement.brierDelta} Brier`
  );

  console.log("\n━━━ Top 10 per Layer ━━━");
  for (const [key, layer] of Object.entries(currentOutput.layers)) {
    console.log(`\n${layer.label} (${key}):`);
    for (let i = 0; i < Math.min(10, layer.teams.length); i++) {
      const t = layer.teams[i];
      console.log(
        `  ${String(i + 1).padStart(2)}. ${t.team.padEnd(30)} ${Math.round(t.rating).toString().padStart(5)}`
      );
    }
  }
}

main();
