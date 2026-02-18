/**
 * v1 Processor — Reads L1 raw, writes L1 canonical + L2 derived.
 *
 * Steps:
 * 1. Find latest raw snapshots in L1
 * 2. Build canonical files (teams, fixtures, match_results, odds_snapshots)
 * 3. Compute Elo ratings (base → multi-layer)
 * 4. Compute oracle prices
 * 5. Write everything under a run_id in L2
 *
 * Usage: npx tsx src/process/runProcess.ts
 */
import fs from "fs";
import path from "path";
import {
  atomicWrite,
  writeVersioned,
  generateRunId,
  L1_RAW_MATCHES,
  L1_RAW_ODDS,
  L1_RAW_INJURIES,
  L1_RAW_NEWS,
  L1_CANONICAL_DIR,
  L2_DERIVED_DIR,
} from "../storage";
import {
  computeElo,
  regressTowardMean,
  DEFAULT_CONFIG,
  type EloConfig,
} from "../model/elo";
import {
  calculateOddsAdjustment,
  normalizeH2H,
  predictedWinProb,
} from "../model/oddsTransform";
import { calculateTeamInjuryImpact } from "../model/injuries";
import { computeOraclePrice, DEFAULT_ORACLE_PARAMS } from "../model/oracle";

// ────────────────────────────────────────
// Helpers
// ────────────────────────────────────────

function latestFile(dir: string, prefix?: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && (!prefix || f.includes(prefix)))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

function readRawPayload(filePath: string): any {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return raw.data ?? raw;
}

// ────────────────────────────────────────
// Match / fixture types (same as v0 shapes)
// ────────────────────────────────────────

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
  odds: { avgHome: number; avgDraw: number; avgAway: number } | null;
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
}

// ────────────────────────────────────────
// Step 1: Load latest raw snapshots
// ────────────────────────────────────────

function loadLatestRaw() {
  console.log("Loading latest L1 raw snapshots...");

  const matchesFile = latestFile(L1_RAW_MATCHES, "matches_");
  if (!matchesFile) throw new Error("No L1 raw match snapshots found. Run ingest first.");
  const matches: Match[] = readRawPayload(matchesFile);
  console.log(`  Matches: ${matches.length} from ${path.basename(matchesFile)}`);

  const registryFile = latestFile(L1_RAW_MATCHES, "teams_registry_");
  const registry: Record<string, { league: string; country: string; matchesPlayed: number }> =
    registryFile ? readRawPayload(registryFile) : {};
  console.log(`  Registry: ${Object.keys(registry).length} teams`);

  const oddsFile = latestFile(L1_RAW_ODDS, "odds_");
  let oddsFixtures: ProcessedFixture[] = [];
  let oddsStale = false;
  if (oddsFile) {
    const oddsData = readRawPayload(oddsFile);
    oddsFixtures = oddsData.fixtures ?? [];
    const fetchedAt = new Date(oddsData.fetchedAt ?? "");
    const ageHours = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
    oddsStale = ageHours > 48;
    console.log(`  Odds: ${oddsFixtures.length} fixtures (${oddsStale ? "STALE" : "fresh"})`);
  } else {
    console.log("  Odds: none");
  }

  const injFile = latestFile(L1_RAW_INJURIES, "injuries_");
  let injuryData: Record<string, { injuries: { playerName: string; position: string; reason: string }[] }> = {};
  if (injFile) {
    const raw = readRawPayload(injFile);
    injuryData = raw.teams ?? {};
    console.log(`  Injuries: ${Object.keys(injuryData).length} teams`);
  } else {
    console.log("  Injuries: none");
  }

  const newsFile = latestFile(L1_RAW_NEWS, "news_");
  let newsData: Record<string, { newsAdjustment: number; events: any[] }> = {};
  if (newsFile) {
    const raw = readRawPayload(newsFile);
    newsData = raw.teams ?? {};
    console.log(`  News: ${Object.keys(newsData).length} teams`);
  } else {
    console.log("  News: none");
  }

  // Load name mapping from v0 (not modifying, just reading)
  const v0Dir = path.join(process.cwd(), "data");
  const oddsMappingFile = path.join(v0Dir, "name_mapping_odds.json");
  const nameMapping: Record<string, string> = fs.existsSync(oddsMappingFile)
    ? JSON.parse(fs.readFileSync(oddsMappingFile, "utf-8"))
    : {};

  return { matches, registry, oddsFixtures, oddsStale, injuryData, newsData, nameMapping };
}

