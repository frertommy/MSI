import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const API_KEY = process.env.ODDS_API_KEY || process.env.ODDS2_API_KEY;
if (!API_KEY) {
  console.error("ODDS_API_KEY or ODDS2_API_KEY must be set");
  process.exit(1);
}
const BASE_URL = "https://api.the-odds-api.com/v4";

const SPORT_KEYS: Record<string, string> = {
  PL: "soccer_epl",
  PD: "soccer_spain_la_liga",
  BL1: "soccer_germany_bundesliga",
  SA: "soccer_italy_serie_a",
  FL1: "soccer_france_ligue_one",
};

const LEAGUE_LABELS: Record<string, string> = {
  soccer_epl: "PL",
  soccer_spain_la_liga: "PD",
  soccer_germany_bundesliga: "BL1",
  soccer_italy_serie_a: "SA",
  soccer_france_ligue_one: "FL1",
};

interface OddsOutcome {
  name: string;
  price: number;
}

interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}

interface OddsBookmaker {
  key: string;
  title: string;
  markets: OddsMarket[];
}

interface OddsEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
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

function rawImpliedProb(decimalOdds: number): number {
  return 1 / decimalOdds;
}

function normalizeProbs(
  home: number,
  draw: number,
  away: number
): { home: number; draw: number; away: number } {
  const total = home + draw + away;
  return {
    home: home / total,
    draw: draw / total,
    away: away / total,
  };
}

async function fetchOddsForSport(
  sportKey: string
): Promise<{ events: OddsEvent[]; remaining: number | null }> {
  const url = `${BASE_URL}/sports/${sportKey}/odds?apiKey=${API_KEY}&regions=uk,eu&markets=h2h&oddsFormat=decimal`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `API error for ${sportKey}: ${res.status} ${res.statusText} — ${body}`
    );
  }

  const remaining = res.headers.get("x-requests-remaining");
  const events: OddsEvent[] = await res.json();
  return {
    events,
    remaining: remaining ? parseInt(remaining, 10) : null,
  };
}

function processEvents(events: OddsEvent[]): ProcessedFixture[] {
  const fixtures: ProcessedFixture[] = [];

  for (const event of events) {
    const homeOdds: number[] = [];
    const drawOdds: number[] = [];
    const awayOdds: number[] = [];

    for (const bookmaker of event.bookmakers) {
      const h2h = bookmaker.markets.find((m) => m.key === "h2h");
      if (!h2h) continue;

      const homeOutcome = h2h.outcomes.find(
        (o) => o.name === event.home_team
      );
      const awayOutcome = h2h.outcomes.find(
        (o) => o.name === event.away_team
      );
      const drawOutcome = h2h.outcomes.find((o) => o.name === "Draw");

      if (homeOutcome && awayOutcome && drawOutcome) {
        homeOdds.push(homeOutcome.price);
        drawOdds.push(drawOutcome.price);
        awayOdds.push(awayOutcome.price);
      }
    }

    if (homeOdds.length === 0) continue;

    const avg = (arr: number[]) =>
      arr.reduce((s, v) => s + v, 0) / arr.length;
    const avgHome = avg(homeOdds);
    const avgDraw = avg(drawOdds);
    const avgAway = avg(awayOdds);

    const rawHome = rawImpliedProb(avgHome);
    const rawDraw = rawImpliedProb(avgDraw);
    const rawAway = rawImpliedProb(avgAway);
    const normalized = normalizeProbs(rawHome, rawDraw, rawAway);

    const league = LEAGUE_LABELS[event.sport_key] || event.sport_key;

    fixtures.push({
      id: event.id,
      league,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      kickoff: event.commence_time,
      avgOdds: {
        home: Math.round(avgHome * 100) / 100,
        draw: Math.round(avgDraw * 100) / 100,
        away: Math.round(avgAway * 100) / 100,
      },
      impliedProb: {
        home: Math.round(normalized.home * 1000) / 1000,
        draw: Math.round(normalized.draw * 1000) / 1000,
        away: Math.round(normalized.away * 1000) / 1000,
      },
      bookmakerCount: homeOdds.length,
      oddsRange: {
        home: [Math.min(...homeOdds), Math.max(...homeOdds)],
        draw: [Math.min(...drawOdds), Math.max(...drawOdds)],
        away: [Math.min(...awayOdds), Math.max(...awayOdds)],
      },
    });
  }

  return fixtures;
}

