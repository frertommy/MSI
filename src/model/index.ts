/**
 * Model layer — pure deterministic functions, no IO.
 */
export { computeElo, regressTowardMean, DEFAULT_CONFIG } from "./elo";
export type { EloConfig, EloResult, TeamRating } from "./elo";

export { predictedWinProb, calculateOddsAdjustment, normalizeH2H } from "./oddsTransform";

export {
  getPlayerImportance,
  injuryToEloAdjustment,
  calculateTeamInjuryImpact,
} from "./injuries";

export { computeOraclePrice, DEFAULT_ORACLE_PARAMS } from "./oracle";
export type { OracleParams, OraclePriceResult } from "./oracle";
