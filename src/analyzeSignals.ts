import * as fs from "fs";
import * as path from "path";

interface LayerSnapshot {
  date: string;
  baseElo: number;
  eloOdds: number;
  eloOddsInjuries: number;
  eloOddsInjuriesNews: number;
}

interface MatchOdds {
  avgHome: number;
  avgDraw: number;
  avgAway: number;
}

interface Match {
  id: number;
  date: string;
  league: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  matchday: number;
  odds: MatchOdds | null;
}

interface DeltaStats {
  mean: number;
  stdDev: number;
  maxPositive: number;
  maxNegative: number;
  correlation: number;
}

interface TeamSignalMetrics {
  team: string;
  league: string;
  totalMatches: number;
  totalDataPoints: number;
  matchDayVolatility: {
    baseElo: number;
    eloOdds: number;
    eloOddsInjuries: number;
    eloOddsInjuriesNews: number;
  };
  betweenMatchVolatility: {
    baseElo: number;
    eloOdds: number;
    eloOddsInjuries: number;
    eloOddsInjuriesNews: number;
  };
  movementDays: {
    baseElo: number;
    eloOdds: number;
    eloOddsInjuries: number;
    eloOddsInjuriesNews: number;
  };
  deltaFromBase: {
    odds: DeltaStats;
    injuries: DeltaStats;
    news: DeltaStats;
  };
  preMatchDirectionAccuracy: {
    totalPredictions: number;
    correctDirection: number;
    accuracy: number;
  };
}

interface AggregateSignalMetrics {
  totalTeams: number;
  totalMatches: number;
  avgMatchDayVolatility: { baseElo: number; eloOdds: number; injuries: number; news: number };
  avgBetweenMatchVolatility: { baseElo: number; eloOdds: number; injuries: number; news: number };
  avgMovementDaysPerMonth: { baseElo: number; eloOdds: number; injuries: number; news: number };
  avgPreMatchDirectionAccuracy: number;
  totalMovement: { baseElo: number; eloOdds: number; injuries: number; news: number };
  movementMultiplier: { eloOdds: number; injuries: number; news: number };
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / (arr.length - 1));
}

