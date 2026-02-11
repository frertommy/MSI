import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { generateAllMatchData } from './generateSeedData.js'

const API_KEY = process.env.FOOTBALL_DATA_API_KEY!
const BASE_URL = 'https://api.football-data.org/v4'

const LEAGUES = ['PL', 'PD', 'BL1', 'SA', 'FL1'] as const
const SEASONS = [2023, 2024]

const LEAGUE_COUNTRY: Record<string, string> = {
  PL: 'ENG',
  PD: 'ESP',
  BL1: 'GER',
  SA: 'ITA',
  FL1: 'FRA',
}

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

interface TeamRegistryEntry {
  league: string
  country: string
  matchesPlayed: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchLeagueSeason(league: string, season: number): Promise<any> {
  const url = `${BASE_URL}/competitions/${league}/matches?season=${season}&status=FINISHED`
  console.log(`  Fetching ${league} ${season}-${season + 1}...`)

  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`  ERROR ${res.status} for ${league} ${season}: ${text}`)
    return null
  }

  const data = await res.json()
  console.log(`  Got ${data.matches?.length ?? 0} matches for ${league} ${season}-${season + 1}`)
  return data
}

function parseMatches(raw: any, league: string, season: number): Match[] {
  if (!raw?.matches) return []
  return raw.matches
    .filter((m: any) => m.score?.fullTime?.home != null && m.score?.fullTime?.away != null)
    .map((m: any) => ({
      id: m.id,
      date: m.utcDate,
      league,
      season: `${season}-${season + 1}`,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeGoals: m.score.fullTime.home,
      awayGoals: m.score.fullTime.away,
      matchday: m.matchday,
    }))
}

function buildTeamRegistry(matches: Match[]): Record<string, TeamRegistryEntry> {
  const registry: Record<string, TeamRegistryEntry> = {}

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

  return registry
}

async function fetchFromAPI(): Promise<Match[] | null> {
  const rawDir = path.join('data', 'raw')
  fs.mkdirSync(rawDir, { recursive: true })

  const allMatches: Match[] = []
  let requestCount = 0

  for (const season of SEASONS) {
    for (const league of LEAGUES) {
      if (requestCount > 0) {
        console.log('  Waiting 7s (rate limit)...')
        await sleep(7000)
      }

      try {
        const raw = await fetchLeagueSeason(league, season)
        requestCount++

        if (raw) {
          const filename = `${league}_${season}.json`
          fs.writeFileSync(path.join(rawDir, filename), JSON.stringify(raw, null, 2))
          const matches = parseMatches(raw, league, season)
          allMatches.push(...matches)
        }
      } catch (err: any) {
        console.error(`  Network error for ${league} ${season}: ${err.message}`)
        return null
      }
    }
  }

  if (allMatches.length === 0) return null

  allMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return allMatches
}

async function main() {
  fs.mkdirSync(path.join('data', 'raw'), { recursive: true })

  console.log('Fetching match data from football-data.org...\n')

  let allMatches = await fetchFromAPI()

  if (!allMatches) {
    console.log('\nAPI not reachable. Generating seed data from built-in match simulator...\n')
    allMatches = generateAllMatchData()
    console.log(`Generated ${allMatches.length} simulated matches (5 leagues x 2 seasons)`)
    console.log('NOTE: Replace with real API data when network is available by re-running npm run fetch\n')
  }

  // Sort by date ascending (oldest first)
  allMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  console.log(`Total matches: ${allMatches.length}`)

  // Save combined matches
  fs.writeFileSync(
    path.join('data', 'matches_all.json'),
    JSON.stringify(allMatches, null, 2)
  )
  console.log('Saved data/matches_all.json')

  // Build and save team registry
  const registry = buildTeamRegistry(allMatches)
  const teamCount = Object.keys(registry).length
  fs.writeFileSync(
    path.join('data', 'teams_registry.json'),
    JSON.stringify(registry, null, 2)
  )
  console.log(`Saved data/teams_registry.json (${teamCount} teams)`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
