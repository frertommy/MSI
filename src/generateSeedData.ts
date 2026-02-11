/**
 * Generates realistic match data for all 5 leagues across 2 seasons.
 * Used as fallback when football-data.org API is not reachable.
 * Match results are seeded deterministically for reproducibility.
 */
import * as fs from 'fs'
import * as path from 'path'

interface Match {
  id: number
  date: string
  league: string
  season: string
  homeTeam: string
  awayTeam: string
  homeGoals: number
  awayGoals: number
  matchday: number
}

// Seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const LEAGUES: Record<string, { country: string; teams2023: string[]; teams2024: string[] }> = {
  PL: {
    country: 'ENG',
    teams2023: [
      'Manchester City FC', 'Arsenal FC', 'Liverpool FC', 'Aston Villa FC',
      'Tottenham Hotspur FC', 'Chelsea FC', 'Newcastle United FC', 'Manchester United FC',
      'West Ham United FC', 'Crystal Palace FC', 'Brighton & Hove Albion FC', 'AFC Bournemouth',
      'Fulham FC', 'Wolverhampton Wanderers FC', 'Everton FC', 'Brentford FC',
      'Nottingham Forest FC', 'Luton Town FC', 'Burnley FC', 'Sheffield United FC',
    ],
    teams2024: [
      'Liverpool FC', 'Arsenal FC', 'Manchester City FC', 'Chelsea FC',
      'Nottingham Forest FC', 'Newcastle United FC', 'Aston Villa FC', 'AFC Bournemouth',
      'Brighton & Hove Albion FC', 'Tottenham Hotspur FC', 'Manchester United FC', 'Fulham FC',
      'Brentford FC', 'West Ham United FC', 'Crystal Palace FC', 'Wolverhampton Wanderers FC',
      'Everton FC', 'Ipswich Town FC', 'Leicester City FC', 'Southampton FC',
    ],
  },
  PD: {
    country: 'ESP',
    teams2023: [
      'Real Madrid CF', 'FC Barcelona', 'Girona FC', 'Club Atlético de Madrid',
      'Athletic Club', 'Real Betis Balompié', 'Real Sociedad de Fútbol', 'Villarreal CF',
      'Valencia CF', 'Getafe CF', 'Deportivo Alavés', 'CA Osasuna',
      'Sevilla FC', 'RCD Mallorca', 'UD Las Palmas', 'RC Celta de Vigo',
      'Rayo Vallecano de Madrid', 'Cádiz CF', 'Granada CF', 'UD Almería',
    ],
    teams2024: [
      'FC Barcelona', 'Real Madrid CF', 'Club Atlético de Madrid', 'Athletic Club',
      'Villarreal CF', 'RCD Mallorca', 'Real Betis Balompié', 'Real Sociedad de Fútbol',
      'RC Celta de Vigo', 'CA Osasuna', 'Girona FC', 'Rayo Vallecano de Madrid',
      'Sevilla FC', 'Getafe CF', 'RCD Espanyol de Barcelona', 'UD Las Palmas',
      'Deportivo Alavés', 'Real Valladolid CF', 'CD Leganés', 'Valencia CF',
    ],
  },
  BL1: {
    country: 'GER',
    teams2023: [
      'Bayer 04 Leverkusen', 'VfB Stuttgart', 'FC Bayern München', 'RB Leipzig',
      'Borussia Dortmund', 'Eintracht Frankfurt', 'SC Freiburg', 'TSG 1899 Hoffenheim',
      'VfL Wolfsburg', '1. FC Union Berlin', 'SV Werder Bremen', 'FC Augsburg',
      'Borussia Mönchengladbach', '1. FSV Mainz 05', '1. FC Heidenheim 1846', 'VfL Bochum 1848',
      '1. FC Köln', 'SV Darmstadt 98',
    ],
    teams2024: [
      'FC Bayern München', 'Bayer 04 Leverkusen', 'Eintracht Frankfurt', 'RB Leipzig',
      'Borussia Dortmund', 'SC Freiburg', '1. FSV Mainz 05', 'VfB Stuttgart',
      'SV Werder Bremen', 'VfL Wolfsburg', '1. FC Union Berlin', 'FC Augsburg',
      'Borussia Mönchengladbach', 'TSG 1899 Hoffenheim', 'FC St. Pauli 1910', '1. FC Heidenheim 1846',
      'VfL Bochum 1848', 'Holstein Kiel',
    ],
  },
  SA: {
    country: 'ITA',
    teams2023: [
      'FC Internazionale Milano', 'AC Milan', 'Juventus FC', 'Atalanta BC',
      'Bologna FC 1909', 'AS Roma', 'SS Lazio', 'ACF Fiorentina',
      'SSC Napoli', 'Torino FC', 'AC Monza', 'Genoa CFC',
      'Cagliari Calcio', 'Hellas Verona FC', 'Udinese Calcio', 'Empoli FC',
      'US Lecce', 'Frosinone Calcio', 'US Salernitana 1919', 'US Sassuolo Calcio',
    ],
    teams2024: [
      'SSC Napoli', 'FC Internazionale Milano', 'Atalanta BC', 'SS Lazio',
      'Juventus FC', 'ACF Fiorentina', 'Bologna FC 1909', 'AC Milan',
      'AS Roma', 'Udinese Calcio', 'Torino FC', 'Genoa CFC',
      'Empoli FC', 'Cagliari Calcio', 'Parma Calcio 1913', 'Como 1907',
      'Hellas Verona FC', 'Venezia FC', 'US Lecce', 'AC Monza',
    ],
  },
  FL1: {
    country: 'FRA',
    teams2023: [
      'Paris Saint-Germain FC', 'AS Monaco FC', 'Stade Brestois 29', 'LOSC Lille',
      'OGC Nice', 'Olympique Lyonnais', 'RC Lens', 'Olympique de Marseille',
      'Stade Rennais FC 1901', 'Toulouse FC', 'RC Strasbourg Alsace', 'FC Nantes',
      'Montpellier HSC', 'Stade de Reims', 'FC Metz', 'FC Lorient',
      'Le Havre AC', 'Clermont Foot 63',
    ],
    teams2024: [
      'Paris Saint-Germain FC', 'Olympique de Marseille', 'AS Monaco FC', 'LOSC Lille',
      'Olympique Lyonnais', 'OGC Nice', 'RC Lens', 'Stade Brestois 29',
      'RC Strasbourg Alsace', 'Stade Rennais FC 1901', 'Toulouse FC', 'Stade de Reims',
      'FC Nantes', 'Montpellier HSC', 'AJ Auxerre', 'Angers SCO',
      'AS Saint-Étienne', 'Le Havre AC',
    ],
  },
}

