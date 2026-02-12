export interface EloConfig {
  initialRating: number;
  kFactor: number;
  homeAdvantage: number;
  goalMarginFactor: boolean;
}

export interface TeamRating {
  team: string;
  rating: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  lastUpdated: string;
  ratingHistory: { date: string; rating: number }[];
}

export const DEFAULT_CONFIG: EloConfig = {
  initialRating: 1500,
  kFactor: 32,
  homeAdvantage: 75,
  goalMarginFactor: true,
};

export interface EloResult {
  homeNewRating: number;
  awayNewRating: number;
  homeExpected: number;
  awayExpected: number;
}

export function computeElo(
  homeRating: number,
  awayRating: number,
  homeGoals: number,
  awayGoals: number,
  config: EloConfig
): EloResult {
  // Expected scores
  const homeExpected =
    1 / (1 + Math.pow(10, (awayRating - homeRating - config.homeAdvantage) / 400));
  const awayExpected = 1 - homeExpected;

  // Actual scores
  let homeActual: number;
  let awayActual: number;
  if (homeGoals > awayGoals) {
    homeActual = 1;
    awayActual = 0;
  } else if (homeGoals < awayGoals) {
    homeActual = 0;
    awayActual = 1;
  } else {
    homeActual = 0.5;
    awayActual = 0.5;
  }

  // Goal margin multiplier
  const goalDiff = Math.abs(homeGoals - awayGoals);
  const G = config.goalMarginFactor ? 1 + Math.log(goalDiff + 1) : 1;

  // Rating updates
  const homeNewRating =
    homeRating + config.kFactor * G * (homeActual - homeExpected);
  const awayNewRating =
    awayRating + config.kFactor * G * (awayActual - awayExpected);

  return { homeNewRating, awayNewRating, homeExpected, awayExpected };
}