function correlation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const xd = xs[i] - mx;
    const yd = ys[i] - my;
    num += xd * yd;
    dx += xd * xd;
    dy += yd * yd;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function main() {
  const dataDir = path.join(__dirname, "..", "data");

  const dailyFile = path.join(dataDir, "msi_multilayer_daily.json");
  const matchesFile = path.join(dataDir, "matches_all.json");
  const registryFile = path.join(dataDir, "teams_registry.json");

  if (!fs.existsSync(dailyFile) || !fs.existsSync(matchesFile)) {
    console.error("Required data files not found. Run compute:multilayer first.");
    process.exit(1);
  }

  const dailySnapshots: Record<string, LayerSnapshot[]> = JSON.parse(
    fs.readFileSync(dailyFile, "utf-8")
  );
  const matches: Match[] = JSON.parse(fs.readFileSync(matchesFile, "utf-8"));
  const teamRegistry: Record<string, { league: string; country: string; matchesPlayed: number }> =
    fs.existsSync(registryFile)
      ? JSON.parse(fs.readFileSync(registryFile, "utf-8"))
      : {};

  console.log(`Loaded ${Object.keys(dailySnapshots).length} teams, ${matches.length} matches`);

  // Build match date sets per team
  const teamMatchDates: Record<string, Set<string>> = {};
  const teamMatchResults: Record<string, { date: string; won: boolean; lost: boolean }[]> = {};

  for (const match of matches) {
    const dateStr = match.date.substring(0, 10);
    const homeWon = match.homeGoals > match.awayGoals;
    const awayWon = match.awayGoals > match.homeGoals;

    for (const [team, isHome] of [
      [match.homeTeam, true],
      [match.awayTeam, false],
    ] as [string, boolean][]) {
      if (!teamMatchDates[team]) teamMatchDates[team] = new Set();
      teamMatchDates[team].add(dateStr);

      if (!teamMatchResults[team]) teamMatchResults[team] = [];
      teamMatchResults[team].push({
        date: dateStr,
        won: isHome ? homeWon : awayWon,
        lost: isHome ? awayWon : homeWon,
      });
    }
  }

  // Compute per-team metrics
  const perTeam: Record<string, TeamSignalMetrics> = {};

  for (const [team, snapshots] of Object.entries(dailySnapshots)) {
    if (snapshots.length < 2) continue;

    const matchDates = teamMatchDates[team] || new Set();
    const matchResults = teamMatchResults[team] || [];
    const league = teamRegistry[team]?.league || "";

    // Classify each data point and compute changes
    const matchDayChanges = { baseElo: [] as number[], eloOdds: [] as number[], injuries: [] as number[], news: [] as number[] };
    const betweenMatchChanges = { baseElo: [] as number[], eloOdds: [] as number[], injuries: [] as number[], news: [] as number[] };
    const movementDays = { baseElo: 0, eloOdds: 0, eloOddsInjuries: 0, eloOddsInjuriesNews: 0 };

    const oddsDeltas: number[] = [];
    const injuriesDeltas: number[] = [];
    const newsDeltas: number[] = [];

    // Total absolute movement
    let totalBaseMove = 0;
    let totalOddsMove = 0;
    let totalInjMove = 0;
    let totalNewsMove = 0;

    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      const isMatchDay = matchDates.has(curr.date);

      const baseChange = Math.abs(curr.baseElo - prev.baseElo);
      const oddsChange = Math.abs(curr.eloOdds - prev.eloOdds);
      const injChange = Math.abs(curr.eloOddsInjuries - prev.eloOddsInjuries);
      const newsChange = Math.abs(curr.eloOddsInjuriesNews - prev.eloOddsInjuriesNews);

      totalBaseMove += baseChange;
      totalOddsMove += oddsChange;
      totalInjMove += injChange;
      totalNewsMove += newsChange;

      if (baseChange > 0.01) movementDays.baseElo++;
      if (oddsChange > 0.01) movementDays.eloOdds++;
      if (injChange > 0.01) movementDays.eloOddsInjuries++;
      if (newsChange > 0.01) movementDays.eloOddsInjuriesNews++;

      const target = isMatchDay ? matchDayChanges : betweenMatchChanges;
      target.baseElo.push(baseChange);
      target.eloOdds.push(oddsChange);
      target.injuries.push(injChange);
      target.news.push(newsChange);

      // Deltas from base
      oddsDeltas.push(curr.eloOdds - curr.baseElo);
      injuriesDeltas.push(curr.eloOddsInjuries - curr.baseElo);
      newsDeltas.push(curr.eloOddsInjuriesNews - curr.baseElo);
    }

    // Pre-match direction accuracy
    // For each match, check if the odds delta predicted the correct direction
    let dirCorrect = 0;
    let dirTotal = 0;

    // Build snapshot lookup by date
    const snapByDate: Record<string, LayerSnapshot> = {};
    for (const s of snapshots) snapByDate[s.date] = s;

    for (const result of matchResults) {
      const snap = snapByDate[result.date];
      if (!snap) continue;

      const delta = snap.eloOdds - snap.baseElo;
      if (Math.abs(delta) < 2) continue; // No signal

      dirTotal++;
      // Delta > 0 means odds rate team higher; we expect them to win
      if (delta > 0 && result.won) dirCorrect++;
      if (delta < 0 && result.lost) dirCorrect++;
    }

    function computeDeltaStats(deltas: number[], results: { date: string; won: boolean; lost: boolean }[]): DeltaStats {
      // Build result scores for correlation: +1 win, 0 draw, -1 loss
      const resultScores: number[] = [];
      const deltaForCorr: number[] = [];
      for (const r of results) {
        const snap = snapByDate[r.date];
        if (!snap) continue;
        deltaForCorr.push(snap.eloOdds - snap.baseElo);
        resultScores.push(r.won ? 1 : r.lost ? -1 : 0);
      }

      return {
        mean: mean(deltas),
        stdDev: stdDev(deltas),
        maxPositive: deltas.length > 0 ? Math.max(...deltas) : 0,
        maxNegative: deltas.length > 0 ? Math.min(...deltas) : 0,
        correlation: correlation(deltaForCorr, resultScores),
      };
    }

    // Compute date range for monthly rate
    const firstDate = new Date(snapshots[0].date);
    const lastDate = new Date(snapshots[snapshots.length - 1].date);
    const months = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));

    perTeam[team] = {
      team,
      league,
      totalMatches: matchDates.size,
      totalDataPoints: snapshots.length,
      matchDayVolatility: {
        baseElo: mean(matchDayChanges.baseElo),
        eloOdds: mean(matchDayChanges.eloOdds),
        eloOddsInjuries: mean(matchDayChanges.injuries),
        eloOddsInjuriesNews: mean(matchDayChanges.news),
      },
      betweenMatchVolatility: {
        baseElo: mean(betweenMatchChanges.baseElo),
        eloOdds: mean(betweenMatchChanges.eloOdds),
        eloOddsInjuries: mean(betweenMatchChanges.injuries),
        eloOddsInjuriesNews: mean(betweenMatchChanges.news),
      },
      movementDays: {
        baseElo: Math.round((movementDays.baseElo / months) * 10) / 10,
        eloOdds: Math.round((movementDays.eloOdds / months) * 10) / 10,
        eloOddsInjuries: Math.round((movementDays.eloOddsInjuries / months) * 10) / 10,
        eloOddsInjuriesNews: Math.round((movementDays.eloOddsInjuriesNews / months) * 10) / 10,
      },
      deltaFromBase: {
        odds: computeDeltaStats(oddsDeltas, matchResults),
        injuries: computeDeltaStats(injuriesDeltas, matchResults),
        news: computeDeltaStats(newsDeltas, matchResults),
      },
      preMatchDirectionAccuracy: {
        totalPredictions: dirTotal,
        correctDirection: dirCorrect,
        accuracy: dirTotal > 0 ? Math.round((dirCorrect / dirTotal) * 1000) / 10 : 0,
      },
    };
  }

  // Aggregate metrics (match-weighted)
  const teamMetrics = Object.values(perTeam);
  let totalMatches = 0;
  let totalTeams = teamMetrics.length;

  const agg = {
    matchDayVol: { baseElo: 0, eloOdds: 0, injuries: 0, news: 0 },
    betweenMatchVol: { baseElo: 0, eloOdds: 0, injuries: 0, news: 0 },
    movementPerMonth: { baseElo: 0, eloOdds: 0, injuries: 0, news: 0 },
    directionAccTotal: 0,
    directionAccCorrect: 0,
    totalMovement: { baseElo: 0, eloOdds: 0, injuries: 0, news: 0 },
  };

  for (const tm of teamMetrics) {
    const w = tm.totalMatches;
    totalMatches += w;

    agg.matchDayVol.baseElo += tm.matchDayVolatility.baseElo * w;
    agg.matchDayVol.eloOdds += tm.matchDayVolatility.eloOdds * w;
    agg.matchDayVol.injuries += tm.matchDayVolatility.eloOddsInjuries * w;
    agg.matchDayVol.news += tm.matchDayVolatility.eloOddsInjuriesNews * w;

    agg.betweenMatchVol.baseElo += tm.betweenMatchVolatility.baseElo * w;
    agg.betweenMatchVol.eloOdds += tm.betweenMatchVolatility.eloOdds * w;
    agg.betweenMatchVol.injuries += tm.betweenMatchVolatility.eloOddsInjuries * w;
    agg.betweenMatchVol.news += tm.betweenMatchVolatility.eloOddsInjuriesNews * w;

    agg.movementPerMonth.baseElo += tm.movementDays.baseElo * w;
    agg.movementPerMonth.eloOdds += tm.movementDays.eloOdds * w;
    agg.movementPerMonth.injuries += tm.movementDays.eloOddsInjuries * w;
    agg.movementPerMonth.news += tm.movementDays.eloOddsInjuriesNews * w;

    agg.directionAccTotal += tm.preMatchDirectionAccuracy.totalPredictions;
    agg.directionAccCorrect += tm.preMatchDirectionAccuracy.correctDirection;
  }

  // Compute total movement from raw snapshots
  for (const [, snapshots] of Object.entries(dailySnapshots)) {
    for (let i = 1; i < snapshots.length; i++) {
      agg.totalMovement.baseElo += Math.abs(snapshots[i].baseElo - snapshots[i - 1].baseElo);
      agg.totalMovement.eloOdds += Math.abs(snapshots[i].eloOdds - snapshots[i - 1].eloOdds);
      agg.totalMovement.injuries += Math.abs(snapshots[i].eloOddsInjuries - snapshots[i - 1].eloOddsInjuries);
      agg.totalMovement.news += Math.abs(snapshots[i].eloOddsInjuriesNews - snapshots[i - 1].eloOddsInjuriesNews);
    }
  }

  const aggregate: AggregateSignalMetrics = {
    totalTeams,
    totalMatches,
    avgMatchDayVolatility: {
      baseElo: Math.round((agg.matchDayVol.baseElo / totalMatches) * 10) / 10,
      eloOdds: Math.round((agg.matchDayVol.eloOdds / totalMatches) * 10) / 10,
      injuries: Math.round((agg.matchDayVol.injuries / totalMatches) * 10) / 10,
      news: Math.round((agg.matchDayVol.news / totalMatches) * 10) / 10,
    },
    avgBetweenMatchVolatility: {
      baseElo: Math.round((agg.betweenMatchVol.baseElo / totalMatches) * 10) / 10,
      eloOdds: Math.round((agg.betweenMatchVol.eloOdds / totalMatches) * 10) / 10,
      injuries: Math.round((agg.betweenMatchVol.injuries / totalMatches) * 10) / 10,
      news: Math.round((agg.betweenMatchVol.news / totalMatches) * 10) / 10,
    },
    avgMovementDaysPerMonth: {
      baseElo: Math.round((agg.movementPerMonth.baseElo / totalMatches) * 10) / 10,
      eloOdds: Math.round((agg.movementPerMonth.eloOdds / totalMatches) * 10) / 10,
      injuries: Math.round((agg.movementPerMonth.injuries / totalMatches) * 10) / 10,
      news: Math.round((agg.movementPerMonth.news / totalMatches) * 10) / 10,
    },
    avgPreMatchDirectionAccuracy:
      agg.directionAccTotal > 0
        ? Math.round((agg.directionAccCorrect / agg.directionAccTotal) * 1000) / 10
        : 0,
    totalMovement: {
      baseElo: Math.round(agg.totalMovement.baseElo),
      eloOdds: Math.round(agg.totalMovement.eloOdds),
      injuries: Math.round(agg.totalMovement.injuries),
      news: Math.round(agg.totalMovement.news),
    },
    movementMultiplier: {
      eloOdds:
        agg.totalMovement.baseElo > 0
          ? Math.round((agg.totalMovement.eloOdds / agg.totalMovement.baseElo) * 100) / 100
          : 1,
      injuries:
        agg.totalMovement.baseElo > 0
          ? Math.round((agg.totalMovement.injuries / agg.totalMovement.baseElo) * 100) / 100
          : 1,
      news:
        agg.totalMovement.baseElo > 0
          ? Math.round((agg.totalMovement.news / agg.totalMovement.baseElo) * 100) / 100
          : 1,
    },
  };

  // Round per-team metrics for cleaner output
  for (const tm of Object.values(perTeam)) {
    tm.matchDayVolatility.baseElo = Math.round(tm.matchDayVolatility.baseElo * 10) / 10;
    tm.matchDayVolatility.eloOdds = Math.round(tm.matchDayVolatility.eloOdds * 10) / 10;
    tm.matchDayVolatility.eloOddsInjuries = Math.round(tm.matchDayVolatility.eloOddsInjuries * 10) / 10;
    tm.matchDayVolatility.eloOddsInjuriesNews = Math.round(tm.matchDayVolatility.eloOddsInjuriesNews * 10) / 10;
    tm.betweenMatchVolatility.baseElo = Math.round(tm.betweenMatchVolatility.baseElo * 10) / 10;
    tm.betweenMatchVolatility.eloOdds = Math.round(tm.betweenMatchVolatility.eloOdds * 10) / 10;
    tm.betweenMatchVolatility.eloOddsInjuries = Math.round(tm.betweenMatchVolatility.eloOddsInjuries * 10) / 10;
    tm.betweenMatchVolatility.eloOddsInjuriesNews = Math.round(tm.betweenMatchVolatility.eloOddsInjuriesNews * 10) / 10;
    tm.deltaFromBase.odds.mean = Math.round(tm.deltaFromBase.odds.mean * 10) / 10;
    tm.deltaFromBase.odds.stdDev = Math.round(tm.deltaFromBase.odds.stdDev * 10) / 10;
    tm.deltaFromBase.odds.maxPositive = Math.round(tm.deltaFromBase.odds.maxPositive * 10) / 10;
    tm.deltaFromBase.odds.maxNegative = Math.round(tm.deltaFromBase.odds.maxNegative * 10) / 10;
    tm.deltaFromBase.odds.correlation = Math.round(tm.deltaFromBase.odds.correlation * 1000) / 1000;
    tm.deltaFromBase.injuries.mean = Math.round(tm.deltaFromBase.injuries.mean * 10) / 10;
    tm.deltaFromBase.injuries.stdDev = Math.round(tm.deltaFromBase.injuries.stdDev * 10) / 10;
    tm.deltaFromBase.injuries.maxPositive = Math.round(tm.deltaFromBase.injuries.maxPositive * 10) / 10;
    tm.deltaFromBase.injuries.maxNegative = Math.round(tm.deltaFromBase.injuries.maxNegative * 10) / 10;
    tm.deltaFromBase.injuries.correlation = Math.round(tm.deltaFromBase.injuries.correlation * 1000) / 1000;
    tm.deltaFromBase.news.mean = Math.round(tm.deltaFromBase.news.mean * 10) / 10;
    tm.deltaFromBase.news.stdDev = Math.round(tm.deltaFromBase.news.stdDev * 10) / 10;
    tm.deltaFromBase.news.maxPositive = Math.round(tm.deltaFromBase.news.maxPositive * 10) / 10;
    tm.deltaFromBase.news.maxNegative = Math.round(tm.deltaFromBase.news.maxNegative * 10) / 10;
    tm.deltaFromBase.news.correlation = Math.round(tm.deltaFromBase.news.correlation * 1000) / 1000;
  }

  // Save
  const output = {
    computedAt: new Date().toISOString(),
    aggregate,
    perTeam,
  };

  const outFile = path.join(dataDir, "msi_signal_analysis.json");
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${outFile}`);

  // Print summary
  console.log("\n━━━ Signal Analysis Summary ━━━");
  console.log(`Teams: ${aggregate.totalTeams}, Matches: ${aggregate.totalMatches}`);
  console.log(`\nMatch-day volatility (avg pts):`);
  console.log(`  Base Elo:    ${aggregate.avgMatchDayVolatility.baseElo}`);
  console.log(`  +Odds:       ${aggregate.avgMatchDayVolatility.eloOdds}`);
  console.log(`\nBetween-match volatility (avg pts):`);
  console.log(`  Base Elo:    ${aggregate.avgBetweenMatchVolatility.baseElo}`);
  console.log(`  +Odds:       ${aggregate.avgBetweenMatchVolatility.eloOdds}`);
  console.log(`\nMovement days per month:`);
  console.log(`  Base Elo:    ${aggregate.avgMovementDaysPerMonth.baseElo}`);
  console.log(`  +Odds:       ${aggregate.avgMovementDaysPerMonth.eloOdds}`);
  console.log(`\nDirection accuracy: ${aggregate.avgPreMatchDirectionAccuracy}%`);
  console.log(`\nTotal movement (10 seasons):`);
  console.log(`  Base Elo:    ${aggregate.totalMovement.baseElo.toLocaleString()}`);
  console.log(`  +Odds:       ${aggregate.totalMovement.eloOdds.toLocaleString()}`);
  console.log(`  Multiplier:  ${aggregate.movementMultiplier.eloOdds}x (+${Math.round((aggregate.movementMultiplier.eloOdds - 1) * 100)}%)`);
}

main();