// Team strengths (0-1 scale, higher = stronger). Determines match outcome probabilities.
const TEAM_STRENGTHS: Record<string, number> = {
  // PL
  'Manchester City FC': 0.92, 'Arsenal FC': 0.90, 'Liverpool FC': 0.91,
  'Chelsea FC': 0.78, 'Tottenham Hotspur FC': 0.76, 'Newcastle United FC': 0.77,
  'Manchester United FC': 0.73, 'Aston Villa FC': 0.79, 'West Ham United FC': 0.68,
  'Crystal Palace FC': 0.64, 'Brighton & Hove Albion FC': 0.72, 'AFC Bournemouth': 0.65,
  'Fulham FC': 0.63, 'Wolverhampton Wanderers FC': 0.60, 'Everton FC': 0.55,
  'Brentford FC': 0.66, 'Nottingham Forest FC': 0.62, 'Ipswich Town FC': 0.45,
  'Leicester City FC': 0.50, 'Southampton FC': 0.42, 'Luton Town FC': 0.40,
  'Burnley FC': 0.43, 'Sheffield United FC': 0.38,
  // PD
  'Real Madrid CF': 0.93, 'FC Barcelona': 0.91, 'Club Atlético de Madrid': 0.84,
  'Athletic Club': 0.75, 'Real Sociedad de Fútbol': 0.72, 'Villarreal CF': 0.73,
  'Real Betis Balompié': 0.71, 'Girona FC': 0.70, 'Sevilla FC': 0.66,
  'Valencia CF': 0.58, 'Getafe CF': 0.60, 'CA Osasuna': 0.61,
  'RC Celta de Vigo': 0.59, 'RCD Mallorca': 0.62, 'UD Las Palmas': 0.52,
  'Rayo Vallecano de Madrid': 0.58, 'Deportivo Alavés': 0.50, 'RCD Espanyol de Barcelona': 0.54,
  'Real Valladolid CF': 0.45, 'CD Leganés': 0.47, 'Cádiz CF': 0.42,
  'Granada CF': 0.40, 'UD Almería': 0.38,
  // BL1
  'FC Bayern München': 0.91, 'Bayer 04 Leverkusen': 0.88, 'Borussia Dortmund': 0.83,
  'RB Leipzig': 0.82, 'VfB Stuttgart': 0.77, 'Eintracht Frankfurt': 0.74,
  'SC Freiburg': 0.69, 'VfL Wolfsburg': 0.65, 'TSG 1899 Hoffenheim': 0.62,
  'Borussia Mönchengladbach': 0.63, '1. FSV Mainz 05': 0.61, 'SV Werder Bremen': 0.60,
  'FC Augsburg': 0.56, '1. FC Union Berlin': 0.59, '1. FC Heidenheim 1846': 0.50,
  'VfL Bochum 1848': 0.42, '1. FC Köln': 0.48, 'SV Darmstadt 98': 0.36,
  'FC St. Pauli 1910': 0.52, 'Holstein Kiel': 0.40,
  // SA
  'SSC Napoli': 0.85, 'FC Internazionale Milano': 0.89, 'AC Milan': 0.80,
  'Juventus FC': 0.82, 'Atalanta BC': 0.83, 'AS Roma': 0.74,
  'SS Lazio': 0.75, 'ACF Fiorentina': 0.71, 'Bologna FC 1909': 0.70,
  'Torino FC': 0.62, 'AC Monza': 0.54, 'Genoa CFC': 0.58,
  'Cagliari Calcio': 0.55, 'Hellas Verona FC': 0.50, 'Udinese Calcio': 0.58,
  'Empoli FC': 0.52, 'US Lecce': 0.48, 'Frosinone Calcio': 0.42,
  'US Salernitana 1919': 0.36, 'US Sassuolo Calcio': 0.44,
  'Parma Calcio 1913': 0.53, 'Como 1907': 0.49, 'Venezia FC': 0.43,
  // FL1
  'Paris Saint-Germain FC': 0.90, 'Olympique de Marseille': 0.76,
  'AS Monaco FC': 0.78, 'LOSC Lille': 0.74, 'Olympique Lyonnais': 0.73,
  'OGC Nice': 0.70, 'RC Lens': 0.68, 'Stade Brestois 29': 0.67,
  'Stade Rennais FC 1901': 0.65, 'Toulouse FC': 0.60, 'RC Strasbourg Alsace': 0.58,
  'FC Nantes': 0.55, 'Montpellier HSC': 0.52, 'Stade de Reims': 0.56,
  'AJ Auxerre': 0.48, 'Angers SCO': 0.46, 'AS Saint-Étienne': 0.50,
  'Le Havre AC': 0.44, 'FC Metz': 0.47, 'FC Lorient': 0.45,
  'Clermont Foot 63': 0.42,
}