// ────────────────────────────────────────
// Step 2: Build L1 canonical files
// ────────────────────────────────────────

function buildCanonical(
  matches: Match[],
  registry: Record<string, { league: string; country: string; matchesPlayed: number }>,
  oddsFixtures: ProcessedFixture[]
) {
  console.log("\nBuilding L1 canonical files...");

  // teams.json
  const teams = Object.entries(registry).map(([name, info], idx) => ({
    id: idx + 1,
    name,
    league: info.league,
    country: info.country,
    matchesPlayed: info.matchesPlayed,
  }));
  const teamIdMap: Record<string, number> = {};
  for (const t of teams) teamIdMap[t.name] = t.id;

  // fixtures.json — built from matches (each match = a fixture with a result)
  const fixtures = matches.map((m) => ({
    fixtureId: m.id,
    season: m.season,
    league: m.league,
    kickoffUtc: m.date,
    homeTeamId: teamIdMap[m.homeTeam] ?? null,
    awayTeamId: teamIdMap[m.awayTeam] ?? null,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
  }));

  // match_results.json
  const matchResults = matches.map((m) => ({
    fixtureId: m.id,
    homeGoals: m.homeGoals,
    awayGoals: m.awayGoals,
    resultFinal: m.homeGoals > m.awayGoals ? "H" : m.homeGoals < m.awayGoals ? "A" : "D",
    source: "v0_matches_all",
  }));

  // odds_snapshots.json — from current odds feed
  const oddsSnapshots = oddsFixtures.map((f, idx) => ({
    oddsSnapshotId: idx + 1,
    externalFixtureId: f.id,
    league: f.league,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    kickoff: f.kickoff,
    avgOdds: f.avgOdds,
    impliedProb: f.impliedProb,
    bookmakerCount: f.bookmakerCount,
  }));

  // Write canonical files
  atomicWrite(path.join(L1_CANONICAL_DIR, "teams.json"), teams);
  atomicWrite(path.join(L1_CANONICAL_DIR, "fixtures.json"), fixtures);
  atomicWrite(path.join(L1_CANONICAL_DIR, "match_results.json"), matchResults);
  atomicWrite(path.join(L1_CANONICAL_DIR, "odds_snapshots.json"), oddsSnapshots);

  console.log(`  teams.json: ${teams.length}`);
  console.log(`  fixtures.json: ${fixtures.length}`);
  console.log(`  match_results.json: ${matchResults.length}`);
  console.log(`  odds_snapshots.json: ${oddsSnapshots.length}`);

  return { teams, teamIdMap, fixtures, matchResults, oddsSnapshots };
}

// ────────────────────────────────────────
// Step 3: Compute Elo ratings (all layers)
// ────────────────────────────────────────

