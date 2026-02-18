/**
 * L3 Engine — Market-Derived Continuous Pricing
 *
 * Computes L3 ratings by heavily weighting betting market odds (80%)
 * against base Elo (20%). Uses match odds to derive implied team ratings.
 *
 * Formula:
 *   1. For each team, collect all available odds snapshots
 *   2. Convert each match's odds → implied rating via inverse Elo formula
 *   3. Weighted average of implied ratings = market consensus
 *   4. L3 = 0.80 * market_consensus + 0.20 * base_elo
 *   5. Oracle price = P0 * exp(beta * (L3 - MSI0))
 */

import { computeOraclePrice, DEFAULT_ORACLE_PARAMS, type OracleParams } from "../model/oracle";

// ── Types ──────────────────────────────────────────────────────────────

export interface OddsSnapshot {
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  avgOdds: { home: number; draw: number; away: number };
  impliedProb: { home: number; draw: number; away: number };
  bookmakerCount: number;
  league: string;
}

export interface L2Rating {
  team: string;
  league: string;
  msiBase: number;
  msiOdds: number;
  msiFinal: number;
  confidence: number;
}

export interface L3TeamRating {
  team: string;
  league: string;
  l3Rating: number;
  baseElo: number;
  marketConsensus: number;
  premium: number; // l3Rating - baseElo
  oraclePrice: number;
  oracleConfidence: number;
  confidence: number;
  components: {
    matchImplied: number;
    matchCount: number;
    avgWinProb: number;
  };
  timestamp: string;
  dataFreshness: string; // relative description
}

export interface L3RunOutput {
  runId: string;
  computedAt: string;
  teamCount: number;
  ratings: L3TeamRating[];
  params: L3Params;
}

export interface L3Params {
  marketWeight: number;
  baseEloWeight: number;
  oracle: OracleParams;
  matchDecayDays: number;
}

// ── Default params ─────────────────────────────────────────────────────

export const DEFAULT_L3_PARAMS: L3Params = {
  marketWeight: 0.80,
  baseEloWeight: 0.20,
  oracle: DEFAULT_ORACLE_PARAMS,
  matchDecayDays: 7,
};

// ── Core computation ───────────────────────────────────────────────────

/**
 * Convert match win probability + opponent rating → implied team rating
 * Using inverse Elo formula:
 *   winProb = 1 / (1 + 10^((oppRating - teamRating)/400))
 *   => teamRating = oppRating + 400 * log10(winProb / (1 - winProb))
 */
function impliedRatingFromWinProb(winProb: number, opponentRating: number): number {
  // Clamp probability to avoid infinities
  const p = Math.max(0.01, Math.min(0.99, winProb));
  const ratingDiff = 400 * Math.log10(p / (1 - p));
  return opponentRating + ratingDiff;
}

/**
 * Calculate confidence score (0-1) based on data quality.
 */
function calculateConfidence(
  matchCount: number,
  bookmakerAvg: number,
  daysToNearest: number
): number {
  let confidence = 1.0;

  // Penalize for few matches
  if (matchCount === 0) return 0.3;
  if (matchCount < 3) confidence -= 0.15;

  // Penalize for low bookmaker count
  if (bookmakerAvg < 5) confidence -= 0.1;

  // Penalize for distant matches
  if (daysToNearest > 14) confidence -= 0.2;
  else if (daysToNearest > 7) confidence -= 0.1;

  return Math.max(confidence, 0.3);
}

/**
 * Main L3 computation: takes odds snapshots + L2 ratings, produces L3 ratings.
 */
