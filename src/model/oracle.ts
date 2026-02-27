/**
 * Oracle price mapping: MSI final rating → price via exponential curve.
 *
 * oracle_price = P0 * exp(beta * (msi_final - MSI0))
 *
 * This is a pure function — no IO.
 */

export interface OracleParams {
  P0: number;    // base price when team is at MSI0
  beta: number;  // sensitivity of price to MSI delta
  MSI0: number;  // anchor MSI rating (league median or global median)
}

export const DEFAULT_ORACLE_PARAMS: OracleParams = {
  P0: 100,
  beta: 0.005,
  MSI0: 1500,
};

export interface OraclePriceResult {
  oraclePrice: number;
  oracleConfidence: number;
  msiFinal: number;
  msiDelta: number;
}

/**
 * Compute oracle price for a team.
 *
 * @param msiFinal     The team's final MSI rating (after all layers)
 * @param confidence   Model confidence (0-1), passed through
 * @param params       Oracle curve params
 */
export function computeOraclePrice(
  msiFinal: number,
  confidence: number,
  params: OracleParams = DEFAULT_ORACLE_PARAMS
): OraclePriceResult {
  const msiDelta = msiFinal - params.MSI0;
  const oraclePrice = params.P0 * Math.exp(params.beta * msiDelta);

  return {
    oraclePrice: Math.round(oraclePrice * 100) / 100,
    oracleConfidence: Math.round(confidence * 1000) / 1000,
    msiFinal,
    msiDelta,
  };
}
