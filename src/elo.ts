export interface EloConfig {
  initialRating: number
  kFactor: number
  homeAdvantage: number
  goalMarginFactor: boolean
}

export interface TeamRating {
  team: string
  rating: number
  matches: number
  wins: number
  draws: number
  losses: number
  lastUpdated: string
  ratingHistory: { date: string; rating: number }[]
}

export const DEFAULT_CONFIG: EloConfig = {
  initialRating: 1500,
  kFactor: 32,
  homeAdvantage: 75,
  goalMarginFactor: true,
}

export function expectedScore(
  ratingHome: number,
  ratingAway: number,
  homeAdvantage: number
): number {
  return 1 / (1 + Math.pow(10, (ratingAway - ratingHome - homeAdvantage) / 400))
}

export function goalMarginMultiplier(goalDiff: number): number {
  return 1 + Math.log(Math.abs(goalDiff) + 1)
}

export function computeEloUpdate(
  ratingHome: number,
  ratingAway: number,
  homeGoals: number,
  awayGoals: number,
  config: EloConfig
): { newHomeRating: number; newAwayRating: number } {
  const eHome = expectedScore(ratingHome, ratingAway, config.homeAdvantage)
  const eAway = 1 - eHome

  let sHome: number
  if (homeGoals > awayGoals) sHome = 1
  else if (homeGoals === awayGoals) sHome = 0.5
  else sHome = 0
  const sAway = 1 - sHome

  const goalDiff = Math.abs(homeGoals - awayGoals)
  const G = config.goalMarginFactor ? goalMarginMultiplier(goalDiff) : 1

  const newHomeRating = ratingHome + config.kFactor * G * (sHome - eHome)
  const newAwayRating = ratingAway + config.kFactor * G * (sAway - eAway)

  return { newHomeRating, newAwayRating }
}
