export interface EloConfig {
  initialRating: number;
  kFactor: number;
  homeAdvantage: number;
  goalMarginFactor: boolean;
  leagueStrength: Record<string, number>;
  leagueBaseline: Record<string, number>;
  seasonRegression: number;
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
  kFactor: 24,
  homeAdvantage: 65,
  goalMarginFactor: true,
  leagueStrength: {
    PL: 1.15,
    PD: 1.05,
    BL1: 1.00,
    SA: 1.00,
    FL1: 0.85,
  },
  leagueBaseline: {
    PL: 1600,
    PD: 1515,
    BL1: 1500,
    SA: 1500,
    FL1: 1470,
  },
  seasonRegression: 0.15,
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
  config: EloConfig,
  league?: string
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

  // League strength multiplier on K-factor
  const leagueMultiplier =
    league && config.leagueStrength ? (config.leagueStrength[league] ?? 1.0) : 1.0;
  const effectiveK = config.kFactor * leagueMultiplier;

  // Rating updates
  const homeNewRating =
    homeRating + effectiveK * G * (homeActual - homeExpected);
  const awayNewRating =
    awayRating + effectiveK * G * (awayActual - awayExpected);

  return { homeNewRating, awayNewRating, homeExpected, awayExpected };
}

export function regressTowardMean(
  rating: number,
  mean: number = 1500,
  factor: number = 0.1
): number {
  return rating + factor * (mean - rating);
}