async function main() {
  const dataDir = path.join(__dirname, "..", "data");
  const oddsDir = path.join(dataDir, "odds");
  const rawDir = path.join(oddsDir, "raw");
  fs.mkdirSync(rawDir, { recursive: true });

  const today = new Date().toISOString().substring(0, 10);
  const allFixtures: ProcessedFixture[] = [];
  let lastRemaining: number | null = null;
  const allTeamNames = new Set<string>();

  console.log("Fetching odds from The Odds API...\n");

  for (const [leagueCode, sportKey] of Object.entries(SPORT_KEYS)) {
    try {
      console.log(`  ${leagueCode} (${sportKey})...`);
      const { events, remaining } = await fetchOddsForSport(sportKey);
      lastRemaining = remaining;

      // Save raw response
      const rawFile = path.join(rawDir, `${sportKey}_${today}.json`);
      fs.writeFileSync(rawFile, JSON.stringify(events, null, 2));

      // Process
      const fixtures = processEvents(events);
      allFixtures.push(...fixtures);

      // Collect team names
      for (const e of events) {
        allTeamNames.add(e.home_team);
        allTeamNames.add(e.away_team);
      }

      console.log(
        `    → ${events.length} events, ${fixtures.length} with h2h odds`
      );
      console.log(`    → Requests remaining: ${remaining}`);

      if (remaining !== null && remaining <= 100) {
        console.warn(`    ⚠ WARNING: Only ${remaining} requests remaining!`);
      }
      if (remaining !== null && remaining <= 50) {
        console.warn(`    ⚠ CRITICAL: Only ${remaining} requests remaining!`);
      }

      // Small delay between requests
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ERROR fetching ${leagueCode}: ${err}`);
    }
  }

  // Save processed odds
  const processed: ProcessedOdds = {
    fetchedAt: new Date().toISOString(),
    requestsRemaining: lastRemaining,
    fixtures: allFixtures,
  };

  const currentFile = path.join(oddsDir, "current.json");
  fs.writeFileSync(currentFile, JSON.stringify(processed, null, 2));
  console.log(`\nSaved ${currentFile} (${allFixtures.length} fixtures)`);

  // Check name mapping coverage
  const mappingFile = path.join(dataDir, "name_mapping_odds.json");
  const nameMapping: Record<string, string> = fs.existsSync(mappingFile)
    ? JSON.parse(fs.readFileSync(mappingFile, "utf-8"))
    : {};

  const registryFile = path.join(dataDir, "teams_registry.json");
  const registry: Record<string, unknown> = fs.existsSync(registryFile)
    ? JSON.parse(fs.readFileSync(registryFile, "utf-8"))
    : {};

  const unmapped: string[] = [];
  for (const name of allTeamNames) {
    const mapped = nameMapping[name];
    if (!mapped) {
      // Try direct match in registry
      if (!registry[name]) {
        unmapped.push(name);
      }
    }
  }

  if (unmapped.length > 0) {
    console.log(`\n⚠ Unmatched team names (${unmapped.length}):`);
    for (const name of unmapped.sort()) {
      console.log(`  - "${name}"`);
    }
    console.log(
      "  Add these to data/name_mapping_odds.json to map them to internal names."
    );
  } else {
    console.log(`\n✓ All ${allTeamNames.size} team names mapped successfully`);
  }

  // Summary
  console.log(`\n━━━ Odds Fetch Summary ━━━`);
  console.log(`  Fixtures: ${allFixtures.length}`);
  console.log(`  Leagues: ${new Set(allFixtures.map((f) => f.league)).size}`);
  console.log(`  Teams: ${allTeamNames.size}`);
  console.log(`  Requests remaining: ${lastRemaining}`);
  console.log(`  Fetched at: ${processed.fetchedAt}`);
}

main();
