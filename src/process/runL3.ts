/**
 * L3 Pipeline — Compute market-derived continuous pricing.
 *
 * Reads L1 canonical odds + L2 ratings → computes L3 → writes output.
 *
 * Usage: npx tsx src/process/runL3.ts
 */

import fs from "fs";
import path from "path";
import {
  computeL3Ratings,
  DEFAULT_L3_PARAMS,
  type OddsSnapshot,
  type L2Rating,
  type L3RunOutput,
} from "./l3Engine";
import { generateRunId } from "../storage/fsGuard";

const L1_CANONICAL = path.join(process.cwd(), "data_v1", "l1_facts", "canonical");
const L2_DIR = path.join(process.cwd(), "data_v1", "l2_derived");
const L3_DIR = path.join(process.cwd(), "data_v1", "l3_derived");
const L3_RUNS = path.join(L3_DIR, "runs");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  console.log("┌─────────────────────────────────────────┐");
  console.log("│  L3 Pipeline — Market-Derived Pricing    │");
  console.log("└─────────────────────────────────────────┘\n");

  // 1. Read L1 odds snapshots
  const oddsPath = path.join(L1_CANONICAL, "odds_snapshots.json");
  if (!fs.existsSync(oddsPath)) {
    console.error("✗ No L1 odds snapshots found. Run pipeline:v1 first.");
    process.exit(1);
  }
  const oddsSnapshots: OddsSnapshot[] = JSON.parse(fs.readFileSync(oddsPath, "utf-8"));
  console.log(`  ✓ Loaded ${oddsSnapshots.length} odds snapshots from L1`);

  // 2. Read L2 latest run ratings
  const latestRunPath = path.join(L2_DIR, "latest_run.json");
  if (!fs.existsSync(latestRunPath)) {
    console.error("✗ No L2 runs found. Run pipeline:v1 first.");
    process.exit(1);
  }
  const latestRun = JSON.parse(fs.readFileSync(latestRunPath, "utf-8"));
  const ratingsPath = path.join(L2_DIR, "runs", latestRun.runId, "msi_ratings.json");
  const ratingsFile = JSON.parse(fs.readFileSync(ratingsPath, "utf-8"));
  const l2Ratings: L2Rating[] = ratingsFile.ratings.map((r: any) => ({
    team: r.team,
    league: r.league,
    msiBase: r.msiBase,
    msiOdds: r.msiOdds,
    msiFinal: r.msiFinal,
    confidence: r.confidence,
  }));
  console.log(`  ✓ Loaded ${l2Ratings.length} L2 ratings from run ${latestRun.runId}`);

  // 3. Also read L2 timeseries for L3 historical computation
  const dailyPath = path.join(L2_DIR, "runs", latestRun.runId, "msi_daily.json");
  let l2Daily: Record<string, { date: string; baseElo: number; eloOdds?: number }[]> = {};
  if (fs.existsSync(dailyPath)) {
    l2Daily = JSON.parse(fs.readFileSync(dailyPath, "utf-8"));
    console.log(`  ✓ Loaded L2 daily timeseries`);
  }

  // 4. Compute L3 ratings
  const params = DEFAULT_L3_PARAMS;
  const now = new Date();
  const l3Ratings = computeL3Ratings(oddsSnapshots, l2Ratings, params, now);

  const withOdds = l3Ratings.filter((r) => r.components.matchCount > 0);
  console.log(`\n  ✓ Computed L3 ratings for ${l3Ratings.length} teams`);
  console.log(`    - ${withOdds.length} teams with live odds data`);
  console.log(`    - ${l3Ratings.length - withOdds.length} teams using L2 fallback`);

  // 5. Compute L3 timeseries per team (apply L3 formula to historical L2 data)
  const l3Daily: Record<string, { date: string; baseElo: number; l3Rating: number; oraclePrice: number }[]> = {};
  for (const team of l3Ratings) {
    const ts = l2Daily[team.team];
    if (!ts || ts.length === 0) continue;

    // For historical points, we apply the L3 formula using the team's current market premium
    // This approximates what L3 would have been if odds data existed historically
    const premiumRatio = team.baseElo > 0 ? team.premium / team.baseElo : 0;

    l3Daily[team.team] = ts.map((pt) => {
      const eloOdds = pt.eloOdds ?? pt.baseElo;
      // Scale the L3 premium proportionally to the historical rating
      const historicalPremium = pt.baseElo * premiumRatio;
      const l3 = params.marketWeight * (eloOdds + historicalPremium) + params.baseEloWeight * pt.baseElo;
      const oracle = params.oracle.P0 * Math.exp(params.oracle.beta * (l3 - params.oracle.MSI0));
      return {
        date: pt.date,
        baseElo: pt.baseElo,
        l3Rating: Math.round(l3 * 100) / 100,
        oraclePrice: Math.round(oracle * 100) / 100,
      };
    });
  }
  console.log(`  ✓ Computed L3 timeseries for ${Object.keys(l3Daily).length} teams`);

  // 6. Write output
  const runId = generateRunId();
  const runDir = path.join(L3_RUNS, runId);
  ensureDir(runDir);

  const output: L3RunOutput = {
    runId,
    computedAt: now.toISOString(),
    teamCount: l3Ratings.length,
    ratings: l3Ratings,
    params,
  };

  // Write ratings
  fs.writeFileSync(path.join(runDir, "l3_ratings.json"), JSON.stringify(output, null, 2));
  console.log(`  ✓ Wrote l3_ratings.json (${l3Ratings.length} teams)`);

  // Write timeseries
  fs.writeFileSync(path.join(runDir, "l3_daily.json"), JSON.stringify(l3Daily));
  const tsSize = Buffer.byteLength(JSON.stringify(l3Daily));
  console.log(`  ✓ Wrote l3_daily.json (${(tsSize / 1024 / 1024).toFixed(1)} MB)`);

  // Write latest pointer
  const latestPointer = { runId, createdAt: now.toISOString() };
  fs.writeFileSync(path.join(L3_DIR, "latest_run.json"), JSON.stringify(latestPointer, null, 2));
  console.log(`  ✓ Updated latest_run.json → ${runId}`);

  // Summary
  console.log("\n┌─── L3 Top 10 ─────────────────────────────────────────────┐");
  console.log("│ #  Team                    L3      Base    Prem   Oracle$ │");
  console.log("├────────────────────────────────────────────────────────────┤");
  for (const r of l3Ratings.slice(0, 10)) {
    const name = r.team.padEnd(24).substring(0, 24);
    const l3 = r.l3Rating.toFixed(0).padStart(5);
    const base = r.baseElo.toFixed(0).padStart(6);
    const prem = (r.premium > 0 ? "+" : "") + r.premium.toFixed(1);
    const price = "$" + r.oraclePrice.toFixed(0);
    console.log(`│ ${(l3Ratings.indexOf(r) + 1).toString().padStart(2)} ${name} ${l3}  ${base}  ${prem.padStart(6)}  ${price.padStart(6)} │`);
  }
  console.log("└────────────────────────────────────────────────────────────┘");

  console.log(`\n✓ L3 pipeline complete. Run: ${runId}\n`);
}

main().catch((err) => {
  console.error("L3 pipeline failed:", err);
  process.exit(1);
});