function simulateMatch(
  homeStrength: number,
  awayStrength: number,
  rng: () => number
): [number, number] {
  // Use an outcome-first approach: determine result, then generate plausible scoreline
  const HOME_ADV = 0.10
  const adjHome = homeStrength + HOME_ADV
  const adjAway = awayStrength

  // Win probability based on strength difference (logistic model)
  const diff = adjHome - adjAway
  const homeWinProb = 0.35 + diff * 1.2 // ~35% base + strength diff scaled
  const drawProb = 0.28 - Math.abs(diff) * 0.5 // draws more likely when teams are close
  const clampedHomeWin = Math.max(0.08, Math.min(0.88, homeWinProb))
  const clampedDraw = Math.max(0.08, Math.min(0.35, drawProb))
  const clampedAwayWin = Math.max(0.04, 1 - clampedHomeWin - clampedDraw)
  const total = clampedHomeWin + clampedDraw + clampedAwayWin

  const r = rng()
  const normHomeWin = clampedHomeWin / total
  const normDraw = clampedDraw / total

  if (r < normHomeWin) {
    // Home win
    const avgStrength = (homeStrength + awayStrength) / 2
    const homeGoals = 1 + poissonSample(0.3 + avgStrength * 0.9, rng)
    const margin = 1 + poissonSample(Math.abs(diff) * 1.5, rng)
    const awayGoals = Math.max(0, homeGoals - margin)
    return [homeGoals, awayGoals]
  } else if (r < normHomeWin + normDraw) {
    // Draw
    const goals = poissonSample(0.5 + (homeStrength + awayStrength) * 0.5, rng)
    return [goals, goals]
  } else {
    // Away win
    const avgStrength = (homeStrength + awayStrength) / 2
    const awayGoals = 1 + poissonSample(0.3 + avgStrength * 0.9, rng)
    const margin = 1 + poissonSample(Math.abs(diff) * 1.5, rng)
    const homeGoals = Math.max(0, awayGoals - margin)
    return [homeGoals, awayGoals]
  }
}

