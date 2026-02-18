/**
 * Pure Elo functions — re-exported from the original src/elo.ts.
 * This file exists so that model/ callers don't reach outside the module.
 * The original src/elo.ts is untouched (v0 scripts depend on it).
 */
export {
  computeElo,
  regressTowardMean,
  DEFAULT_CONFIG,
  type EloConfig,
  type EloResult,
  type TeamRating,
} from "../elo";
