/**
 * Convert bookmaker odds to Elo adjustments.
 * Exported functions used by computeLive.ts — not a standalone script.
 */

export interface OddsAdjustment {
  team: string;
  baseElo: number;
  predictedWinProb: number;
  marketWinProb: number;
  probGap: number;
  eloAdjustment: number;
  msiLive: number;
}

/**
 * Calculate what our Elo model predicts for win probability.
 */
export function predictedWinProb(
  teamElo: number,
  opponentElo: number,
  isHome: boolean,
  homeAdvantage: number = 65
): number {
  const eloDiff = isHome
    ? teamElo + homeAdvantage - opponentElo
    : teamElo - opponentElo - homeAdvantage;
  return 1 / (1 + Math.pow(10, -eloDiff / 400));
}

/**
 * Calculate Elo adjustment based on gap between market and model.
 *
 * adjustmentWeight: how much we trust the market vs our model (0.15 = 15%)
 * A 5% probability gap ≈ ~35 Elo points before weighting.
 */
export function calculateOddsAdjustment(
  teamElo: number,
  opponentElo: number,
  isHome: boolean,
  marketWinProb: number,
  homeAdvantage: number = 65,
  adjustmentWeight: number = 0.15
): number {
  const predicted = predictedWinProb(
    teamElo,
    opponentElo,
    isHome,
    homeAdvantage
  );

  const probGap = marketWinProb - predicted;

  // Clamp adjusted probability to avoid log(0) / log(negative)
  const adjustedProb = Math.max(0.01, Math.min(0.99, predicted + probGap));
  const clampedPredicted = Math.max(0.01, Math.min(0.99, predicted));

  // Convert probability gap back to Elo points
  const eloFromAdjusted =
    -400 * Math.log10(1 / adjustedProb - 1);
  const eloFromPredicted =
    -400 * Math.log10(1 / clampedPredicted - 1);
  const eloGap = eloFromAdjusted - eloFromPredicted;

  return eloGap * adjustmentWeight;
}

/**
 * Normalize home/away win probs by excluding draws for h2h comparison.
 */
export function normalizeH2H(
  homeProb: number,
  awayProb: number
): { home: number; away: number } {
  const total = homeProb + awayProb;
  if (total === 0) return { home: 0.5, away: 0.5 };
  return {
    home: homeProb / total,
    away: awayProb / total,
  };
}
