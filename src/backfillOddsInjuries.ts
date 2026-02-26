import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_KEY = process.env.API_FOOTBALL_KEY || "1109c634f7989ac2ca9e96a37e7c7b72";
const BASE_URL = "https://v3.football.api-sports.io";

const LEAGUES = [
  { id: 39, code: "PL", name: "Premier League" },
  { id: 140, code: "PD", name: "La Liga" },
  { id: 78, code: "BL1", name: "Bundesliga" },
  { id: 135, code: "SA", name: "Serie A" },
  { id: 61, code: "FL1", name: "Ligue 1" },
];

const SEASON = 2025;
const DATE_FROM = "2026-01-01";
const DATE_TO = "2026-02-26";

// Rate limiting: 30 requests/minute → 1 request per 2.1s (with margin)
const REQUEST_DELAY_MS = 2200;
// Daily limit tracking
const DAILY_LIMIT = 7500;

const DATA_DIR = path.join(__dirname, "..", "data");
const BACKFILL_DIR = path.join(DATA_DIR, "backfill", "api-football");
const RAW_DIR = path.join(BACKFILL_DIR, "raw");
const RAW_FIXTURES_DIR = path.join(RAW_DIR, "fixtures");
const RAW_ODDS_DIR = path.join(RAW_DIR, "odds");
const RAW_INJURIES_DIR = path.join(RAW_DIR, "injuries");
const PROCESSED_DIR = path.join(BACKFILL_DIR, "processed");
const STATE_FILE = path.join(BACKFILL_DIR, "backfill_state.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Fixture {
  fixtureId: number;
  date: string;
  leagueId: number;
  leagueCode: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
}