function computeRatings(
  matches: Match[],
  registry: Record<string, { league: string; country: string; matchesPlayed: number }>,
  oddsFixtures: ProcessedFixture[],
  oddsStale: boolean,
  injuryData: Record<string, { injuries: { playerName: string; position: string; reason: string }[] }>,
  newsData: Record<string, { newsAdjustment: number; events: any[] }>,
  nameMapping: Record<string, string>
) {
  console.log("\nComputing Elo ratings (4 layers)...");

  const config: EloConfig = { ...DEFAULT_CONFIG };
  const baseElo: Record<string, number> = {};
  const eloOdds: Record<string, number> = {};
  const teamLeague: Record<string, string> = {};

  function initTeam(team: string, league?: string) {
    if (baseElo[team] !== undefined) return;
    const lg = league || registry[team]?.league || "";
    if (lg) teamLeague[team] = lg;
    const baseline = config.leagueBaseline[lg] ?? config.initialRating;
    baseElo[team] = baseline;
    eloOdds[team] = baseline;
  }

  // Rating history for daily snapshots
  const dailySnapshots: Record<string, { date: string; baseElo: number; eloOdds: number }[]> = {};

  function recordSnapshot(team: string, date: string) {
    if (!dailySnapshots[team]) dailySnapshots[team] = [];
    dailySnapshots[team].push({
      date,
      baseElo: baseElo[team],
      eloOdds: eloOdds[team],
    });
  }

  let lastMatchDate: Date | null = null;

  for (const match of matches) {
    const matchDate = new Date(match.date);
    const dateStr = match.date.substring(0, 10);

    // Season break regression
    if (lastMatchDate) {
      const dayGap = (matchDate.getTime() - lastMatchDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dayGap >= 60) {
        for (const team of Object.keys(baseElo)) {
          const lg = teamLeague[team] || "";
          const mean = config.leagueBaseline[lg] ?? config.initialRating;
          baseElo[team] = regressTowardMean(baseElo[team], mean, config.seasonRegression);
          eloOdds[team] = regressTowardMean(eloOdds[team], mean, config.seasonRegression);
        }
      }
    }
    lastMatchDate = matchDate;

    initTeam(match.homeTeam, match.league);
    initTeam(match.awayTeam, match.league);

    // Layer 2: pre-match odds adjustment
    let homeOddsAdj = 0;
    let awayOddsAdj = 0;
    if (match.odds) {
      const rawH = 1 / match.odds.avgHome;
      const rawA = 1 / match.odds.avgAway;
      const rawTotal = rawH + (1 / match.odds.avgDraw) + rawA;
      const marketHome = rawH / rawTotal;
      const marketAway = rawA / rawTotal;
      const h2hHome = marketHome / (marketHome + marketAway);
      const h2hAway = marketAway / (marketHome + marketAway);

      const eloDiff = eloOdds[match.homeTeam] + config.homeAdvantage - eloOdds[match.awayTeam];
      const predictedHome = 1 / (1 + Math.pow(10, -eloDiff / 400));
      const blendWeight = 0.08;

      const homeGap = h2hHome - predictedHome;
      const awayGap = h2hAway - (1 - predictedHome);
      homeOddsAdj = homeGap * 400 * blendWeight;
      awayOddsAdj = awayGap * 400 * blendWeight;
    }

    const l2Home = eloOdds[match.homeTeam] + homeOddsAdj;
    const l2Away = eloOdds[match.awayTeam] + awayOddsAdj;

    // Layer 1: base Elo update
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

    // Layer 2: Elo + odds update
    const r2 = computeElo(l2Home, l2Away, match.homeGoals, match.awayGoals, config, match.league);
    eloOdds[match.homeTeam] = r2.homeNewRating;
    eloOdds[match.awayTeam] = r2.awayNewRating;

    recordSnapshot(match.homeTeam, dateStr);
    recordSnapshot(match.awayTeam, dateStr);
  }

  // Now apply live adjustments (odds, injuries, news) to compute MSI Final
  const ratingMap: Record<string, number> = {};
  for (const t of Object.keys(baseElo)) ratingMap[t] = baseElo[t];

  // Compute odds adjustments from current odds feed
  const teamOddsAdj: Record<string, number[]> = {};
  const teamNextFixtures: Record<string, { opponent: string; date: string; marketWinProb: number; predictedWinProb: number; isHome: boolean }[]> = {};

  function resolveTeamName(oddsName: string): string | null {
    if (ratingMap[oddsName] !== undefined) return oddsName;
    const mapped = nameMapping[oddsName];
    if (mapped && ratingMap[mapped] !== undefined) return mapped;
    return null;
  }

  if (!oddsStale) {
    for (const fixture of oddsFixtures) {
      const homeName = resolveTeamName(fixture.homeTeam);
      const awayName = resolveTeamName(fixture.awayTeam);
      if (!homeName || !awayName) continue;
      if (ratingMap[homeName] === undefined || ratingMap[awayName] === undefined) continue;

      const h2h = normalizeH2H(fixture.impliedProb.home, fixture.impliedProb.away);

      const homeAdj = calculateOddsAdjustment(ratingMap[homeName], ratingMap[awayName], true, h2h.home, config.homeAdvantage);
      if (!teamOddsAdj[homeName]) teamOddsAdj[homeName] = [];
      teamOddsAdj[homeName].push(homeAdj);

      const homePredicted = predictedWinProb(ratingMap[homeName], ratingMap[awayName], true, config.homeAdvantage);
      if (!teamNextFixtures[homeName]) teamNextFixtures[homeName] = [];
      teamNextFixtures[homeName].push({ opponent: awayName, date: fixture.kickoff, marketWinProb: h2h.home, predictedWinProb: homePredicted, isHome: true });

      const awayAdj = calculateOddsAdjustment(ratingMap[awayName], ratingMap[homeName], false, h2h.away, config.homeAdvantage);
      if (!teamOddsAdj[awayName]) teamOddsAdj[awayName] = [];
      teamOddsAdj[awayName].push(awayAdj);

      const awayPredicted = predictedWinProb(ratingMap[awayName], ratingMap[homeName], false, config.homeAdvantage);
      if (!teamNextFixtures[awayName]) teamNextFixtures[awayName] = [];
      teamNextFixtures[awayName].push({ opponent: homeName, date: fixture.kickoff, marketWinProb: h2h.away, predictedWinProb: awayPredicted, isHome: false });
    }
  }

  // Build MSI ratings per team
  interface MSIRating {
    team: string;
    league: string;
    msiBase: number;
    msiOdds: number;
    msiFinal: number;
    confidence: number;
    oddsAdjustment: number;
    injuryAdjustment: number;
    newsAdjustment: number;
    nextFixture: { opponent: string; date: string; marketWinProb: number; predictedWinProb: number; isHome: boolean } | null;
    explainJson: Record<string, unknown>;
  }

  const msiRatings: MSIRating[] = [];

  for (const team of Object.keys(baseElo)) {
    const adjs = teamOddsAdj[team];
    const avgOddsAdj = adjs && adjs.length > 0 ? adjs.reduce((s, v) => s + v, 0) / adjs.length : 0;

    // Injury adjustment
    let injAdj = 0;
    const teamInjuries = injuryData[team];
    if (teamInjuries && teamInjuries.injuries.length > 0) {
      const impact = calculateTeamInjuryImpact(
        team,
        teamInjuries.injuries.map((i) => ({ name: i.playerName, position: i.position, reason: i.reason }))
      );
      injAdj = impact.ratingAdjustment;
    }

    // News adjustment
    const teamNews = newsData[team];
    const newsAdj = teamNews?.newsAdjustment ?? 0;

    const msiBase = Math.round(baseElo[team] * 100) / 100;
    const msiOddsVal = Math.round(eloOdds[team] * 100) / 100;
    const msiFinal = baseElo[team] + avgOddsAdj + injAdj + newsAdj;

    // Confidence: higher when more data available
    let confidence = 0.5;
    if (avgOddsAdj !== 0) confidence += 0.2;
    if (injAdj !== 0) confidence += 0.1;
    if (newsAdj !== 0) confidence += 0.1;
    confidence = Math.min(confidence, 1.0);

    // Next fixture
    const fixtures = teamNextFixtures[team];
    let nextFixture = null;
    if (fixtures && fixtures.length > 0) {
      fixtures.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      nextFixture = fixtures[0];
    }

    const reg = registry[team];

    msiRatings.push({
      team,
      league: reg?.league || "?",
      msiBase,
      msiOdds: msiOddsVal,
      msiFinal: Math.round(msiFinal * 100) / 100,
      confidence,
      oddsAdjustment: Math.round(avgOddsAdj * 10) / 10,
      injuryAdjustment: Math.round(injAdj * 10) / 10,
      newsAdjustment: Math.round(newsAdj * 10) / 10,
      nextFixture,
      explainJson: {
        baseElo: msiBase,
        oddsAdj: Math.round(avgOddsAdj * 10) / 10,
        injuryAdj: Math.round(injAdj * 10) / 10,
        newsAdj: Math.round(newsAdj * 10) / 10,
        components: {
          hasOdds: avgOddsAdj !== 0,
          hasInjuries: injAdj !== 0,
          hasNews: newsAdj !== 0,
        },
      },
    });
  }

  msiRatings.sort((a, b) => b.msiFinal - a.msiFinal);

  // Deduplicate daily snapshots (last value per day wins)
  for (const team of Object.keys(dailySnapshots)) {
    const dayMap: Record<string, { date: string; baseElo: number; eloOdds: number }> = {};
    for (const snap of dailySnapshots[team]) {
      dayMap[snap.date] = snap;
    }
    dailySnapshots[team] = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  return { msiRatings, dailySnapshots, config };
}

// ────────────────────────────────────────
// Step 4: Compute oracle prices
// ────────────────────────────────────────

function computeOracle(
  msiRatings: { team: string; msiFinal: number; confidence: number }[]
) {
  console.log("\nComputing oracle prices...");
  const params = DEFAULT_ORACLE_PARAMS;

  const prices = msiRatings.map((r) => {
    const result = computeOraclePrice(r.msiFinal, r.confidence, params);
    return {
      team: r.team,
      ...result,
    };
  });

  prices.sort((a, b) => b.oraclePrice - a.oraclePrice);
  return { prices, params };
}

// ────────────────────────────────────────
// Main
// ────────────────────────────────────────

function main() {
  console.log("━━━ v1 Process Pipeline ━━━\n");

  const { matches, registry, oddsFixtures, oddsStale, injuryData, newsData, nameMapping } = loadLatestRaw();
  const { teams, teamIdMap } = buildCanonical(matches, registry, oddsFixtures);
  const { msiRatings, dailySnapshots, config } = computeRatings(
    matches,
    registry,
    oddsFixtures,
    oddsStale,
    injuryData,
    newsData,
    nameMapping
  );
  const { prices: oraclePrices, params: oracleParams } = computeOracle(msiRatings);

  // ── Generate run_id and write L2 derived ──
  const runId = generateRunId();
  console.log(`\nRun ID: ${runId}`);

  // Model version
  let gitCommit = "unknown";
  try {
    const { execSync } = require("child_process");
    gitCommit = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch { /* ignore */ }

  const modelVersion = {
    modelVersionId: 1,
    name: "msi_v1",
    gitCommit,
    createdAt: new Date().toISOString(),
    runId,
    paramsJson: {
      K: config.kFactor,
      homeAdvantage: config.homeAdvantage,
      goalMarginFactor: config.goalMarginFactor,
      seasonRegression: config.seasonRegression,
      leagueStrength: config.leagueStrength,
      leagueBaseline: config.leagueBaseline,
      oddsBlendWeight: 0.08,
      oddsLiveWeight: 0.15,
      oracle: oracleParams,
    },
  };

  // Write L2 derived files
  console.log("\nWriting L2 derived outputs...");

  writeVersioned(runId, "model_version.json", modelVersion);
  console.log(`  model_version.json`);

  writeVersioned(runId, "msi_ratings.json", {
    computedAt: new Date().toISOString(),
    runId,
    matchesProcessed: matches.length,
    teamCount: msiRatings.length,
    ratings: msiRatings,
  });
  console.log(`  msi_ratings.json (${msiRatings.length} teams)`);

  writeVersioned(runId, "msi_daily.json", dailySnapshots);
  console.log(`  msi_daily.json`);

  // MSI Live snapshot (same shape as v0 msi_live.json for compatibility)
  const liveOutput = {
    computedAt: new Date().toISOString(),
    runId,
    stale: oddsStale,
    ratings: msiRatings.map((r, i) => ({
      team: r.team,
      league: r.league,
      baseElo: r.msiBase,
      oddsAdjustment: r.oddsAdjustment,
      injuryAdjustment: r.injuryAdjustment,
      newsAdjustment: r.newsAdjustment,
      msiLive: r.msiFinal,
      msiLiveRank: i + 1,
      nextFixture: r.nextFixture,
    })),
  };
  writeVersioned(runId, "msi_live.json", liveOutput);
  console.log(`  msi_live.json`);

  writeVersioned(runId, "oracle_prices.json", {
    computedAt: new Date().toISOString(),
    runId,
    params: oracleParams,
    prices: oraclePrices,
  });
  console.log(`  oracle_prices.json (${oraclePrices.length} teams)`);

  // Update model_versions.json (append-safe list of all runs)
  const versionsFile = path.join(L2_DERIVED_DIR, "model_versions.json");
  let versions: any[] = [];
  if (fs.existsSync(versionsFile)) {
    versions = JSON.parse(fs.readFileSync(versionsFile, "utf-8"));
  }
  versions.push(modelVersion);
  atomicWrite(versionsFile, versions);
  console.log(`  model_versions.json updated (${versions.length} runs)`);

  // Write latest_run.json pointer
  const latestRunFile = path.join(L2_DERIVED_DIR, "latest_run.json");
  atomicWrite(latestRunFile, { runId, createdAt: new Date().toISOString() });
  console.log(`  latest_run.json → ${runId}`);

  // ── Summary ──
  console.log("\n━━━ Process Summary ━━━");
  console.log(`  Run ID:          ${runId}`);
  console.log(`  Matches:         ${matches.length}`);
  console.log(`  Teams:           ${msiRatings.length}`);
  console.log(`  Odds fixtures:   ${oddsFixtures.length}`);
  console.log(`  Top 5 MSI Final:`);
  for (let i = 0; i < Math.min(5, msiRatings.length); i++) {
    const r = msiRatings[i];
    console.log(`    ${i + 1}. ${r.team.padEnd(30)} ${r.msiFinal.toFixed(0)}`);
  }
  console.log(`  Top 5 Oracle Prices:`);
  for (let i = 0; i < Math.min(5, oraclePrices.length); i++) {
    const p = oraclePrices[i];
    console.log(`    ${i + 1}. ${p.team.padEnd(30)} $${p.oraclePrice.toFixed(2)}`);
  }
}

main();
