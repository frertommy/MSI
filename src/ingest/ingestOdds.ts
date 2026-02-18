/**
 * Ingest odds into L1 raw.
 *
 * Reads the current v0 odds/current.json and writes an immutable snapshot
 * into data_v1/l1_facts/raw/odds/.
 */
import fs from "fs";
import path from "path";
import {
  writeImmutable,
  timestampTag,
  contentHash,
  L1_RAW_ODDS,
  V0_DATA_DIR,
} from "../storage";

export function ingestOdds(): { file: string; count: number } {
  const oddsFile = path.join(V0_DATA_DIR, "odds", "current.json");
  if (!fs.existsSync(oddsFile)) {
    console.log("  No odds data found — skipping.");
    return { file: "", count: 0 };
  }
  const odds = JSON.parse(fs.readFileSync(oddsFile, "utf-8"));
  const hash = contentHash(odds);
  const tag = timestampTag();
  const fileName = `${tag}_odds_${hash}.json`;
  const filePath = path.join(L1_RAW_ODDS, fileName);

  const fixtureCount = odds.fixtures?.length ?? 0;
  const payload = {
    source: "v0_odds_current",
    fetchedAt: odds.fetchedAt || new Date().toISOString(),
    payloadHash: hash,
    fixtureCount,
    data: odds,
  };

  writeImmutable(filePath, payload);
  console.log(`  L1 raw odds: ${filePath} (${fixtureCount} fixtures)`);
  return { file: filePath, count: fixtureCount };
}

if (require.main === module) {
  console.log("Ingesting odds into L1 raw...");
  ingestOdds();
  console.log("Done.");
}