export function computeL3Ratings(
  oddsSnapshots: OddsSnapshot[],
  l2Ratings: L2Rating[],
  params: L3Params = DEFAULT_L3_PARAMS,
  now: Date = new Date()
): L3TeamRating[] {
  // Build a base Elo lookup from L2
  const baseEloMap = new Map<string, L2Rating>();
  for (const r of l2Ratings) {
    baseEloMap.set(r.team, r);
  }

  // Group odds by team
  const teamOddsMap = new Map<string, {
    winProb: number;
    opponentRating: number;
    daysAway: number;
    bookmakerCount: number;
  }[]>();

  for (const snap of oddsSnapshots) {
    const kickoffDate = new Date(snap.kickoff);
    const daysAway = Math.max(0, (kickoffDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Process for home team
    const homeRating = baseEloMap.get(snap.homeTeam);
    const awayRating = baseEloMap.get(snap.awayTeam);

    if (homeRating && awayRating) {
      // Home team entry
      if (!teamOddsMap.has(snap.homeTeam)) teamOddsMap.set(snap.homeTeam, []);
      teamOddsMap.get(snap.homeTeam)!.push({
        winProb: snap.impliedProb.home,
        opponentRating: awayRating.msiBase,
        daysAway,
        bookmakerCount: snap.bookmakerCount,
      });

      // Away team entry
      if (!teamOddsMap.has(snap.awayTeam)) teamOddsMap.set(snap.awayTeam, []);
      teamOddsMap.get(snap.awayTeam)!.push({
        winProb: snap.impliedProb.away,
        opponentRating: homeRating.msiBase,
        daysAway,
        bookmakerCount: snap.bookmakerCount,
      });
    }
  }

  // Compute L3 for each team
  const results: L3TeamRating[] = [];

  for (const l2 of l2Ratings) {
    const oddsEntries = teamOddsMap.get(l2.team) ?? [];

    let marketConsensus: number;
    let matchImplied = 0;
    let avgWinProb = 0;
    let confidence: number;

    if (oddsEntries.length > 0) {
      // Compute implied ratings with time-decay weighting
      let totalWeight = 0;
      let weightedRating = 0;
      let totalWinProb = 0;
      let totalBookmakers = 0;
      let nearestDays = Infinity;

      for (const entry of oddsEntries) {
        const timeWeight = 1.0 / (1.0 + entry.daysAway / params.matchDecayDays);
        const implied = impliedRatingFromWinProb(entry.winProb, entry.opponentRating);

        weightedRating += implied * timeWeight;
        totalWeight += timeWeight;
        totalWinProb += entry.winProb;
        totalBookmakers += entry.bookmakerCount;
        nearestDays = Math.min(nearestDays, entry.daysAway);
      }

      matchImplied = totalWeight > 0 ? weightedRating / totalWeight : l2.msiBase;
      avgWinProb = totalWinProb / oddsEntries.length;
      marketConsensus = matchImplied;

      const avgBooks = totalBookmakers / oddsEntries.length;
      confidence = calculateConfidence(oddsEntries.length, avgBooks, nearestDays);
    } else {
      // No odds data — fall back to L2 with reduced confidence
      marketConsensus = l2.msiFinal;
      confidence = 0.4; // Low confidence without market data
    }

    // Final L3 = weighted blend
    const l3Rating = params.marketWeight * marketConsensus + params.baseEloWeight * l2.msiBase;
    const premium = l3Rating - l2.msiBase;

    // Oracle price from L3 rating
    const oracle = computeOraclePrice(l3Rating, confidence, params.oracle);

    results.push({
      team: l2.team,
      league: l2.league,
      l3Rating: Math.round(l3Rating * 100) / 100,
      baseElo: l2.msiBase,
      marketConsensus: Math.round(marketConsensus * 100) / 100,
      premium: Math.round(premium * 100) / 100,
      oraclePrice: oracle.oraclePrice,
      oracleConfidence: oracle.oracleConfidence,
      confidence: Math.round(confidence * 1000) / 1000,
      components: {
        matchImplied: Math.round(matchImplied * 100) / 100,
        matchCount: oddsEntries.length,
        avgWinProb: Math.round(avgWinProb * 1000) / 1000,
      },
      timestamp: now.toISOString(),
      dataFreshness: oddsEntries.length > 0 ? "current" : "stale",
    });
  }

  // Sort by L3 rating descending
  results.sort((a, b) => b.l3Rating - a.l3Rating);

  return results;
}
