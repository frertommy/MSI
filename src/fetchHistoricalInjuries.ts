import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const API_KEY = process.env.API_FOOTBALL_KEY || process.env.API2_FOOTBALL_KEY;
if (!API_KEY) {
  console.error("API_FOOTBALL_KEY or API2_FOOTBALL_KEY must be set");
  process.exit(1);
}
const BASE_URL = "https://v3.football.api-sports.io";

const LEAGUES = [
  { id: 39, code: "PL", season: 2024 },
  { id: 140, code: "PD", season: 2024 },
  { id: 78, code: "BL1", season: 2024 },
  { id: 135, code: "SA", season: 2024 },
  { id: 61, code: "FL1", season: 2024 },
];

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Fetch injuries for all leagues on a specific date
async function fetchInjuriesForDate(date: string) {
  console.log(`\nFetching injuries for ${date}...`);
  const allInjuries: any[] = [];

  for (const league of LEAGUES) {
    const url = `${BASE_URL}/injuries?league=${league.id}&season=${league.season}&date=${date}`;

    const res = await fetch(url, {
      headers: { "x-apisports-key": API_KEY },
    });

    if (!res.ok) {
      console.error(`  ERROR ${league.code}: ${res.status} ${res.statusText}`);
      continue;
    }

    const json = await res.json();
    const injuries = json.response || [];
    allInjuries.push(...injuries);
    console.log(`  ${league.code}: ${injuries.length} injuries`);

    await delay(1000); // Rate limit safety
  }

  return allInjuries;
}

async function main() {
  const dataDir = path.join(__dirname, "..", "data");
  const archiveDir = path.join(dataDir, "injuries", "archive");
  fs.mkdirSync(archiveDir, { recursive: true });

  // Last 30 days
  const today = new Date();
  const dates: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().substring(0, 10));
  }

  console.log(`Backfilling ${dates.length} days of injury data...`);

  for (const date of dates) {
    const archiveFile = path.join(archiveDir, `${date}.json`);

    // Skip if already fetched
    if (fs.existsSync(archiveFile)) {
      console.log(`Skipping ${date} (already exists)`);
      continue;
    }

    try {
      const injuries = await fetchInjuriesForDate(date);
      fs.writeFileSync(archiveFile, JSON.stringify(injuries, null, 2));
      console.log(`  Saved ${injuries.length} total injuries for ${date}`);
    } catch (err) {
      console.error(`  ERROR on ${date}:`, err);
    }

    await delay(2000); // Be nice to the API
  }

  console.log("\nBackfill complete!");
}

main();
