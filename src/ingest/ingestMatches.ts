/**
 * Ingest matches into L1 raw.
 *
 * Reads the current v0 matches_all.json + teams_registry.json and writes
 * an immutable snapshot into data_v1/l1_facts/raw/matches/.
 *
 * Does NOT modify any v0 files.
 */
import fs from "fs";
import path from "path";
import {
  writeImmutable,
  timestampTag,
  contentHash,
  L1_RAW_MATCHES,
  V0_DATA_DIR,
} from "../storage";

export function ingestMatches(): { file: string; count: number } {
  const matchesFile = path.join(V0_DATA_DIR, "matches_all.json");
  if (!fs.existsSync(matchesFile)) {
    throw new Error("matches_all.json not found. Run v0 pipeline first.");
  }
  const matches = JSON.parse(fs.readFileSync(matchesFile, "utf-8"));
  const hash = contentHash(matches);
  const tag = timestampTag();
  const fileName = `${tag}_matches_${hash}.json`;
  const filePath = path.join(L1_RAW_MATCHES, fileName);

  const payload = {
    source: "v0_matches_all",
    fetchedAt: new Date().toISOString(),
    payloadHash: hash,
    matchCount: matches.length,
    data: matches,
  };

  writeImmutable(filePath, payload);
  console.log(`  L1 raw matches: ${filePath} (${matches.length} matches)`);
  return { file: filePath, count: matches.length };
}

// Also ingest the team registry as a separate raw fact
export function ingestTeamRegistry(): { file: string; count: number } {
  const registryFile = path.join(V0_DATA_DIR, "teams_registry.json");
  if (!fs.existsSync(registryFile)) {
    throw new Error("teams_registry.json not found. Run v0 pipeline first.");
  }
  const registry = JSON.parse(fs.readFileSync(registryFile, "utf-8"));
  const hash = contentHash(registry);
  const tag = timestampTag();
  const fileName = `${tag}_teams_registry_${hash}.json`;
  const filePath = path.join(L1_RAW_MATCHES, fileName);

  const teamCount = Object.keys(registry).length;
  const payload = {
    source: "v0_teams_registry",
    fetchedAt: new Date().toISOString(),
    payloadHash: hash,
    teamCount,
    data: registry,
  };

  writeImmutable(filePath, payload);
  console.log(`  L1 raw registry: ${filePath} (${teamCount} teams)`);
  return { file: filePath, count: teamCount };
}

if (require.main === module) {
  console.log("Ingesting matches into L1 raw...");
  ingestMatches();
  ingestTeamRegistry();
  console.log("Done.");
}
