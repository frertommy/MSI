import * as fs from 'fs'
import * as path from 'path'

interface TeamRating {
  team: string
  rating: number
  matches: number
  wins: number
  draws: number
  losses: number
  lastUpdated: string
}

interface RatingsFile {
  config: any
  computedAt: string
  matchesProcessed: number
  teams: TeamRating[]
}

const LEAGUE_COUNTRY: Record<string, string> = {
  PL: 'ENG',
  PD: 'ESP',
  BL1: 'GER',
  SA: 'ITA',
  FL1: 'FRA',
}

function main() {
  const ratingsPath = path.join('data', 'msi_ratings.json')
  if (!fs.existsSync(ratingsPath)) {
    console.error('No ratings file found. Run `npm run compute` first.')
    process.exit(1)
  }

  const data: RatingsFile = JSON.parse(fs.readFileSync(ratingsPath, 'utf-8'))

  // Load team registry for league info
  const registryPath = path.join('data', 'teams_registry.json')
  let registry: Record<string, { league: string; country: string; matchesPlayed: number }> = {}
  if (fs.existsSync(registryPath)) {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
  }

  const computedDate = new Date(data.computedAt).toISOString().split('T')[0]

  console.log()
  console.log(`MSI Rankings — Computed from ${data.matchesProcessed.toLocaleString()} matches`)
  console.log(`Config: K=${data.config.kFactor}, Home=${data.config.homeAdvantage}, GoalMargin=${data.config.goalMarginFactor ? 'yes' : 'no'}`)
  console.log(`Computed: ${computedDate}`)
  console.log('━'.repeat(70))

  const header =
    '#'.padStart(3) +
    '  ' +
    'Team'.padEnd(30) +
    'League'.padStart(7) +
    '  ' +
    'MSI Rating'.padStart(10) +
    '  ' +
    'W-D-L'.padStart(10)

  console.log(header)
  console.log('─'.repeat(70))

  const top30 = data.teams.slice(0, 30)
  for (let i = 0; i < top30.length; i++) {
    const t = top30[i]
    const reg = registry[t.team]
    const league = reg ? LEAGUE_COUNTRY[reg.league] || reg.league : '???'
    const wdl = `${t.wins}-${t.draws}-${t.losses}`

    console.log(
      String(i + 1).padStart(3) +
      '  ' +
      t.team.padEnd(30) +
      league.padStart(7) +
      '  ' +
      String(t.rating).padStart(10) +
      '  ' +
      wdl.padStart(10)
    )
  }

  console.log('━'.repeat(70))

  // League averages
  const leagueRatings: Record<string, number[]> = {}
  for (const t of data.teams) {
    const reg = registry[t.team]
    if (reg) {
      const league = reg.league
      if (!leagueRatings[league]) leagueRatings[league] = []
      leagueRatings[league].push(t.rating)
    }
  }

  console.log('\nLeague Averages:')
  const leagueAvgs = Object.entries(leagueRatings)
    .map(([league, ratings]) => ({
      league,
      avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      count: ratings.length,
    }))
    .sort((a, b) => b.avg - a.avg)

  for (const l of leagueAvgs) {
    console.log(
      `  ${l.league.padEnd(4)} ${LEAGUE_COUNTRY[l.league]?.padEnd(4) || '    '} Avg: ${Math.round(l.avg).toString().padStart(4)}  (${l.count} teams)`
    )
  }
}

main()