function poissonSample(lambda: number, rng: () => number): number {
  let goals = 0
  let p = Math.exp(-lambda)
  let sum = p
  const r = rng()
  while (sum < r && goals < 8) {
    goals++
    p *= lambda / goals
    sum += p
  }
  return goals
}

function generateSeasonMatches(
  teams: string[],
  league: string,
  seasonYear: number,
  rng: () => number,
  idStart: number
): Match[] {
  const matches: Match[] = []
  const season = `${seasonYear}-${seasonYear + 1}`
  const numTeams = teams.length
  const totalRounds = (numTeams - 1) * 2

  // Generate round-robin schedule (home & away)
  const fixtures: [number, number][] = []
  for (let i = 0; i < numTeams; i++) {
    for (let j = 0; j < numTeams; j++) {
      if (i !== j) fixtures.push([i, j])
    }
  }

  const matchesPerRound = Math.floor(numTeams / 2)

  const seasonStart = new Date(seasonYear === 2023 ? '2023-08-11' : '2024-08-16')

  for (let f = 0; f < fixtures.length; f++) {
    const [homeIdx, awayIdx] = fixtures[f]
    const homeTeam = teams[homeIdx]
    const awayTeam = teams[awayIdx]

    const homeStrength = TEAM_STRENGTHS[homeTeam] || 0.50
    const awayStrength = TEAM_STRENGTHS[awayTeam] || 0.50

    const [homeGoals, awayGoals] = simulateMatch(homeStrength, awayStrength, rng)

    // Date assignment: spread across the season
    const dayOffset = Math.floor((f / fixtures.length) * 280)
    const matchDate = new Date(seasonStart)
    matchDate.setDate(matchDate.getDate() + dayOffset + Math.floor(rng() * 3))

    const matchday = Math.min(Math.floor(f / matchesPerRound) + 1, totalRounds)

    matches.push({
      id: idStart + f,
      date: matchDate.toISOString(),
      league,
      season,
      homeTeam,
      awayTeam,
      homeGoals,
      awayGoals,
      matchday,
    })
  }

  return matches
}

export function generateAllMatchData(): Match[] {
  const rng = mulberry32(42)
  const allMatches: Match[] = []
  let idCounter = 100000

  for (const [league, data] of Object.entries(LEAGUES)) {
    for (const seasonYear of [2023, 2024]) {
      const teams = seasonYear === 2023 ? data.teams2023 : data.teams2024
      const matches = generateSeasonMatches(teams, league, seasonYear, rng, idCounter)
      allMatches.push(...matches)
      idCounter += matches.length
    }
  }

  // Sort by date ascending
  allMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return allMatches
}

if (require.main === module || process.argv[1]?.includes('generateSeedData')) {
  const matches = generateAllMatchData()

  fs.mkdirSync(path.join('data', 'raw'), { recursive: true })

  fs.writeFileSync(
    path.join('data', 'matches_all.json'),
    JSON.stringify(matches, null, 2)
  )
  console.log(`Generated ${matches.length} matches`)

  // Build team registry
  const LEAGUE_COUNTRY: Record<string, string> = {
    PL: 'ENG', PD: 'ESP', BL1: 'GER', SA: 'ITA', FL1: 'FRA',
  }
  const registry: Record<string, any> = {}
  for (const m of matches) {
    for (const team of [m.homeTeam, m.awayTeam]) {
      if (!registry[team]) {
        registry[team] = {
          league: m.league,
          country: LEAGUE_COUNTRY[m.league] || 'UNK',
          matchesPlayed: 0,
        }
      }
      registry[team].matchesPlayed++
    }
  }

  fs.writeFileSync(
    path.join('data', 'teams_registry.json'),
    JSON.stringify(registry, null, 2)
  )
  console.log(`Team registry: ${Object.keys(registry).length} teams`)
}
