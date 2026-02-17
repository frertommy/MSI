import * as fs from "fs";
import * as path from "path";

const API_KEY = "1109c634f7989ac2ca9e96a37e7c7b72";
const BASE_URL = "https://v3.football.api-sports.io";

// Max age before refetching a squad (30 days)
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface APISquadPlayer {
  id: number;
  name: string;
  age: number;
  number: number | null;
  position: string;
  photo: string;
}

interface APISquadResponse {
  team: {
    id: number;
    name: string;
    logo: string;
  };
  players: APISquadPlayer[];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchSquad(
  teamId: number
): Promise<{ data: APISquadResponse[]; remaining: number | null }> {
  const url = `${BASE_URL}/players/squads?team=${teamId}`;

  const res = await fetch(url, {
    headers: {
      "x-apisports-key": API_KEY,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error: ${res.status} ${res.statusText} — ${body}`);
  }

  const json = await res.json();
  const remaining = parseInt(
    res.headers.get("x-ratelimit-requests-remaining") || "0",
    10
  );

  return {
    data: json.response || [],
    remaining,
  };
}

async function main() {
  const dataDir = path.join(__dirname, "..", "data");
  const squadsDir = path.join(dataDir, "squads");
  fs.mkdirSync(squadsDir, { recursive: true });

  // Load team IDs
  const teamIdsFile = path.join(dataDir, "team_ids_api_football.json");
  if (!fs.existsSync(teamIdsFile)) {
    console.error(
      "team_ids_api_football.json not found. Run fetch:injuries first to discover team IDs."
    );
    process.exit(1);
  }

  const teamIds: Record<string, number> = JSON.parse(
    fs.readFileSync(teamIdsFile, "utf-8")
  );

  // Load MSI ratings to prioritize top teams
  const ratingsFile = path.join(dataDir, "msi_ratings.json");
  const ratings: { teams: { team: string; rating: number }[] } =
    fs.existsSync(ratingsFile)
      ? JSON.parse(fs.readFileSync(ratingsFile, "utf-8"))
      : { teams: [] };

  // Sort teams by rating, pick top ones that have API-Football IDs
  const teamsToFetch: { name: string; id: number }[] = [];
  for (const t of ratings.teams) {
    if (teamIds[t.team]) {
      teamsToFetch.push({ name: t.team, id: teamIds[t.team] });
    }
  }

  // Budget: check which squads need refreshing
  const now = Date.now();
  const needsRefresh: { name: string; id: number }[] = [];

  for (const team of teamsToFetch) {
    const squadFile = path.join(squadsDir, `${team.id}.json`);
    if (fs.existsSync(squadFile)) {
      const stat = fs.statSync(squadFile);
      if (now - stat.mtimeMs < MAX_AGE_MS) {
        continue; // Fresh enough, skip
      }
    }
    needsRefresh.push(team);
  }

  // Cap at available budget (leave buffer for daily injury fetches)
  const maxFetches = Math.min(needsRefresh.length, 80);
  const toFetch = needsRefresh.slice(0, maxFetches);

  console.log(`Squad data: ${teamsToFetch.length} teams have API IDs`);
  console.log(`  ${needsRefresh.length} need refresh (>${MAX_AGE_MS / 86400000} days old or missing)`);
  console.log(`  Fetching ${toFetch.length} squads...\n`);

  const allSquads: Record<
    string,
    { id: number; name: string; position: string }[]
  > = {};

  // Load existing combined data
  const allSquadsFile = path.join(squadsDir, "all_squads.json");
  if (fs.existsSync(allSquadsFile)) {
    Object.assign(
      allSquads,
      JSON.parse(fs.readFileSync(allSquadsFile, "utf-8"))
    );
  }

  let fetched = 0;
  let lastRemaining: number | null = null;

  for (const team of toFetch) {
    try {
      console.log(`  ${team.name} (ID: ${team.id})...`);
      const { data, remaining } = await fetchSquad(team.id);
      lastRemaining = remaining;

      if (data.length > 0) {
        const squad = data[0];
        const players = squad.players.map((p) => ({
          id: p.id,
          name: p.name,
          position: p.position,
        }));

        // Save individual file
        const squadFile = path.join(squadsDir, `${team.id}.json`);
        fs.writeFileSync(squadFile, JSON.stringify(players, null, 2));

        // Add to combined data
        allSquads[String(team.id)] = players;

        console.log(`    → ${players.length} players`);
      } else {
        console.log(`    → No squad data returned`);
      }

      console.log(`    → Requests remaining: ${remaining}`);
      fetched++;

      if (remaining !== null && remaining <= 10) {
        console.warn(`\n⚠ Only ${remaining} API requests remaining. Stopping.`);
        break;
      }

      // 3-second delay between calls
      await delay(3000);
    } catch (err) {
      console.error(`  ERROR fetching ${team.name}: ${err}`);
    }
  }

  // Save combined data
  fs.writeFileSync(allSquadsFile, JSON.stringify(allSquads, null, 2));
  console.log(`\nSaved ${allSquadsFile} (${Object.keys(allSquads).length} teams)`);

  console.log(`\n━━━ Squad Fetch Summary ━━━`);
  console.log(`  Fetched: ${fetched} / ${toFetch.length}`);
  console.log(`  Total cached: ${Object.keys(allSquads).length} teams`);
  console.log(`  API requests remaining: ${lastRemaining}`);
}

main();
