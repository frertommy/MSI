import * as fs from 'fs'
import * as path from 'path'
import { DEFAULT_CONFIG, computeEloUpdate, type EloConfig, type TeamRating } from './elo.js'

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

function main() {
  const config: EloConfig = DEFAULT_CONFIG

  // Load matches
  const matchesPath = path.join('data', 'matches_all.json')
  if (!fs.existsSync(matchesPath)) {
    console.error('No matches file found. Run `npm run fetch` first.')
    process.exit(1)
  }

  const matches: Match[] = JSON.parse(fs.readFileSync(matchesPath, 'utf-8'))
  console.log(`Loaded ${matches.length} matches`)

  // Initialize ratings
  const ratings: Record<string, TeamRating> = {}

  function ensureTeam(name: string) {
    if (!ratings[name]) {
      ratings[name] = {
        team: name,
        rating: config.initialRating,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        lastUpdated: '',
        ratingHistory: [],
      }
    }
  }

  // Process matches chronologically
  for (const match of matches) {
    ensureTeam(match.homeTeam)
    ensureTeam(match.awayTeam)

    const home = ratings[match.homeTeam]
    const away = ratings[match.awayTeam]

    const { newHomeRating, newAwayRating } = computeEloUpdate(
      home.rating,
      away.rating,
      match.homeGoals,
      match.awayGoals,
      config
    )

    home.rating = newHomeRating
    away.rating = newAwayRating

    home.matches++
    away.matches++

    if (match.homeGoals > match.awayGoals) {
      home.wins++
      away.losses++
    } else if (match.homeGoals === match.awayGoals) {
      home.draws++
      away.draws++
    } else {
      home.losses++
      away.wins++
    }

    const dateStr = match.date.split('T')[0]
    home.lastUpdated = dateStr
    away.lastUpdated = dateStr

    home.ratingHistory.push({ date: dateStr, rating: Math.round(newHomeRating) })
    away.ratingHistory.push({ date: dateStr, rating: Math.round(newAwayRating) })
  }

  // Sort by rating descending
  const sortedTeams = Object.values(ratings).sort((a, b) => b.rating - a.rating)

  // Build output
  const output = {
    config: {
      initialRating: config.initialRating,
      kFactor: config.kFactor,
      homeAdvantage: config.homeAdvantage,
      goalMarginFactor: config.goalMarginFactor,
    },
    computedAt: new Date().toISOString(),
    matchesProcessed: matches.length,
    teams: sortedTeams.map(t => ({
      ...t,
      rating: Math.round(t.rating),
    })),
  }

  fs.writeFileSync(
    path.join('data', 'msi_ratings.json'),
    JSON.stringify(output, null, 2)
  )
  console.log(`Saved data/msi_ratings.json (${sortedTeams.length} teams)`)

  // Generate daily snapshots
  console.log('Generating daily snapshots...')
  const dailySnapshots = generateDailySnapshots(ratings, matches)
  fs.writeFileSync(
    path.join('data', 'msi_daily.json'),
    JSON.stringify(dailySnapshots, null, 2)
  )
  console.log('Saved data/msi_daily.json')

  // Print top 10 quick summary
  console.log('\nTop 10 teams:')
  for (let i = 0; i < Math.min(10, sortedTeams.length); i++) {
    const t = sortedTeams[i]
    console.log(
      `  ${String(i + 1).padStart(2)}. ${t.team.padEnd(25)} ${Math.round(t.rating).toString().padStart(4)}  (${t.wins}W-${t.draws}D-${t.losses}L)`
    )
  }
}

function generateDailySnapshots(
  ratings: Record<string, TeamRating>,
  matches: Match[]
): Record<string, { date: string; rating: number }[]> {
  // Find the date range
  const dates = matches.map(m => m.date.split('T')[0])
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]

  // For each team, build daily ratings from their ratingHistory
  const daily: Record<string, { date: string; rating: number }[]> = {}

  for (const [teamName, teamRating] of Object.entries(ratings)) {
    const history = teamRating.ratingHistory
    if (history.length === 0) continue

    const teamDaily: { date: string; rating: number }[] = []
    let histIdx = 0
    let currentRating = 1500 // initial

    // Walk through each day
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      const dayStr = current.toISOString().split('T')[0]

      // Advance through any matches on this day
      while (histIdx < history.length && history[histIdx].date <= dayStr) {
        currentRating = history[histIdx].rating
        histIdx++
      }

      teamDaily.push({ date: dayStr, rating: currentRating })
      current.setDate(current.getDate() + 1)
    }

    daily[teamName] = teamDaily
  }

  return daily
}

main()
