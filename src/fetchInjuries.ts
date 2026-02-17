import * as fs from "fs";
import * as path from "path";

const API_KEY = process.env.API_FOOTBALL_KEY || "1109c634f7989ac2ca9e96a37e7c7b72";
const BASE_URL = "https://v3.football.api-sports.io";

const LEAGUES = [
  { id: 39, code: "PL", season: 2024 },
  { id: 140, code: "PD", season: 2024 },
  { id: 78, code: "BL1", season: 2024 },
  { id: 135, code: "SA", season: 2024 },
  { id: 61, code: "FL1", season: 2024 },
];

interface APIInjuryResponse {
  player: {
    id: number;
    name: string;
    photo: string;
    type: string;
    reason: string;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  fixture: {
    id: number;
    timezone: string;
    date: string;
  };
  league: {
    id: number;
    season: number;
    name: string;
    country: string;
  };
}

interface ProcessedInjury {
  playerName: string;
  playerId: number;
  position: string; // filled from squad data if available, else from type
  reason: string;
  type: string;
  teamApiName: string;
  teamId: number;
}

interface ProcessedTeamInjuries {
  team: string;
  league: string;
  injuries: ProcessedInjury[];
}

interface InjuryData {
  fetchedAt: string;
  teams: Record<string, ProcessedTeamInjuries>;
  unmappedTeams: string[];
  totalInjuries: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchInjuriesForLeague(
  leagueId: number,
  season: number
): Promise<{ data: APIInjuryResponse[]; remaining: number | null }> {
  const url = `${BASE_URL}/injuries?league=${leagueId}&season=${season}`;

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
  const remaining = json.errors?.rateLimit
    ? 0
    : parseInt(
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
  const injuryDir = path.join(dataDir, "injuries");
  const rawDir = path.join(injuryDir, "raw");
  fs.mkdirSync(rawDir, { recursive: true });

  const today = new Date().toISOString().substring(0, 10);

  // Load name mapping
  const mappingFile = path.join(dataDir, "name_mapping_injuries.json");
  const nameMapping: Record<string, string> = fs.existsSync(mappingFile)
    ? JSON.parse(fs.readFileSync(mappingFile, "utf-8"))
    : {};

  // Load team registry for validation
  const registryFile = path.join(dataDir, "teams_registry.json");
  const registry: Record<string, { league: string }> = fs.existsSync(
    registryFile
  )
    ? JSON.parse(fs.readFileSync(registryFile, "utf-8"))
    : {};

  // Load team IDs file
  const teamIdsFile = path.join(dataDir, "team_ids_api_football.json");
  const teamIds: Record<string, number> = fs.existsSync(teamIdsFile)
    ? JSON.parse(fs.readFileSync(teamIdsFile, "utf-8"))
    : {};

  // Load squad data for positions
  const squadsFile = path.join(dataDir, "squads", "all_squads.json");
  const squads: Record<
    string,
    { id: number; name: string; position: string }[]
  > = fs.existsSync(squadsFile)
    ? JSON.parse(fs.readFileSync(squadsFile, "utf-8"))
    : {};

  console.log("Fetching injuries from API-Football...\n");

  const allRawResponses: APIInjuryResponse[] = [];
  const apiTeamNames = new Set<string>();
  const apiTeamIdMap: Record<string, number> = {};
  let lastRemaining: number | null = null;

  for (const league of LEAGUES) {
    try {
      console.log(`  ${league.code} (league ${league.id}, season ${league.season})...`);
      const { data, remaining } = await fetchInjuriesForLeague(
        league.id,
        league.season
      );
      lastRemaining = remaining;

      // Save raw response
      const rawFile = path.join(rawDir, `${league.code}_${today}.json`);
      fs.writeFileSync(rawFile, JSON.stringify(data, null, 2));

      allRawResponses.push(...data);

      // Collect team names and IDs
      for (const inj of data) {
        apiTeamNames.add(inj.team.name);
        apiTeamIdMap[inj.team.name] = inj.team.id;
      }

      console.log(`    → ${data.length} injuries`);
      console.log(`    → Requests remaining: ${remaining}`);

      // 3-second delay between API calls
      await delay(3000);
    } catch (err) {
      console.error(`  ERROR fetching ${league.code}: ${err}`);
    }
  }

  // Update team ID mapping from discovered IDs
  let newIdCount = 0;
  for (const [apiName, apiId] of Object.entries(apiTeamIdMap)) {
    const internalName = nameMapping[apiName] || apiName;
    if (registry[internalName] && !teamIds[internalName]) {
      teamIds[internalName] = apiId;
      newIdCount++;
    }
  }
  if (newIdCount > 0) {
    fs.writeFileSync(teamIdsFile, JSON.stringify(teamIds, null, 2));
    console.log(`\nUpdated ${teamIdsFile} (+${newIdCount} new IDs)`);
  }

  // Resolve team names: API name → internal name
  function resolveTeamName(apiName: string): string | null {
    if (registry[apiName]) return apiName;
    const mapped = nameMapping[apiName];
    if (mapped && registry[mapped]) return mapped;
    return null;
  }

  // Get player position from squad data
  function getPlayerPosition(
    teamId: number,
    playerName: string,
    fallbackType: string
  ): string {
    const teamIdStr = String(teamId);
    const squad = squads[teamIdStr];
    if (squad) {
      const player = squad.find(
        (p) =>
          p.name === playerName ||
          p.name.includes(playerName) ||
          playerName.includes(p.name)
      );
      if (player) return player.position;
    }
    // Fallback: try to infer from injury type/reason
    if (fallbackType.toLowerCase().includes("goalkeeper")) return "Goalkeeper";
    return "Unknown";
  }

  // Group injuries by resolved team name
  const teamInjuries: Record<string, ProcessedTeamInjuries> = {};
  const unmappedTeams = new Set<string>();
  let totalInjuries = 0;

  for (const inj of allRawResponses) {
    const internalName = resolveTeamName(inj.team.name);
    if (!internalName) {
      unmappedTeams.add(inj.team.name);
      continue;
    }

    if (!teamInjuries[internalName]) {
      teamInjuries[internalName] = {
        team: internalName,
        league: registry[internalName]?.league || "",
        injuries: [],
      };
    }

    const position = getPlayerPosition(
      inj.team.id,
      inj.player.name,
      inj.player.type
    );

    teamInjuries[internalName].injuries.push({
      playerName: inj.player.name,
      playerId: inj.player.id,
      position,
      reason: inj.player.reason || inj.player.type,
      type: inj.player.type,
      teamApiName: inj.team.name,
      teamId: inj.team.id,
    });
    totalInjuries++;
  }

  // Deduplicate injuries per team by playerId (API returns one record per fixture missed)
  let deduped = 0;
  for (const teamData of Object.values(teamInjuries)) {
    const seen = new Set<number>();
    const unique: ProcessedInjury[] = [];
    for (const inj of teamData.injuries) {
      if (!seen.has(inj.playerId)) {
        seen.add(inj.playerId);
        unique.push(inj);
      }
    }
    deduped += teamData.injuries.length - unique.length;
    teamData.injuries = unique;
  }
  totalInjuries -= deduped;
  console.log(`\nDeduplicated ${deduped} duplicate injury records`);

  // Save processed injury data
  const injuryOutput: InjuryData = {
    fetchedAt: new Date().toISOString(),
    teams: teamInjuries,
    unmappedTeams: [...unmappedTeams],
    totalInjuries,
  };

  const currentFile = path.join(injuryDir, "current.json");
  fs.writeFileSync(currentFile, JSON.stringify(injuryOutput, null, 2));
  console.log(`\nSaved ${currentFile}`);

  // Report unmapped teams
  if (unmappedTeams.size > 0) {
    console.log(`\n⚠ Unmapped team names (${unmappedTeams.size}):`);
    for (const name of [...unmappedTeams].sort()) {
      console.log(`  - "${name}" (API ID: ${apiTeamIdMap[name]})`);
    }
    console.log(
      "  Add these to data/name_mapping_injuries.json"
    );
  } else if (apiTeamNames.size > 0) {
    console.log(
      `\n✓ All ${apiTeamNames.size} team names mapped successfully`
    );
  }

  // Summary
  console.log(`\n━━━ Injury Fetch Summary ━━━`);
  console.log(`  Total injuries: ${totalInjuries}`);
  console.log(`  Teams with injuries: ${Object.keys(teamInjuries).length}`);
  console.log(`  Unmapped teams: ${unmappedTeams.size}`);
  console.log(`  API requests remaining: ${lastRemaining}`);
  console.log(`  Fetched at: ${injuryOutput.fetchedAt}`);
}

main();