interface BackfillState {
  fixtures: Fixture[];
  oddsCompleted: number[];
  injuriesCompleted: number[];
  requestCount: number;
  lastRun: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDirs(): void {
  for (const dir of [RAW_FIXTURES_DIR, RAW_ODDS_DIR, RAW_INJURIES_DIR, PROCESSED_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadState(): BackfillState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  }
  return {
    fixtures: [],
    oddsCompleted: [],
    injuriesCompleted: [],
    requestCount: 0,
    lastRun: "",
  };
}

function saveState(state: BackfillState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function apiFetch(endpoint: string): Promise<{ response: any[]; remaining: number }> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": API_KEY },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
  }

  const json = await res.json();

  if (json.errors && Object.keys(json.errors).length > 0) {
    const errMsg = JSON.stringify(json.errors);
    if (errMsg.includes("rateLimit")) {
      throw new Error(`Rate limit hit: ${errMsg}`);
    }
    // Some endpoints return empty errors object — only throw on real errors
    if (errMsg !== "{}") {
      console.warn(`  API warning: ${errMsg}`);
    }
  }

  const remaining = parseInt(
    res.headers.get("x-ratelimit-requests-remaining") || "-1",
    10
  );

  return { response: json.response || [], remaining };
}

// ---------------------------------------------------------------------------
// Phase 1: Discover fixtures
// ---------------------------------------------------------------------------

async function discoverFixtures(state: BackfillState): Promise<Fixture[]> {
  console.log("=== Phase 1: Discovering fixtures ===\n");
  console.log(`  Season: ${SEASON}`);
  console.log(`  Date range: ${DATE_FROM} to ${DATE_TO}`);
  console.log(`  Leagues: ${LEAGUES.map((l) => l.code).join(", ")}\n`);

  const allFixtures: Fixture[] = [];

  for (const league of LEAGUES) {
    const endpoint = `/fixtures?league=${league.id}&season=${SEASON}&from=${DATE_FROM}&to=${DATE_TO}`;
    console.log(`  Fetching ${league.code} (${league.name}, id=${league.id})...`);

    try {
      const { response, remaining } = await apiFetch(endpoint);
      state.requestCount++;

      const fixtures: Fixture[] = response.map((f: any) => ({
        fixtureId: f.fixture.id,
        date: f.fixture.date,
        leagueId: league.id,
        leagueCode: league.code,
        homeTeam: f.teams.home.name,
        homeTeamId: f.teams.home.id,
        awayTeam: f.teams.away.name,
        awayTeamId: f.teams.away.id,
        homeGoals: f.goals.home,
        awayGoals: f.goals.away,
        status: f.fixture.status.short,
      }));

      // Save raw response
      const rawFile = path.join(RAW_FIXTURES_DIR, `${league.code}_fixtures.json`);
      fs.writeFileSync(rawFile, JSON.stringify(response, null, 2));

      allFixtures.push(...fixtures);
      console.log(`    -> ${fixtures.length} fixtures (API remaining: ${remaining})`);

      await delay(REQUEST_DELAY_MS);
    } catch (err) {
      console.error(`    ERROR: ${err}`);
    }
  }

  state.fixtures = allFixtures;
  saveState(state);

  return allFixtures;
}

// ---------------------------------------------------------------------------
// Phase 2: Pull odds + injuries for each fixture
// ---------------------------------------------------------------------------

async function pullOddsAndInjuries(state: BackfillState): Promise<void> {
  const fixtures = state.fixtures;
  const oddsSet = new Set(state.oddsCompleted);
  const injuriesSet = new Set(state.injuriesCompleted);

  const oddsRemaining = fixtures.filter((f) => !oddsSet.has(f.fixtureId));
  const injuriesRemaining = fixtures.filter((f) => !injuriesSet.has(f.fixtureId));

  const totalCalls = oddsRemaining.length + injuriesRemaining.length;
  console.log(`\n=== Phase 2: Pulling odds & injuries ===\n`);
  console.log(`  Odds remaining:     ${oddsRemaining.length}/${fixtures.length}`);
  console.log(`  Injuries remaining: ${injuriesRemaining.length}/${fixtures.length}`);
  console.log(`  API calls needed:   ${totalCalls}`);
  console.log(`  Requests used so far: ${state.requestCount}`);
  console.log(`  Daily budget left:  ~${DAILY_LIMIT - state.requestCount}\n`);

  if (totalCalls === 0) {
    console.log("  Nothing to pull — all done!");
    return;
  }

  // Check if we have budget
  if (state.requestCount + totalCalls > DAILY_LIMIT) {
    console.log(`  WARNING: Need ${totalCalls} calls but only ~${DAILY_LIMIT - state.requestCount} remain.`);
    console.log(`  Will pull as many as possible. Re-run tomorrow to continue.\n`);
  }

  // Pull odds
  let callNum = 0;
  for (const fixture of oddsRemaining) {
    if (state.requestCount >= DAILY_LIMIT) {
      console.log(`\n  Daily limit reached (${state.requestCount}). Saving progress.`);
      saveState(state);
      return;
    }

    callNum++;
    const pct = ((callNum / totalCalls) * 100).toFixed(1);
    process.stdout.write(
      `  [${callNum}/${totalCalls}] (${pct}%) Odds for fixture ${fixture.fixtureId} (${fixture.homeTeam} vs ${fixture.awayTeam})... `
    );

    try {
      const { response, remaining } = await apiFetch(`/odds?fixture=${fixture.fixtureId}`);
      state.requestCount++;

      const rawFile = path.join(RAW_ODDS_DIR, `${fixture.fixtureId}.json`);
      fs.writeFileSync(rawFile, JSON.stringify(response, null, 2));

      state.oddsCompleted.push(fixture.fixtureId);
      console.log(`OK (${response.length} bookmakers, API rem: ${remaining})`);
    } catch (err) {
      console.log(`ERROR: ${err}`);
    }

    // Save state periodically
    if (callNum % 10 === 0) saveState(state);

    await delay(REQUEST_DELAY_MS);
  }

  // Pull injuries
  for (const fixture of injuriesRemaining) {
    if (state.requestCount >= DAILY_LIMIT) {
      console.log(`\n  Daily limit reached (${state.requestCount}). Saving progress.`);
      saveState(state);
      return;
    }

    callNum++;
    const pct = ((callNum / totalCalls) * 100).toFixed(1);
    process.stdout.write(
      `  [${callNum}/${totalCalls}] (${pct}%) Injuries for fixture ${fixture.fixtureId} (${fixture.homeTeam} vs ${fixture.awayTeam})... `
    );

    try {
      const { response, remaining } = await apiFetch(`/injuries?fixture=${fixture.fixtureId}`);
      state.requestCount++;

      const rawFile = path.join(RAW_INJURIES_DIR, `${fixture.fixtureId}.json`);
      fs.writeFileSync(rawFile, JSON.stringify(response, null, 2));

      state.injuriesCompleted.push(fixture.fixtureId);
      console.log(`OK (${response.length} injuries, API rem: ${remaining})`);
    } catch (err) {
      console.log(`ERROR: ${err}`);
    }

    if (callNum % 10 === 0) saveState(state);

    await delay(REQUEST_DELAY_MS);
  }

  saveState(state);
  console.log(`\n  Phase 2 complete. Total API requests used: ${state.requestCount}`);
}

// ---------------------------------------------------------------------------
// Phase 3: Process raw data into matches_with_odds.json
// ---------------------------------------------------------------------------

function processResults(state: BackfillState): void {
  console.log(`\n=== Phase 3: Processing results ===\n`);

  const output: any[] = [];

  for (const fixture of state.fixtures) {
    const oddsFile = path.join(RAW_ODDS_DIR, `${fixture.fixtureId}.json`);
    const injuriesFile = path.join(RAW_INJURIES_DIR, `${fixture.fixtureId}.json`);

    // Parse odds
    let odds: any = null;
    if (fs.existsSync(oddsFile)) {
      const rawOdds = JSON.parse(fs.readFileSync(oddsFile, "utf-8"));
      // Extract match-winner (1X2) odds from all bookmakers
      const bookmakers: any[] = [];
      let avgHome = 0, avgDraw = 0, avgAway = 0, count = 0;

      for (const entry of rawOdds) {
        for (const bk of entry.bookmakers || []) {
          const matchWinner = bk.bets?.find((b: any) =>
            b.name === "Match Winner" || b.id === 1
          );
          if (matchWinner) {
            const values = matchWinner.values || [];
            const home = values.find((v: any) => v.value === "Home")?.odd;
            const draw = values.find((v: any) => v.value === "Draw")?.odd;
            const away = values.find((v: any) => v.value === "Away")?.odd;

            if (home && draw && away) {
              bookmakers.push({
                name: bk.name,
                home: parseFloat(home),
                draw: parseFloat(draw),
                away: parseFloat(away),
              });
              avgHome += parseFloat(home);
              avgDraw += parseFloat(draw);
              avgAway += parseFloat(away);
              count++;
            }
          }
        }
      }

      if (count > 0) {
        odds = {
          avgHome: Math.round((avgHome / count) * 100) / 100,
          avgDraw: Math.round((avgDraw / count) * 100) / 100,
          avgAway: Math.round((avgAway / count) * 100) / 100,
          bookmakerCount: count,
          bookmakers,
        };
      }
    }

    // Parse injuries
    let injuries: any[] = [];
    if (fs.existsSync(injuriesFile)) {
      const rawInjuries = JSON.parse(fs.readFileSync(injuriesFile, "utf-8"));
      injuries = rawInjuries.map((inj: any) => ({
        playerId: inj.player?.id,
        playerName: inj.player?.name,
        playerPhoto: inj.player?.photo,
        type: inj.player?.type,
        reason: inj.player?.reason,
        teamId: inj.team?.id,
        teamName: inj.team?.name,
      }));
    }

    output.push({
      fixtureId: fixture.fixtureId,
      date: fixture.date,
      leagueId: fixture.leagueId,
      leagueCode: fixture.leagueCode,
      homeTeam: fixture.homeTeam,
      homeTeamId: fixture.homeTeamId,
      awayTeam: fixture.awayTeam,
      awayTeamId: fixture.awayTeamId,
      homeGoals: fixture.homeGoals,
      awayGoals: fixture.awayGoals,
      status: fixture.status,
      odds,
      injuries,
    });
  }

  const outFile = path.join(PROCESSED_DIR, "matches_with_odds.json");
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));

  // Summary
  const withOdds = output.filter((m) => m.odds !== null).length;
  const withInjuries = output.filter((m) => m.injuries.length > 0).length;
  const totalInjuries = output.reduce((sum, m) => sum + m.injuries.length, 0);

  console.log(`  Matches processed:   ${output.length}`);
  console.log(`  With odds data:      ${withOdds}`);
  console.log(`  With injury data:    ${withInjuries}`);
  console.log(`  Total injuries:      ${totalInjuries}`);
  console.log(`  Output: ${outFile}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`  API key: ${API_KEY.substring(0, 6)}...${API_KEY.substring(API_KEY.length - 4)}`);

  const dryRun = process.argv.includes("--dry-run");
  const processOnly = process.argv.includes("--process-only");

  ensureDirs();
  const state = loadState();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  API-Football Backfill: Odds & Injuries");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (processOnly) {
    if (state.fixtures.length === 0) {
      console.error("No fixtures in state. Run discovery first (without --process-only).");
      process.exit(1);
    }
    processResults(state);
    return;
  }

  // Phase 1: Discover fixtures
  const fixtures = state.fixtures.length > 0 ? state.fixtures : await discoverFixtures(state);

  // Show match count summary
  console.log("\n━━━ MATCH COUNT SUMMARY ━━━\n");
  console.log(`  Total matches found: ${fixtures.length}`);
  console.log("");

  const byLeague: Record<string, number> = {};
  for (const l of LEAGUES) byLeague[l.code] = 0;
  for (const f of fixtures) byLeague[f.leagueCode]++;
  for (const [code, count] of Object.entries(byLeague)) {
    const league = LEAGUES.find((l) => l.code === code);
    console.log(`  ${code.padEnd(4)} ${(league?.name || "").padEnd(16)} ${count} matches`);
  }

  const apiCallsNeeded =
    fixtures.length * 2 -
    state.oddsCompleted.length -
    state.injuriesCompleted.length;

  console.log("");
  console.log(`  API calls needed: ${apiCallsNeeded} (${fixtures.length} odds + ${fixtures.length} injuries - ${state.oddsCompleted.length + state.injuriesCompleted.length} already done)`);
  console.log(`  Estimated time:   ~${Math.ceil((apiCallsNeeded * REQUEST_DELAY_MS) / 60000)} minutes`);
  console.log(`  Daily limit:      ${DAILY_LIMIT} requests/day`);
  console.log("");

  if (dryRun) {
    console.log("  --dry-run: Stopping after discovery. Run without --dry-run to pull data.\n");

    // Print first few fixtures as sample
    console.log("  Sample fixtures:");
    for (const f of fixtures.slice(0, 5)) {
      console.log(`    ${f.date.substring(0, 10)} ${f.leagueCode} ${f.homeTeam} vs ${f.awayTeam} (${f.status}) [id=${f.fixtureId}]`);
    }
    if (fixtures.length > 5) {
      console.log(`    ... and ${fixtures.length - 5} more`);
    }
    console.log("");
    return;
  }

  // Phase 2: Pull odds and injuries
  await pullOddsAndInjuries(state);

  // Phase 3: Process
  processResults(state);

  state.lastRun = new Date().toISOString();
  saveState(state);

  console.log("━━━ Backfill complete ━━━\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
