/**
 * Ingest injuries into L1 raw.
 *
 * Reads the current v0 injuries/current.json and writes an immutable snapshot
 * into data_v1/l1_facts/raw/injuries/.
 */
import fs from "fs";
import path from "path";
import {
  writeImmutable,
  timestampTag,
  contentHash,
  L1_RAW_INJURIES,
  V0_DATA_DIR,
} from "../storage";

export function ingestInjuries(): { file: string; count: number } {
  const injFile = path.join(V0_DATA_DIR, "injuries", "current.json");
  if (!fs.existsSync(injFile)) {
    console.log("  No injury data found — skipping.");
    return { file: "", count: 0 };
  }
  const injuries = JSON.parse(fs.readFileSync(injFile, "utf-8"));
  const hash = contentHash(injuries);
  const tag = timestampTag();
  const fileName = `${tag}_injuries_${hash}.json`;
  const filePath = path.join(L1_RAW_INJURIES, fileName);

  const totalInjuries = injuries.totalInjuries ?? 0;
  const payload = {
    source: "v0_injuries_current",
    fetchedAt: injuries.fetchedAt || new Date().toISOString(),
    payloadHash: hash,
    totalInjuries,
    data: injuries,
  };

  writeImmutable(filePath, payload);
  console.log(`  L1 raw injuries: ${filePath} (${totalInjuries} injuries)`);
  return { file: filePath, count: totalInjuries };
}

if (require.main === module) {
  console.log("Ingesting injuries into L1 raw...");
  ingestInjuries();
  console.log("Done.");
}
