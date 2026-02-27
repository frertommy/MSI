/**
 * Run all v1 ingest scripts — snapshot v0 data into L1 raw.
 *
 * Usage: npx tsx src/ingest/runIngest.ts
 */
import { ingestMatches, ingestTeamRegistry } from "./ingestMatches";
import { ingestOdds } from "./ingestOdds";
import { ingestInjuries } from "./ingestInjuries";
import { ingestNews } from "./ingestNews";

function main() {
  console.log("━━━ v1 Ingest Pipeline ━━━\n");
  const results: Record<string, { file: string; count: number }> = {};

  console.log("[1/5] Matches...");
  results.matches = ingestMatches();

  console.log("[2/5] Team Registry...");
  results.registry = ingestTeamRegistry();

  console.log("[3/5] Odds...");
  results.odds = ingestOdds();

  console.log("[4/5] Injuries...");
  results.injuries = ingestInjuries();

  console.log("[5/5] News...");
  results.news = ingestNews();

  console.log("\n━━━ Ingest Summary ━━━");
  for (const [key, r] of Object.entries(results)) {
    if (r.file) {
      console.log(`  ${key}: ${r.count} items → ${r.file.split("/").pop()}`);
    } else {
      console.log(`  ${key}: skipped (no source data)`);
    }
  }
  console.log("\nAll L1 raw snapshots written to data_v1/l1_facts/raw/");
}

main();
